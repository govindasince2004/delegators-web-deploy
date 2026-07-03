import type { WebSearchResult } from './workbenchTools.js';

type CacheEntry = {
  results: WebSearchResult[];
  storedAt: number;
};

const cache = new Map<string, CacheEntry>();
const ttlMs = Number.parseInt(process.env.WORKBENCH_SEARCH_CACHE_TTL_MS ?? '1800000', 10);
const maxEntries = Number.parseInt(process.env.WORKBENCH_SEARCH_CACHE_MAX ?? '256', 10);

function cacheKey(query: string, mode: string, maxResults: number): string {
  return `${mode}:${maxResults}:${query.trim().toLowerCase()}`;
}

export function getCachedSearch(query: string, mode: string, maxResults: number): WebSearchResult[] | null {
  const key = cacheKey(query, mode, maxResults);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > ttlMs) {
    cache.delete(key);
    return null;
  }
  return entry.results.map((result) => ({ ...result }));
}

export function setCachedSearch(
  query: string,
  mode: string,
  maxResults: number,
  results: WebSearchResult[]
): void {
  if (!results.length) return;
  if (cache.size >= maxEntries) {
    const oldest = [...cache.entries()].sort((left, right) => left[1].storedAt - right[1].storedAt)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  cache.set(cacheKey(query, mode, maxResults), {
    results: results.map((result) => ({ ...result })),
    storedAt: Date.now()
  });
}

export function clearSearchCache(): void {
  cache.clear();
}