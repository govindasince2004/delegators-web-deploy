import {
  buildResearchQuery,
  extractResearchAnchors,
  extractRequestedSubject
} from './research.js';
import type { RunDepthTier } from './agenticDepth.js';
import type { WebSearchMode } from './workbenchTools.js';

export type ResearchQueryTier = {
  query: string;
  mode: WebSearchMode;
  maxResults: number;
  label: string;
};

export type ResearchSchedulerOptions = {
  brief: string;
  platform?: { baseURL: string; sessionKey: string };
  includeImages?: boolean;
  onStatus?: (message: string) => void;
};

function researchFocus(brief: string): string {
  const base = buildResearchQuery(brief);
  const subject = extractRequestedSubject(brief);
  const anchors = extractResearchAnchors(brief);
  return subject
    ? `"${subject}"`
    : anchors.length > 0
      ? anchors.map((anchor) => `"${anchor}"`).join(' ')
      : base;
}

export function scheduleResearchQueries(brief: string, tier: RunDepthTier = 'standard'): ResearchQueryTier[] {
  const base = buildResearchQuery(brief);
  const focus = researchFocus(brief);
  const year = new Date().getUTCFullYear();
  const deepMode: WebSearchMode = tier === 'marathon' ? 'deep-reasoning' : 'deep';
  const fastMax = tier === 'fast' ? 6 : tier === 'marathon' ? 8 : 7;

  return [
    { query: base, mode: 'fast', maxResults: fastMax, label: 'primary' },
    { query: `${focus} official source announcement`, mode: deepMode, maxResults: 6, label: 'official' },
    { query: `${focus} statistics data report`, mode: 'fast', maxResults: fastMax, label: 'statistics' },
    { query: `${focus} independent analysis criticism`, mode: 'fast', maxResults: fastMax, label: 'independent' },
    { query: `${focus} latest news ${year}`, mode: 'fast', maxResults: fastMax, label: 'news' }
  ];
}

export function scheduleResearchGapQueries(brief: string, wave: number, existingDomains: string[]): ResearchQueryTier[] {
  const focus = researchFocus(brief);
  const year = new Date().getUTCFullYear();
  if (wave === 2) {
    return [
      { query: `${focus} competitor landscape comparison`, mode: 'fast', maxResults: 6, label: 'competitors' },
      { query: `${focus} regulatory compliance standards`, mode: 'fast', maxResults: 5, label: 'regulatory' },
      { query: `${focus} expert interview commentary`, mode: 'deep-lite', maxResults: 5, label: 'commentary' }
    ];
  }
  const domainGap = existingDomains.length > 0 ? '' : ' primary sources';
  return [
    { query: `${focus} historical timeline context`, mode: 'fast', maxResults: 5, label: 'history' },
    { query: `${focus} risks challenges limitations${domainGap}`, mode: 'deep-lite', maxResults: 6, label: 'risks' },
    { query: `${focus} market outlook forecast ${year + 1}`, mode: 'fast', maxResults: 5, label: 'outlook' },
    { query: `${focus} case study implementation`, mode: 'fast', maxResults: 5, label: 'cases' }
  ];
}

export function tieredResearchSummary(tiers: ResearchQueryTier[], wave = 1): string {
  const deep = tiers.filter((tier) => tier.mode.startsWith('deep')).length;
  const fast = tiers.length - deep;
  const waveLabel = wave > 1 ? `Wave ${wave}: ` : '';
  return `${waveLabel}${deep} deep + ${fast} fast queries`;
}