import type { ArtifactDocument } from '../src/lib/shared.js';
import type { ResearchPack } from './research.js';

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s%$]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 4);
}

function overlapScore(haystack: string, needle: string): number {
  const hayTokens = new Set(tokenize(haystack));
  const needleTokens = tokenize(needle);
  if (needleTokens.length === 0) return 0;
  let hits = 0;
  for (const token of needleTokens) {
    if (hayTokens.has(token)) hits += 1;
  }
  return hits / needleTokens.length;
}

function bestSourceId(text: string, pack: ResearchPack): string | undefined {
  let best: { id: string; score: number } | undefined;
  for (const source of pack.sources) {
    const haystack = [
      source.title,
      source.snippet,
      ...(source.highlights ?? []),
      source.fetched?.text ?? ''
    ].join(' ');
    const score = overlapScore(haystack, text);
    if (!best || score > best.score) {
      best = { id: source.id, score };
    }
  }
  return best && best.score >= 0.18 ? best.id : undefined;
}

function attachToSlide(slide: NonNullable<ArtifactDocument['slides']>[number], pack: ResearchPack) {
  if (slide.sourceIds?.length) return slide;
  const text = [slide.title, slide.subtitle, ...slide.bullets, slide.takeaway, slide.quote].filter(Boolean).join(' ');
  const sourceId = bestSourceId(text, pack);
  return sourceId ? { ...slide, sourceIds: [sourceId] } : slide;
}

function attachToSection(section: ArtifactDocument['sections'][number], pack: ResearchPack) {
  const text = [section.heading, section.body, ...section.bullets].filter(Boolean).join(' ');
  const sourceId = bestSourceId(text, pack);
  if (!sourceId) return section;
  return { ...section, sourceIds: section.sourceIds?.length ? section.sourceIds : [sourceId] };
}

export function attachResearchCitations(artifact: ArtifactDocument, pack: ResearchPack | null): ArtifactDocument {
  if (!pack?.sources.length) return artifact;

  const slides = artifact.slides?.map((slide) => attachToSlide(slide, pack));
  const sections = artifact.sections.map((section) => attachToSection(section, pack));

  const existing = new Map((artifact.citations ?? []).map((citation) => [citation.id ?? citation.label, citation]));
  const citations = [...existing.values()];
  for (const source of pack.sources) {
    if (existing.has(source.id)) continue;
    citations.push({
      id: source.id,
      label: source.title,
      url: source.url
    });
  }

  return {
    ...artifact,
    slides,
    sections,
    citations
  };
}