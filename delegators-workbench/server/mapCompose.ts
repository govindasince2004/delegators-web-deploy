import { jsonrepair } from 'jsonrepair';
import type { ArtifactDocument, ArtifactKind, ArtifactPrimaryFormat, Slide } from '../src/lib/shared.js';
import { parseArtifactCandidate } from './artifactRepair.js';
import { audienceCraftLines, detectArtifactAudience } from './artifactAudience.js';
import type { ArtifactSkillPack } from './artifactSkills.js';
import type { SkillDefinition } from '../src/lib/skills.js';
import type { ResearchPack } from './research.js';
import { compileBriefConstraints, constraintPromptLines } from './constraintCompiler.js';
import { diversityDirectiveForSlide } from './diversityPlanner.js';
import { selectTemplateScaffold, templateScaffoldPromptLines } from './templateRag.js';
import { credibilityPromptLines } from './artifactCredibility.js';
import { buildUserPromptContract, userPromptContractLines } from './userPromptContract.js';
import type { RunDepthTier } from './agenticDepth.js';
import { mapComposeConcurrency } from './agenticDepth.js';

type OutlineSlide = {
  index?: number;
  role?: Slide['role'];
  title?: string;
  message?: string;
  layout?: Slide['layout'];
  theme?: Slide['theme'];
  sourceIds?: string[];
  needsChart?: boolean;
  needsImage?: boolean;
  speakerNotesHint?: string;
};

type DeckOutline = {
  title?: string;
  audience?: string;
  tone?: string;
  design?: ArtifactDocument['design'];
  narrativeArc?: string;
  slides?: OutlineSlide[];
};

export type MapComposeContext = {
  artifactKind: ArtifactKind;
  primaryFormat: ArtifactPrimaryFormat;
  cleanBrief: string;
  skillPack: ArtifactSkillPack;
  combinedSourceText: string;
  outlineJson: string;
  selectedSkill?: SkillDefinition;
  instructions: string;
  style: string;
  designPromptLines: string[];
  formatSkillInstructions: string[];
  schemaContract: string;
  researchPack: ResearchPack | null;
  threadRoutingLines?: string[];
  preferredScaffoldId?: string;
  completeTurn: (request: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature: number;
  }) => Promise<string>;
  composeModel: string;
  depthTier?: RunDepthTier;
  streamLimit?: number;
  onStatus?: (message: string) => void;
};

export function shouldUseMapCompose(kind: ArtifactKind, brief: string, outlineJson: string): boolean {
  if (kind !== 'deck') return false;
  const outline = parseOutline(outlineJson);
  const slideCount = outline?.slides?.length ?? 0;
  if (slideCount < 4) return false;
  const constraints = compileBriefConstraints(brief, kind);
  if (constraints.slideCount && constraints.slideCount >= 4) return true;
  return slideCount >= 4;
}

function parseOutline(content: string): DeckOutline | null {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const candidate = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  try {
    return JSON.parse(candidate) as DeckOutline;
  } catch {
    try {
      return JSON.parse(jsonrepair(candidate)) as DeckOutline;
    } catch {
      return null;
    }
  }
}

function buildSlideComposeMessages(ctx: MapComposeContext, outline: DeckOutline, slide: OutlineSlide, index: number, total: number) {
  const audience = detectArtifactAudience(ctx.cleanBrief, ctx.artifactKind);
  const scaffold = selectTemplateScaffold(
    ctx.artifactKind,
    ctx.cleanBrief,
    ctx.preferredScaffoldId
  );
  const constraints = compileBriefConstraints(ctx.cleanBrief, ctx.artifactKind);
  const contract = buildUserPromptContract(ctx.cleanBrief, ctx.artifactKind);
  return [
    {
      role: 'system',
      content: [
        'You compose ONE presentation slide for Delegators Workbench.',
        'Return only JSON for a single slide object. No Markdown. No array wrapper.',
        'Slide schema fields: title, role?, eyebrow?, subtitle?, bullets[], sourceIds?, speakerNotes?, layout?, theme?, takeaway?, metrics?, columns?, quote?, quoteAttribution?, table?, chart?, imageAssetId?.',
        'Write message titles — not topic labels. Keep on-slide copy concise.',
        'Use only facts from the research pack; bind external claims to sourceIds.',
        ...audienceCraftLines(audience, ctx.artifactKind),
        ...templateScaffoldPromptLines(scaffold),
        ...constraintPromptLines(constraints),
        ...userPromptContractLines(contract),
        ...(ctx.threadRoutingLines ?? []),
        ...credibilityPromptLines(audience, ctx.artifactKind, {
          needsResearch: Boolean(ctx.researchPack?.sources.length),
          hasSources: Boolean(ctx.researchPack?.sources.length)
        }),
        ...diversityDirectiveForSlide(index, total, slide),
        ctx.skillPack.guide
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        `Deck: ${outline.title ?? 'Untitled'}`,
        `Slide ${index + 1} of ${total}`,
        `Role: ${slide.role ?? 'context'}`,
        `Planned title: ${slide.title ?? ''}`,
        `Planned message: ${slide.message ?? ''}`,
        `Layout: ${slide.layout ?? 'list'}`,
        slide.needsChart ? 'Include a chart if numeric evidence exists in sources.' : '',
        slide.needsImage ? 'Use imageAssetId only from listed available assets.' : '',
        slide.sourceIds?.length ? `Bind to sourceIds: ${slide.sourceIds.join(', ')}` : '',
        slide.speakerNotesHint ? `Speaker notes hint: ${slide.speakerNotesHint}` : '',
        `Brief:\n${ctx.cleanBrief}`,
        ctx.combinedSourceText ? `Sources:\n${ctx.combinedSourceText}` : ''
      ].filter(Boolean).join('\n\n')
    }
  ];
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(values[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function normalizeSlide(slide: OutlineSlide, composed: Slide, index: number, total: number): Slide {
  return {
    ...composed,
    title: composed.title || slide.title || `Slide ${index + 1}`,
    role: composed.role ?? slide.role ?? (index === 0 ? 'opener' : index === total - 1 ? 'close' : 'context'),
    layout: composed.layout ?? slide.layout,
    theme: composed.theme ?? slide.theme,
    sourceIds: composed.sourceIds?.length ? composed.sourceIds : slide.sourceIds
  };
}

export async function composeDeckFromOutline(ctx: MapComposeContext): Promise<ArtifactDocument | null> {
  const outline = parseOutline(ctx.outlineJson);
  if (!outline?.slides?.length) return null;

  const slides = outline.slides;
  ctx.onStatus?.(`Composing ${slides.length} slides in parallel`);

  const concurrency = mapComposeConcurrency(ctx.depthTier ?? 'standard', ctx.streamLimit);
  const composedSlides = await mapWithConcurrency(slides, concurrency, async (slide, index) => {
    const content = await ctx.completeTurn({
      model: ctx.composeModel,
      messages: buildSlideComposeMessages(ctx, outline, slide, index, slides.length),
      temperature: 0.12
    });
    const parsed = parseSlideJson(content);
    if (!parsed) {
      return normalizeSlide(slide, {
        title: slide.title ?? `Slide ${index + 1}`,
        bullets: slide.message ? [slide.message] : ['Content pending verification.'],
        layout: slide.layout,
        role: slide.role
      }, index, slides.length);
    }
    return normalizeSlide(slide, parsed, index, slides.length);
  });

  const artifactCandidate = {
    kind: ctx.artifactKind,
    primaryFormat: ctx.primaryFormat,
    title: outline.title ?? 'Untitled presentation',
    audience: outline.audience ?? 'Audience',
    tone: outline.tone ?? ctx.style,
    executiveSummary: outline.narrativeArc ?? '',
    design: outline.design ?? {},
    sections: composedSlides.map((slide) => ({
      heading: slide.title,
      body: slide.subtitle ?? slide.takeaway ?? '',
      bullets: slide.bullets.slice(0, 4)
    })),
    slides: composedSlides,
    citations: [],
    nextQuestions: []
  };

  const parsed = parseArtifactCandidate(artifactCandidate, {
    expectedKind: ctx.artifactKind,
    expectedPrimaryFormat: ctx.primaryFormat,
    fallbackTone: ctx.style
  });
  return parsed.success ? parsed.data : null;
}

function parseSlideJson(content: string): Slide | null {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const candidate = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  try {
    return JSON.parse(candidate) as Slide;
  } catch {
    try {
      return JSON.parse(jsonrepair(candidate)) as Slide;
    } catch {
      return null;
    }
  }
}