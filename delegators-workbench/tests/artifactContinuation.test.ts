import { describe, expect, it } from 'vitest';
import {
  artifactChatRecoveryNotice,
  canRestartSavedArtifact,
  coalesceAssistantParagraphs,
  isArtifactContinuation,
  formatAssistantProse,
  looksLikeRawArtifactPayload,
  looksLikeRawToolCallPayload,
  sanitizeChatReply,
  splitAssistantParagraphs,
  stripChatMarkdownNoise,
  stripDecorativeSlop,
  stripRawToolCallPayload,
  unwrapChatMarkdownEmphasis
} from '../src/lib/artifactContinuation';

describe('anti-slop chat sanitation', () => {
  it('strips decorative emoji and tidies whitespace', () => {
    expect(stripDecorativeSlop('Done! 🎉 Your deck is ready 🚀')).toBe('Done! Your deck is ready');
    expect(stripDecorativeSlop('✅ Saved ✨')).toBe('Saved');
  });

  it('preserves legitimate prose, markdown bold, and trademark/symbols', () => {
    expect(stripDecorativeSlop('The **key** point is clear.')).toBe('The **key** point is clear.');
    expect(stripDecorativeSlop('Delegators™ © 2026')).toBe('Delegators™ © 2026');
  });

  it('collapses excessive blank lines', () => {
    expect(stripDecorativeSlop('a\n\n\n\nb')).toBe('a\n\nb');
  });

  it('sanitizeChatReply applies the slop strip', () => {
    expect(sanitizeChatReply('All set 🎉')).toBe('All set');
  });

  it('strips orphan asterisk decoration lines', () => {
    expect(stripDecorativeSlop('Ready.\n***\nDone.')).toBe('Ready.\nDone.');
    expect(stripDecorativeSlop('**')).toBe('');
  });
});

describe('assistant prose formatting', () => {
  it('unwraps markdown emphasis and strips divider noise', () => {
    expect(unwrapChatMarkdownEmphasis('The **key** point is _clear_.')).toBe('The key point is clear.');
    expect(stripChatMarkdownNoise('Ready.\n---\n**Next** step')).toBe('Ready.\n\nNext step');
  });

  it('normalizes category lines, bullets, and coalesces soft wraps', () => {
    const raw = [
      'Hey! Sure thing — tell me what exactly?',
      'I can help with that.',
      '',
      '***',
      '**Code**  -  writing, debugging',
      '- looking up facts',
      'Research — market sizing'
    ].join('\n');
    expect(formatAssistantProse(raw)).toBe([
      'Hey! Sure thing — tell me what exactly? I can help with that.',
      [
        'Code: writing, debugging',
        'looking up facts',
        'Research: market sizing'
      ].join('\n')
    ].join('\n\n'));
  });

  it('splits formatted prose into render blocks', () => {
    const blocks = splitAssistantParagraphs('First paragraph.\n\nCode: detail\n\nMore: lines');
    expect(blocks).toEqual([
      'First paragraph.',
      'Code: detail',
      'More: lines'
    ]);
  });

  it('joins wrapped prose inside a stanza instead of breaking every line', () => {
    const wrapped = coalesceAssistantParagraphs('This is one long thought that\nwraps awkwardly mid sentence.');
    expect(wrapped).toBe('This is one long thought that wraps awkwardly mid sentence.');
    const stanzas = coalesceAssistantParagraphs('First thought.\n\nSecond thought.');
    expect(stanzas).toBe('First thought.\n\nSecond thought.');
  });
});

describe('artifact continuation routing', () => {
  it.each([
    'continue where you left',
    'continue where you elft',
    'resume the PPT',
    'retry',
    'keep going',
    'finish the deck',
    'build it',
    'try it again',
    'pick it up where it failed'
  ])('recognizes %s as a continuation', (prompt) => {
    expect(isArtifactContinuation(prompt)).toBe(true);
  });

  it('does not hijack an unrelated conversation turn', () => {
    expect(isArtifactContinuation('What was the revenue assumption?')).toBe(false);
  });

  it('restarts only recoverable saved requests', () => {
    expect(canRestartSavedArtifact(true, 'failed', 'run-old')).toBe(true);
    expect(canRestartSavedArtifact(true, 'interrupted', 'run-old')).toBe(true);
    expect(canRestartSavedArtifact(true, undefined, undefined)).toBe(true);
    expect(canRestartSavedArtifact(true, 'completed', 'run-done')).toBe(true);
    expect(canRestartSavedArtifact(true, 'running', 'run-live')).toBe(false);
    expect(canRestartSavedArtifact(true, 'waiting_input', 'run-live')).toBe(false);
    expect(canRestartSavedArtifact(false, 'failed', 'run-old')).toBe(false);
  });
});

describe('raw tool-call chat protection', () => {
  const leaked = 'Building now. <tool_call><function=bash><parameter=command>pip install python-pptx</parameter></function></tool_call>';

  it('detects tool-call XML leaked into chat', () => {
    expect(looksLikeRawToolCallPayload(leaked)).toBe(true);
  });

  it('strips tool-call XML while preserving prose', () => {
    expect(stripRawToolCallPayload(leaked)).toBe('Building now.');
    expect(sanitizeChatReply(leaked)).toBe('Building now.');
  });
});

describe('raw artifact chat protection', () => {
  const rawDeck = `My apologies - here is your deck:\n\n\`\`\`json
  {
    "kind": "deck",
    "primaryFormat": "pptx",
    "title": "Board Deck",
    "sections": [],
    "slides": [{ "title": "Opening", "bullets": [] }]
  }
  \`\`\``;

  it('detects an artifact schema dumped into chat', () => {
    expect(looksLikeRawArtifactPayload(rawDeck)).toBe(true);
    expect(sanitizeChatReply(rawDeck)).toBe(artifactChatRecoveryNotice);
  });

  it('allows ordinary short JSON examples', () => {
    expect(looksLikeRawArtifactPayload('```json\n{"status":"ok"}\n```')).toBe(false);
  });
});
