import { describe, expect, it } from 'vitest';
import {
  clearThreadResearchCache,
  getThreadResearchPack,
  setThreadResearchPack
} from '../server/threadResearchCache';
import type { ResearchPack } from '../server/research';

const pack = (label: string): ResearchPack => ({
  query: label,
  queries: [label],
  capturedAt: new Date().toISOString(),
  confidence: 'low',
  summary: label,
  sources: [{
    id: 'S1',
    title: label,
    snippet: label,
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
});

describe('thread research cache isolation', () => {
  it('scopes cached research by session key and thread id', () => {
    clearThreadResearchCache();
    setThreadResearchPack('sess_user_a_12345678901234567890', 'thread-1', pack('user-a'));
    setThreadResearchPack('sess_user_b_12345678901234567890', 'thread-1', pack('user-b'));

    expect(getThreadResearchPack('sess_user_a_12345678901234567890', 'thread-1')?.summary).toBe('user-a');
    expect(getThreadResearchPack('sess_user_b_12345678901234567890', 'thread-1')?.summary).toBe('user-b');
    expect(getThreadResearchPack('sess_user_a_12345678901234567890', 'thread-2')).toBeNull();
  });
});