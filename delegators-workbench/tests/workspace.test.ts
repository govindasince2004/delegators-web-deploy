import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanupExpiredWorkspaces,
  createWorkspace,
  listWorkspace,
  readWorkspaceText,
  recordWorkspaceCheckpoint,
  resolveWorkspacePath,
  workspaceTtlMs,
  writeWorkspaceText
} from '../server/workspace';

let tempRoot = '';

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'dw-workspace-test-'));
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(tempRoot, { recursive: true, force: true });
});

describe('Workbench workspace', () => {
  it('retains thread workspaces for the full 30-day wallet window by default', () => {
    vi.stubEnv('WORKBENCH_WORKSPACE_TTL_MS', '');
    expect(workspaceTtlMs()).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('isolates files under a hashed session workspace', async () => {
    const workspace = await createWorkspace({
      sessionKey: 'sess_test_workspace_1234567890',
      baseRoot: tempRoot
    });

    expect(workspace.root).toContain(tempRoot);
    expect(workspace.root).not.toContain('sess_test_workspace_1234567890');

    await writeWorkspaceText(workspace, 'drafts/outline.md', '# Outline');
    await expect(readWorkspaceText(workspace, 'drafts/outline.md')).resolves.toBe('# Outline');
    await expect(listWorkspace(workspace)).resolves.toMatchObject({
      files: [{ path: 'drafts/outline.md', bytes: 9 }],
      totalBytes: 9
    });
  });

  it('reuses a stable hashed workspace for the same thread', async () => {
    const first = await createWorkspace({
      sessionKey: 'sess_test_workspace_1234567890',
      workspaceKey: 'thread-abc',
      baseRoot: tempRoot
    });
    await writeWorkspaceText(first, 'drafts/outline.md', '# Outline');

    const second = await createWorkspace({
      sessionKey: 'sess_test_workspace_1234567890',
      workspaceKey: 'thread-abc',
      baseRoot: tempRoot
    });

    expect(second.root).toBe(first.root);
    expect(second.id).toBe(first.id);
    expect(second.id).not.toContain('thread-abc');
    await expect(readWorkspaceText(second, 'drafts/outline.md')).resolves.toBe('# Outline');
  });

  it('keeps stable thread workspaces isolated by session and thread key', async () => {
    const first = await createWorkspace({
      sessionKey: 'sess_test_workspace_1234567890',
      workspaceKey: 'thread-abc',
      baseRoot: tempRoot
    });
    const otherThread = await createWorkspace({
      sessionKey: 'sess_test_workspace_1234567890',
      workspaceKey: 'thread-def',
      baseRoot: tempRoot
    });
    const otherSession = await createWorkspace({
      sessionKey: 'sess_other_workspace_1234567890',
      workspaceKey: 'thread-abc',
      baseRoot: tempRoot
    });

    expect(otherThread.root).not.toBe(first.root);
    expect(otherSession.root).not.toBe(first.root);
    expect(first.root).toContain(tempRoot);
    expect(otherThread.root).toContain(tempRoot);
    expect(otherSession.root).toContain(tempRoot);
  });

  it('hashes suspicious thread keys instead of treating them as paths', async () => {
    const workspace = await createWorkspace({
      sessionKey: 'sess_test_workspace_1234567890',
      workspaceKey: '../../outside',
      baseRoot: tempRoot
    });

    expect(workspace.root).toContain(tempRoot);
    expect(workspace.root).not.toContain('..');
    expect(path.relative(tempRoot, workspace.root)).not.toMatch(/^\.\./);
  });

  it('rejects traversal and absolute paths', async () => {
    const workspace = await createWorkspace({
      sessionKey: 'sess_test_workspace_1234567890',
      baseRoot: tempRoot
    });

    expect(() => resolveWorkspacePath(workspace, '../outside.txt')).toThrow(/escapes/);
    expect(() => resolveWorkspacePath(workspace, '/tmp/outside.txt')).toThrow(/relative/);
    await expect(writeWorkspaceText(workspace, 'nested/../../outside.txt', 'bad')).rejects.toThrow(/escapes/);
  });

  it('enforces file and total byte limits', async () => {
    const workspace = await createWorkspace({
      sessionKey: 'sess_test_workspace_1234567890',
      baseRoot: tempRoot,
      limits: { maxFileBytes: 8, maxTotalBytes: 12 }
    });

    await expect(writeWorkspaceText(workspace, 'a.txt', '123456789')).rejects.toThrow(/exceeds/);
    await writeWorkspaceText(workspace, 'a.txt', '123456');
    await expect(writeWorkspaceText(workspace, 'b.txt', '1234567')).rejects.toThrow(/exceeds/);
  });

  it('records internal checkpoints without exposing metadata in normal listings', async () => {
    const workspace = await createWorkspace({
      sessionKey: 'sess_test_workspace_1234567890',
      baseRoot: tempRoot
    });

    await writeWorkspaceText(workspace, 'drafts/report.md', 'real content');
    const checkpoint = await recordWorkspaceCheckpoint(workspace, 'before-export', { tool: 'test' });
    const listed = await listWorkspace(workspace);

    expect(checkpoint.path).toMatch(/^\.workbench\/checkpoints\//);
    expect(checkpoint.files[0]?.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(listed.files.map((file) => file.path)).toEqual(['drafts/report.md']);
  });

  it('cleans up expired workspaces while retaining fresh ones', async () => {
    const oldWorkspace = await createWorkspace({
      sessionKey: 'sess_old_workspace_1234567890',
      baseRoot: tempRoot
    });
    const freshWorkspace = await createWorkspace({
      sessionKey: 'sess_fresh_workspace_1234567890',
      baseRoot: tempRoot
    });
    await writeWorkspaceText(oldWorkspace, 'old.txt', 'old');
    await writeWorkspaceText(freshWorkspace, 'fresh.txt', 'fresh');

    const oldTime = new Date(Date.now() - 10 * 60 * 1000);
    await fs.utimes(oldWorkspace.root, oldTime, oldTime);

    const result = await cleanupExpiredWorkspaces({
      baseRoot: tempRoot,
      ttlMs: 5 * 60 * 1000,
      now: Date.now()
    });

    expect(result.removedWorkspaces).toBe(1);
    await expect(fs.stat(oldWorkspace.root)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readWorkspaceText(freshWorkspace, 'fresh.txt')).resolves.toBe('fresh');
  });

  it('touches reused workspaces so cleanup keeps active threads', async () => {
    const workspace = await createWorkspace({
      sessionKey: 'sess_test_workspace_1234567890',
      workspaceKey: 'thread-reused',
      baseRoot: tempRoot
    });
    await writeWorkspaceText(workspace, 'drafts/report.md', 'content');

    const oldTime = new Date(Date.now() - 10 * 60 * 1000);
    await fs.utimes(workspace.root, oldTime, oldTime);

    const reused = await createWorkspace({
      sessionKey: 'sess_test_workspace_1234567890',
      workspaceKey: 'thread-reused',
      baseRoot: tempRoot
    });
    const result = await cleanupExpiredWorkspaces({
      baseRoot: tempRoot,
      ttlMs: 5 * 60 * 1000,
      now: Date.now()
    });

    expect(reused.root).toBe(workspace.root);
    expect(result.removedWorkspaces).toBe(0);
    await expect(readWorkspaceText(reused, 'drafts/report.md')).resolves.toBe('content');
  });
});
