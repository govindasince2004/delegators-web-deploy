import { describe, expect, it, beforeEach } from 'vitest';
import { clearSearchCache, getCachedSearch, setCachedSearch } from '../server/searchCache';

describe('search cache', () => {
  beforeEach(() => {
    clearSearchCache();
  });

  it('stores and returns cached search results', () => {
    const results = [{ title: 'Example', snippet: 'Snippet text here', url: 'https://example.com' }];
    setCachedSearch('battery market 2026', 'deep', 6, results);
    expect(getCachedSearch('battery market 2026', 'deep', 6)).toEqual(results);
  });

  it('misses on different query or mode', () => {
    setCachedSearch('alpha', 'deep', 6, [{ title: 'A', snippet: 'Alpha snippet', url: 'https://a.test' }]);
    expect(getCachedSearch('beta', 'deep', 6)).toBeNull();
    expect(getCachedSearch('alpha', 'fast', 6)).toBeNull();
  });
});