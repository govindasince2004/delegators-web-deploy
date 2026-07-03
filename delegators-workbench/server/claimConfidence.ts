import type { ArtifactDocument } from '../src/lib/shared.js';
import type { ResearchPack } from './research.js';
import { attachResearchCitations } from './citationAttach.js';
import { exportClaimText, hasConfidenceLabel } from './citationExport.js';

const externalClaimPattern = /\b(?:\d+(?:\.\d+)?%?|[$₹€£]\s*\d|billion|million|reported|according to|market|revenue|growth|users?|customers?|acqui(?:red|sition)|merger|ipo|valuation)\b/i;

function needsConfidencePass(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 12) return false;
  if (hasConfidenceLabel(trimmed)) return false;
  return externalClaimPattern.test(trimmed) || trimmed.length >= 48;
}

function labelClaim(text: string, sourceIds?: string[]): string {
  if (!needsConfidencePass(text)) return text;
  return exportClaimText(text, sourceIds);
}

export function applyClaimConfidence(artifact: ArtifactDocument, pack: ResearchPack | null = null): ArtifactDocument {
  let next = attachResearchCitations(artifact, pack);

  const sections = next.sections.map((section) => ({
    ...section,
    body: section.body ? labelClaim(section.body, section.sourceIds) : section.body,
    bullets: section.bullets.map((bullet) => labelClaim(bullet, section.sourceIds))
  }));

  const slides = next.slides?.map((slide) => ({
    ...slide,
    bullets: slide.bullets.map((bullet) => labelClaim(bullet, slide.sourceIds)),
    takeaway: slide.takeaway ? labelClaim(slide.takeaway, slide.sourceIds) : slide.takeaway,
    subtitle: slide.subtitle ? labelClaim(slide.subtitle, slide.sourceIds) : slide.subtitle
  }));

  const executiveSummary = next.executiveSummary
    ? labelClaim(next.executiveSummary, collectTopSourceIds(next))
    : next.executiveSummary;

  return {
    ...next,
    sections,
    slides,
    executiveSummary
  };
}

function collectTopSourceIds(artifact: ArtifactDocument): string[] {
  const ids = new Set<string>();
  for (const section of artifact.sections) {
    for (const id of section.sourceIds ?? []) ids.add(id);
  }
  for (const slide of artifact.slides ?? []) {
    for (const id of slide.sourceIds ?? []) ids.add(id);
  }
  return [...ids].slice(0, 4);
}