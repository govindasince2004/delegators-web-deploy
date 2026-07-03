import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const serverIndex = fs.readFileSync(
  path.join(process.cwd(), 'server/index.ts'),
  'utf8'
);

describe('agent harness wiring (brutal static audit)', () => {
  it('routes chat agent turns through runChatHarness', () => {
    expect(serverIndex).toMatch(/app\.post\(\s*'\/api\/agent\/chat'/);
    expect(serverIndex).toMatch(/const reply = await runChatHarness\(/);
    expect(serverIndex).toMatch(
      /completeTurn:\s*\(request\)\s*=>\s*completeDelegatorsTurn/
    );
  });

  it('routes durable artifact runs through RunCoordinator executeManagedRun', () => {
    expect(serverIndex).toMatch(
      /new RunCoordinator\(runRepository,\s*executeManagedRun\)/
    );
    expect(serverIndex).toMatch(/app\.post\(\s*'\/api\/v2\/runs'/);
    expect(serverIndex).toMatch(/async function executeManagedRun\(/);
    expect(serverIndex).toMatch(
      /generateArtifact\(request,\s*\{\s*reporter,\s*control\s*\}\)/
    );
  });

  it('enables workbench tool harness when callDelegators sets useHarness', () => {
    expect(serverIndex).toMatch(
      /enableTools:\s*runtimeOptions\.useHarness === true/
    );
    expect(serverIndex).toMatch(/return runWorkbenchHarness\(/);
    expect(serverIndex).toMatch(/useHarness:\s*requiresToolHarness/);
  });

  it('uses father orchestrator for internal parallel specialists', () => {
    expect(serverIndex).toMatch(
      /import\s*\{\s*runFatherOrchestrated\s*\}\s*from\s*'\.\/internalHarness\.js'/
    );
    expect(serverIndex).toMatch(/await runFatherOrchestrated\(\s*\[/);
    expect(serverIndex).toMatch(/role:\s*'research_scout'/);
    expect(serverIndex).toMatch(/role:\s*'source_analyst'/);
  });

  it('persists durable run checkpoints from the coordinator context', () => {
    expect(serverIndex).toMatch(/checkpoint:\s*context\.checkpoint/);
    expect(serverIndex).toMatch(
      /await options\.control\?\.checkpoint\?\.\(\s*'research'/
    );
    expect(serverIndex).toMatch(
      /await options\.control\?\.checkpoint\?\.\(\s*'outline'/
    );
    expect(serverIndex).toMatch(
      /await options\.control\?\.checkpoint\?\.\(\s*'compose'/
    );
  });

  it('sends stable gateway harness identity on every completion turn', () => {
    expect(serverIndex).toMatch(
      /\.\.\.workbenchHarnessIdentity\(input\.threadId\)/
    );
  });
});
