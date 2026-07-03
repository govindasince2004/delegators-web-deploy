import { incrementCounter } from './metrics.js';

type CircuitSnapshot = {
  state: 'closed' | 'open' | 'half_open';
  failures: number;
  openedAt: number;
};

let failures = 0;
let openedAt = 0;
let halfOpenProbe = false;

function failureThreshold(): number {
  const configured = Number.parseInt(process.env.WORKBENCH_SANDBOX_CIRCUIT_FAILURES ?? '5', 10);
  return Number.isFinite(configured) && configured > 0 ? configured : 5;
}

function cooldownMs(): number {
  const configured = Number.parseInt(process.env.WORKBENCH_SANDBOX_CIRCUIT_COOLDOWN_MS ?? '30000', 10);
  return Number.isFinite(configured) && configured > 0 ? configured : 30_000;
}

export function sandboxCircuitSnapshot(): CircuitSnapshot {
  if (openedAt > 0 && Date.now() - openedAt >= cooldownMs()) {
    return { state: 'half_open', failures, openedAt };
  }
  if (openedAt > 0) {
    return { state: 'open', failures, openedAt };
  }
  return { state: 'closed', failures, openedAt };
}

export function assertSandboxAvailable(): void {
  const snapshot = sandboxCircuitSnapshot();
  if (snapshot.state === 'open') {
    throw new Error('Workbench sandbox is temporarily unavailable. Retry in a few moments.');
  }
  if (snapshot.state === 'half_open' && halfOpenProbe) {
    throw new Error('Workbench sandbox is recovering. Retry in a few moments.');
  }
}

export function recordSandboxSuccess(): void {
  failures = 0;
  openedAt = 0;
  halfOpenProbe = false;
}

export function recordSandboxFailure(): void {
  failures += 1;
  if (failures >= failureThreshold()) {
    openedAt = Date.now();
    incrementCounter('workbench_sandbox_circuit_open_total');
  }
}

export async function withSandboxCircuit<T>(operation: () => Promise<T>): Promise<T> {
  assertSandboxAvailable();
  if (sandboxCircuitSnapshot().state === 'half_open') halfOpenProbe = true;
  try {
    const result = await operation();
    recordSandboxSuccess();
    return result;
  } catch (error) {
    recordSandboxFailure();
    throw error;
  } finally {
    halfOpenProbe = false;
  }
}