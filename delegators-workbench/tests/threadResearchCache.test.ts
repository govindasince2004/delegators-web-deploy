import { describe, expect, it } from 'vitest';
import { ArtifactDocumentSchema } from '../src/lib/shared';
import {
  mergeThreadResearchPacks,
  priorArtifactCitations,
  researchPackFromPriorArtifacts,
  shouldReuseThreadResearch
} from '../server/threadResearchCache';

const priorReport = ArtifactDocumentSchema.parse({
  kind: 'report',
  primaryFormat: 'pdf',
  title: 'Research pack',
  audience: 'Team',
  tone: 'professional',
  executiveSummary: 'Findings.',
  sections: [{ heading: 'Finding', body: 'Data point.', bullets: [] }],
  citations: [{ id: 'S1', label: 'Benchmark report', url: 'https://example.com/benchmark' }]
});

describe('thread research cache', () => {
  it('extracts prior artifact citations without inventing snippets', () => {
    expect(priorArtifactCitations([priorReport])).toEqual([
      { id: 'S1', label: 'Benchmark report', url: 'https://example.com/benchmark' }
    ]);
  });

  it('reuses thread research when the brief references prior work', () => {
    expect(shouldReuseThreadResearch('Create a pdf report from our research', [priorReport])).toBe(true);
    expect(shouldReuseThreadResearch('Make a completely new topic deck on cats', [priorReport])).toBe(false);
  });

  it('builds a prior-artifact research pack only from captured citations', () => {
    const pack = researchPackFromPriorArtifacts([priorReport], 'Turn our research into an executive report');
    expect(pack?.sources[0]?.id).toBe('S1');
    expect(pack?.sources[0]?.title).toBe('Benchmark report');
    expect(pack?.summary).toMatch(/Reusing 1 captured source/);
  });

  it('merges cached, prior, and fresh research without duplicate source ids', () => {
    const prior = researchPackFromPriorArtifacts([priorReport], 'from our research');
    const fresh = {
      ...prior!,
      sources: [
        prior!.sources[0],
        { ...prior!.sources[0], id: 'S2', title: 'Fresh source', url: 'https://example.com/fresh', relevanceScore: 0.9 }
      ]
    };
    const merged = mergeThreadResearchPacks(prior, prior, fresh);
    expect(merged?.sources.map((source) => source.id)).toEqual(['S2', 'S1']);
  });
});