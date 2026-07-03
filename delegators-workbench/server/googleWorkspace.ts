import { spawn } from 'node:child_process';
import path from 'node:path';
import { scrubSecrets } from './security.js';

export const GOOGLE_WORKSPACE_READ_ONLY_ALLOWLIST = [
  'drive files list',
  'drive files get',
  'sheets spreadsheets values get',
  'docs documents get'
] as const;

export type GoogleWorkspaceAllowlistedCommand = (typeof GOOGLE_WORKSPACE_READ_ONLY_ALLOWLIST)[number];

const COMMAND_TOKEN_RE = /^[a-z][a-z0-9+_-]*$/i;
const ALLOWED_GWS_FLAGS = new Set(['--params', '--json', '--page-limit', '--page-delay']);

export type GoogleWorkspaceRunRequest = {
  command: string[];
  params?: Record<string, unknown>;
  json?: Record<string, unknown>;
};

export type GoogleWorkspaceRunResult = {
  ok: boolean;
  commandPath: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

export type GoogleWorkspaceSpawn = (
  file: string,
  args: string[],
  options: { env: NodeJS.ProcessEnv; timeoutMs: number; maxOutputBytes: number }
) => Promise<{ exitCode: number | null; stdout: string; stderr: string; timedOut: boolean }>;

export const googleWorkspaceToolDefinition = {
  type: 'function',
  function: {
    name: 'google_workspace_run',
    description:
      'Run a read-only Google Workspace CLI (gws) command against the user connected Google account. Beta allowlist: drive files list/get, sheets spreadsheets values get, docs documents get.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        command: {
          type: 'array',
          items: { type: 'string' },
          description: 'gws command path after the binary, for example ["drive","files","list"].'
        },
        params: {
          type: 'object',
          description: 'Optional --params JSON object passed to gws.'
        },
        json: {
          type: 'object',
          description: 'Optional --json body passed to gws. Rarely needed for read-only beta commands.'
        }
      },
      required: ['command']
    }
  }
} as const;

export function isGoogleWorkspaceEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.WORKBENCH_GOOGLE_WORKSPACE_ENABLED === 'true';
}

export function normalizeGwsCommandPath(parts: readonly string[]): string {
  return parts.map((part) => part.trim()).filter(Boolean).join(' ');
}

export function assertAllowlistedCommand(commandPath: string): void {
  if (!GOOGLE_WORKSPACE_READ_ONLY_ALLOWLIST.includes(commandPath as GoogleWorkspaceAllowlistedCommand)) {
    throw new Error(`Google Workspace command "${commandPath}" is not allowlisted.`);
  }
}

export function assertCommandTokens(command: readonly string[]): string {
  if (!Array.isArray(command) || command.length === 0) {
    throw new Error('Google Workspace command must be a non-empty string array.');
  }
  for (const token of command) {
    if (typeof token !== 'string' || !COMMAND_TOKEN_RE.test(token.trim())) {
      throw new Error('Google Workspace command tokens must be simple gws path segments.');
    }
  }
  return normalizeGwsCommandPath(command);
}

export function resolveGoogleWorkspaceCredentialsFile(options: {
  sessionEnv?: NodeJS.ProcessEnv;
  sessionHash?: string;
  ownerSubject?: string;
  credentialsPath?: string | null;
  env?: NodeJS.ProcessEnv;
}): string {
  const env = options.env ?? process.env;
  if (options.credentialsPath?.trim()) return options.credentialsPath.trim();
  const fromSession = options.sessionEnv?.GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE?.trim();
  if (fromSession) return fromSession;

  const vaultRoot = env.WORKBENCH_GOOGLE_WORKSPACE_VAULT_ROOT?.trim() || '/vault/google-workspace/sessions';
  const sessionHash = options.ownerSubject?.trim() || options.sessionHash?.trim() || 'unknown';
  const digest = sessionHash.includes(':') ? sessionHash.split(':').pop() ?? sessionHash : sessionHash;
  return path.join(vaultRoot, digest, 'credentials.json');
}

export function maskGoogleWorkspaceSecrets(text: string): string {
  return scrubSecrets(text)
    .replace(/GOOGLE_WORKSPACE_CLI_TOKEN=[^\s]+/gi, 'GOOGLE_WORKSPACE_CLI_TOKEN=[redacted]')
    .replace(/GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE=[^\s]+/gi, 'GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE=[redacted]')
    .replace(/ya29\.[A-Za-z0-9._-]+/g, 'ya29.[redacted]')
    .replace(/\/vault\/[^\s]+/g, '[vault-path-redacted]')
    .replace(/"access_token"\s*:\s*"[^"]+"/gi, '"access_token":"[redacted]"')
    .replace(/refresh_token"\s*:\s*"[^"]+"/gi, 'refresh_token":"[redacted]"')
    .replace(/"client_secret"\s*:\s*"[^"]+"/gi, '"client_secret":"[redacted]"');
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readRecord(value: unknown, field: string): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Google Workspace argument "${field}" must be a JSON object when provided.`);
  }
  return value as Record<string, unknown>;
}

export function readGoogleWorkspaceToolArgs(args: Record<string, unknown>): GoogleWorkspaceRunRequest {
  const command = args.command;
  if (!Array.isArray(command) || command.length === 0 || !command.every((part) => typeof part === 'string')) {
    throw new Error('Tool argument "command" must be a non-empty string array.');
  }
  return {
    command,
    params: readRecord(args.params, 'params'),
    json: readRecord(args.json, 'json')
  };
}

function buildGwsArgs(request: GoogleWorkspaceRunRequest): string[] {
  const args = [...request.command.map((part) => part.trim())];
  if (request.params) {
    args.push('--params', JSON.stringify(request.params));
  }
  if (request.json) {
    args.push('--json', JSON.stringify(request.json));
  }
  for (let index = 2; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith('--')) continue;
    if (!ALLOWED_GWS_FLAGS.has(token)) {
      throw new Error(`Google Workspace flag "${token}" is not allowed.`);
    }
    if ((token === '--params' || token === '--json') && typeof args[index + 1] !== 'string') {
      throw new Error(`Google Workspace flag "${token}" requires a JSON payload.`);
    }
  }
  return args;
}

function defaultSpawn(
  file: string,
  args: string[],
  options: { env: NodeJS.ProcessEnv; timeoutMs: number; maxOutputBytes: number }
): Promise<{ exitCode: number | null; stdout: string; stderr: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(file, args, {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: options.env
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const append = (current: string, chunk: Buffer) => {
      const next = current + chunk.toString('utf8');
      if (Buffer.byteLength(next, 'utf8') <= options.maxOutputBytes) return next;
      return Buffer.from(next, 'utf8').subarray(0, options.maxOutputBytes).toString('utf8') + '\n[truncated]';
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, options.timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => { stdout = append(stdout, chunk); });
    child.stderr.on('data', (chunk: Buffer) => { stderr = append(stderr, chunk); });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({
        exitCode: 127,
        stdout,
        stderr: append(stderr, Buffer.from(error.message)),
        timedOut
      });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code, stdout, stderr, timedOut });
    });
  });
}

export async function runGoogleWorkspaceCommand(options: {
  request: GoogleWorkspaceRunRequest;
  sessionEnv?: NodeJS.ProcessEnv;
  sessionHash?: string;
  ownerSubject?: string;
  credentialsPath?: string | null;
  env?: NodeJS.ProcessEnv;
  maxOutputBytes?: number;
  timeoutMs?: number;
  spawnFn?: GoogleWorkspaceSpawn;
  log?: (message: string) => void;
}): Promise<GoogleWorkspaceRunResult> {
  const env = options.env ?? process.env;
  if (!isGoogleWorkspaceEnabled(env)) {
    throw new Error('Google Workspace integration is disabled.');
  }

  const commandPath = assertCommandTokens(options.request.command);
  assertAllowlistedCommand(commandPath);

  const binary = env.WORKBENCH_GOOGLE_WORKSPACE_CLI_COMMAND?.trim() || 'gws';
  const timeoutMs = Math.max(
    1_000,
    Math.min(
      options.timeoutMs ?? positiveInt(env.WORKBENCH_GOOGLE_WORKSPACE_TIMEOUT_MS, 30_000),
      positiveInt(env.WORKBENCH_GOOGLE_WORKSPACE_TIMEOUT_MS, 30_000)
    )
  );
  const maxOutputBytes = Math.max(
    1_024,
    options.maxOutputBytes ?? positiveInt(env.WORKBENCH_GOOGLE_WORKSPACE_MAX_OUTPUT_BYTES, 64_000)
  );
  const credentialsFile = resolveGoogleWorkspaceCredentialsFile({
    sessionEnv: options.sessionEnv,
    sessionHash: options.sessionHash,
    ownerSubject: options.ownerSubject,
    credentialsPath: options.credentialsPath,
    env
  });
  const childEnv: NodeJS.ProcessEnv = {
    ...env,
    GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE: credentialsFile
  };
  delete childEnv.GOOGLE_WORKSPACE_CLI_TOKEN;

  const args = buildGwsArgs(options.request);
  const log = options.log ?? ((message: string) => console.info(maskGoogleWorkspaceSecrets(message)));
  log(`[google-workspace] ${binary} ${commandPath} timeoutMs=${timeoutMs} credentials=[session]`);

  const spawned = await (options.spawnFn ?? defaultSpawn)(binary, args, {
    env: childEnv,
    timeoutMs,
    maxOutputBytes
  });

  if (spawned.timedOut) {
    return {
      ok: false,
      commandPath,
      exitCode: spawned.exitCode,
      stdout: spawned.stdout,
      stderr: spawned.stderr || `gws timed out after ${timeoutMs}ms.`,
      timedOut: true
    };
  }

  return {
    ok: spawned.exitCode === 0,
    commandPath,
    exitCode: spawned.exitCode,
    stdout: spawned.stdout,
    stderr: spawned.stderr,
    timedOut: false
  };
}