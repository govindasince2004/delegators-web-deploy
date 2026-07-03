import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createToolState, executeWorkbenchTool, type ToolBudget } from '../server/workbenchTools';
import { createWorkspace } from '../server/workspace';

let tempRoot = '';
const previousEnv: Record<string, string | undefined> = {};

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'dw-remote-sandbox-test-'));
  for (const key of ['NODE_ENV', 'WORKBENCH_TERMINAL_MODE', 'WORKBENCH_SANDBOX_URL', 'WORKBENCH_SANDBOX_TOKEN']) {
    previousEnv[key] = process.env[key];
  }
  process.env.NODE_ENV = 'production';
  process.env.WORKBENCH_TERMINAL_MODE = 'remote';
  process.env.WORKBENCH_SANDBOX_URL = 'http://sandboxd:4180';
  process.env.WORKBENCH_SANDBOX_TOKEN = 'test-sandbox-token';
});

afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.unstubAllGlobals();
});

const budget: ToolBudget = {
  maxToolCalls: 2,
  maxTerminalRuns: 1,
  maxWebRequests: 0,
  timeoutMs: 10_000,
  maxToolResultBytes: 4_000
};

describe('remote production sandbox', () => {
  it('allows the isolated remote mode and forwards the scoped request', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      exitCode: 0,
      stdout: '42\n',
      stderr: '',
      timedOut: false
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const workspace = await createWorkspace({
      sessionKey: 'sess_remote_sandbox_1234567890',
      baseRoot: tempRoot
    });

    const result = await executeWorkbenchTool({
      workspace,
      budget,
      state: createToolState(),
      call: {
        id: 'call_remote',
        function: {
          name: 'terminal_run',
          arguments: JSON.stringify({ runtime: 'python3', code: 'print(6 * 7)' })
        }
      }
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://sandboxd:4180/v1/run',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-sandbox-token' })
      })
    );
  });
});
