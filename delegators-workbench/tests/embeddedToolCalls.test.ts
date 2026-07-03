import { describe, expect, it } from 'vitest';
import {
  coalesceCompletionTurn,
  looksLikeEmbeddedToolPayload,
  parseEmbeddedToolCalls,
  stripEmbeddedToolPayload
} from '../server/embeddedToolCalls';

describe('embedded tool call parsing', () => {
  const leaked = [
    'I have strong research data from the searches already completed. Let me build the deck now.',
    '<tool_call>',
    '<function=bash>',
    '<parameter=command>pip install python-pptx Pillow requests 2>&1 | tail -5</parameter>',
    '<parameter=timeout>60</parameter>',
    '</function>',
    '</tool_call>'
  ].join(' ');

  it('detects embedded tool-call XML markers', () => {
    expect(looksLikeEmbeddedToolPayload(leaked)).toBe(true);
    expect(looksLikeEmbeddedToolPayload('All set.')).toBe(false);
  });

  it('strips embedded tool-call XML from assistant prose', () => {
    expect(stripEmbeddedToolPayload(leaked)).toBe(
      'I have strong research data from the searches already completed. Let me build the deck now.'
    );
  });

  it('maps bash command XML into terminal_run tool calls', () => {
    const parsed = parseEmbeddedToolCalls(leaked);
    expect(parsed.cleanedContent).toContain('Let me build the deck now.');
    expect(parsed.toolCalls).toHaveLength(1);
    expect(parsed.toolCalls[0]?.function.name).toBe('terminal_run');
    expect(JSON.parse(parsed.toolCalls[0]?.function.arguments ?? '{}')).toEqual({
      runtime: 'bash',
      code: 'pip install python-pptx Pillow requests 2>&1 | tail -5',
      timeoutMs: 60
    });
  });

  it('coalesces embedded calls with native tool_calls', () => {
    const coalesced = coalesceCompletionTurn({
      content: leaked,
      toolCalls: [{
        id: 'call_workspace',
        function: {
          name: 'workspace_list',
          arguments: '{}'
        }
      }]
    });
    expect(coalesced.toolCalls).toHaveLength(2);
    expect(coalesced.toolCalls[0]?.function.name).toBe('workspace_list');
    expect(coalesced.toolCalls[1]?.function.name).toBe('terminal_run');
    expect(coalesced.content).not.toContain('<tool_call');
  });
});