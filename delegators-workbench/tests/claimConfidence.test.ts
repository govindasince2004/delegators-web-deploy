import { describe, expect, it } from 'vitest';
import { ArtifactDocumentSchema } from '../src/lib/shared';
import { applyClaimConfidence } from '../server/claimConfidence';

describe('claim confidence pass', () => {
  it('labels external claims and preserves attached source ids', () => {
    const artifact = ArtifactDocumentSchema.parse({
      kind: 'report',
      primaryFormat: 'pdf',
      title: 'Brief',
      audience: 'Team',
      tone: 'professional',
      executiveSummary: 'Market revenue reached $4.2B in 2026.',
      sections: [{
        heading: 'Findings',
        body: 'Enterprise adoption accelerated across North America.',
        bullets: ['Cloud spend rose 12% year over year']
      }],
      citations: []
    });

    const pack = {
      query: 'cloud spend',
      queries: ['cloud spend'],
      capturedAt: new Date().toISOString(),
      confidence: 'high' as const,
      summary: 'Captured sources.',
      sources: [{
        id: 'S1',
        title: 'Cloud benchmark',
        url: 'https://example.com/cloud',
        snippet: 'Cloud spend rose 12% year over year across enterprise accounts.',
        highlights: [],
        domain: 'example.com',
        role: 'independent' as const,
        freshness: 'recent' as const,
        anchorMatches: 2,
        relevanceScore: 0.8
      }],
      domains: ['example.com'],
      roleCoverage: ['independent' as const],
      contradictionCandidates: [],
      assets: [],
      usedProvider: 'exa' as const
    };

    const labeled = applyClaimConfidence(artifact, pack);
    expect(labeled.sections[0]?.bullets[0]).toMatch(/\[CONFIRMED\]/);
    expect(labeled.sections[0]?.sourceIds).toContain('S1');
    expect(labeled.citations.some((citation) => citation.id === 'S1')).toBe(true);
  });
});