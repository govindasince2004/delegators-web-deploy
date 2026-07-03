import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../server/workbenchTools', () => ({
  webSearch: vi.fn(),
  webFetch: vi.fn(),
  safeWebFetch: vi.fn(),
  safeImageFetch: vi.fn()
}));

import {
  allowedResearchCitationUrls,
  briefNeedsResearch,
  briefReferencesThreadContext,
  buildArtifactResearchBrief,
  buildResearchQueries,
  citationsAreGrounded,
  explicitlyAcknowledgesUnverified,
  preliminarySearchConfidence,
  prepareResearchPack,
  renderResearchPackMarkdown
} from '../server/research';
import { webFetch, webSearch } from '../server/workbenchTools';

const mockedWebSearch = vi.mocked(webSearch);
const mockedWebFetch = vi.mocked(webFetch);

describe('research pack preparation', () => {
  beforeEach(() => {
    mockedWebSearch.mockReset();
    mockedWebFetch.mockReset();
  });

  it('detects prompts that require current-source research', () => {
    expect(briefNeedsResearch('Create a report on the latest Glasswing project by Anthropic')).toBe(true);
    expect(briefNeedsResearch('Draft a resume from these supplied notes only')).toBe(false);
  });

  it('inherits prior thread facts when the brief says create a deck on this', () => {
    expect(briefReferencesThreadContext('create a ppt on this my love')).toBe(true);
    const researchBrief = buildArtifactResearchBrief(
      'create a ppt on this my love',
      [
        'User: search the internet for the latest SpaceX and Cursor news',
        'Assistant: SpaceX IPO at $135/share and SpaceX agreed to acquire Anysphere for $60 billion.'
      ].join('\n')
    );
    expect(briefNeedsResearch(researchBrief, 'deck')).toBe(true);
    expect(researchBrief).toContain('SpaceX agreed to acquire Anysphere');
  });

  it('does not web-research uploaded-only evidence briefs', () => {
    expect(briefNeedsResearch(
      '@ppt Create a comparison deck from the uploaded screenshots. Use only facts visible in the screenshots.',
      'deck',
      { hasReferences: true }
    )).toBe(false);
    expect(briefNeedsResearch(
      '@ppt Create a current market comparison deck with latest sources.',
      'deck',
      { hasReferences: true }
    )).toBe(true);
  });

  it('accepts equivalent honest language for an unverified topic', () => {
    expect(explicitlyAcknowledgesUnverified('Current public evidence did not verify the project.')).toBe(true);
    expect(explicitlyAcknowledgesUnverified('There is insufficient public evidence for this claim.')).toBe(true);
    expect(explicitlyAcknowledgesUnverified('The project launched successfully last week.')).toBe(false);
  });

  it('builds exact-subject query variants and grounds citations to captured URLs', () => {
    const queries = buildResearchQueries('Create a report on Project Glasswing by Anthropic.');
    expect(queries).toHaveLength(5);
    expect(queries.some((query) => query.includes('"Project Glasswing by Anthropic" official'))).toBe(true);
    expect(queries.some((query) => /statistics|data|report/i.test(query))).toBe(true);
    expect(queries.some((query) => /independent analysis|criticism/i.test(query))).toBe(true);
    expect(queries.some((query) => /latest|news/i.test(query))).toBe(true);

    const allowed = allowedResearchCitationUrls({
      query: queries[0],
      queries,
      capturedAt: new Date().toISOString(),
      confidence: 'high',
      summary: 'verified',
      assets: [],
      domains: ['example.com'],
      roleCoverage: ['official'],
      contradictionCandidates: [],
      sources: [{
        id: 'S1',
        title: 'Official announcement',
        snippet: 'Project Glasswing',
        url: 'https://example.com/news/glasswing',
        provider: 'exa',
        domain: 'example.com',
        role: 'official',
        freshness: 'unknown',
        anchorMatches: 2,
        relevanceScore: 60
      }],
      usedProvider: 'exa'
    });
    expect(citationsAreGrounded([{ url: 'https://example.com/news/glasswing' }], allowed)).toBe(true);
    expect(citationsAreGrounded([{ url: 'https://invented.example/glasswing' }], allowed)).toBe(false);
  });

  it('removes artifact-building boilerplate from research facets', () => {
    const queries = buildResearchQueries(
      '@ppt Create a current cited report comparing Claude Artifacts by Anthropic with modern AI presentation workflows.'
    );
    expect(queries[0]).toBe('Claude Artifacts by Anthropic with modern AI presentation workflows.');
    expect(queries.every((query) => !/^create a current cited report/i.test(query))).toBe(true);
  });

  it('keeps source instructions out of the requested subject name', async () => {
    mockedWebSearch.mockResolvedValue([]);
    mockedWebFetch.mockResolvedValue({
      url: 'https://example.com/',
      contentType: 'text/html',
      text: 'Example reference without a matching announcement.',
      provider: 'direct'
    });

    const pack = await prepareResearchPack({
      brief: 'Create a report on Project Zephyrquill by Anthropic using this source https://example.com/'
    });

    expect(pack?.requestedSubject).toBe('Project Zephyrquill by Anthropic');
    expect(pack?.question).toContain('Project Zephyrquill by Anthropic');
    expect(pack?.question).not.toContain('using this');
  });

  it('marks a subject as low confidence when sources do not verify the requested project', async () => {
    mockedWebSearch.mockResolvedValue([
      {
        title: 'Anthropic company updates',
        snippet: 'Recent Claude and safety news from Anthropic.',
        url: 'https://www.anthropic.com/news',
        provider: 'exa'
      }
    ]);
    mockedWebFetch.mockResolvedValue({
      url: 'https://www.anthropic.com/news',
      contentType: 'text/html',
      text: 'Anthropic announced Claude improvements and model updates.',
      provider: 'exa'
    });

    const pack = await prepareResearchPack({
      brief: 'Create a report on the latest project Glasswing by Anthropic and why it matters.'
    });

    expect(pack).not.toBeNull();
    expect(pack?.confidence).toBe('low');
    expect(pack?.question).toContain('could not verify');
    expect(pack?.requestedSubject).toContain('Glasswing');
  });

  it('marks a subject as high confidence when sources match the requested project and company', async () => {
    mockedWebSearch.mockResolvedValue([
      {
        title: 'Anthropic introduces Project Glasswing',
        snippet: 'Project Glasswing by Anthropic expands multimodal reasoning.',
        url: 'https://www.anthropic.com/news/glasswing',
        provider: 'exa'
      }
    ]);
    mockedWebFetch.mockResolvedValue({
      url: 'https://www.anthropic.com/news/glasswing',
      contentType: 'text/html',
      text: 'Anthropic says Project Glasswing improves multimodal reasoning and tool use.',
      provider: 'exa'
    });

    const pack = await prepareResearchPack({
      brief: 'Make a PDF about the latest project Glasswing by Anthropic.'
    });

    expect(pack?.confidence).toBe('high');
    expect(pack?.question).toBeUndefined();
    expect(pack?.sources[0]?.anchorMatches).toBeGreaterThanOrEqual(2);
    expect(pack?.sources[0]?.domain).toBe('anthropic.com');
    expect(pack?.sources[0]?.role).toBe('official');
    expect(renderResearchPackMarkdown(pack!)).toContain('Confidence: high');
  });

  it('selects a diverse evidence set, fetches fuller pages, and exposes source roles', async () => {
    mockedWebSearch.mockResolvedValue([
      {
        title: 'Official launch',
        snippet: 'Project Glasswing by Anthropic launch details.',
        url: 'https://www.anthropic.com/news/glasswing',
        provider: 'duckduckgo',
        publishedDate: '2026-05-01'
      },
      {
        title: 'Official technical report',
        snippet: 'Project Glasswing by Anthropic evaluation data.',
        url: 'https://www.anthropic.com/research/glasswing',
        provider: 'duckduckgo',
        publishedDate: '2026-05-02'
      },
      {
        title: 'Independent review',
        snippet: 'Analysis of Project Glasswing by Anthropic.',
        url: 'https://analysis.example/reviews/glasswing',
        provider: 'duckduckgo',
        publishedDate: '2026-05-03'
      },
      {
        title: 'Industry news',
        snippet: 'Project Glasswing by Anthropic reaches users.',
        url: 'https://news.example/ai/glasswing',
        provider: 'duckduckgo',
        publishedDate: '2026-05-04'
      }
    ]);
    mockedWebFetch.mockImplementation(async (url) => ({
      url,
      contentType: 'text/html',
      title: 'Fetched source',
      text: `Project Glasswing by Anthropic. Full evidence from ${url}.`,
      provider: 'direct'
    }));

    const pack = await prepareResearchPack({
      brief: 'Create a current cited report on Project Glasswing by Anthropic.'
    });

    expect(new Set(pack?.sources.map((source) => source.domain)).size).toBeGreaterThanOrEqual(3);
    expect(pack?.roleCoverage).toContain('official');
    expect(pack?.roleCoverage).toContain('independent');
    expect(pack?.roleCoverage).toContain('news');
    expect(mockedWebFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ maxBytes: 16_000, fresh: true })
    );
    expect(renderResearchPackMarkdown(pack!)).toContain('Role: official');
    expect(renderResearchPackMarkdown(pack!)).toContain('Domain: anthropic.com');
  });

  it('flags conflicting metric values for reconciliation instead of silently choosing one', async () => {
    mockedWebSearch.mockResolvedValue([
      {
        title: 'Company results',
        snippet: 'Project Glasswing by Anthropic reports revenue of $12M.',
        url: 'https://www.anthropic.com/news/glasswing-results',
        provider: 'duckduckgo'
      },
      {
        title: 'Independent analysis',
        snippet: 'Project Glasswing by Anthropic revenue is estimated at $18M.',
        url: 'https://analysis.example/glasswing-results',
        provider: 'duckduckgo'
      }
    ]);
    mockedWebFetch.mockImplementation(async (url) => ({
      url,
      contentType: 'text/html',
      text: url.includes('anthropic.com')
        ? 'Project Glasswing by Anthropic revenue was $12M.'
        : 'Project Glasswing by Anthropic revenue was estimated at $18M.',
      provider: 'direct'
    }));

    const pack = await prepareResearchPack({
      brief: 'Create a researched report on Project Glasswing by Anthropic revenue.'
    });

    expect(pack?.contradictionCandidates).toEqual([
      expect.objectContaining({ metric: 'revenue', sourceIds: ['S1', 'S2'] })
    ]);
    expect(renderResearchPackMarkdown(pack!)).toContain('Do not silently choose one');
  });

  it('drops search-engine ad redirects and does not misclassify third-party coverage as official', async () => {
    mockedWebSearch.mockResolvedValue([
      {
        title: 'Claude artifacts expand to app creation',
        snippet: 'Independent coverage of the official announcement.',
        url: 'https://ppc.land/claude-artifacts-expand/',
        provider: 'duckduckgo'
      },
      {
        title: 'Artifacts are generally available | Claude',
        snippet: 'Product announcement.',
        url: 'https://claude.com/blog/artifacts',
        provider: 'duckduckgo'
      },
      {
        title: 'Advertisement',
        snippet: 'Sponsored result.',
        url: 'https://duckduckgo.com/y.js?ad_provider=bing',
        provider: 'duckduckgo'
      }
    ]);
    mockedWebFetch.mockImplementation(async (url) => ({
      url,
      contentType: 'text/html',
      text: 'Claude Artifacts product information.',
      provider: 'direct'
    }));

    const pack = await prepareResearchPack({
      brief: 'Create a current researched report about Claude Artifacts.'
    });

    expect(pack?.sources.some((source) => source.domain === 'duckduckgo.com')).toBe(false);
    expect(pack?.sources.find((source) => source.domain === 'ppc.land')?.role).toBe('independent');
    expect(pack?.sources.find((source) => source.domain === 'claude.com')?.role).toBe('official');
  });

  it('fetches a user-provided source directly during a clarification refresh', async () => {
    mockedWebSearch.mockResolvedValue([]);
    mockedWebFetch.mockResolvedValue({
      url: 'https://example.com/project-glasswing',
      contentType: 'text/html',
      title: 'Project Glasswing announcement',
      text: 'Project Glasswing by Anthropic is described in this supplied announcement.',
      provider: 'direct'
    });

    const pack = await prepareResearchPack({
      brief: 'Create a report on Project Glasswing by Anthropic. Source: https://example.com/project-glasswing'
    });

    expect(pack?.confidence).toBe('high');
    expect(pack?.usedProvider).toBe('direct');
    expect(pack?.sources[0]?.url).toBe('https://example.com/project-glasswing');
    expect(mockedWebFetch).toHaveBeenCalledWith(
      'https://example.com/project-glasswing',
      expect.objectContaining({ fresh: true })
    );
  });

  it('scores preliminary search confidence from anchor coverage', () => {
    const anchors = ['glasswing', 'anthropic'];
    expect(preliminarySearchConfidence([], anchors)).toBe('none');
    expect(preliminarySearchConfidence([
      { title: 'Glasswing by Anthropic', snippet: 'Anthropic Glasswing project overview', url: 'https://a.test' },
      { title: 'Glasswing revenue', snippet: 'Anthropic Glasswing revenue context', url: 'https://b.test' },
      { title: 'More Glasswing', snippet: 'Anthropic details on Glasswing', url: 'https://c.test' },
      { title: 'Glasswing timeline', snippet: 'Anthropic Glasswing launch', url: 'https://d.test' }
    ], anchors)).toBe('low');
  });
});
