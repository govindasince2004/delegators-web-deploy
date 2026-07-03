import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

export type GoogleWorkspaceVaultRecord = {
  provider: 'google_workspace';
  email: string;
  scopes: string[];
  refresh_token: string;
  access_token?: string;
  access_token_expires_at?: string;
  connected_at: string;
};

export type Microsoft365VaultRecord = {
  provider: 'microsoft_365';
  email: string;
  scopes: string[];
  refresh_token: string;
  access_token?: string;
  access_token_expires_at?: string;
  connected_at: string;
};

export type IntegrationProvider = 'google_workspace' | 'microsoft_365';

function vaultRoot(env: NodeJS.ProcessEnv = process.env): string {
  return env.WORKBENCH_INTEGRATION_VAULT_ROOT?.trim() || path.join(process.cwd(), '.data', 'integration-vault');
}

export function integrationVaultKey(env: NodeJS.ProcessEnv = process.env): Buffer | null {
  const raw = env.WORKBENCH_INTEGRATION_VAULT_KEY?.trim();
  if (!raw) return null;
  const decoded = Buffer.from(raw, 'base64');
  if (decoded.length !== 32) return null;
  return decoded;
}

export function requireIntegrationVaultKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const key = integrationVaultKey(env);
  if (!key) {
    throw new Error(
      'WORKBENCH_INTEGRATION_VAULT_KEY must be a base64-encoded 32-byte key when integrations are enabled.'
    );
  }
  return key;
}

export function vaultBlobPath(subject: string, provider: IntegrationProvider, env: NodeJS.ProcessEnv = process.env): string {
  const digest = createHash('sha256').update(subject).digest('hex');
  return path.join(vaultRoot(env), provider, `${digest}.enc`);
}

export function signOpaqueTicket(payload: Record<string, unknown>, env: NodeJS.ProcessEnv = process.env): string {
  const key = requireIntegrationVaultKey(env);
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = createHmac('sha256', key).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyOpaqueTicket<T extends Record<string, unknown>>(
  ticket: string,
  env: NodeJS.ProcessEnv = process.env
): T | null {
  const key = integrationVaultKey(env);
  if (!key) return null;
  const [body, sig] = ticket.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', key).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

export async function encryptJson(value: unknown, env: NodeJS.ProcessEnv = process.env): Promise<string> {
  const key = requireIntegrationVaultKey(env);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

export async function decryptJson<T>(blob: string, env: NodeJS.ProcessEnv = process.env): Promise<T> {
  const key = requireIntegrationVaultKey(env);
  const packed = Buffer.from(blob, 'base64url');
  if (packed.length < IV_BYTES + TAG_BYTES + 1) {
    throw new Error('Encrypted integration blob is corrupt.');
  }
  const iv = packed.subarray(0, IV_BYTES);
  const tag = packed.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = packed.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8')) as T;
}

export async function writeGoogleWorkspaceRecord(
  subject: string,
  record: GoogleWorkspaceVaultRecord,
  env: NodeJS.ProcessEnv = process.env
): Promise<void> {
  const filePath = vaultBlobPath(subject, 'google_workspace', env);
  await mkdir(path.dirname(filePath), { recursive: true });
  const encrypted = await encryptJson(record, env);
  await writeFile(filePath, `${encrypted}\n`, { encoding: 'utf8', mode: 0o600 });
}

export async function readGoogleWorkspaceRecord(
  subject: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<GoogleWorkspaceVaultRecord | null> {
  const filePath = vaultBlobPath(subject, 'google_workspace', env);
  try {
    const raw = await readFile(filePath, 'utf8');
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const record = await decryptJson<GoogleWorkspaceVaultRecord>(trimmed, env);
    return record?.provider === 'google_workspace' ? record : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function deleteGoogleWorkspaceRecord(
  subject: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<boolean> {
  const filePath = vaultBlobPath(subject, 'google_workspace', env);
  try {
    await rm(filePath, { force: true });
    return true;
  } catch {
    return false;
  }
}

export async function writeMicrosoft365Record(
  subject: string,
  record: Microsoft365VaultRecord,
  env: NodeJS.ProcessEnv = process.env
): Promise<void> {
  const filePath = vaultBlobPath(subject, 'microsoft_365', env);
  await mkdir(path.dirname(filePath), { recursive: true });
  const encrypted = await encryptJson(record, env);
  await writeFile(filePath, `${encrypted}\n`, { encoding: 'utf8', mode: 0o600 });
}

export async function readMicrosoft365Record(
  subject: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<Microsoft365VaultRecord | null> {
  const filePath = vaultBlobPath(subject, 'microsoft_365', env);
  try {
    const raw = await readFile(filePath, 'utf8');
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const record = await decryptJson<Microsoft365VaultRecord>(trimmed, env);
    return record?.provider === 'microsoft_365' ? record : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function deleteMicrosoft365Record(
  subject: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<boolean> {
  const filePath = vaultBlobPath(subject, 'microsoft_365', env);
  try {
    await rm(filePath, { force: true });
    return true;
  } catch {
    return false;
  }
}

export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf('@');
  if (at <= 1) return '••••@••••';
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const maskedLocal = `${local.slice(0, 1)}${'•'.repeat(Math.max(2, local.length - 2))}${local.slice(-1)}`;
  const dot = domain.lastIndexOf('.');
  if (dot <= 0) return `${maskedLocal}@••••`;
  return `${maskedLocal}@${domain.slice(0, 1)}••••${domain.slice(dot)}`;
}