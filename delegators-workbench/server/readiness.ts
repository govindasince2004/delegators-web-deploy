import { Redis } from 'ioredis';
import { createRunRepository } from './runRepository.js';
import { sandboxCircuitSnapshot } from './sandboxCircuit.js';

export type ReadinessCheck = {
  name: string;
  ok: boolean;
  detail?: string;
};

let redisProbe: Redis | null | undefined;

function redisUrl(): string | null {
  const url = process.env.WORKBENCH_REDIS_URL?.trim();
  return url || null;
}

function getRedisProbe(): Redis | null {
  if (redisProbe !== undefined) return redisProbe;
  const url = redisUrl();
  if (!url) {
    redisProbe = null;
    return redisProbe;
  }
  redisProbe = new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1
  });
  return redisProbe;
}

async function checkRedis(): Promise<ReadinessCheck> {
  const redis = getRedisProbe();
  if (!redis) {
    return { name: 'redis', ok: true, detail: 'not_configured' };
  }
  try {
    if (redis.status === 'wait') await redis.connect();
    const pong = await redis.ping();
    return { name: 'redis', ok: pong === 'PONG' };
  } catch (error) {
    return {
      name: 'redis',
      ok: false,
      detail: error instanceof Error ? error.message : 'redis_unreachable'
    };
  }
}

async function checkGateway(baseURL: string): Promise<ReadinessCheck> {
  try {
    const response = await fetch(`${baseURL.replace(/\/$/, '')}/healthz`, {
      signal: AbortSignal.timeout(3000)
    });
    return { name: 'gateway', ok: response.ok, detail: `http_${response.status}` };
  } catch (error) {
    return {
      name: 'gateway',
      ok: false,
      detail: error instanceof Error ? error.message : 'gateway_unreachable'
    };
  }
}

async function checkSandbox(): Promise<ReadinessCheck> {
  const mode = process.env.WORKBENCH_TERMINAL_MODE || (process.env.NODE_ENV === 'production' ? 'off' : 'local');
  if (mode !== 'remote') {
    return { name: 'sandbox', ok: true, detail: `mode_${mode}` };
  }
  const endpoint = process.env.WORKBENCH_SANDBOX_URL?.trim();
  if (!endpoint) {
    return { name: 'sandbox', ok: false, detail: 'missing_sandbox_url' };
  }
  const circuit = sandboxCircuitSnapshot();
  if (circuit.state === 'open') {
    return { name: 'sandbox', ok: false, detail: 'circuit_open' };
  }
  try {
    const response = await fetch(`${endpoint.replace(/\/$/, '')}/healthz`, {
      signal: AbortSignal.timeout(3000)
    });
    return { name: 'sandbox', ok: response.ok, detail: `http_${response.status}` };
  } catch (error) {
    return {
      name: 'sandbox',
      ok: false,
      detail: error instanceof Error ? error.message : 'sandbox_unreachable'
    };
  }
}

async function checkMarkItDown(): Promise<ReadinessCheck> {
  const endpoint = process.env.WORKBENCH_MARKITDOWN_URL?.trim();
  if (!endpoint) {
    return { name: 'markitdown', ok: true, detail: 'not_configured' };
  }
  try {
    const response = await fetch(`${endpoint.replace(/\/$/, '')}/healthz`, {
      signal: AbortSignal.timeout(3000)
    });
    return { name: 'markitdown', ok: response.ok, detail: `http_${response.status}` };
  } catch (error) {
    return {
      name: 'markitdown',
      ok: false,
      detail: error instanceof Error ? error.message : 'markitdown_unreachable'
    };
  }
}

async function checkRunRepository(): Promise<ReadinessCheck> {
  try {
    const repository = createRunRepository();
    await repository.get('run_probe00000000');
    await repository.close?.();
    return { name: 'run_repository', ok: true };
  } catch (error) {
    return {
      name: 'run_repository',
      ok: false,
      detail: error instanceof Error ? error.message : 'run_repository_unreachable'
    };
  }
}

export async function collectReadinessChecks(gatewayBaseURL: string): Promise<ReadinessCheck[]> {
  return Promise.all([
    checkRedis(),
    checkGateway(gatewayBaseURL),
    checkSandbox(),
    checkMarkItDown(),
    checkRunRepository()
  ]);
}