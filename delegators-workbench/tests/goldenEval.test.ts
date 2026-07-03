import { describe, expect, it } from 'vitest';
import { ArtifactDocumentSchema } from '../src/lib/shared';
import { goldenEvalCases, scoreArtifactAgainstGoldenCase } from '../server/goldenEval';

describe('golden eval harness', () => {
  it('scores slide-count fidelity for investor deck cases', () => {
    const artifact = ArtifactDocumentSchema.parse({
      kind: 'deck',
      primaryFormat: 'pptx',
      title: 'SpaceX',
      audience: 'Investors',
      tone: 'executive',
      executiveSummary: 'Summary',
      design: { template: 'executive-slate' },
      sections: [{ heading: 'Open', body: '', bullets: ['Point'] }],
      slides: Array.from({ length: 4 }, (_, index) => ({
        title: `Slide ${index + 1}`,
        bullets: ['Point']
      })),
      citations: []
    });

    const score = scoreArtifactAgainstGoldenCase(artifact, goldenEvalCases[0]);
    expect(score.passed).toBe(false);
    expect(score.issues.join(' ')).toMatch(/12 slides/i);
  });
});