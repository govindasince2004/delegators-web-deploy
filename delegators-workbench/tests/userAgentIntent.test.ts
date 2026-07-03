import { describe, expect, it } from 'vitest';
import {
  buildUserAgentIntentSeeds,
  deriveUserAgentIntent,
  userAgentHarnessPromptLines,
  userAgentPromptLines
} from '../server/userAgentIntent';

describe('userAgentIntent', () => {
  it('detects strict mode and research-heavy goal from the user brief', () => {
    const intent = deriveUserAgentIntent({
      brief: 'Build a 12-slide investor deck on Acme Corp. Must cite sources. Hard rules: no hype.',
      kind: 'deck',
      depthTier: 'deep',
      needsResearch: true
    });
    expect(intent.mode).toBe('strict');
    expect(intent.goal).toBe('research-heavy');
    expect(intent.toolPlaybook.join(' ')).toMatch(/research\/source-pack|web_search/i);
    expect(userAgentPromptLines(intent).join(' ')).toMatch(/AGENTIC EXECUTION/);
  });

  it('detects autonomous data-compute goal when user invites judgment on numbers', () => {
    const intent = deriveUserAgentIntent({
      brief: 'Figure out YoY growth from this table and build a spreadsheet — use your judgment on layout.',
      kind: 'sheet',
      depthTier: 'standard',
      needsResearch: false
    });
    expect(intent.mode).toBe('autonomous');
    expect(intent.goal).toBe('data-compute');
    expect(intent.toolPlaybook.join(' ')).toMatch(/terminal_run/i);
  });

  it('seeds agent intent, playbook, and log files for harness execution', () => {
    const intent = deriveUserAgentIntent({
      brief: 'Update slide 3 title to emphasize margin expansion.',
      kind: 'deck',
      depthTier: 'fast',
      threadMode: 'refine'
    });
    expect(intent.goal).toBe('refine-targeted');
    const seeds = buildUserAgentIntentSeeds(intent, 'Update slide 3 title');
    expect(seeds.map((seed) => seed.path)).toEqual([
      'context/user-agent-intent.md',
      'harness/agent-playbook.md',
      'workspace/agent-log.md'
    ]);
    expect(seeds[0]?.content).toMatch(/User agent intent/);
    expect(userAgentHarnessPromptLines().join(' ')).toMatch(/agent-playbook/);
  });

  it('routes cloud-continue when brief names connected workspace', () => {
    const intent = deriveUserAgentIntent({
      brief: 'Pull facts from my Google Drive doc and continue the report in the same tone.',
      kind: 'report',
      depthTier: 'standard',
      ownerSubject: 'user_123',
      env: {
        WORKBENCH_INTEGRATION_VAULT_KEY: Buffer.alloc(32).toString('base64'),
        WORKBENCH_GOOGLE_WORKSPACE_ENABLED: 'true',
        WORKBENCH_GOOGLE_OAUTH_CLIENT_ID: 'id',
        WORKBENCH_GOOGLE_OAUTH_CLIENT_SECRET: 'secret'
      }
    });
    expect(intent.goal).toBe('cloud-continue');
    expect(intent.toolPlaybook.join(' ')).toMatch(/personal_knowledge_search|google_workspace_run/i);
  });
});