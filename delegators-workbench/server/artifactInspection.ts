import { z } from 'zod';
import type { ArtifactDocument, ArtifactKind, ArtifactPrimaryFormat } from '../src/lib/shared.js';
import type { DelegatorsMessage } from './harnessOrchestrator.js';
import type { PresentationDesignProfile } from './references.js';
import { stabilizeDeckComposition } from './deckComposition.js';
import { stabilizeArtifactComposition } from './documentComposition.js';
import { requestedSlideCount } from './constraintCompiler.js';
import { designPresetIssue } from './designPreset.js';
import {
  inspectCoverAndOpenerDesign,
  inspectCredibilityApparatus,
  inspectCredibilityTone
} from './artifactCredibility.js';
import { inspectPriorArtifactNovelty } from '../src/lib/threadArtifactRouting.js';

export type ArtifactInspection = {
  passed: boolean;
  summary: string;
  issues: string[];
  revisionInstruction?: string;
  source: 'provider' | 'local' | 'combined' | 'fallback';
};

const ProviderInspectionSchema = z.object({
  passed: z.boolean(),
  summary: z.string().trim().min(1).max(500),
  issues: z.array(z.string().trim().min(1).max(240)).max(8).default([]),
  revisionInstruction: z.string().trim().max(1600).optional()
});

export function fallbackArtifactInspection(): ArtifactInspection {
  return {
    passed: true,
    summary: 'Provider inspection unavailable; schema and export validation remain active.',
    issues: [],
    source: 'fallback'
  };
}

export function inspectArtifactLocally(options: {
  artifact: ArtifactDocument;
  sourceBrief?: string;
  sourceEvidence?: string;
  referenceDesignProfiles?: PresentationDesignProfile[];
  expectedKind?: ArtifactKind;
  expectedPrimaryFormat?: ArtifactPrimaryFormat;
  citationsRequired?: boolean;
  needsResearch?: boolean;
  hasResearchSources?: boolean;
  threadArtifactMode?: 'new' | 'refine' | 'reuse-content' | 'template-fill';
  priorArtifact?: ArtifactDocument;
}): ArtifactInspection {
  const artifact = stabilizeArtifactComposition(
    stabilizeDeckComposition(options.artifact, options.sourceBrief),
    options.sourceBrief
  );
  const brief = options.sourceBrief ?? '';
  const sourceEvidence = [options.sourceBrief, options.sourceEvidence].filter(Boolean).join('\n\n');
  const issues: string[] = [];
  const expectedKind = options.expectedKind ?? artifact.kind;
  const expectedFormat = options.expectedPrimaryFormat ?? artifact.primaryFormat;

  if (artifact.kind !== expectedKind) {
    issues.push(`The artifact kind is ${artifact.kind}, but the requested kind is ${expectedKind}.`);
  }
  if (expectedFormat && artifact.primaryFormat !== expectedFormat) {
    issues.push(`The primary format is ${artifact.primaryFormat ?? 'unspecified'}, but the requested format is ${expectedFormat}.`);
  }

  if (artifact.kind === 'deck') inspectDeck(artifact, brief, issues);
  if (artifact.kind === 'sheet') inspectSheet(artifact, brief, issues);
  if (artifact.kind === 'report' || artifact.kind === 'assignment') inspectDocumentDepth(artifact, brief, issues);
  inspectRequestedDesign(artifact, brief, issues);
  const presetIssue = designPresetIssue(artifact, brief);
  if (presetIssue) issues.push(presetIssue);
  inspectReferenceDesignFidelity(artifact, brief, options.referenceDesignProfiles ?? [], issues);
  inspectUnsupportedBusinessClaims(artifact, brief, sourceEvidence, issues, options.hasResearchSources);
  inspectFabricatedCorporateEvents(artifact, sourceEvidence, issues);
  inspectCredibilityTone(artifact, issues);
  inspectCredibilityApparatus(artifact, {
    needsResearch: options.needsResearch ?? false,
    hasSources: options.hasResearchSources ?? false,
    citationsRequired: options.citationsRequired ?? false
  }, issues);
  inspectCoverAndOpenerDesign(artifact, issues);
  inspectPriorArtifactNovelty(
    options.priorArtifact,
    artifact,
    options.threadArtifactMode ?? 'new',
    issues
  );

  const uniqueIssues = [...new Set(issues)].slice(0, 10);
  return {
    passed: uniqueIssues.length === 0,
    summary: uniqueIssues.length === 0
      ? 'Local publication checks passed.'
      : `Local publication checks found ${uniqueIssues.length} fixable issue${uniqueIssues.length === 1 ? '' : 's'}.`,
    issues: uniqueIssues,
    revisionInstruction: uniqueIssues.length > 0
      ? `Revise the artifact to fix every publication issue: ${uniqueIssues.join(' ')}`.slice(0, 1600)
      : undefined,
    source: 'local'
  };
}

export function mergeArtifactInspections(
  local: ArtifactInspection,
  provider: ArtifactInspection
): ArtifactInspection {
  const issues = [...new Set([...local.issues, ...provider.issues])].slice(0, 8);
  const localFailed = !local.passed;
  const providerFailed = !provider.passed;
  const source: ArtifactInspection['source'] = localFailed && providerFailed
    ? 'combined'
    : localFailed
      ? 'local'
      : providerFailed || provider.source === 'provider'
        ? provider.source
        : 'local';
  const revisionInstruction = [local.revisionInstruction, provider.revisionInstruction]
    .filter(Boolean)
    .join(' ')
    .slice(0, 1600)
    .trim();
  return {
    passed: issues.length === 0 && local.passed && provider.passed,
    summary: issues.length === 0
      ? provider.source === 'provider' ? provider.summary : local.summary
      : [localFailed ? local.summary : '', providerFailed ? provider.summary : ''].filter(Boolean).join(' '),
    issues,
    revisionInstruction: revisionInstruction || undefined,
    source
  };
}

export function parseProviderInspection(content: string): ArtifactInspection | null {
  const parsedJson = safeJson(content);
  const parsed = ProviderInspectionSchema.safeParse(parsedJson);
  if (!parsed.success) return null;
  const issues = parsed.data.issues.map((issue) => cleanText(issue, 240)).filter(Boolean);
  const revisionInstruction = cleanText(parsed.data.revisionInstruction, 1600);
  return {
    passed: parsed.data.passed || issues.length === 0,
    summary: cleanText(parsed.data.summary, 500) || 'Artifact inspection completed.',
    issues,
    revisionInstruction: revisionInstruction || undefined,
    source: 'provider'
  };
}

export function buildInspectionMessages(options: {
  artifact: ArtifactDocument;
  sourceBrief?: string;
  sourceEvidence?: string;
  referenceDesignProfiles?: PresentationDesignProfile[];
  expectedKind?: ArtifactKind;
  expectedPrimaryFormat?: ArtifactPrimaryFormat;
  citationsRequired?: boolean;
}): DelegatorsMessage[] {
  return [
    {
      role: 'system',
      content: [
        'You inspect Delegators Workbench artifacts before publication.',
        'Return only compact JSON. Do not return Markdown.',
        'Do not mention backend, harness, tools, terminal, workspace, JSON, schema, or implementation details.',
        'Judge whether the artifact follows the user brief, selected output format, visual/design direction, requested structure, and citation requirements.',
        'Do not fail the artifact for missing facts that were not supplied if the artifact is honest about them.',
        'Fail only for fixable issues: ignored explicit user constraints, generic/unrequested design direction, placeholders, unsupported claims, wrong format, missing requested tables/slides/sheets, or visibly incomplete content.',
        'If failed, include a concise revisionInstruction that tells the generator how to fix the artifact using only available facts.',
        'JSON shape: { "passed": boolean, "summary": string, "issues": string[], "revisionInstruction"?: string }.'
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        options.expectedKind ? `Expected kind: ${options.expectedKind}` : '',
        options.expectedPrimaryFormat ? `Expected primary output: ${options.expectedPrimaryFormat}` : '',
        `Citations required: ${options.citationsRequired ? 'yes' : 'no'}`,
        options.sourceBrief ? `Original brief and answers:\n${options.sourceBrief}` : '',
        options.sourceEvidence ? `Available source evidence:\n${options.sourceEvidence.slice(0, 20_000)}` : '',
        options.referenceDesignProfiles?.length
          ? `Uploaded presentation design profiles:\n${JSON.stringify(options.referenceDesignProfiles)}`
          : '',
        `Artifact JSON:\n${JSON.stringify(options.artifact)}`
      ].filter(Boolean).join('\n\n')
    }
  ];
}

export function buildQualityRevisionMessages(options: {
  artifact: ArtifactDocument;
  inspection: ArtifactInspection;
  sourceBrief?: string;
  sourceEvidence?: string;
  referenceDesignProfiles?: PresentationDesignProfile[];
  expectedKind?: ArtifactKind;
  expectedPrimaryFormat?: ArtifactPrimaryFormat;
}): DelegatorsMessage[] {
  return [
    {
      role: 'system',
      content: [
        'You revise a Delegators Workbench artifact after quality inspection.',
        'Return only the full corrected artifact JSON. Do not return a patch or Markdown.',
        'Preserve truthful supplied facts. Do not invent missing facts, citations, dates, metrics, people, companies, or credentials.',
        // The validator re-runs after revision: dropping citations (or charts)
        // that the original artifact carried makes the revision FAIL.
        'Preserve the citations array EXACTLY as-is unless an inspection issue is specifically about citations.',
        'Preserve sourceIds on slides and sections exactly unless an inspection issue specifically requires changing evidence attribution.',
        'Preserve existing chart and table objects unless an issue says otherwise.',
        'Preserve valid imageAssetId values unless an issue specifically says an image is irrelevant.',
        'Preserve explicit user design choices and requested primary output format.',
        'Fix only the inspection issues. Do not introduce internal execution wording into the artifact.'
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        options.expectedKind ? `Expected kind: ${options.expectedKind}` : '',
        options.expectedPrimaryFormat ? `Expected primary output: ${options.expectedPrimaryFormat}` : '',
        options.sourceBrief ? `Original brief and answers:\n${options.sourceBrief}` : '',
        options.sourceEvidence ? `Available source evidence:\n${options.sourceEvidence.slice(0, 20_000)}` : '',
        options.referenceDesignProfiles?.length
          ? `Uploaded presentation design profiles:\n${JSON.stringify(options.referenceDesignProfiles)}`
          : '',
        `Inspection summary:\n${options.inspection.summary}`,
        `Inspection issues:\n${options.inspection.issues.map((issue) => `- ${issue}`).join('\n') || '- none'}`,
        options.inspection.revisionInstruction ? `Revision instruction:\n${options.inspection.revisionInstruction}` : '',
        `Current artifact JSON:\n${JSON.stringify(options.artifact)}`
      ].filter(Boolean).join('\n\n')
    }
  ];
}

function safeJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
}

function inspectDeck(artifact: ArtifactDocument, brief: string, issues: string[]): void {
  const slides = artifact.slides ?? [];
  const requestedCount = requestedSlideCount(brief);
  if (requestedCount && slides.length !== requestedCount) {
    issues.push(`The user requested ${requestedCount} slides, but the artifact contains ${slides.length}.`);
  }
  if (slides.length >= 5) {
    const layouts = new Set(slides.map(effectiveSlideLayout));
    const layoutFamilies = new Set(slides.map((slide) => layoutFamily(effectiveSlideLayout(slide))));
    if (layouts.size < 3) {
      issues.push('The deck relies on too few layout patterns; use at least three purposeful compositions across a presentation of this length.');
    }
    const visuallyStructured = slides.filter((slide) => isVisuallyStructuredSlide(slide));
    const requiredVisualSlides = Math.max(2, Math.ceil(slides.length * 0.34));
    if (visuallyStructured.length < requiredVisualSlides) {
      issues.push(`The deck lacks visual storytelling and evidence structure; at least ${requiredVisualSlides} slides should use charts, tables, source images, metrics, comparisons, timelines, processes, or a purposeful quote.`);
    }
    if (slides.length >= 8 && layoutFamilies.size > 5) {
      issues.push('The deck uses too many one-off layout families; consolidate it into 3-5 recurring compositions so it reads as one designed system.');
    }
    const roles = new Set(slides.map((slide) => slide.role).filter(Boolean));
    if (slides.length >= 8 && roles.size < 4) {
      issues.push('The deck lacks a developed narrative arc; use at least four purposeful roles across opener, context/tension, evidence/insight, solution/plan/proof, and close.');
    }
    if (countThemeTransitions(slides) > 3) {
      issues.push('The deck changes light/dark/accent treatment too frequently; use a controlled theme rhythm instead of alternating slide by slide.');
    }
  }
  if (slides.length > 0 && !['cover', 'statement', 'image'].includes(effectiveSlideLayout(slides[0]))) {
    issues.push('The opening slide should establish the argument with a cover, statement, or image-led composition instead of starting as a content list.');
  }
  if (slides.length >= 5 && (slides[0].role !== 'opener' || slides.at(-1)?.role !== 'close')) {
    issues.push('The narrative must open with an opener role and finish with a close role; the deck currently reads like an unordered topic list.');
  }
  if (hasThreeConsecutiveMatchingLayouts(slides)) {
    issues.push('The same slide composition repeats three times in a row; change the visual rhythm to match each slide’s communication job.');
  }
  const denseSlides = slides.filter((slide) =>
    slide.bullets.length > 6 ||
    slide.bullets.join(' ').length > 520 ||
    slide.bullets.some((bullet) => bullet.length > 180)
  );
  if (denseSlides.length > 0) {
    issues.push(`${denseSlides.length} slide${denseSlides.length === 1 ? ' is' : 's are'} too dense for presentation use; move nuance to speaker notes or split the content.`);
  }
  const genericTitles = slides.filter((slide) =>
    /^(?:overview|introduction|agenda|problem|solution|market|traction|product|team|roadmap|conclusion|next steps)$/i.test(slide.title.trim())
  );
  if (slides.length >= 5 && genericTitles.length >= 2) {
    issues.push('Multiple slide titles name topics instead of stating conclusions; rewrite them as message titles that communicate the point.');
  }
}

function inspectSheet(artifact: ArtifactDocument, brief: string, issues: string[]): void {
  if (/\b(?:blank|empty|template)\b/i.test(brief)) return;
  const sheets = artifact.sheet?.sheets ?? [];
  const populatedRows = sheets.flatMap((sheet) => sheet.rows).filter((row) =>
    row.some((cell) => cell.trim().length > 0)
  );
  if (populatedRows.length === 0) {
    issues.push('The workbook has no populated data rows; use supplied data or create a useful formula-driven structure without random filler.');
  }
}

function inspectDocumentDepth(artifact: ArtifactDocument, brief: string, issues: string[]): void {
  const words = wordCount([
    artifact.executiveSummary,
    ...artifact.sections.flatMap((section) => [section.heading, section.body, ...section.bullets])
  ].join(' '));
  const requestedPages = requestedPageCount(brief);
  if (requestedPages) {
    const minimumWords = requestedPages * 250;
    if (words < minimumWords) {
      issues.push(`The user requested ${requestedPages} pages, but about ${words} words cannot plausibly fill that length; expand the supported analysis and section substance.`);
    }
  }
  if (/\b(?:comprehensive|detailed|deep|in-depth|white\s*paper|long-form)\b/i.test(brief) && words < 450) {
    issues.push(`The requested comprehensive document is too shallow at about ${words} words; develop the supported analysis and section substance.`);
  }
}

const corporateEventPattern = /\b(?:merger|merged|acqui(?:red|sition)|buyout|takeover|combined with|largest (?:tech )?acquisition|ipo at|went public at|market cap(?: above| over)?)\b/i;

function inspectFabricatedCorporateEvents(
  artifact: ArtifactDocument,
  sourceEvidence: string,
  issues: string[]
): void {
  const haystack = artifactTextUnits(artifact).join('\n');
  if (!corporateEventPattern.test(haystack)) return;
  const evidence = sourceEvidence.toLowerCase();
  const claims = artifactTextUnits(artifact).filter((unit) => corporateEventPattern.test(unit));
  const unsupported = claims.filter((claim) => {
    const lower = claim.toLowerCase();
    const eventWords = lower.match(/\b(?:merger|merged|acqui(?:red|sition)|buyout|takeover|ipo|went public|market cap\w*|combined with|largest (?:tech )?acquisition)\b/g) ?? [];
    if (eventWords.length === 0) return false;
    return !eventWords.some((word) => {
      if (evidence.includes(word)) return true;
      const stem = word.replace(/(?:ed|ing|ion|s)$/i, '');
      return stem.length >= 4 && evidence.includes(stem);
    });
  });
  if (unsupported.length > 0) {
    issues.push(
      'The artifact asserts a merger, acquisition, IPO, or market-cap event that is not supported by the captured research pack or supplied evidence. Remove fabricated corporate events or attach a real source.'
    );
  }
}

function inspectUnsupportedBusinessClaims(
  artifact: ArtifactDocument,
  brief: string,
  sourceEvidence: string,
  issues: string[],
  hasResearchSources = false
): void {
  // General informational decks (news, trends, explainers) may cite researched stats.
  // Only enforce upload-evidence parity for pitch / traction / investor workflows.
  if (allowsInventedBusinessFacts(brief) || hasResearchSources || !requiresStrictBusinessEvidence(brief, sourceEvidence)) {
    return;
  }
  const sourceNumbers = new Set(extractNumberTokens(sourceEvidence));
  const riskyClaims = artifactTextUnits(artifact).filter((unit) =>
    strictBusinessMetricPattern.test(unit) &&
    unsupportedMetricNumbers(unit).some((token) => !sourceNumbers.has(token))
  );
  if (riskyClaims.length > 0) {
    issues.push(
      'The artifact includes business metrics, traction numbers, market sizes, valuation, or raise figures that are not present in the supplied brief or uploaded evidence. Remove unsupported numbers or ask for the missing facts.'
    );
  }
}

function inspectRequestedDesign(artifact: ArtifactDocument, brief: string, issues: string[]): void {
  if (!/\b(?:editorial|premium|minimal|monochrome|bold|visual direction|font|palette|color|colour)\b/i.test(brief)) return;
  const design = artifact.design;
  if (
    !design.visualDirection &&
    !design.template &&
    !design.headingFontFamily &&
    !design.bodyFontFamily &&
    !design.palette
  ) {
    issues.push('The brief requests a visual direction, but the artifact does not encode one in its design settings.');
  }
}

function inspectReferenceDesignFidelity(
  artifact: ArtifactDocument,
  brief: string,
  profiles: PresentationDesignProfile[],
  issues: string[]
): void {
  if (profiles.length === 0 || !requestsReferenceStyle(brief)) return;
  const profile = profiles[0];
  const design = artifact.design;
  if (
    (profile.slideAspect === 'wide' || profile.slideAspect === 'standard') &&
    design.slideAspect !== profile.slideAspect
  ) {
    issues.push(`The uploaded reference uses a ${profile.slideAspect} slide aspect, but the artifact does not preserve it.`);
  }
  if (profile.headingFontFamily && !sameFont(design.headingFontFamily, profile.headingFontFamily)) {
    issues.push(`The uploaded reference theme specifies "${profile.headingFontFamily}" for headings; preserve that font when matching its style.`);
  }
  if (profile.bodyFontFamily && !sameFont(design.bodyFontFamily, profile.bodyFontFamily)) {
    issues.push(`The uploaded reference theme specifies "${profile.bodyFontFamily}" for body text; preserve that font when matching its style.`);
  }
  const artifactColors = Object.values(design.palette ?? {})
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.replace(/^#/, '').toUpperCase());
  const referenceColors = profile.usedColors.length >= 2 ? profile.usedColors : profile.themeColors;
  const overlap = artifactColors.filter((color) => referenceColors.includes(color));
  if (referenceColors.length >= 4 && new Set(overlap).size < 2) {
    issues.push('The artifact palette does not preserve enough of the uploaded presentation theme colors; use at least two compatible extracted colors.');
  }
}

function requestsReferenceStyle(brief: string): boolean {
  return /\b(?:same|match(?:ing|ed)?|mirror(?:ing|ed)?|recreat(?:e|ing|ed)|replicat(?:e|ing|ed)|follow(?:ing|ed)?|us(?:e|ing|ed))\b[\s\S]{0,40}\b(?:style|theme|design|look|visual|format)\b|\b(?:like|similar to|inspired by)\s+(?:this|the|uploaded|attached|reference)\b/i.test(brief);
}

function sameFont(actual: string | undefined, expected: string): boolean {
  const normalize = (value: string | undefined) => (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalize(actual) === normalize(expected);
}

// Pitch / traction guard only — not generic "market trends" educational copy.
const strictBusinessMetricPattern = /\b(?:arr|mrr|revenue|sales|profit|margin|tam|sam|som|cagr|valuation|pre-money|post-money|raise|funding|pipeline)\b|[$₹]\s*\d[\d,.]*\s*(?:k|m|b|cr|crore|lakh|million|billion)?|\b\d+(?:\.\d+)?\s*%/i;

function requiresStrictBusinessEvidence(brief: string, sourceEvidence: string): boolean {
  const haystack = `${brief}\n${sourceEvidence}`;
  return /\b(?:vc|pitch deck|investor deck|series [a-z]|term sheet|traction deck|fundraising|pre-money|post-money)\b/i.test(haystack)
    || /\b(?:from the uploaded|uploaded (?:screenshot|deck|file|evidence|reference)|attached (?:screenshot|deck|file)|landing-?page screenshot)\b/i.test(haystack)
    || /do not make ai slop/i.test(haystack);
}

function allowsInventedBusinessFacts(brief: string): boolean {
  return /\b(?:fictional|hypothetical|assume|invent|mock|sample|placeholder|example metrics|plausible metrics|make up)\b/i.test(brief);
}

function unsupportedMetricNumbers(text: string): string[] {
  return extractNumberTokens(text).filter((token) => !isCalendarYearToken(token));
}

function isCalendarYearToken(token: string): boolean {
  const numeric = Number.parseFloat(token.replace(/[^\d.]/g, ''));
  return Number.isFinite(numeric)
    && Number.isInteger(numeric)
    && numeric >= 1990
    && numeric <= 2035
    && !/[kmb%]|million|billion|crore|lakh|cr/.test(token);
}

function artifactTextUnits(artifact: ArtifactDocument): string[] {
  const units: string[] = [
    artifact.title,
    artifact.audience,
    artifact.tone,
    artifact.executiveSummary
  ];

  for (const section of artifact.sections) {
    units.push(section.heading, section.body, ...section.bullets);
    if (section.table) {
      units.push(...section.table.columns);
      units.push(...section.table.rows.flat());
    }
    if (section.chart) {
      units.push(section.chart.title ?? '', ...section.chart.labels, ...section.chart.series.map((series) => series.name));
    }
  }

  for (const slide of artifact.slides ?? []) {
    units.push(slide.title, slide.subtitle ?? '', ...slide.bullets, slide.speakerNotes ?? '');
    if (slide.table) {
      units.push(...slide.table.columns);
      units.push(...slide.table.rows.flat());
    }
    if (slide.chart) {
      units.push(slide.chart.title ?? '', ...slide.chart.labels, ...slide.chart.series.map((series) => series.name));
    }
  }

  return units.map((unit) => unit.trim()).filter(Boolean);
}

function extractNumberTokens(value: string): string[] {
  return [...value.matchAll(/[$₹]?\s*\d+(?:[,.]\d+)*(?:\.\d+)?\s*(?:k|m|b|%|cr|crore|lakh|mn|million|billion)?/gi)]
    .map((match) => normalizeNumberToken(match[0]))
    .filter(Boolean);
}

function normalizeNumberToken(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[$₹,\s]/g, '')
    .trim();
  const match = cleaned.match(/^(\d+(?:\.\d+)?)(k|m|b|%|cr|crore|lakh|mn|million|billion)?$/);
  if (!match) return cleaned;
  return `${Number(match[1])}${match[2] ?? ''}`;
}

function requestedPageCount(brief: string): number | undefined {
  const match = brief.match(/\b(?:exactly\s+)?(\d{1,2})\s*(?:-|–|\s)?\s*pages?\b/i);
  if (!match) return undefined;
  const count = Number.parseInt(match[1], 10);
  return count > 0 && count <= 24 ? count : undefined;
}

function effectiveSlideLayout(slide: NonNullable<ArtifactDocument['slides']>[number]): string {
  if (slide.chart) return 'chart';
  if (slide.metrics?.length) return 'metric';
  if (slide.columns?.length === 2) return 'comparison';
  if (slide.quote) return 'quote';
  if (slide.layout) return slide.layout;
  if (slide.table) return 'list';
  if (slide.imageAssetId) return 'image';
  if (slide.bullets.length <= 2) return 'statement';
  if (slide.subtitle) return 'split';
  if (slide.bullets.length >= 5) return 'grid';
  return 'list';
}

function isVisuallyStructuredSlide(slide: NonNullable<ArtifactDocument['slides']>[number]): boolean {
  const layout = effectiveSlideLayout(slide);
  return Boolean(
    slide.chart ||
    slide.table ||
    slide.imageAssetId ||
    slide.metrics?.length ||
    slide.columns?.length ||
    slide.quote ||
    layout === 'timeline' ||
    layout === 'process'
  );
}

function hasThreeConsecutiveMatchingLayouts(slides: NonNullable<ArtifactDocument['slides']>): boolean {
  return slides.some((slide, index) =>
    index >= 2 &&
    effectiveSlideLayout(slide) === effectiveSlideLayout(slides[index - 1]) &&
    effectiveSlideLayout(slide) === effectiveSlideLayout(slides[index - 2])
  );
}

function countThemeTransitions(slides: NonNullable<ArtifactDocument['slides']>): number {
  return slides.slice(1).reduce((count, slide, index) =>
    count + ((slide.theme ?? 'light') === (slides[index].theme ?? 'light') ? 0 : 1), 0
  );
}

function layoutFamily(layout: string): string {
  if (layout === 'cover' || layout === 'statement') return 'narrative';
  if (layout === 'split' || layout === 'list') return 'explanatory';
  if (layout === 'grid' || layout === 'comparison' || layout === 'metric') return 'modular';
  if (layout === 'chart') return 'data';
  if (layout === 'timeline' || layout === 'process') return 'sequence';
  return 'visual';
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function cleanText(value: string | undefined, max: number): string {
  return (value ?? '')
    .replace(/\b(?:backend|harness|terminal|workspace|tool(?:-| )?call|json|schema)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}
