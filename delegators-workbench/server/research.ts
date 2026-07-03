import { stripSkillTags } from '../src/lib/skills.js';
import type { ArtifactAsset } from '../src/lib/shared.js';
import { collectResearchAssets } from './researchAssets.js';
import type { RunDepthTier } from './agenticDepth.js';
import { researchFetchBytes, researchSourceCap, researchWaveCount } from './agenticDepth.js';
import {
  scheduleResearchGapQueries,
  scheduleResearchQueries,
  tieredResearchSummary
} from './researchScheduler.js';
import { webFetch, webSearch, type WebFetchResult, type WebSearchResult } from './workbenchTools.js';

export type ResearchConfidence = 'high' | 'low' | 'none';
export type ResearchSourceRole = 'official' | 'primary-data' | 'independent' | 'news' | 'community' | 'other';
export type ResearchFreshness = 'recent' | 'dated' | 'unknown';

export type ResearchSource = WebSearchResult & {
  id: string;
  domain: string;
  role: ResearchSourceRole;
  freshness: ResearchFreshness;
  fetched?: Pick<WebFetchResult, 'text' | 'title' | 'highlights'>;
  anchorMatches: number;
  relevanceScore: number;
};

export type ResearchContradictionCandidate = {
  metric: string;
  values: string[];
  sourceIds: string[];
};

export type ResearchPack = {
  query: string;
  queries: string[];
  capturedAt: string;
  requestedSubject?: string;
  confidence: ResearchConfidence;
  summary: string;
  question?: string;
  sources: ResearchSource[];
  domains: string[];
  roleCoverage: ResearchSourceRole[];
  contradictionCandidates: ResearchContradictionCandidate[];
  assets: ArtifactAsset[];
  usedProvider: 'firecrawl' | 'exa' | 'duckduckgo' | 'direct' | 'mixed' | 'none';
};

// Wide trigger: any brief that makes claims about the outside world should get
// current, source-backed grounding. Self-contained work (formatting supplied
// content, personal letters, resumes from the user's own history) stays out so
// runs remain fast and credits aren't spent on searches that can't help.
const researchTrigger = new RegExp(
  '\\b(?:' + [
    'latest', 'current', 'recent', 'research', 'news', 'announced?', 'launch(?:ed)?', 'market',
    'statistics?', 'data', 'cite', 'citations?', 'sources?', 'pricing', 'project', 'report on',
    'trends?', 'industry', 'competitors?', 'competitive', 'benchmarks?', 'best practices?',
    'state of', 'landscape', 'outlook', 'forecast', 'analysis of', 'compare', 'comparison', 'vs\\.?',
    '20\\d{2}', 'regulations?', 'compliance', 'standards?', 'top \\d+', 'case stud(?:y|ies)'
  ].join('|') + ')\\b',
  'i'
);

// Kind-aware research tiers:
// - resume/email are personal documents — search only on an EXPLICIT request.
// - decks usually present the user's own numbers ("ARR trend chart" is not a
//   web question) — search on explicit requests or clearly external subjects.
// - reports/assignments default wide: they make claims about the world.
const explicitResearchTrigger = /\b(research|cite|citations?|sources?|latest|current|news|up[- ]to[- ]date)\b/i;
// (?<!-) keeps compounds like "mid-market" and "go-to-market" from triggering.
const externalSubjectTrigger = /(?<!-)\b(market|industry|competitors?|competitive|landscape|benchmarks?|state of|outlook|regulations?|case stud(?:y|ies))\b/i;
const uploadedOnlyEvidenceTrigger = /\b(?:use|using|from|based on|ground(?:ed)? in)\b[\s\S]{0,120}\b(?:uploaded|supplied|provided|attached|reference|references|screenshots?|files?|visible)\b[\s\S]{0,120}\b(?:only|evidence|facts?)\b|\b(?:use only|only use)\b[\s\S]{0,120}\b(?:uploaded|supplied|provided|attached|visible|screenshot|screenshots?|reference|references|files?)\b|\b(?:facts?|data|claims?)\b[\s\S]{0,80}\b(?:visible|shown|supplied|provided|uploaded)\b/i;

export function briefReferencesThreadContext(brief: string): boolean {
  const clean = stripSkillTags(brief).replace(/\s+/g, ' ').trim();
  return /\b(?:on|about|for|from|using|with|covering)\s+(?:this|that|these|those|it|the same(?: topic| subject| news| story)?|the above|what (?:we|you) (?:discussed|found|searched|talked about)|your (?:findings|research|summary|update|answer))\b|\b(?:turn|make|build|create|draft|write)\b[\s\S]{0,50}\b(?:this|that|it)\b/i.test(clean);
}

export function buildArtifactResearchBrief(brief: string, threadSummary?: string): string {
  const clean = stripSkillTags(brief) || brief;
  const summary = threadSummary?.trim();
  if (!summary || !briefReferencesThreadContext(clean)) return clean;
  return `${clean}\n\nPrior conversation facts:\n${summary}`;
}

export function briefNeedsResearch(
  brief: string,
  kind?: string,
  options: { hasReferences?: boolean } = {}
): boolean {
  const clean = stripSkillTags(brief);
  if (options.hasReferences && uploadedOnlyEvidenceTrigger.test(clean)) return false;
  if (kind === 'resume' || kind === 'email') return explicitResearchTrigger.test(clean);
  if (kind === 'deck' || kind === 'sheet') {
    return explicitResearchTrigger.test(clean) || externalSubjectTrigger.test(clean);
  }
  return researchTrigger.test(clean);
}

export function buildResearchQuery(brief: string): string {
  const clean = stripSkillTags(brief).replace(/\s+/g, ' ').trim();
  const focused = clean
    .replace(/^(?:please\s+)?(?:create|make|build|write|prepare|produce|design|generate)\s+/i, '')
    .replace(/^(?:(?:a|an|the)\s+)?(?:(?:current|latest|recent|deep|detailed|comprehensive|cited|professional|board-ready|investor-ready)\s+){0,6}(?:report|deck|presentation|pptx?|document|brief|analysis|comparison|artifact)\s+(?:on|about|of|comparing)?\s*/i, '')
    .replace(/\b(?:and|then)\s+(?:create|make|build|deliver|export|turn)\b[\s\S]*$/i, '')
    .trim();
  return (focused || clean).slice(0, 180);
}

export function buildResearchQueries(brief: string): string[] {
  const base = buildResearchQuery(brief);
  const subject = extractRequestedSubject(brief);
  const anchors = extractResearchAnchors(brief);
  const focus = subject
    ? `"${subject}"`
    : anchors.length > 0
      ? anchors.map((anchor) => `"${anchor}"`).join(' ')
      : base;
  const candidates = [
    base,
    `${focus} official source announcement`,
    `${focus} statistics data report`,
    `${focus} independent analysis criticism`,
    `${focus} latest news ${new Date().getUTCFullYear()}`
  ].filter(Boolean);
  return [...new Set(candidates)].slice(0, 5);
}

export function extractResearchAnchors(brief: string): string[] {
  const clean = stripSkillTags(brief);
  const projectMatch = clean.match(/\bproject\s+['"]?([a-z0-9][a-z0-9 .:-]{1,60}?)['"]?\s+by\s+([a-z][a-z0-9 .&-]{1,60})/i);
  if (projectMatch) {
    return [projectMatch[1], projectMatch[2]].map(cleanSubjectFragment).map(normalizeAnchor).filter(Boolean);
  }

  const quoted = [...clean.matchAll(/["']([^"']{3,60})["']/g)]
    .map((match) => normalizeAnchor(match[1]))
    .filter(Boolean);
  if (quoted.length > 0) return quoted.slice(0, 3);

  return [];
}

export function extractRequestedSubject(brief: string): string | undefined {
  const clean = stripSkillTags(brief);
  const match = clean.match(/\b(project\s+['"]?[a-z0-9][a-z0-9 .:-]{1,60}['"]?\s+by\s+[a-z][a-z0-9 .&-]{1,60})/i);
  if (match) return cleanSubjectFragment(match[1].trim());
  return undefined;
}

async function runResearchTiers(
  tiers: ReturnType<typeof scheduleResearchQueries>,
  platform: { baseURL: string; sessionKey: string } | undefined,
  wave: number,
  onStatus?: (message: string) => void
): Promise<WebSearchResult[]> {
  onStatus?.(tieredResearchSummary(tiers, wave));
  const searchBatches = await Promise.all(
    tiers.map((tier) =>
      webSearch(tier.query, {
        platform,
        maxResults: tier.maxResults,
        fresh: true,
        mode: tier.mode
      }).catch(() => [] as WebSearchResult[])
    )
  );
  return searchBatches.flat();
}

export async function prepareResearchPack(options: {
  brief: string;
  delegatorsBaseURL?: string;
  sessionKey?: string;
  includeImages?: boolean;
  depthTier?: RunDepthTier;
  onStatus?: (message: string) => void;
}): Promise<ResearchPack | null> {
  if (!briefNeedsResearch(options.brief)) return null;

  // All web search/fetch routes through the Delegators gateway (managed Firecrawl
  // pool, metered against the plan). The Workbench never holds a search key.
  const platform = options.delegatorsBaseURL && options.sessionKey
    ? { baseURL: options.delegatorsBaseURL, sessionKey: options.sessionKey }
    : undefined;

  const depthTier = options.depthTier ?? 'standard';
  const query = buildResearchQuery(options.brief);
  const anchors = extractResearchAnchors(options.brief);
  const requestedSubject = extractRequestedSubject(options.brief);
  const directResults: WebSearchResult[] = extractProvidedUrls(options.brief).map((url) => ({
    title: 'User-provided source',
    snippet: 'Source supplied during artifact clarification.',
    url,
    provider: 'direct'
  }));

  const allQueries: string[] = [];
  let results: WebSearchResult[] = await runResearchTiers(
    scheduleResearchQueries(options.brief, depthTier),
    platform,
    1,
    options.onStatus
  );
  allQueries.push(...scheduleResearchQueries(options.brief, depthTier).map((tier) => tier.query));

  const waves = researchWaveCount(depthTier);
  const preliminary = preliminarySearchConfidence(dedupeResults(results), anchors);
  if (waves > 1 && preliminary === 'high') {
    options.onStatus?.('Strong initial sources — deepening skipped');
  } else {
    let existingDomains: string[] = [];
    for (let wave = 2; wave <= waves; wave += 1) {
      existingDomains = [...new Set(results.map((result) => sourceDomain(result.url)).filter(Boolean))];
      const gapTiers = scheduleResearchGapQueries(options.brief, wave, existingDomains);
      allQueries.push(...gapTiers.map((tier) => tier.query));
      const waveResults = await runResearchTiers(gapTiers, platform, wave, options.onStatus);
      results = [...results, ...waveResults];
      if (preliminarySearchConfidence(dedupeResults(results), anchors) === 'high') break;
    }
  }

  const deduped = selectDiverseResults(dedupeResults([
    ...directResults,
    ...dedupeResults(results).sort((left, right) => resultPriority(right, anchors) - resultPriority(left, anchors))
  ]), requestedSubject, researchSourceCap(depthTier));
  options.onStatus?.(deduped.length > 0 ? `Reviewing ${deduped.length} sources` : 'No strong public sources found yet');

  const fetchedSources = await mapWithConcurrency(deduped, 6, async (result) => {
    const fetched = result.url
      ? await webFetch(result.url, {
          platform,
          maxBytes: researchFetchBytes(depthTier),
          fresh: true
        }).catch(() => null)
      : null;
    const haystack = [
      result.title,
      result.snippet,
      ...(result.highlights ?? []),
      fetched?.title ?? '',
      ...(fetched?.highlights ?? []),
      fetched?.text ?? ''
    ].join(' ');

    const anchorMatches = scoreAnchors(haystack, anchors);
    const role = classifySourceRole(result, requestedSubject);
    return {
      ...result,
      domain: sourceDomain(result.url),
      role,
      freshness: classifyFreshness(result.publishedDate),
      fetched: fetched ? { text: fetched.text, title: fetched.title, highlights: fetched.highlights } : undefined,
      anchorMatches,
      relevanceScore: sourceRelevance(result, anchorMatches, role)
    };
  });
  const sources: ResearchSource[] = fetchedSources
    .sort((left, right) => right.relevanceScore - left.relevanceScore)
    .map((source, index) => ({ ...source, id: `S${index + 1}` }));
  const contradictionCandidates = findContradictionCandidates(sources);
  const assets = options.includeImages
    ? await collectResearchAssets(sources, options.onStatus, requestedSubject ?? query)
    : [];

  const confidence = classifyConfidence(sources, anchors);
  return {
    query,
    queries: [...new Set(allQueries)],
    capturedAt: new Date().toISOString(),
    requestedSubject,
    confidence,
    summary: summarizeResearch(confidence, requestedSubject, sources.length),
    question: buildResearchQuestion(confidence, requestedSubject),
    sources,
    domains: [...new Set(sources.map((source) => source.domain).filter(Boolean))],
    roleCoverage: [...new Set(sources.map((source) => source.role))],
    contradictionCandidates,
    assets,
    usedProvider: classifyProvider(sources)
  };
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(values[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export function renderResearchPackMarkdown(pack: ResearchPack): string {
  const lines = [
    '# Research Pack',
    '',
    `Query: ${pack.query}`,
    `Queries: ${pack.queries.join(' | ')}`,
    `Captured: ${pack.capturedAt}`,
    `Confidence: ${pack.confidence}`,
    `Provider: ${pack.usedProvider}`,
    `Domains: ${pack.domains.join(', ') || 'none'}`,
    `Source roles: ${pack.roleCoverage.join(', ') || 'none'}`,
    `Source images: ${pack.assets.length}`,
    pack.requestedSubject ? `Requested subject: ${pack.requestedSubject}` : '',
    `Summary: ${pack.summary}`,
    '',
    'Rule: Use only source-backed claims. If confidence is not high, do not present the requested subject as publicly verified.',
    'Citation rule: Cite the source IDs that directly support each external claim; do not cite a source merely because it is topically related.',
    ''
  ].filter(Boolean);

  if (pack.question) {
    lines.push(`Clarification question: ${pack.question}`, '');
  }

  if (pack.assets.length > 0) {
    lines.push('## Available source images');
    lines.push('Use `imageAssetId` on a slide or section to place one of these validated images.');
    pack.assets.forEach((asset) => {
      lines.push(`- ${asset.id}: ${asset.alt} (${asset.width}x${asset.height}); attribution: ${asset.attribution}; source page: ${asset.sourcePageUrl}`);
    });
    lines.push('');
  }

  if (pack.contradictionCandidates.length > 0) {
    lines.push('## Contradiction candidates');
    lines.push('These sources report different values for the same named metric. Do not silently choose one: reconcile scope/date/methodology or present the disagreement explicitly.');
    pack.contradictionCandidates.forEach((candidate) => {
      lines.push(`- ${candidate.metric}: ${candidate.values.join(' vs ')} (${candidate.sourceIds.join(', ')})`);
    });
    lines.push('');
  }

  if (pack.sources.length === 0) {
    lines.push('No sources were captured.');
    return lines.join('\n');
  }

  pack.sources.forEach((source, index) => {
    lines.push(`## ${source.id}: Source ${index + 1}`);
    lines.push(`Title: ${source.title}`);
    if (source.url) lines.push(`URL: ${source.url}`);
    lines.push(`Domain: ${source.domain || 'unknown'}`);
    lines.push(`Role: ${source.role}`);
    lines.push(`Freshness: ${source.freshness}`);
    if (source.publishedDate) lines.push(`Published: ${source.publishedDate}`);
    lines.push(`Anchor matches: ${source.anchorMatches}`);
    lines.push(`Snippet: ${source.snippet}`);
    if (source.highlights?.length) {
      lines.push('Highlights:');
      source.highlights.forEach((highlight) => lines.push(`- ${highlight}`));
    }
    if (source.fetched?.text) {
      lines.push('Excerpt:');
      lines.push(source.fetched.text.slice(0, 4000));
    }
    lines.push('');
  });

  return lines.join('\n').trim() + '\n';
}

export function researchPackManifest(pack: ResearchPack): Omit<ResearchPack, 'assets'> & {
  assets: Array<Omit<ArtifactAsset, 'dataUri'>>;
} {
  return {
    ...pack,
    assets: pack.assets.map(({ dataUri: _dataUri, ...asset }) => asset)
  };
}

export function researchAssetSeedFiles(pack: ResearchPack): Array<{ path: string; binary: Buffer }> {
  return pack.assets.map((asset) => ({
    path: `research/assets/${asset.id}.${asset.mimeType === 'image/png' ? 'png' : 'jpg'}`,
    binary: Buffer.from(asset.dataUri.slice(asset.dataUri.indexOf(',') + 1), 'base64')
  }));
}

export function allowedResearchCitationUrls(pack: ResearchPack | null): Set<string> {
  return new Set(
    (pack?.sources ?? [])
      .map((source) => normalizeUrl(source.url))
      .filter((url): url is string => Boolean(url))
  );
}

export function citationsAreGrounded(
  citations: Array<{ url?: string }>,
  allowedUrls: Set<string>
): boolean {
  if (allowedUrls.size === 0) return citations.length === 0;
  return citations.every((citation) => {
    const normalized = normalizeUrl(citation.url);
    return Boolean(normalized && allowedUrls.has(normalized));
  });
}

export function explicitlyAcknowledgesUnverified(value: unknown): boolean {
  return /\b(could not verify|couldn't verify|did not verify|does not verify|failed to verify|unable to verify|not publicly verified|not verified|no public confirmation|insufficient (?:public )?evidence|no (?:reliable|credible|supporting) evidence)\b/i.test(
    typeof value === 'string' ? value : JSON.stringify(value)
  );
}

function dedupeResults(results: WebSearchResult[]): WebSearchResult[] {
  const seen = new Set<string>();
  const deduped: WebSearchResult[] = [];
  for (const result of results) {
    if (!isUsableSearchResult(result)) continue;
    const key = result.url?.replace(/\/$/, '') || `${result.title}:${result.snippet}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(result);
  }
  return deduped;
}

function scoreAnchors(text: string, anchors: string[]): number {
  if (anchors.length === 0) return text.trim() ? 1 : 0;
  const haystack = normalizeAnchor(text);
  return anchors.filter((anchor) => haystack.includes(anchor)).length;
}

export function preliminarySearchConfidence(
  results: WebSearchResult[],
  anchors: string[]
): ResearchConfidence {
  const usable = results.filter(isUsableSearchResult);
  if (usable.length === 0) return 'none';
  const anchorHits = usable.filter((result) => {
    const haystack = [result.title, result.snippet, ...(result.highlights ?? [])].join(' ');
    return scoreAnchors(haystack, anchors) > 0;
  }).length;
  if (anchors.length === 0) {
    return usable.length >= 6 ? 'high' : usable.length >= 3 ? 'low' : 'none';
  }
  if (anchorHits >= anchors.length && usable.length >= 6) return 'high';
  if (anchorHits > 0 && usable.length >= 4) return 'low';
  return 'none';
}

function classifyConfidence(sources: ResearchSource[], anchors: string[]): ResearchConfidence {
  if (sources.length === 0) return 'none';
  const bestMatch = Math.max(...sources.map((source) => source.anchorMatches), 0);
  if (anchors.length === 0) return bestMatch > 0 ? 'high' : 'low';
  if (bestMatch >= anchors.length) return 'high';
  if (bestMatch > 0) return 'low';
  return 'none';
}

function summarizeResearch(confidence: ResearchConfidence, requestedSubject: string | undefined, sourceCount: number): string {
  if (confidence === 'high') {
    return sourceCount > 0
      ? `Captured ${sourceCount} source-backed results for the requested topic.`
      : 'Captured source-backed results for the requested topic.';
  }
  if (confidence === 'low') {
    return requestedSubject
      ? `Current sources mention related material, but they do not cleanly verify ${requestedSubject}.`
      : 'Current sources are incomplete or only partially match the requested topic.';
  }
  return requestedSubject
    ? `Current public sources did not verify ${requestedSubject}.`
    : 'Current public sources did not verify the requested topic.';
}

function buildResearchQuestion(confidence: ResearchConfidence, requestedSubject: string | undefined): string | undefined {
  if (confidence === 'high' || !requestedSubject) return undefined;
  return `I could not verify ${requestedSubject} from current public sources. If you have a link or alternate name, send it and I will refine the artifact.`;
}

function classifyProvider(sources: ResearchSource[]): ResearchPack['usedProvider'] {
  const providers = new Set(sources.map((source) => source.provider).filter(Boolean));
  if (providers.size === 0) return 'none';
  if (providers.size > 1) return 'mixed';
  const [provider] = [...providers];
  if (provider === 'duckduckgo' || provider === 'direct' || provider === 'exa') return provider;
  return 'firecrawl';
}

function resultPriority(result: WebSearchResult, anchors: string[]): number {
  return sourceRelevance(
    result,
    scoreAnchors(`${result.title} ${result.snippet}`, anchors),
    classifySourceRole(result)
  );
}

function sourceRelevance(
  result: WebSearchResult,
  anchorMatches: number,
  role: ResearchSourceRole
): number {
  let score = anchorMatches * 25;
  if (result.url) {
    try {
      const hostname = new URL(result.url).hostname.replace(/^www\./, '');
      if (!/(medium\.com|reddit\.com|quora\.com|linkedin\.com)$/i.test(hostname)) score += 5;
      if (/\/(news|blog|research|docs|press|about)\b/i.test(new URL(result.url).pathname)) score += 3;
    } catch {
      score -= 5;
    }
  }
  if (result.publishedDate) score += 4;
  if (result.provider === 'firecrawl' || result.provider === 'exa') score += 2;
  if (role === 'official' || role === 'primary-data') score += 7;
  if (role === 'independent' || role === 'news') score += 4;
  if (role === 'community') score -= 3;
  return score;
}

function selectDiverseResults(
  results: WebSearchResult[],
  requestedSubject: string | undefined,
  limit: number
): WebSearchResult[] {
  const ranked = [...results].sort((left, right) => {
    const roleDelta = sourceRolePriority(classifySourceRole(right, requestedSubject)) -
      sourceRolePriority(classifySourceRole(left, requestedSubject));
    return roleDelta || Number(Boolean(right.publishedDate)) - Number(Boolean(left.publishedDate));
  });
  const selected: WebSearchResult[] = [];
  const domainCounts = new Map<string, number>();
  const add = (result: WebSearchResult) => {
    if (selected.includes(result)) return;
    const domain = sourceDomain(result.url) || `unknown-${selected.length}`;
    if ((domainCounts.get(domain) ?? 0) >= 2) return;
    selected.push(result);
    domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
  };

  for (const role of ['official', 'primary-data', 'independent', 'news'] as const) {
    const candidate = ranked.find((result) => classifySourceRole(result, requestedSubject) === role);
    if (candidate) add(candidate);
  }
  for (const result of ranked) {
    if (selected.length >= limit) break;
    add(result);
  }
  return selected.slice(0, limit);
}

function classifySourceRole(
  result: WebSearchResult,
  requestedSubject?: string
): ResearchSourceRole {
  const domain = sourceDomain(result.url);
  const pathname = sourcePath(result.url);
  const provider = result.provider?.toLowerCase();
  if (provider === 'direct') return 'other';
  if (/(?:^|\.)(?:reddit\.com|quora\.com|medium\.com|linkedin\.com)$/i.test(domain)) return 'community';
  if (
    /^(?:docs|support|help|developer)\./i.test(domain) ||
    /\bofficial\b/i.test(result.title) ||
    domainBrandMatchesTitle(domain, result.title)
  ) {
    return 'official';
  }
  if (/\.(?:gov|edu|ac\.[a-z]{2})$/i.test(domain) || /\/(?:research|reports?|whitepapers?|data|statistics|datasets?)(?:\/|$)/i.test(pathname)) {
    return 'primary-data';
  }
  const organizationTokens = normalizeAnchor(requestedSubject ?? '')
    .split(' ')
    .filter((token) => token.length >= 4 && !['project', 'report', 'latest'].includes(token));
  if (organizationTokens.some((token) => domain.includes(token))) return 'official';
  if (/(?:^|\.)(?:reuters\.com|apnews\.com|bbc\.(?:com|co\.uk)|bloomberg\.com|forbes\.com|techcrunch\.com)$/i.test(domain) ||
      /(?:^|[.-])news(?:[.-]|$)/i.test(domain) ||
      /\/(?:news|story|article)(?:\/|$)/i.test(pathname)) {
    return 'news';
  }
  return domain ? 'independent' : 'other';
}

function sourceRolePriority(role: ResearchSourceRole): number {
  if (role === 'official') return 6;
  if (role === 'primary-data') return 5;
  if (role === 'independent') return 4;
  if (role === 'news') return 3;
  if (role === 'other') return 2;
  return 1;
}

function classifyFreshness(publishedDate: string | undefined): ResearchFreshness {
  if (!publishedDate) return 'unknown';
  const timestamp = Date.parse(publishedDate);
  if (!Number.isFinite(timestamp)) return 'unknown';
  const ageDays = (Date.now() - timestamp) / 86_400_000;
  return ageDays <= 370 ? 'recent' : 'dated';
}

function findContradictionCandidates(sources: ResearchSource[]): ResearchContradictionCandidate[] {
  const metrics = new Map<string, Map<string, Set<string>>>();
  const metricPattern = /\b(revenue|arr|growth|retention|users?|customers?|market size|valuation|price|pricing|cost|funding|raise)\b[\s\S]{0,48}?((?:[$€£₹]\s*)?\d+(?:\.\d+)?\s*(?:%|[kmbt]|million|billion|trillion)?)/gi;
  for (const source of sources) {
    const text = [
      source.title,
      source.snippet,
      ...(source.highlights ?? []),
      source.fetched?.text ?? ''
    ].join(' ');
    for (const match of text.matchAll(metricPattern)) {
      const metric = normalizeAnchor(match[1]);
      const rawValue = match[2];
      if (!/[€£₹$%]|\b(?:k|m|b|t|million|billion|trillion)\b/i.test(rawValue)) continue;
      const value = rawValue.replace(/\s+/g, '').toUpperCase();
      const values = metrics.get(metric) ?? new Map<string, Set<string>>();
      const sourceIds = values.get(value) ?? new Set<string>();
      sourceIds.add(source.id);
      values.set(value, sourceIds);
      metrics.set(metric, values);
    }
  }
  return [...metrics.entries()].flatMap(([metric, values]) => {
    if (values.size < 2) return [];
    const sourceIds = [...new Set([...values.values()].flatMap((ids) => [...ids]))];
    if (sourceIds.length < 2) return [];
    return [{
      metric,
      values: [...values.keys()].slice(0, 4),
      sourceIds: sourceIds.slice(0, 6)
    }];
  }).slice(0, 6);
}

function uniqueDomainCount(results: WebSearchResult[]): number {
  return new Set(results.map((result) => sourceDomain(result.url)).filter(Boolean)).size;
}

function sourceDomain(value: string | undefined): string {
  if (!value) return '';
  try {
    return new URL(value).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function sourcePath(value: string | undefined): string {
  if (!value) return '';
  try {
    return new URL(value).pathname.toLowerCase();
  } catch {
    return '';
  }
}

function isUsableSearchResult(result: WebSearchResult): boolean {
  if (!result.url) return Boolean(result.title.trim() && result.snippet.trim());
  try {
    const url = new URL(result.url);
    const hostname = url.hostname.replace(/^www\./, '').toLowerCase();
    if (hostname === 'duckduckgo.com' && /\/(?:y\.js|l\/)/i.test(url.pathname)) return false;
    if (hostname === 'bing.com' && /\/aclick/i.test(url.pathname)) return false;
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function domainBrandMatchesTitle(domain: string, title: string): boolean {
  const labels = domain.split('.');
  const brand = labels.length >= 2 ? labels[labels.length - 2] : labels[0];
  if (!brand || brand.length < 4 || ['news', 'blog', 'support', 'docs'].includes(brand)) return false;
  return normalizeAnchor(title).split(' ').includes(normalizeAnchor(brand));
}

function normalizeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return undefined;
  }
}

function normalizeAnchor(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function cleanSubjectFragment(value: string): string {
  return value
    .replace(/\b(and|why|what|how|when|where|regarding|about|because|using|source|link|url)\b[\s\S]*$/i, '')
    .replace(/[.,;:!?]+$/, '')
    .trim();
}

function extractProvidedUrls(value: string): string[] {
  const matches = value.match(/https?:\/\/[^\s<>()"']+/gi) ?? [];
  return [...new Set(matches.map((match) => match.replace(/[.,;:!?]+$/, ''))) ].slice(0, 3);
}
