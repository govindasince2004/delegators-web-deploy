import type { ArtifactDesign, ArtifactDocument, Slide } from '../src/lib/shared.js';
import { detectArtifactAudience } from './artifactAudience.js';
import { enrichCoverSlide } from './artifactCredibilityRepair.js';

type SlideRole = NonNullable<Slide['role']>;

type DeckTemplate = {
  name: NonNullable<ArtifactDesign['template']>;
  visualDirection: string;
  headingFont: string;
  bodyFont: string;
  palette: NonNullable<ArtifactDesign['palette']>;
};

const deckTemplates: Record<string, DeckTemplate> = {
  'midnight-aurora': {
    name: 'midnight-aurora',
    visualDirection: 'Cinematic dark-space investor briefing with restrained typography and high-contrast evidence blocks.',
    headingFont: 'Arial Black',
    bodyFont: 'Calibri',
    palette: {
      background: '#070B12',
      surface: '#111827',
      text: '#F8FAFC',
      muted: '#94A3B8',
      primary: '#38BDF8',
      accent: '#F59E0B'
    }
  },
  'executive-slate': {
    name: 'executive-slate',
    visualDirection: 'Boardroom executive slate with calm hierarchy, generous whitespace, and sourced metrics.',
    headingFont: 'Georgia',
    bodyFont: 'Calibri',
    palette: {
      background: '#0F172A',
      surface: '#1E293B',
      text: '#F1F5F9',
      muted: '#94A3B8',
      primary: '#E2E8F0',
      accent: '#38BDF8'
    }
  },
  'consulting-mono': {
    name: 'consulting-mono',
    visualDirection: 'Consulting-grade monochrome system with sharp message titles and evidence-first layouts.',
    headingFont: 'Arial',
    bodyFont: 'Arial',
    palette: {
      background: '#FFFFFF',
      surface: '#F4F4F5',
      text: '#18181B',
      muted: '#71717A',
      primary: '#18181B',
      accent: '#2563EB'
    }
  },
  'noir-lumina': {
    name: 'noir-lumina',
    visualDirection: 'Premium noir opener with luminous accent panels for product and AI-native workflows.',
    headingFont: 'Helvetica',
    bodyFont: 'Helvetica',
    palette: {
      background: '#09090B',
      surface: '#18181B',
      text: '#FAFAFA',
      muted: '#A1A1AA',
      primary: '#FAFAFA',
      accent: '#22D3EE'
    }
  },
  'bold-pop': {
    name: 'bold-pop',
    visualDirection: 'Student-friendly bold presentation with high readability, one idea per slide, and clean contrast.',
    headingFont: 'Arial',
    bodyFont: 'Calibri',
    palette: {
      background: '#FFFFFF',
      surface: '#EEF2FF',
      text: '#1E1B4B',
      muted: '#6366F1',
      primary: '#4F46E5',
      accent: '#F97316'
    }
  },
  'modern-indigo': {
    name: 'modern-indigo',
    visualDirection: 'Modern startup and college-project deck with confident indigo system and crisp evidence blocks.',
    headingFont: 'Arial',
    bodyFont: 'Calibri',
    palette: {
      background: '#0B1020',
      surface: '#151B33',
      text: '#F8FAFC',
      muted: '#94A3B8',
      primary: '#818CF8',
      accent: '#38BDF8'
    }
  },
  'editorial-ivory': {
    name: 'editorial-ivory',
    visualDirection: 'Academic editorial deck with calm ivory surfaces and citation-friendly structure.',
    headingFont: 'Georgia',
    bodyFont: 'Calibri',
    palette: {
      background: '#FFFDF7',
      surface: '#F4F1EA',
      text: '#1C1917',
      muted: '#78716C',
      primary: '#1C1917',
      accent: '#B45309'
    }
  }
};

export function inferInvestorDeckTemplate(brief: string): DeckTemplate {
  const clean = brief.toLowerCase();
  if (/\b(?:space|orbital|rocket|starship|starlink|nasa)\b/.test(clean)) {
    return deckTemplates['midnight-aurora'];
  }
  if (/\b(?:cursor|ai[- ]native|developer|software|coding|ide)\b/.test(clean)) {
    return deckTemplates['noir-lumina'];
  }
  const audience = detectArtifactAudience(brief, 'deck');
  const audienceTemplate = deckTemplates[audience.deckTemplate];
  if (audienceTemplate) return audienceTemplate;
  if (/\b(?:consulting|strategy|thesis|briefing)\b/.test(clean)) {
    return deckTemplates['consulting-mono'];
  }
  return deckTemplates['executive-slate'];
}

export function applyInvestorDeckDesign(artifact: ArtifactDocument, brief = ''): ArtifactDocument {
  if (artifact.kind !== 'deck') return artifact;
  if (/\b(?:match(?:ing|ed)?|mirror(?:ing|ed)?|same style|uploaded presentation|reference style|follow(?:ing|ed)? the uploaded)\b/i.test(brief)) {
    return artifact;
  }
  const template = inferInvestorDeckTemplate(brief);
  const design = artifact.design ?? {};
  return {
    ...artifact,
    design: {
      ...design,
      template: design.template ?? template.name,
      visualDirection: design.visualDirection ?? template.visualDirection,
      headingFontFamily: design.headingFontFamily ?? template.headingFont,
      bodyFontFamily: design.bodyFontFamily ?? template.bodyFont,
      slideAspect: design.slideAspect ?? 'wide',
      density: design.density ?? detectArtifactAudience(brief, 'deck').density,
      includePageNumbers: design.includePageNumbers ?? false,
      palette: {
        background: design.palette?.background ?? template.palette.background,
        surface: design.palette?.surface ?? template.palette.surface,
        text: design.palette?.text ?? template.palette.text,
        muted: design.palette?.muted ?? template.palette.muted,
        primary: design.palette?.primary ?? template.palette.primary,
        accent: design.palette?.accent ?? template.palette.accent
      }
    }
  };
}

export function stabilizeDeckComposition(
  artifact: ArtifactDocument,
  brief = ''
): ArtifactDocument {
  if (artifact.kind !== 'deck' || !artifact.slides?.length) return artifact;
  artifact = applyInvestorDeckDesign(artifact, brief);
  const sourceSlides = artifact.slides;
  if (!sourceSlides?.length) return artifact;
  const slides = sourceSlides.map((slide, index, all) => ({
    ...slide,
    role: slide.role ?? inferSlideRole(slide, index, all.length)
  }));
  const preserveTheme = requestsUniformTheme(brief);
  const normalized = slides.map((slide, index) => ({
    ...slide,
    layout: stableLayout(slide, index),
    theme: preserveTheme ? slide.theme : stableTheme(slide, index, slides.length)
  }));
  const rhythm = preventLayoutTriples(normalized);
  const audience = detectArtifactAudience(brief, 'deck');
  const enriched = rhythm.length
    ? [
      enrichCoverSlide(
        rhythm[0],
        artifact,
        brief,
        new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        audience.label
      ),
      ...rhythm.slice(1)
    ]
    : rhythm;
  return { ...artifact, slides: enriched };
}

function inferSlideRole(slide: Slide, index: number, total: number): SlideRole {
  if (index === 0) return 'opener';
  if (index === total - 1) return 'close';
  const title = `${slide.title} ${slide.eyebrow ?? ''}`.toLowerCase();
  if (/\b(problem|risk|gap|challenge|friction|broken|cost of|why now)\b/.test(title)) return 'tension';
  if (/\b(roadmap|timeline|plan|sequence|phases?|next steps?|implementation|rollout)\b/.test(title) || slide.layout === 'timeline' || slide.layout === 'process') return 'plan';
  if (/\b(solution|product|platform|model|architecture|how it works|operating model)\b/.test(title)) return 'solution';
  if (/\b(traction|team|customers?|validation|case study|proof|results?)\b/.test(title)) return 'proof';
  if (slide.chart || slide.metrics?.length || slide.table || slide.sourceIds?.length) return 'evidence';
  if (slide.columns?.length === 2 || /\b(implication|means|therefore|decision|trade-?off|comparison)\b/.test(title)) return 'insight';
  const position = index / Math.max(1, total - 1);
  if (position < 0.3) return 'context';
  if (position < 0.58) return 'evidence';
  if (position < 0.78) return 'solution';
  return 'plan';
}

function stableLayout(slide: Slide, index: number): NonNullable<Slide['layout']> {
  if (slide.chart) return 'chart';
  if (slide.metrics?.length) return 'metric';
  if (slide.columns?.length === 2) return 'comparison';
  if (slide.quote) return 'quote';
  if (slide.imageAssetId) return 'image';
  if (slide.table) return 'list';
  if (slide.layout && ['timeline', 'process'].includes(slide.layout)) return slide.layout;
  if ((slide.role === 'insight' || slide.role === 'tension') && slide.bullets.length <= 2) return 'statement';

  const variants: Record<SlideRole, Array<NonNullable<Slide['layout']>>> = {
    opener: ['cover'],
    context: ['split', 'list'],
    tension: ['statement', 'split'],
    evidence: ['grid', 'split'],
    insight: ['statement', 'split'],
    solution: ['split', 'grid'],
    plan: ['process', 'timeline'],
    proof: ['grid', 'split'],
    close: ['statement']
  };
  const choices = variants[slide.role ?? 'context'];
  return choices[index % choices.length];
}

function stableTheme(slide: Slide, index: number, total: number): NonNullable<Slide['theme']> {
  if (index === 0 || index === total - 1) return 'dark';
  if (slide.role === 'insight' && total >= 8 && index >= Math.floor(total * 0.4) && index <= Math.ceil(total * 0.7)) {
    return 'accent';
  }
  return 'light';
}

function preventLayoutTriples(slides: Slide[]): Slide[] {
  return slides.map((slide, index) => {
    if (index < 2) return slide;
    const previous = slides[index - 1]?.layout;
    const beforePrevious = slides[index - 2]?.layout;
    if (!slide.layout || slide.layout !== previous || slide.layout !== beforePrevious) return slide;
    if (slide.chart || slide.metrics?.length || slide.columns?.length || slide.quote || slide.imageAssetId || slide.table) return slide;
    const alternate = slide.layout === 'split' ? 'list' : slide.layout === 'grid' ? 'split' : 'split';
    return { ...slide, layout: alternate };
  });
}

function requestsUniformTheme(brief: string): boolean {
  return /\b(?:all|entire|throughout|every slide|all slides)\b[\s\S]{0,45}\b(?:dark|black|light|white|monochrome)\b|\b(?:dark|black|light|white|monochrome)\b[\s\S]{0,45}\b(?:throughout|every slide|all slides)\b/i.test(brief);
}
