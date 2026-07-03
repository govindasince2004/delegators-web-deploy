import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  decryptJson,
  deleteGoogleWorkspaceRecord,
  encryptJson,
  maskEmail,
  readGoogleWorkspaceRecord,
  signOpaqueTicket,
  verifyOpaqueTicket,
  writeGoogleWorkspaceRecord
} from '../server/integrationVault';

const VAULT_KEY = Buffer.alloc(32, 7).toString('base64');
let tempRoot = '';

afterEach(async () => {
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true });
    tempRoot = '';
  }
  delete process.env.WORKBENCH_INTEGRATION_VAULT_KEY;
  delete process.env.WORKBENCH_INTEGRATION_VAULT_ROOT;
});

async function withVaultEnv(run: () => Promise<void>): Promise<void> {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), 'wb-vault-'));
  process.env.WORKBENCH_INTEGRATION_VAULT_KEY = VAULT_KEY;
  process.env.WORKBENCH_INTEGRATION_VAULT_ROOT = tempRoot;
  await run();
}

describe('integration vault', () => {
  it('encrypts and decrypts integration payloads', async () => {
    await withVaultEnv(async () => {
      const encrypted = await encryptJson({ secret: 'refresh_token_value' });
      const decrypted = await decryptJson<{ secret: string }>(encrypted);
      expect(decrypted.secret).toBe('refresh_token_value');
    });
  });

  it('signs and verifies opaque oauth tickets', async () => {
    await withVaultEnv(async () => {
      const ticket = signOpaqueTicket({ kind: 'google_oauth', subject: 'clerk:abc', exp: Date.now() + 60_000 });
      const payload = verifyOpaqueTicket<{ kind: string; subject: string }>(ticket);
      expect(payload?.kind).toBe('google_oauth');
      expect(payload?.subject).toBe('clerk:abc');
    });
  });

  it('stores google workspace records encrypted on disk', async () => {
    await withVaultEnv(async () => {
      await writeGoogleWorkspaceRecord('clerk:test-user', {
        provider: 'google_workspace',
        email: 'builder@example.com',
        scopes: ['drive.readonly'],
        refresh_token: 'rt_123',
        connected_at: new Date().toISOString()
      });
      const record = await readGoogleWorkspaceRecord('clerk:test-user');
      expect(record?.email).toBe('builder@example.com');
      const encFiles = await readdir(path.join(tempRoot, 'google_workspace'));
      const blob = await readFile(path.join(tempRoot, 'google_workspace', encFiles[0]!), 'utf8');
      expect(blob).not.toContain('rt_123');
      await deleteGoogleWorkspaceRecord('clerk:test-user');
      expect(await readGoogleWorkspaceRecord('clerk:test-user')).toBeNull();
    });
  });

  it('masks email addresses for the UI', () => {
    expect(maskEmail('builder@example.com')).toMatch(/^b•+r@e•+\.com$/);
  });
});