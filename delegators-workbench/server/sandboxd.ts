import { spawn } from 'node:child_process';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import { z } from 'zod';
import { buildSandboxDockerArgs } from './sandboxCommand.js';
import { defaultWorkspaceRoot } from './workspace.js';

const app = express();
const port = Number.parseInt(process.env.WORKBENCH_SANDBOX_PORT ?? '4180', 10);
const host = process.env.WORKBENCH_SANDBOX_BIND_HOST ?? '0.0.0.0';
const authToken = process.env.WORKBENCH_SANDBOX_TOKEN?.trim();
const storageRoot = path.resolve(defaultWorkspaceRoot());

const RunRequestSchema = z.object({
  workspaceRoot: z.string().min(1).max(1200),
  runtime: z.enum(['python3', 'node', 'bash']),
  runPath: z.string().min(1).max(500),
  timeoutMs: z.number().int().min(1000).max(120_000),
  maxOutputBytes: z.number().int().min(1000).max(100_000)
});

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '32kb' }));

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', service: 'delegators-workbench-sandboxd' });
});

app.post('/v1/run', (req, res, next) => {
  if (!authToken) {
    res.status(503).json({ error: 'Sandbox token is not configured.' });
    return;
  }
  if (req.headers.authorization !== `Bearer ${authToken}`) {
    res.status(401).json({ error: 'Unauthorized sandbox request.' });
    return;
  }
  next();
}, async (req, res) => {
  const parsed = RunRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map((issue) => issue.message).join('; ') });
    return;
  }

  try {
    const workspaceRoot = resolveWorkspaceRoot(parsed.data.workspaceRoot);
    const scriptPath = resolveRunPath(workspaceRoot, parsed.data.runPath);
    const result = await runSandboxContainer({
      workspaceRoot,
      runPath: path.relative(workspaceRoot, scriptPath),
      runtime: parsed.data.runtime,
      timeoutMs: parsed.data.timeoutMs,
      maxOutputBytes: parsed.data.maxOutputBytes
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Sandbox execution failed.' });
  }
});

app.listen(port, host, () => {
  console.log(`delegators-workbench sandboxd listening on ${host}:${port}`);
});

function resolveWorkspaceRoot(raw: string): string {
  const resolved = path.resolve(raw);
  if (resolved === storageRoot || !resolved.startsWith(storageRoot + path.sep)) {
    throw new Error('Sandbox workspace is outside the Workbench storage root.');
  }
  return resolved;
}

function resolveRunPath(workspaceRoot: string, relativePath: string): string {
  if (path.isAbsolute(relativePath) || relativePath.includes('\0')) {
    throw new Error('Sandbox run path must be relative.');
  }
  const resolved = path.resolve(workspaceRoot, relativePath);
  if (!resolved.startsWith(workspaceRoot + path.sep)) {
    throw new Error('Sandbox run path escapes the workspace.');
  }
  return resolved;
}

async function runSandboxContainer(options: {
  workspaceRoot: string;
  runPath: string;
  runtime: 'python3' | 'node' | 'bash';
  timeoutMs: number;
  maxOutputBytes: number;
}) {
  const args = buildSandboxDockerArgs({
    storageRoot,
    workspaceRoot: options.workspaceRoot,
    runPath: options.runPath,
    runtime: options.runtime
  });
  return runProcess(process.env.WORKBENCH_SANDBOX_COMMAND ?? 'docker', args, options);
}

function runProcess(
  file: string,
  args: string[],
  options: { timeoutMs: number; maxOutputBytes: number }
): Promise<{ exitCode: number | null; stdout: string; stderr: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(file, args, {
      env: {
        PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
        ...(process.env.DOCKER_HOST ? { DOCKER_HOST: process.env.DOCKER_HOST } : {}),
        ...(process.env.DOCKER_TLS_VERIFY ? { DOCKER_TLS_VERIFY: process.env.DOCKER_TLS_VERIFY } : {}),
        ...(process.env.DOCKER_CERT_PATH ? { DOCKER_CERT_PATH: process.env.DOCKER_CERT_PATH } : {})
      },
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    const append = (current: string, chunk: Buffer) => {
      const next = current + chunk.toString('utf8');
      if (Buffer.byteLength(next, 'utf8') <= options.maxOutputBytes) return next;
      return Buffer.from(next, 'utf8').subarray(0, options.maxOutputBytes).toString('utf8') + '\n[truncated]';
    };
    const finish = (exitCode: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ exitCode, stdout, stderr, timedOut });
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, options.timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => { stdout = append(stdout, chunk); });
    child.stderr.on('data', (chunk: Buffer) => { stderr = append(stderr, chunk); });
    child.on('error', (error) => {
      stderr = append(stderr, Buffer.from(error.message));
      finish(127);
    });
    child.on('close', finish);
  });
}
