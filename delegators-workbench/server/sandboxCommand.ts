import path from 'node:path';

type SandboxRuntime = 'python3' | 'node' | 'bash';

type SandboxCommandOptions = {
  storageRoot: string;
  workspaceRoot: string;
  runPath: string;
  runtime: SandboxRuntime;
};

type SandboxCommandEnvironment = {
  WORKBENCH_SANDBOX_VOLUME?: string;
  WORKBENCH_SANDBOX_USER?: string;
  WORKBENCH_SANDBOX_RUNTIME?: string;
  WORKBENCH_SANDBOX_PYTHON_IMAGE?: string;
  WORKBENCH_SANDBOX_NODE_IMAGE?: string;
  WORKBENCH_SANDBOX_BASH_IMAGE?: string;
};

export function buildSandboxDockerArgs(
  options: SandboxCommandOptions,
  env: SandboxCommandEnvironment = process.env
): string[] {
  const storageRoot = path.resolve(options.storageRoot);
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const relativeWorkspace = path.relative(storageRoot, workspaceRoot);
  if (!relativeWorkspace || relativeWorkspace.startsWith('..') || path.isAbsolute(relativeWorkspace)) {
    throw new Error('Sandbox workspace is outside the Workbench storage root.');
  }

  const runPath = normalizeRelativePath(options.runPath, 'Sandbox run path');
  const runtimeArgs = options.runtime === 'bash'
    ? ['bash', '--noprofile', '--norc', `/workspace/${runPath}`]
    : [options.runtime, `/workspace/${runPath}`];
  const volume = env.WORKBENCH_SANDBOX_VOLUME?.trim();
  const mountArgs = volume
    ? [
        '--mount',
        `type=volume,src=${safeVolumeName(volume)},dst=/workspace,volume-subpath=${toPosix(relativeWorkspace)}`
      ]
    : ['-v', `${workspaceRoot}:/workspace:rw`];

  return [
    'run', '--rm',
    '--network=none',
    '--cpus=1',
    '--memory=1024m',
    '--memory-swap=1024m',
    '--pids-limit=128',
    '--read-only',
    '--user', env.WORKBENCH_SANDBOX_USER ?? '10001:10001',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges',
    '--tmpfs=/tmp:rw,noexec,nosuid,size=64m',
    ...(env.WORKBENCH_SANDBOX_RUNTIME ? ['--runtime', env.WORKBENCH_SANDBOX_RUNTIME] : []),
    '-e', 'WORKBENCH_SANDBOX=1',
    ...mountArgs,
    '-w', '/workspace',
    sandboxImage(options.runtime, env),
    ...runtimeArgs
  ];
}

function sandboxImage(runtime: SandboxRuntime, env: SandboxCommandEnvironment): string {
  if (runtime === 'python3') return env.WORKBENCH_SANDBOX_PYTHON_IMAGE ?? 'python:3.12-slim';
  if (runtime === 'node') return env.WORKBENCH_SANDBOX_NODE_IMAGE ?? 'node:24-alpine';
  return env.WORKBENCH_SANDBOX_BASH_IMAGE ?? 'bash:5.2';
}

function normalizeRelativePath(value: string, label: string): string {
  if (!value || path.isAbsolute(value) || value.includes('\0')) {
    throw new Error(`${label} must be relative.`);
  }
  const normalized = path.posix.normalize(toPosix(value));
  if (normalized === '..' || normalized.startsWith('../')) {
    throw new Error(`${label} escapes the workspace.`);
  }
  return normalized;
}

function safeVolumeName(value: string): string {
  if (!/^[A-Za-z0-9_.-]+$/.test(value)) {
    throw new Error('Sandbox volume name is invalid.');
  }
  return value;
}

function toPosix(value: string): string {
  return value.split(path.sep).join('/');
}
