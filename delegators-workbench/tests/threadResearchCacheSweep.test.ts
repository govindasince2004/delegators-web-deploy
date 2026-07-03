import { describe, expect, it } from 'vitest';
import { clearThreadResearchCache, setThreadResearchPack, sweepThreadResearchCache } from '../server/threadResearchCache';
import type { ResearchPack } from '../server/research';

describe('thread research cache sweep', () => {
  it('evicts expired entries during sweep', () => {
    clearThreadResearchCache();
    const pack: ResearchPack = {
      query: 'test',
      queries: ['test'],
      capturedAt: new Date().toISOString(),
      confidence: 'low',
      summary: 'test',
      sources: [{
        id: 'S1',
        title: 'Example',
        snippet: 'Snippet',
        url: 'https://example.com',
        domain: 'example.com',
        role: 'other',
        freshness: 'unknown',
        anchorMatches: 0,
        relevanceScore: 1
      }],
      domains: ['example.com'],
      roleCoverage: ['other'],
      contradictionCandidates: [],
      assets: [],
      usedProvider: 'mixed'
    };
    setThreadResearchPack('sess_test_thread_cache_1234567890', 'thread-old', pack);
    expect(sweepThreadResearchCache(Date.now() + 8 * 60 * 60 * 1000)).toBe(1);
  });
});