import { resolveDesignPreset } from '../../designPresets.js';
import type { ArtifactDocument, Slide } from '../../shared.js';
import type { DeckArchetype, SlideBlueprint } from '../archetypes/deckArchetypes.js';
import { applyDeckVisualVariant } from './deckVisualVariant.js';

export type DeckVertical = {
  id: string;
  product: string;
  category: string;
  thesis: string;
  marketSize: string;
  askAmount: string;
  tractionCount: string;
  tractionGrowth: string;
};

type SlideContent = Pick<
  Slide,
  | 'title'
  | 'eyebrow'
  | 'subtitle'
  | 'bullets'
  | 'takeaway'
  | 'metrics'
  | 'columns'
  | 'quote'
  | 'quoteAttribution'
  | 'chart'
>;

const tractionChart = (vertical: DeckVertical): Slide['chart'] => ({
  type: 'column',
  title: 'Monthly active accounts',
  labels: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'],
  series: [{ name: 'Accounts', values: [42, 58, 71, 84, 96, 112] }]
});

const growthChart = (vertical: DeckVertical): Slide['chart'] => ({
  type: 'area',
  title: 'ARR ($M)',
  labels: ['Q1', 'Q2', 'Q3', 'Q4'],
  series: [{ name: 'ARR', values: [2.1, 3.4, 5.2, 7.8] }],
  unit: '$M'
});

const legacyComparison = (vertical: DeckVertical): Slide['columns'] => [
  {
    heading: 'Legacy stack',
    bullets: ['Manual handoffs', 'Fragmented reporting', 'Slow onboarding', 'Low visibility']
  },
  {
    heading: vertical.product,
    bullets: ['Unified workflow layer', 'Live operational metrics', 'Faster rollout', 'Executive-ready reporting']
  }
];

const CONTENT_RESOLVERS: Record<string, (vertical: DeckVertical, archetype: DeckArchetype) => SlideContent> = {
  cover: (vertical) => ({
    title: vertical.product,
    eyebrow: vertical.category,
    subtitle: `${vertical.thesis} · 2026 investor narrative`,
    bullets: ['Investor deck', '2026', 'Product', 'Traction']
  }),
  'cover-close': (vertical) => ({
    title: `Join ${vertical.product}`,
    eyebrow: 'Next chapter',
    subtitle: 'Thank you · Questions welcome',
    bullets: [vertical.askAmount, '90-day milestone plan', 'Monthly investor updates']
  }),
  thesis: (vertical) => ({
    title: vertical.thesis,
    eyebrow: vertical.product,
    subtitle: 'One sentence that frames the entire round',
    bullets: ['Category shift underway', 'Timing advantage is now']
  }),
  vision: (vertical) => ({
    title: `The future of ${vertical.category.toLowerCase()}`,
    eyebrow: 'Vision',
    subtitle: vertical.thesis,
    bullets: ['10x better operator experience', 'Platform becomes system of record']
  }),
  agenda: (vertical, archetype) => ({
    title: 'Agenda',
    eyebrow: `${vertical.product} · ${archetype.name}`,
    bullets: [
      '01 · Problem and market tension',
      '02 · Product and differentiation',
      '03 · Traction and proof',
      '04 · Business model',
      '05 · Team and plan',
      '06 · The ask'
    ],
    takeaway: 'One narrative arc from tension to close'
  }),
  problem: (vertical) => ({
    title: 'The workflow gap',
    eyebrow: 'Problem',
    subtitle: `Teams in ${vertical.category.toLowerCase()} still stitch together fragmented tools`,
    bullets: ['Manual reporting', 'Context switching', 'Slow approvals', 'No single source of truth']
  }),
  origin: (vertical) => ({
    title: 'Where we started',
    eyebrow: 'Story',
    subtitle: `Operators in ${vertical.category.toLowerCase()} deserved a better default`,
    bullets: [
      'Founders lived the pain firsthand',
      'Early design partners shaped v1',
      'Shape panels mark each chapter — no stock photos required'
    ]
  }),
  platform: (vertical) => ({
    title: 'Platform overview',
    eyebrow: vertical.product,
    subtitle: 'One surface for operators, executives, and integrators',
    bullets: ['Unified dashboard', 'Automation layer', 'Audit trail', 'Enterprise SSO']
  }),
  market: (vertical) => ({
    title: 'Market opportunity',
    eyebrow: 'TAM',
    subtitle: 'Large, expanding category with urgent workflow modernization',
    metrics: [
      { value: vertical.marketSize, label: 'Total market', detail: 'Global category spend' },
      { value: '$8B', label: 'Serviceable', detail: 'Mid-market and enterprise' },
      { value: '$1.2B', label: 'Obtainable', detail: 'Initial wedge' }
    ],
    bullets: ['Workflow digitization is still early in this category']
  }),
  traction: (vertical) => ({
    title: 'Our traction',
    eyebrow: 'Momentum',
    subtitle: `Gaining traction with ${vertical.tractionCount}`,
    bullets: [vertical.tractionGrowth, 'Logo velocity improving quarter over quarter'],
    chart: tractionChart(vertical)
  }),
  'growth-chart': (vertical) => ({
    title: 'ARR momentum',
    eyebrow: 'Growth',
    subtitle: `Expansion-led growth across ${vertical.tractionCount}`,
    bullets: ['Net retention above 120% in enterprise cohort'],
    chart: growthChart(vertical)
  }),
  comparison: (vertical) => ({
    title: 'Why we win',
    eyebrow: 'Differentiation',
    columns: legacyComparison(vertical),
    bullets: ['Replace spreadsheets and swivel-chair ops with one system of record']
  }),
  team: (vertical) => ({
    title: 'Team behind the product',
    eyebrow: 'Operators',
    subtitle: 'Founders with domain depth and enterprise delivery experience',
    bullets: [
      'Previously scaled B2B SaaS from seed to Series C',
      'Built workflow platforms used by Fortune 500 teams',
      'Hiring senior GTM and customer success leaders next'
    ]
  }),
  gtm: (vertical) => ({
    title: 'Go-to-market plan',
    eyebrow: 'Plan',
    subtitle: `Land-and-expand motion for ${vertical.category.toLowerCase()}`,
    bullets: ['Founder-led enterprise pilots', 'Partner channel in Q3', 'Self-serve wedge for mid-market']
  }),
  process: (vertical) => ({
    title: 'How it works',
    eyebrow: 'Process',
    subtitle: `Three-step rollout for ${vertical.product}`,
    bullets: ['Connect data sources', 'Configure workflows', 'Measure outcomes in week one']
  }),
  roadmap: (vertical) => ({
    title: 'Roadmap',
    eyebrow: 'Timeline',
    subtitle: 'Milestones for the next 18 months',
    bullets: ['Q1 · Enterprise SSO', 'Q2 · AI workflow layer', 'Q3 · Partner ecosystem', 'Q4 · International expansion']
  }),
  ask: (vertical) => ({
    title: 'Use of funds',
    eyebrow: 'The ask',
    subtitle: 'Geographic expansion, product velocity, and enterprise acquisition',
    metrics: [
      { value: vertical.askAmount, label: 'Round target', detail: '18-month runway' },
      { value: '40%', label: 'Product', detail: 'Platform and AI workflows' },
      { value: '35%', label: 'GTM', detail: 'Enterprise expansion' }
    ],
    bullets: ['Expand US and EU enterprise sales', 'Accelerate AI-native workflow roadmap']
  }),
  close: (vertical, archetype) => ({
    title: `Scaling ${vertical.product} to the next level`,
    eyebrow: 'Close',
    subtitle: `Join the round · ${archetype.name} narrative`,
    bullets: ['Clear use of funds', 'Named owners for each growth lever', 'Investor updates monthly']
  }),
  'metrics-snapshot': (vertical) => ({
    title: 'Operating metrics at a glance',
    eyebrow: 'Proof',
    metrics: [
      { value: vertical.tractionGrowth, label: 'Growth', detail: 'Quarter over quarter' },
      { value: '128%', label: 'Net retention', detail: 'Enterprise cohort' },
      { value: '61', label: 'NPS', detail: 'Support satisfaction' }
    ],
    bullets: ['ARR velocity', 'Net revenue retention', 'Activation rate']
  }),
  highlights: (vertical) => ({
    title: 'Just a few facts',
    eyebrow: 'Highlights',
    bullets: [
      '24 months of enterprise delivery',
      '10M workflow events processed',
      `Live with ${vertical.tractionCount}`,
      '16 countries live or in pilot'
    ]
  }),
  'quote-customer': (vertical) => ({
    title: 'Customer voice',
    quote: `${vertical.product} replaced three tools and gave our team live visibility in the first week.`,
    quoteAttribution: `VP Operations · ${vertical.category} customer`,
    bullets: ['Reference logos available under NDA']
  }),
  'quote-founder': (vertical) => ({
    title: 'Founder note',
    quote: `We built ${vertical.product} because ${vertical.thesis.toLowerCase()}.`,
    quoteAttribution: `CEO · ${vertical.product}`,
    bullets: ['Operator-first product DNA']
  })
};

function resolveSlideContent(
  blueprint: SlideBlueprint,
  vertical: DeckVertical,
  archetype: DeckArchetype
): SlideContent {
  const resolver = CONTENT_RESOLVERS[blueprint.contentKey];
  if (!resolver) {
    return {
      title: blueprint.contentKey,
      bullets: [vertical.thesis]
    };
  }
  return resolver(vertical, archetype);
}

function buildSlide(
  blueprint: SlideBlueprint,
  vertical: DeckVertical,
  archetype: DeckArchetype
): Slide {
  const content = resolveSlideContent(blueprint, vertical, archetype);
  return {
    ...content,
    role: blueprint.role,
    layout: blueprint.layout,
    theme: blueprint.theme,
    tone: blueprint.tone
  };
}

export function buildDeckFromArchetype(
  archetype: DeckArchetype,
  vertical: DeckVertical
): ArtifactDocument {
  const preset = resolveDesignPreset(archetype.designPreset, 'deck');
  const baseSlides = archetype.slideBlueprint.map((blueprint) => buildSlide(blueprint, vertical, archetype));
  const variant = applyDeckVisualVariant(vertical, baseSlides, preset.palette, preset.headingFont);

  return {
    kind: 'deck',
    primaryFormat: 'pptx',
    title: `${archetype.name} — ${vertical.product}`,
    audience: 'Seed and Series A investors',
    tone: archetype.deckTone,
    executiveSummary: `${vertical.thesis}. ${archetype.visualDirection} ${variant.visualSuffix}.`,
    sections: [{
      heading: 'Deck intent',
      body: `Preserve the ${archetype.name} layout fingerprint: ${archetype.layoutSequence}.`,
      bullets: [
        `${variant.slides.length} slides with distinct ${archetype.id} rhythm`,
        `${vertical.category} visual variant — unique palette and tone rotation`,
        'One insight per slide · metric and chart proof where mapped'
      ]
    }],
    slides: variant.slides,
    citations: [{
      id: 'S1',
      label: `Peak archetype: ${archetype.name}`,
      url: 'https://powerpoint.cloud.microsoft/create/en/pitch-deck-templates/'
    }],
    nextQuestions: [],
    design: {
      template: preset.template,
      visualDirection: `${archetype.visualDirection} ${variant.visualSuffix}.`,
      headingFontFamily: variant.headingFontFamily ?? preset.headingFont,
      bodyFontFamily: preset.bodyFont,
      slideAspect: preset.slideAspect ?? 'wide',
      density: variant.density ?? preset.density ?? 'airy',
      palette: { ...variant.palette }
    },
    assets: []
  };
}

export function buildDeckArtifactId(archetypeId: string, verticalId: string): string {
  return `peak-archetype-${archetypeId}-${verticalId}`;
}