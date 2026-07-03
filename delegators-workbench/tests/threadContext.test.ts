import { describe, expect, it } from 'vitest';
import {
  appendArtifactHistory,
  artifactFormatLabel,
  recentConversation,
  renderThreadContext
} from '../src/lib/threadContext';
import { ArtifactDocumentSchema } from '../src/lib/shared';

const report = ArtifactDocumentSchema.parse({
  kind: 'report',
  primaryFormat: 'pdf',
  title: '2026 Market Brief',
  audience: 'Leadership',
  tone: 'Executive',
  executiveSummary: 'Current market findings.',
  sections: [{ heading: 'Finding', body: 'Demand increased.', bullets: [] }]
});

const deck = ArtifactDocumentSchema.parse({
  kind: 'deck',
  primaryFormat: 'pptx',
  title: '2026 Market Deck',
  audience: 'Leadership',
  tone: 'Executive',
  executiveSummary: 'Presentation version.',
  sections: [{ heading: 'Finding', body: 'Demand increased.', bullets: [] }],
  slides: [{ title: 'Finding', bullets: ['Demand increased.'] }]
});

describe('thread context', () => {
  it('keeps recent conversation and prior artifact content for cross-format work', () => {
    const conversation = recentConversation([
      { role: 'user', text: 'Research the 2026 market.' },
      { role: 'assistant', text: 'I created the report.' },
      { role: 'user', text: '@ppt turn it into a board deck.' }
    ]);
    const context = renderThreadContext(conversation, [report]);

    expect(context).toContain('Research the 2026 market.');
    expect(context).toContain('Format: PDF');
    expect(context).toContain('Demand increased.');
    expect(context).toContain('facts only');
    expect(context).not.toContain('"slides"');
  });

  it('appends a new format without deleting the previous artifact', () => {
    const history = appendArtifactHistory([report], deck);

    expect(history).toHaveLength(2);
    expect(history.map(artifactFormatLabel)).toEqual(['PDF', 'PPTX']);
  });

  it('does not duplicate the same completed artifact during run replay', () => {
    expect(appendArtifactHistory([report], report)).toHaveLength(1);
  });
});
