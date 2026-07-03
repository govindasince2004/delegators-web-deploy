import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runChatHarness, runWorkbenchHarness, type CompletionTurn, type DelegatorsMessage } from '../server/harnessOrchestrator';
import { policyForChat, policyForModel, type ToolCall } from '../server/workbenchTools';
import { createWorkspace, readWorkspaceText, writeWorkspaceText } from '../server/workspace';

let tempRoot = '';

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'dw-orchestrator-test-'));
});

afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

describe('Workbench harness orchestrator', () => {
  it('executes model-requested tools and returns the final artifact JSON', async () => {
    const workspace = await createWorkspace({
      sessionKey: 'sess_test_orchestrator_1234567890',
      baseRoot: tempRoot
    });
    await writeWorkspaceText(workspace, 'input/brief.md', 'Create a short office report.');
    const seen: Array<{ toolsEnabled: boolean; messages: DelegatorsMessage[] }> = [];
    const finalArtifact = JSON.stringify({
      kind: 'report',
      title: 'Office Report',
      audience: 'Operations',
      tone: 'professional',
      executiveSummary: 'A concise operational report.',
      sections: [{ heading: 'Findings', body: 'The draft was prepared in the workspace.', bullets: ['Workspace file created'] }],
      citations: [],
      nextQuestions: []
    });
    const turns: CompletionTurn[] = [
      {
        content: '',
        toolCalls: [toolCall('workspace_write', { path: 'drafts/report.md', content: 'workspace draft' })]
      },
      {
        content: '',
        toolCalls: [toolCall('artifact_validate', { json: finalArtifact, expectedKind: 'report' })]
      },
      {
        content: finalArtifact,
        toolCalls: []
      }
    ];
    const progress: string[] = [];

    const output = await runWorkbenchHarness({
      messages: [{ role: 'user', content: 'Create a report.' }],
      workspace,
      budget: policyForModel('swe-pro'),
      onProgress: (message) => progress.push(message),
      initialTemperature: 0.25,
      completeTurn: async (request) => {
        seen.push({ toolsEnabled: request.toolsEnabled, messages: request.messages });
        const next = turns.shift();
        if (!next) throw new Error('No mock turn left.');
        return next;
      }
    });

    expect(JSON.parse(output).title).toBe('Office Report');
    await expect(readWorkspaceText(workspace, 'drafts/report.md')).resolves.toBe('workspace draft');
    expect(seen.map((turn) => turn.toolsEnabled)).toEqual([true, true, true]);
    expect(seen[1]?.messages.some((message) => message.role === 'tool' && message.name === 'workspace_write')).toBe(true);
    expect(progress).toContain('Working on working draft files');
    expect(progress).toContain('Completed artifact validation');
  });

  it('executes embedded bash XML when the model leaks tool calls into content', async () => {
    const workspace = await createWorkspace({
      sessionKey: 'sess_test_orchestrator_1234567890',
      baseRoot: tempRoot
    });
    const finalArtifact = JSON.stringify({
      kind: 'deck',
      title: 'Board Deck',
      audience: 'Board',
      tone: 'professional',
      slides: [{ title: 'Opening', bullets: ['Ready'] }],
      citations: [],
      nextQuestions: []
    });
    const leaked = [
      'Let me save a working draft.',
      '<tool_call><function=workspace_write><parameter=path>drafts/status.txt</parameter><parameter=content>deck-ready</parameter></function></tool_call>'
    ].join(' ');
    const turns: CompletionTurn[] = [
      { content: leaked, toolCalls: [] },
      { content: finalArtifact, toolCalls: [] }
    ];

    const output = await runWorkbenchHarness({
      messages: [{ role: 'user', content: 'Create a deck.' }],
      workspace,
      budget: policyForModel('swe-pro'),
      initialTemperature: 0.25,
      completeTurn: async () => {
        const next = turns.shift();
        if (!next) throw new Error('No mock turn left.');
        return next;
      }
    });

    expect(JSON.parse(output).kind).toBe('deck');
    await expect(readWorkspaceText(workspace, 'drafts/status.txt')).resolves.toBe('deck-ready');
  });

  it('forces a final no-tools turn after exhausting the tool-call budget', async () => {
    const workspace = await createWorkspace({
      sessionKey: 'sess_test_orchestrator_1234567890',
      baseRoot: tempRoot
    });
    const finalArtifact = JSON.stringify({
      kind: 'email',
      title: 'Status Email',
      audience: 'Manager',
      tone: 'professional',
      sections: [{ heading: 'Email', body: 'The tool budget was exhausted safely.', bullets: [] }],
      citations: [],
      nextQuestions: []
    });
    const toolsEnabled: boolean[] = [];

    const output = await runWorkbenchHarness({
      messages: [{ role: 'user', content: 'Create email.' }],
      workspace,
      budget: { ...policyForModel('swe-fast'), maxToolCalls: 1 },
      initialTemperature: 0.25,
      completeTurn: async (request) => {
        toolsEnabled.push(request.toolsEnabled);
        if (request.toolsEnabled) {
          return {
            content: '',
            toolCalls: [toolCall('workspace_list', {})]
          };
        }
        return { content: finalArtifact, toolCalls: [] };
      }
    });

    expect(JSON.parse(output).kind).toBe('email');
    expect(toolsEnabled).toEqual([true, false]);
  });
});

describe('Chat harness orchestrator', () => {
  it('executes web_search and returns a final plain reply', async () => {
    const toolsEnabled: boolean[] = [];
    const turns: CompletionTurn[] = [
      {
        content: '',
        toolCalls: [toolCall('web_search', { query: 'latest RBI repo rate' })]
      },
      {
        content: 'The RBI repo rate is 6.25% as of the latest policy update.',
        toolCalls: []
      }
    ];

    const output = await runChatHarness({
      messages: [
        { role: 'system', content: 'Answer concisely.' },
        { role: 'user', content: 'What is the current RBI repo rate?' }
      ],
      budget: policyForChat('swe-fast'),
      platformSearch: { baseURL: 'https://gateway.example', sessionKey: 'sess_test_chat_1234567890' },
      initialTemperature: 0.6,
      completeTurn: async (request) => {
        toolsEnabled.push(request.toolsEnabled);
        const next = turns.shift();
        if (!next) throw new Error('No mock turn left.');
        return next;
      }
    });

    expect(output).toContain('6.25%');
    expect(toolsEnabled).toEqual([true, true]);
  });

  it('forces a final no-tools turn after exhausting the chat tool budget', async () => {
    const toolsEnabled: boolean[] = [];

    const output = await runChatHarness({
      messages: [{ role: 'user', content: 'Summarize today\'s market news.' }],
      budget: { ...policyForChat('swe-fast'), maxToolCalls: 1 },
      platformSearch: { baseURL: 'https://gateway.example', sessionKey: 'sess_test_chat_1234567890' },
      initialTemperature: 0.6,
      completeTurn: async (request) => {
        toolsEnabled.push(request.toolsEnabled);
        if (request.toolsEnabled) {
          return {
            content: '',
            toolCalls: [toolCall('web_fetch', { url: 'https://example.com/news' })]
          };
        }
        return { content: 'Markets were mixed today with tech leading gains.', toolCalls: [] };
      }
    });

    expect(output).toContain('Markets were mixed');
    expect(toolsEnabled).toEqual([true, false]);
  });
});

function toolCall(name: string, args: unknown): ToolCall {
  return {
    id: `call_${name}_${Math.random().toString(16).slice(2)}`,
    function: { name, arguments: JSON.stringify(args) }
  };
}
