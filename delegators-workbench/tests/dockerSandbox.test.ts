import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createToolState, executeWorkbenchTool, type ToolBudget, type ToolCall } from '../server/workbenchTools';
import { createWorkspace, readWorkspaceText } from '../server/workspace';

const runDocker = process.env.WORKBENCH_RUN_DOCKER_TEST === 'true';

let tempRoot = '';
let oldNodeEnv: string | undefined;
let oldMode: string | undefined;
let oldImage: string | undefined;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'dw-docker-sandbox-test-'));
  oldNodeEnv = process.env.NODE_ENV;
  oldMode = process.env.WORKBENCH_TERMINAL_MODE;
  oldImage = process.env.WORKBENCH_SANDBOX_IMAGE;
  process.env.NODE_ENV = 'production';
  process.env.WORKBENCH_TERMINAL_MODE = 'docker';
  process.env.WORKBENCH_SANDBOX_IMAGE = process.env.WORKBENCH_SANDBOX_IMAGE || 'python:3.11-slim';
});

afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
  restoreEnv('NODE_ENV', oldNodeEnv);
  restoreEnv('WORKBENCH_TERMINAL_MODE', oldMode);
  restoreEnv('WORKBENCH_SANDBOX_IMAGE', oldImage);
});

const budget: ToolBudget = {
  maxToolCalls: 4,
  maxTerminalRuns: 3,
  maxWebRequests: 0,
  timeoutMs: 15_000,
  maxToolResultBytes: 6_000
};

describe.skipIf(!runDocker)('Docker Workbench sandbox', () => {
  it('runs Python in a real networkless container and writes only to the workspace', async () => {
    const workspace = await createWorkspace({
      sessionKey: 'sess_test_docker_sandbox_1234567890',
      baseRoot: tempRoot
    });
    const state = createToolState();

    const writeResult = await executeWorkbenchTool({
      workspace,
      budget,
      state,
      call: toolCall('terminal_run', {
        runtime: 'python3',
        code: [
          'from pathlib import Path',
          'Path("artifact.txt").write_text("sandbox-ok")',
          'print("uid-sandbox-write-ok")'
        ].join('\n')
      })
    });

    expect(writeResult.ok).toBe(true);
    expect(JSON.stringify(writeResult.data)).toContain('"exitCode":0');
    await expect(readWorkspaceText(workspace, 'artifact.txt')).resolves.toBe('sandbox-ok');

    const networkResult = await executeWorkbenchTool({
      workspace,
      budget,
      state,
      call: toolCall('terminal_run', {
        runtime: 'python3',
        code: [
          'import socket',
          's=socket.socket()',
          's.settimeout(1)',
          'try:',
          '    s.connect(("1.1.1.1", 53))',
          '    raise SystemExit("network-open")',
          'except OSError:',
          '    print("network-blocked")'
        ].join('\n')
      })
    });

    expect(networkResult.ok).toBe(true);
    expect(JSON.stringify(networkResult.data)).toContain('"exitCode":0');
    expect(JSON.stringify(networkResult.data)).toContain('network-blocked');
  });
});

function toolCall(name: string, args: unknown): ToolCall {
  return {
    id: `call_${name}`,
    function: { name, arguments: JSON.stringify(args) }
  };
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
