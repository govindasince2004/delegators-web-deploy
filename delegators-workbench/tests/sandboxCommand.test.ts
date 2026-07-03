import { describe, expect, it } from 'vitest';
import { buildSandboxDockerArgs } from '../server/sandboxCommand';

describe('sandbox Docker command', () => {
  it('mounts only the requesting workspace from the shared named volume', () => {
    const args = buildSandboxDockerArgs({
      storageRoot: '/data/workbench',
      workspaceRoot: '/data/workbench/sessions/abc/workspace',
      runPath: '.runs/check.py',
      runtime: 'python3'
    }, {
      WORKBENCH_SANDBOX_VOLUME: 'delegators-swe-agentic-api_workbenchdata'
    });

    expect(args).toContain('--network=none');
    expect(args).toContain('type=volume,src=delegators-swe-agentic-api_workbenchdata,dst=/workspace,volume-subpath=sessions/abc/workspace');
    expect(args).toContain('/workspace/.runs/check.py');
    expect(args).not.toContain('/data/workbench/sessions/abc/workspace:/workspace:rw');
  });

  it('rejects workspace and run-path escapes', () => {
    expect(() => buildSandboxDockerArgs({
      storageRoot: '/data/workbench',
      workspaceRoot: '/tmp/other',
      runPath: 'check.py',
      runtime: 'python3'
    })).toThrow('outside the Workbench storage root');

    expect(() => buildSandboxDockerArgs({
      storageRoot: '/data/workbench',
      workspaceRoot: '/data/workbench/sessions/abc',
      runPath: '../check.py',
      runtime: 'python3'
    })).toThrow('escapes the workspace');
  });
});
