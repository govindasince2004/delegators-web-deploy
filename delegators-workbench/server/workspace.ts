import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export type WorkspaceLimits = {
  maxFileBytes: number;
  maxTotalBytes: number;
  maxFiles: number;
};

export type WorkspaceFile = {
  path: string;
  bytes: number;
  sha256?: string;
};

export type WorkspaceSnapshot = {
  files: WorkspaceFile[];
  totalBytes: number;
};

export type WorkspaceCleanupResult = {
  removedWorkspaces: number;
  removedSessionDirs: number;
  skipped: number;
};

export type WorkbenchWorkspace = {
  id: string;
  root: string;
  sessionHash: string;
  limits: WorkspaceLimits;
};

const defaultLimits: WorkspaceLimits = {
  maxFileBytes: 25 * 1024 * 1024,
  maxTotalBytes: 200 * 1024 * 1024,
  maxFiles: 500
};

export function defaultWorkspaceRoot(): string {
  return process.env.WORKBENCH_STORAGE_ROOT || path.join(os.tmpdir(), 'delegators-workbench');
}

export function workspaceTtlMs(): number {
  return parsePositiveInt(process.env.WORKBENCH_WORKSPACE_TTL_MS, 30 * 24 * 60 * 60 * 1000);
}

export function workspaceCleanupIntervalMs(): number {
  return parsePositiveInt(process.env.WORKBENCH_WORKSPACE_CLEANUP_INTERVAL_MS, 30 * 60 * 1000);
}

export function hashSessionKey(sessionKey: string): string {
  return crypto.createHash('sha256').update(sessionKey).digest('hex').slice(0, 24);
}

export function hashWorkspaceKey(sessionHash: string, workspaceKey: string): string {
  return crypto.createHash('sha256').update(`${sessionHash}:${workspaceKey}`).digest('hex').slice(0, 32);
}

export async function createWorkspace(options: {
  sessionKey: string;
  workspaceKey?: string;
  baseRoot?: string;
  limits?: Partial<WorkspaceLimits>;
}): Promise<WorkbenchWorkspace> {
  const sessionHash = hashSessionKey(options.sessionKey);
  const stableKey = options.workspaceKey?.trim();
  const id = stableKey ? `thread-${hashWorkspaceKey(sessionHash, stableKey)}` : crypto.randomUUID();
  const root = path.join(path.resolve(options.baseRoot ?? defaultWorkspaceRoot()), sessionHash, id);
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  const now = new Date();
  await fs.utimes(root, now, now);
  return {
    id,
    root,
    sessionHash,
    limits: { ...defaultLimits, ...options.limits }
  };
}

export async function cleanupExpiredWorkspaces(options: {
  baseRoot?: string;
  ttlMs?: number;
  now?: number;
} = {}): Promise<WorkspaceCleanupResult> {
  const baseRoot = path.resolve(options.baseRoot ?? defaultWorkspaceRoot());
  const ttlMs = options.ttlMs ?? workspaceTtlMs();
  const now = options.now ?? Date.now();
  const result: WorkspaceCleanupResult = {
    removedWorkspaces: 0,
    removedSessionDirs: 0,
    skipped: 0
  };
  if (ttlMs <= 0) return result;

  const sessionEntries = await fs.readdir(baseRoot, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });

  for (const sessionEntry of sessionEntries) {
    if (!sessionEntry.isDirectory()) continue;
    const sessionDir = path.join(baseRoot, sessionEntry.name);
    const workspaceEntries = await fs.readdir(sessionDir, { withFileTypes: true }).catch(() => []);
    for (const workspaceEntry of workspaceEntries) {
      if (!workspaceEntry.isDirectory()) continue;
      const workspaceDir = path.join(sessionDir, workspaceEntry.name);
      const stat = await fs.stat(workspaceDir).catch(() => null);
      if (!stat) {
        result.skipped += 1;
        continue;
      }
      if (now - stat.mtimeMs < ttlMs) continue;
      await fs.rm(workspaceDir, { recursive: true, force: true });
      result.removedWorkspaces += 1;
    }

    const remaining = await fs.readdir(sessionDir).catch(() => []);
    if (remaining.length === 0) {
      await fs.rm(sessionDir, { recursive: true, force: true });
      result.removedSessionDirs += 1;
    }
  }

  return result;
}

export function resolveWorkspacePath(workspace: WorkbenchWorkspace, relativePath: string): string {
  if (!relativePath || relativePath.includes('\0')) {
    throw new Error('Workspace path is required.');
  }
  if (path.isAbsolute(relativePath)) {
    throw new Error('Workspace paths must be relative.');
  }

  const normalized = path.normalize(relativePath);
  if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
    throw new Error('Workspace path escapes the workspace root.');
  }

  const root = path.resolve(workspace.root);
  const resolved = path.resolve(root, normalized);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error('Workspace path escapes the workspace root.');
  }
  return resolved;
}

export async function writeWorkspaceText(
  workspace: WorkbenchWorkspace,
  relativePath: string,
  content: string
): Promise<WorkspaceFile> {
  return writeWorkspaceBinary(workspace, relativePath, Buffer.from(content, 'utf8'));
}

export async function writeWorkspaceBinary(
  workspace: WorkbenchWorkspace,
  relativePath: string,
  content: Buffer
): Promise<WorkspaceFile> {
  const bytes = content.byteLength;
  if (bytes > workspace.limits.maxFileBytes) {
    throw new Error(`Workspace file exceeds ${workspace.limits.maxFileBytes} bytes.`);
  }
  const target = resolveWorkspacePath(workspace, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await fs.writeFile(target, content, { mode: 0o600 });
  await enforceWorkspaceLimits(workspace);
  return { path: toWorkspaceRelative(workspace, target), bytes, sha256: sha256Buffer(content) };
}

export async function deleteWorkspacePath(
  workspace: WorkbenchWorkspace,
  relativePath: string
): Promise<{ path: string; deleted: boolean }> {
  const target = resolveWorkspacePath(workspace, relativePath);
  const relative = toWorkspaceRelative(workspace, target);
  if (relative.startsWith('.workbench/')) {
    throw new Error('Workbench metadata files cannot be deleted by tools.');
  }
  const stat = await fs.stat(target).catch(() => null);
  if (!stat) return { path: relative, deleted: false };
  await fs.rm(target, { recursive: stat.isDirectory(), force: true });
  return { path: relative, deleted: true };
}

export async function readWorkspaceText(
  workspace: WorkbenchWorkspace,
  relativePath: string,
  maxBytes = workspace.limits.maxFileBytes
): Promise<string> {
  const target = resolveWorkspacePath(workspace, relativePath);
  const stat = await fs.stat(target);
  if (!stat.isFile()) {
    throw new Error('Workspace path is not a file.');
  }
  if (stat.size > maxBytes) {
    throw new Error(`Workspace file exceeds ${maxBytes} bytes.`);
  }
  return fs.readFile(target, 'utf8');
}

export async function listWorkspace(
  workspace: WorkbenchWorkspace,
  relativePath = '.'
): Promise<WorkspaceSnapshot> {
  const start = resolveWorkspacePath(workspace, relativePath);
  const stat = await fs.stat(start).catch(() => null);
  if (!stat) {
    return { files: [], totalBytes: 0 };
  }
  if (stat.isFile()) {
    return {
      files: [{ path: toWorkspaceRelative(workspace, start), bytes: stat.size }],
      totalBytes: stat.size
    };
  }

  const files: WorkspaceFile[] = [];
  let totalBytes = 0;
  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === '.workbench') continue;
      const child = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(child);
        continue;
      }
      if (!entry.isFile()) continue;
      const childStat = await fs.stat(child);
      totalBytes += childStat.size;
      files.push({
        path: toWorkspaceRelative(workspace, child),
        bytes: childStat.size,
        sha256: await sha256File(child)
      });
      if (files.length > workspace.limits.maxFiles) {
        throw new Error(`Workspace exceeds ${workspace.limits.maxFiles} files.`);
      }
    }
  }

  await walk(start);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { files, totalBytes };
}

export async function recordWorkspaceCheckpoint(
  workspace: WorkbenchWorkspace,
  label: string,
  metadata: Record<string, unknown> = {}
): Promise<{ id: string; path: string; files: WorkspaceFile[]; totalBytes: number }> {
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'checkpoint';
  const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${safeLabel}`;
  const snapshot = await listWorkspace(workspace);
  const checkpoint = {
    id,
    workspaceId: workspace.id,
    sessionHash: workspace.sessionHash,
    createdAt: new Date().toISOString(),
    metadata,
    files: snapshot.files,
    totalBytes: snapshot.totalBytes
  };
  const relativePath = `.workbench/checkpoints/${id}.json`;
  const target = resolveWorkspacePath(workspace, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await fs.writeFile(target, JSON.stringify(checkpoint, null, 2), { encoding: 'utf8', mode: 0o600 });
  return { id, path: relativePath, files: snapshot.files, totalBytes: snapshot.totalBytes };
}

async function sha256File(absolutePath: string): Promise<string> {
  const content = await fs.readFile(absolutePath);
  return sha256Buffer(content);
}

function sha256Buffer(content: Buffer): string {
  const hash = crypto.createHash('sha256');
  hash.update(content);
  return hash.digest('hex');
}

export async function enforceWorkspaceLimits(workspace: WorkbenchWorkspace): Promise<void> {
  const snapshot = await listWorkspace(workspace);
  if (snapshot.files.length > workspace.limits.maxFiles) {
    throw new Error(`Workspace exceeds ${workspace.limits.maxFiles} files.`);
  }
  if (snapshot.totalBytes > workspace.limits.maxTotalBytes) {
    throw new Error(`Workspace exceeds ${workspace.limits.maxTotalBytes} bytes.`);
  }
  for (const file of snapshot.files) {
    if (file.bytes > workspace.limits.maxFileBytes) {
      throw new Error(`Workspace file ${file.path} exceeds ${workspace.limits.maxFileBytes} bytes.`);
    }
  }
}

function toWorkspaceRelative(workspace: WorkbenchWorkspace, absolutePath: string): string {
  return path.relative(workspace.root, absolutePath).split(path.sep).join('/');
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
