import type { ArtifactDocument, ArtifactSection, Slide } from '../src/lib/shared.js';

export type CitationEntry = NonNullable<ArtifactDocument['citations']>[number];

const confidencePattern = /\[(?:CONFIRMED|REPORTED|LIKELY|UNCLEAR|UNVERIFIED|LOW CONFIDENCE|HIGH CONFIDENCE)\]/i;
const trailingSourcePattern = /\s*\[(?:S\d+(?:,\s*S\d+)*)\]\s*$/i;

export function hasConfidenceLabel(text: string): boolean {
  return confidencePattern.test(text);
}

export function confidenceLabelForClaim(sourceIds?: string[]): '[CONFIRMED]' | '[UNVERIFIED]' {
  return sourceIds?.length ? '[CONFIRMED]' : '[UNVERIFIED]';
}

export function stripTrailingCitationMarkers(text: string): string {
  return text.replace(trailingSourcePattern, '').trim();
}

export function citationMarkerSuffix(sourceIds?: string[]): string {
  if (!sourceIds?.length) return '';
  return ` [${sourceIds.join(', ')}]`;
}

export function exportClaimText(
  text: string,
  sourceIds?: string[],
  options: { citationsExpected?: boolean } = {}
): string {
  const base = stripTrailingCitationMarkers(text.trim());
  if (!base) return base;
  const shouldLabel = Boolean(options.citationsExpected || sourceIds?.length);
  if (!shouldLabel) return base;
  if (hasConfidenceLabel(base)) {
    return `${base}${citationMarkerSuffix(sourceIds)}`.trim();
  }
  return `${confidenceLabelForClaim(sourceIds)} ${base}${citationMarkerSuffix(sourceIds)}`.trim();
}

export function formattedCitationLine(citation: CitationEntry): string {
  const id = citation.id ? `${citation.id}: ` : '';
  const url = citation.url ? ` — ${citation.url}` : '';
  return `${id}${citation.label}${url}`.trim();
}

export function methodologyBullets(): string[] {
  return [
    'Confirmed — directly supported by a listed source in this deliverable.',
    'Reported — cited secondhand or pending independent verification.',
    'Likely — reasonable inference from available evidence, not independently verified.',
    'Unclear / [UNVERIFIED] — needs a source before external circulation.'
  ];
}

export function methodologyBody(): string {
  return 'This deliverable synthesizes user-provided context and captured research. Confidence varies by claim — read inline labels and the source list before reuse.';
}

export function artifactHasResearchApparatus(artifact: ArtifactDocument): boolean {
  return (artifact.citations?.length ?? 0) > 0 ||
    artifact.sections.some((section) => (section.sourceIds?.length ?? 0) > 0) ||
    (artifact.slides ?? []).some((slide) => (slide.sourceIds?.length ?? 0) > 0);
}

export function dedupeCitations(citations: CitationEntry[]): CitationEntry[] {
  const seen = new Set<string>();
  return citations.filter((citation) => {
    const key = `${citation.id ?? ''}|${citation.label}|${citation.url ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(citation.label?.trim());
  });
}

export function collectReferencedCitationIds(artifact: ArtifactDocument): string[] {
  const ids = new Set<string>();
  for (const section of artifact.sections) {
    for (const id of section.sourceIds ?? []) ids.add(id);
  }
  for (const slide of artifact.slides ?? []) {
    for (const id of slide.sourceIds ?? []) ids.add(id);
  }
  return [...ids];
}

export function orderedCitationsForExport(artifact: ArtifactDocument): CitationEntry[] {
  const referenced = new Set(collectReferencedCitationIds(artifact));
  const all = dedupeCitations(artifact.citations ?? []);
  const referencedFirst = all.filter((citation) => citation.id && referenced.has(citation.id));
  const remainder = all.filter((citation) => !citation.id || !referenced.has(citation.id));
  return [...referencedFirst, ...remainder];
}

export function pptxClaimRuns(
  text: string,
  sourceIds: string[] | undefined,
  baseOptions: Record<string, unknown>
): Array<{ text: string; options: Record<string, unknown> }> {
  const rendered = exportClaimText(text, sourceIds);
  const marker = citationMarkerSuffix(sourceIds);
  if (!marker || !rendered.endsWith(marker.trim())) {
    return [{ text: rendered, options: baseOptions }];
  }
  const body = rendered.slice(0, rendered.length - marker.length).trimEnd();
  return [
    { text: body, options: baseOptions },
    { text: marker.trim(), options: { ...baseOptions, superscript: true, fontSize: (baseOptions.fontSize as number) * 0.72 } }
  ];
}

export function htmlClaimText(text: string, sourceIds?: string[]): string {
  const rendered = exportClaimText(text, sourceIds);
  const marker = citationMarkerSuffix(sourceIds);
  if (!marker || !rendered.endsWith(marker.trim())) return rendered;
  const body = rendered.slice(0, rendered.length - marker.length).trimEnd();
  const ids = (sourceIds ?? []).map((id) => `<sup class="cite-ref">${id}</sup>`).join('');
  return `${body}${ids}`;
}

export type PptxSlideApi = {
  addSlide: () => {
    background?: { color: string };
    addText: (text: string | Array<{ text: string; options?: Record<string, unknown> }>, options: Record<string, unknown>) => void;
    addShape: (shape: string, options: Record<string, unknown>) => void;
  };
  ShapeType: { rect: string };
};

export function addPptxSourcesSlides(
  pptx: PptxSlideApi,
  artifact: ArtifactDocument,
  design: {
    headingFont: string;
    bodyFont: string;
    slideAspect: 'wide' | 'standard';
    background: string;
    surface: string;
    text: string;
    muted: string;
    primary: string;
    accent: string;
    density: 'compact' | 'balanced' | 'airy';
  }
): void {
  const citations = orderedCitationsForExport(artifact);
  if (citations.length === 0) return;

  const slideWidth = design.slideAspect === 'standard' ? 10 : 13.333;
  const compact = design.density === 'compact';
  const airy = design.density === 'airy';
  const bodySize = compact ? 11 : airy ? 13 : 12;

  const sourcesPage = pptx.addSlide();
  sourcesPage.background = { color: design.primary };
  sourcesPage.addShape(pptx.ShapeType.rect, {
    x: 0.62, y: 0.72, w: 0.58, h: 0.06,
    fill: { color: design.accent },
    line: { color: design.accent, transparency: 100 }
  });
  sourcesPage.addText('Sources', {
    x: 0.62, y: 0.95, w: slideWidth - 1.2, h: 0.55,
    fontFace: design.headingFont, fontSize: compact ? 24 : 28, bold: true, color: design.background
  });
  sourcesPage.addText('Referenced evidence for claims in this deck.', {
    x: 0.62, y: 1.55, w: slideWidth - 1.2, h: 0.3,
    fontFace: design.bodyFont, fontSize: 10, color: design.background, transparency: 18
  });
  const lines = citations.map((citation) => formattedCitationLine(citation));
  sourcesPage.addText(lines.map((line, index) => ({
    text: line,
    options: { bullet: { indent: 14 }, breakLine: index < lines.length - 1, paraSpaceAfter: 6 }
  })), {
    x: 0.72, y: 2.05, w: slideWidth - 1.44, h: 4.8,
    fontFace: design.bodyFont, fontSize: bodySize, color: design.background, valign: 'top', margin: 0
  });

  const methodPage = pptx.addSlide();
  methodPage.background = { color: design.background };
  methodPage.addText('Methodology & limitations', {
    x: 0.62, y: 0.72, w: slideWidth - 1.2, h: 0.55,
    fontFace: design.headingFont, fontSize: compact ? 22 : 26, bold: true, color: design.text
  });
  methodPage.addText(methodologyBody(), {
    x: 0.62, y: 1.35, w: slideWidth - 1.2, h: 0.9,
    fontFace: design.bodyFont, fontSize: bodySize, color: design.muted, valign: 'top'
  });
  methodPage.addText(methodologyBullets().map((line, index) => ({
    text: line,
    options: { bullet: { indent: 14 }, breakLine: index < methodologyBullets().length - 1, paraSpaceAfter: 8 }
  })), {
    x: 0.72, y: 2.35, w: slideWidth - 1.44, h: 4.2,
    fontFace: design.bodyFont, fontSize: bodySize, color: design.text, valign: 'top', margin: 0
  });
}

export function enrichSectionForExport(
  section: ArtifactSection,
  citationsExpected: boolean
): ArtifactSection {
  return {
    ...section,
    body: section.body ? exportClaimText(section.body, section.sourceIds, { citationsExpected }) : section.body,
    bullets: section.bullets.map((bullet) => exportClaimText(bullet, section.sourceIds, { citationsExpected }))
  };
}

export function enrichSlideForExport(slide: Slide, citationsExpected: boolean): Slide {
  return {
    ...slide,
    bullets: slide.bullets.map((bullet) => exportClaimText(bullet, slide.sourceIds, { citationsExpected }))
  };
}

export function enrichArtifactForExport(artifact: ArtifactDocument): ArtifactDocument {
  const citationsExpected = artifactHasResearchApparatus(artifact);
  return {
    ...artifact,
    executiveSummary: artifact.executiveSummary
      ? exportClaimText(
        artifact.executiveSummary,
        collectReferencedCitationIds(artifact).slice(0, 3),
        { citationsExpected }
      )
      : artifact.executiveSummary,
    sections: artifact.sections.map((section) => enrichSectionForExport(section, citationsExpected)),
    slides: artifact.slides?.map((slide) => enrichSlideForExport(slide, citationsExpected)),
    citations: orderedCitationsForExport(artifact)
  };
}