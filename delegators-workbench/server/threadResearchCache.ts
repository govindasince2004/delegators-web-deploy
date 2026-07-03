import type { ArtifactDocument } from '../src/lib/shared.js';
import type { ResearchPack, ResearchSource } from './research.js';
import { briefReferencesThreadContext } from './research.js';
import { hashSessionKey } from './workspace.js';

type ThreadResearchEntry = {
  pack: ResearchPack;
  storedAt: number;
};

const cache = new Map<string, ThreadResearchEntry>();
const ttlMs = Number.parseInt(process.env.WORKBENCH_THREAD_RESEARCH_TTL_MS ?? '7200000', 10);
const sweepIntervalMs = Number.parseInt(process.env.WORKBENCH_THREAD_RESEARCH_SWEEP_MS ?? '1800000', 10);
let sweepTimer: NodeJS.Timeout | null = null;

export function sweepThreadResearchCache(now = Date.now()): number {
  let removed = 0;
  for (const [threadId, entry] of cache.entries()) {
    if (now - entry.storedAt > ttlMs) {
      cache.delete(threadId);
      removed += 1;
    }
  }
  return removed;
}

export function startThreadResearchCacheSweep(): void {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    sweepThreadResearchCache();
  }, sweepIntervalMs);
  sweepTimer.unref?.();
}

export function threadResearchCacheKey(sessionKey: string | undefined, threadId?: string): string | null {
  if (!threadId?.trim()) return null;
  const sessionScope = sessionKey?.trim() ? hashSessionKey(sessionKey.trim()) : 'anonymous';
  return `${sessionScope}:${threadId.trim()}`;
}

export function getThreadResearchPack(sessionKey: string | undefined, threadId?: string): ResearchPack | null {
  const cacheKey = threadResearchCacheKey(sessionKey, threadId);
  if (!cacheKey) return null;
  const entry = cache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > ttlMs) {
    cache.delete(cacheKey);
    return null;
  }
  return entry.pack;
}

export function setThreadResearchPack(
  sessionKey: string | undefined,
  threadId: string | undefined,
  pack: ResearchPack | null
): void {
  const cacheKey = threadResearchCacheKey(sessionKey, threadId);
  if (!cacheKey || !pack?.sources.length) return;
  cache.set(cacheKey, { pack, storedAt: Date.now() });
}

export function priorArtifactCitations(priorArtifacts: ArtifactDocument[] = []): Array<{ id?: string; label: string; url?: string }> {
  const seen = new Set<string>();
  const out: Array<{ id?: string; label: string; url?: string }> = [];
  for (const artifact of priorArtifacts) {
    for (const citation of artifact.citations ?? []) {
      const key = `${citation.id ?? ''}|${citation.label}|${citation.url ?? ''}`;
      if (seen.has(key) || !citation.label.trim()) continue;
      seen.add(key);
      out.push({ id: citation.id, label: citation.label, url: citation.url });
    }
  }
  return out;
}

export function researchPackFromPriorArtifacts(priorArtifacts: ArtifactDocument[], brief: string): ResearchPack | null {
  const citations = priorArtifactCitations(priorArtifacts);
  if (citations.length === 0) return null;
  if (
    !briefReferencesThreadContext(brief) &&
    !/\b(?:from (?:our|the) (?:research|conversation|deck|report)|our research|prior|earlier|thread|turn (?:it|this|that)|based on (?:our|the))\b/i.test(brief)
  ) {
    return null;
  }

  const sources: ResearchSource[] = citations
    .filter((citation) => citation.id && /^S\d+$/.test(citation.id))
    .map((citation, index) => ({
      id: citation.id!,
      title: citation.label,
      url: citation.url ?? '',
      snippet: citation.label,
      highlights: [],
      publishedDate: undefined,
      domain: citation.url ? safeDomain(citation.url) : 'thread-memory',
      role: 'other' as const,
      freshness: 'unknown' as const,
      anchorMatches: 0,
      relevanceScore: 0.5 - index * 0.01
    }));

  if (sources.length === 0) return null;

  return {
    query: 'thread-prior-research',
    queries: ['thread-prior-research'],
    capturedAt: new Date().toISOString(),
    requestedSubject: undefined,
    confidence: 'low',
    summary: `Reusing ${sources.length} captured source${sources.length === 1 ? '' : 's'} from prior thread artifacts.`,
    question: undefined,
    sources,
    domains: [...new Set(sources.map((source) => source.domain).filter(Boolean))],
    roleCoverage: ['other'],
    contradictionCandidates: [],
    assets: [],
    usedProvider: 'mixed'
  };
}

export function mergeThreadResearchPacks(
  cached: ResearchPack | null,
  prior: ResearchPack | null,
  fresh: ResearchPack | null
): ResearchPack | null {
  const packs = [cached, prior, fresh].filter((pack): pack is ResearchPack => Boolean(pack?.sources.length));
  if (packs.length === 0) return null;
  if (packs.length === 1) return packs[0];

  const sourceMap = new Map<string, ResearchSource>();
  for (const pack of packs) {
    for (const source of pack.sources) {
      if (!sourceMap.has(source.id)) sourceMap.set(source.id, source);
    }
  }
  const sources = [...sourceMap.values()].sort((left, right) => right.relevanceScore - left.relevanceScore);
  const primary = fresh ?? cached ?? prior!;
  return {
    ...primary,
    sources,
    queries: [...new Set(packs.flatMap((pack) => pack.queries))],
    summary: [
      primary.summary,
      prior ? 'Prior thread sources merged.' : '',
      cached ? 'Cached thread research reused.' : ''
    ].filter(Boolean).join(' '),
    assets: packs.flatMap((pack) => pack.assets).filter((asset, index, values) =>
      values.findIndex((item) => item.id === asset.id) === index
    ).slice(0, 3),
    usedProvider: fresh?.usedProvider ?? cached?.usedProvider ?? prior?.usedProvider ?? 'mixed'
  };
}

export function shouldReuseThreadResearch(brief: string, priorArtifacts: ArtifactDocument[]): boolean {
  if (priorArtifacts.length === 0) return false;
  if (priorArtifactCitations(priorArtifacts).length === 0) return false;
  return briefReferencesThreadContext(brief) ||
    /\b(?:from (?:our|the) (?:research|conversation|deck|report)|also|another|turn (?:it|this)|based on (?:our|the)|same (?:research|sources))\b/i.test(brief);
}

function safeDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'thread-memory';
  }
}

export function clearThreadResearchCache(sessionKey?: string, threadId?: string): void {
  if (!threadId) {
    cache.clear();
    return;
  }
  const cacheKey = threadResearchCacheKey(sessionKey, threadId);
  if (cacheKey) cache.delete(cacheKey);
}