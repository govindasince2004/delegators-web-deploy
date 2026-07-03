import { describe, expect, it } from 'vitest';
import { ArtifactDocumentSchema } from '../src/lib/shared';
import { exportFormatsForArtifact, primaryExportFormat } from '../src/lib/downloads';

describe('artifact download formats', () => {
  it('puts the requested PowerPoint export first for decks', () => {
    const deck = ArtifactDocumentSchema.parse({
      kind: 'deck',
      primaryFormat: 'pptx',
      title: 'Board deck',
      audience: 'Board',
      tone: 'executive',
      executiveSummary: 'A concise investor narrative.',
      sections: [{ heading: 'Thesis', body: 'The product has a clear wedge.', bullets: ['Governed AI work'] }],
      slides: [{ title: 'Governed AI work', bullets: ['One account', 'Finished artifacts'] }]
    });

    expect(primaryExportFormat(deck)).toBe('pptx');
    expect(exportFormatsForArtifact(deck)[0]).toBe('pptx');
  });
});
