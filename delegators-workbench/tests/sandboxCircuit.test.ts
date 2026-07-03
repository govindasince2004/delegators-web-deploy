import { afterEach, describe, expect, it } from 'vitest';
import {
  assertSandboxAvailable,
  recordSandboxFailure,
  recordSandboxSuccess,
  sandboxCircuitSnapshot,
  withSandboxCircuit
} from '../server/sandboxCircuit';

describe('sandbox circuit breaker', () => {
  afterEach(() => {
    recordSandboxSuccess();
    delete process.env.WORKBENCH_SANDBOX_CIRCUIT_FAILURES;
  });

  it('opens after repeated sandbox failures', () => {
    process.env.WORKBENCH_SANDBOX_CIRCUIT_FAILURES = '2';
    recordSandboxFailure();
    expect(sandboxCircuitSnapshot().state).toBe('closed');
    recordSandboxFailure();
    expect(sandboxCircuitSnapshot().state).toBe('open');
    expect(() => assertSandboxAvailable()).toThrow(/temporarily unavailable/i);
  });

  it('recovers after a successful sandbox call once the cooldown elapses', async () => {
    process.env.WORKBENCH_SANDBOX_CIRCUIT_FAILURES = '1';
    process.env.WORKBENCH_SANDBOX_CIRCUIT_COOLDOWN_MS = '5';
    recordSandboxFailure();
    expect(sandboxCircuitSnapshot().state).toBe('open');
    await new Promise((resolve) => setTimeout(resolve, 10));
    await expect(withSandboxCircuit(async () => 'ok')).resolves.toBe('ok');
    expect(sandboxCircuitSnapshot().state).toBe('closed');
  });
});