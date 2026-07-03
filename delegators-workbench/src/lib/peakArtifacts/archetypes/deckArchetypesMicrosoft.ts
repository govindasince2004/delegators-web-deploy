import type { DeckArchetype, SlideBlueprint } from './deckArchetypes.js';
import { microsoftPowerPointRefs } from './microsoftInspiredCatalog.js';

function sequence(blueprint: SlideBlueprint[]): string {
  return blueprint.map((slide) => slide.layout).join('>');
}

function msArchetype(
  msId: string,
  name: string,
  category: string,
  visualDirection: string,
  deckTone: DeckArchetype['deckTone'],
  slideBlueprint: SlideBlueprint[]
): DeckArchetype {
  const id = `ms-${msId}`;
  return {
    id,
    name,
    category,
    designPreset: id,
    layoutSequence: sequence(slideBlueprint),
    slideBlueprint,
    visualDirection,
    deckTone
  };
}

const s = (
  contentKey: string,
  role: SlideBlueprint['role'],
  layout: SlideBlueprint['layout'],
  theme: SlideBlueprint['theme'],
  tone: SlideBlueprint['tone']
): SlideBlueprint => ({ contentKey, role, layout, theme, tone });

/** 32 Microsoft Create–inspired decks — each with a unique layout fingerprint. */
const MS_BLUEPRINTS: Record<string, SlideBlueprint[]> = {
  'pitch-deck': [
    s('timeline', 'context', 'timeline', 'light', 'cobalt'),
    s('cover', 'opener', 'cover', 'accent', 'white'),
    s('thesis', 'opener', 'statement', 'light', 'ivory'),
    s('problem', 'tension', 'split', 'light', 'orange'),
    s('market', 'context', 'metric', 'light', 'cobalt'),
    s('traction', 'proof', 'chart', 'light', 'white'),
    s('comparison', 'insight', 'comparison', 'light', 'ivory'),
    s('platform', 'solution', 'grid', 'light', 'lime'),
    s('quote-customer', 'proof', 'quote', 'accent', 'pink'),
    s('close', 'close', 'statement', 'light', 'cobalt')
  ],
  'business-presentation': [
    s('cover', 'opener', 'cover', 'light', 'white'),
    s('agenda', 'context', 'list', 'light', 'cobalt'),
    s('problem', 'tension', 'split', 'light', 'ivory'),
    s('platform', 'solution', 'grid', 'light', 'white'),
    s('market', 'context', 'metric', 'light', 'cobalt'),
    s('traction', 'proof', 'chart', 'light', 'ivory'),
    s('process', 'plan', 'process', 'light', 'white'),
    s('comparison', 'insight', 'comparison', 'light', 'cobalt'),
    s('close', 'close', 'statement', 'light', 'ivory'),
    s('agenda', 'close', 'list', 'light', 'white')
  ],
  'timeline-slides': [
    s('cover', 'opener', 'cover', 'accent', 'cobalt'),
    s('roadmap', 'context', 'timeline', 'light', 'white'),
    s('roadmap', 'plan', 'timeline', 'light', 'ivory'),
    s('process', 'solution', 'process', 'light', 'cobalt'),
    s('market', 'context', 'metric', 'light', 'white'),
    s('traction', 'proof', 'chart', 'light', 'lime'),
    s('comparison', 'insight', 'comparison', 'light', 'ivory'),
    s('platform', 'solution', 'grid', 'light', 'cobalt'),
    s('close', 'close', 'statement', 'light', 'white')
  ],
  'marketing-deck': [
    s('platform', 'opener', 'grid', 'accent', 'pink'),
    s('cover', 'opener', 'cover', 'accent', 'orange'),
    s('thesis', 'context', 'statement', 'light', 'white'),
    s('market', 'evidence', 'metric', 'light', 'yellow'),
    s('highlights', 'proof', 'grid', 'accent', 'lime'),
    s('traction', 'proof', 'chart', 'light', 'white'),
    s('comparison', 'insight', 'comparison', 'light', 'pink'),
    s('problem', 'tension', 'split', 'light', 'orange'),
    s('quote-customer', 'proof', 'quote', 'accent', 'cobalt'),
    s('close', 'close', 'statement', 'light', 'white')
  ],
  'academic-presentation': [
    s('cover', 'opener', 'cover', 'light', 'ivory'),
    s('thesis', 'opener', 'statement', 'light', 'white'),
    s('agenda', 'context', 'list', 'light', 'cobalt'),
    s('problem', 'tension', 'split', 'light', 'ivory'),
    s('market', 'evidence', 'metric', 'light', 'white'),
    s('traction', 'proof', 'chart', 'light', 'cobalt'),
    s('comparison', 'insight', 'comparison', 'light', 'ivory'),
    s('platform', 'solution', 'grid', 'light', 'white'),
    s('quote-founder', 'proof', 'quote', 'light', 'cobalt'),
    s('agenda', 'close', 'list', 'light', 'ivory')
  ],
  'sales-deck': [
    s('cover', 'opener', 'cover', 'accent', 'cobalt'),
    s('comparison', 'insight', 'comparison', 'light', 'white'),
    s('market', 'evidence', 'metric', 'light', 'lime'),
    s('problem', 'tension', 'split', 'light', 'ivory'),
    s('traction', 'proof', 'chart', 'light', 'white'),
    s('platform', 'solution', 'grid', 'light', 'cobalt'),
    s('metrics-snapshot', 'proof', 'metric', 'light', 'orange'),
    s('quote-customer', 'proof', 'quote', 'accent', 'pink'),
    s('close', 'close', 'statement', 'light', 'white'),
    s('gtm', 'plan', 'process', 'light', 'cobalt')
  ],
  'product-launch': [
    s('thesis', 'opener', 'statement', 'dark', 'noir'),
    s('cover', 'opener', 'cover', 'dark', 'cobalt'),
    s('platform', 'solution', 'grid', 'dark', 'noir'),
    s('problem', 'tension', 'split', 'dark', 'cobalt'),
    s('market', 'evidence', 'metric', 'dark', 'noir'),
    s('traction', 'proof', 'chart', 'dark', 'cobalt'),
    s('process', 'plan', 'process', 'dark', 'noir'),
    s('comparison', 'insight', 'comparison', 'dark', 'cobalt'),
    s('vision', 'close', 'statement', 'dark', 'noir'),
    s('cover-close', 'close', 'cover', 'dark', 'cobalt')
  ],
  'proposal-presentation': [
    s('cover', 'opener', 'cover', 'light', 'white'),
    s('platform', 'solution', 'grid', 'light', 'cobalt'),
    s('problem', 'tension', 'split', 'light', 'ivory'),
    s('market', 'evidence', 'metric', 'light', 'white'),
    s('comparison', 'insight', 'comparison', 'light', 'cobalt'),
    s('traction', 'proof', 'chart', 'light', 'ivory'),
    s('process', 'plan', 'process', 'light', 'white'),
    s('quote-customer', 'proof', 'quote', 'accent', 'lime'),
    s('close', 'close', 'statement', 'light', 'cobalt'),
    s('ask', 'close', 'metric', 'light', 'white')
  ],
  keynote: [
    s('thesis', 'opener', 'statement', 'dark', 'noir'),
    s('vision', 'opener', 'statement', 'dark', 'cobalt'),
    s('cover', 'opener', 'cover', 'dark', 'noir'),
    s('problem', 'tension', 'statement', 'dark', 'white'),
    s('market', 'evidence', 'metric', 'dark', 'cobalt'),
    s('traction', 'proof', 'chart', 'dark', 'noir'),
    s('comparison', 'insight', 'comparison', 'dark', 'cobalt'),
    s('platform', 'solution', 'grid', 'dark', 'noir'),
    s('quote-founder', 'proof', 'quote', 'dark', 'cobalt')
  ],
  portfolio: [
    s('platform', 'opener', 'grid', 'accent', 'pink'),
    s('highlights', 'proof', 'grid', 'accent', 'yellow'),
    s('cover', 'opener', 'cover', 'light', 'white'),
    s('quote-customer', 'proof', 'quote', 'accent', 'cobalt'),
    s('problem', 'context', 'split', 'light', 'ivory'),
    s('market', 'evidence', 'metric', 'light', 'white'),
    s('traction', 'proof', 'chart', 'light', 'cobalt'),
    s('comparison', 'insight', 'comparison', 'light', 'ivory'),
    s('close', 'close', 'statement', 'light', 'white')
  ],
  'copilot-pitch': [
    s('cover', 'opener', 'cover', 'light', 'cobalt'),
    s('process', 'solution', 'process', 'light', 'white'),
    s('platform', 'solution', 'grid', 'light', 'ivory'),
    s('traction', 'proof', 'chart', 'light', 'cobalt'),
    s('market', 'evidence', 'metric', 'light', 'white'),
    s('problem', 'tension', 'split', 'light', 'ivory'),
    s('comparison', 'insight', 'comparison', 'light', 'cobalt'),
    s('vision', 'close', 'statement', 'light', 'white'),
    s('highlights', 'proof', 'grid', 'accent', 'lime'),
    s('quote-founder', 'proof', 'quote', 'accent', 'cobalt')
  ],
  'financial-review': [
    s('market', 'opener', 'metric', 'light', 'cobalt'),
    s('metrics-snapshot', 'evidence', 'metric', 'light', 'white'),
    s('cover', 'opener', 'cover', 'light', 'ivory'),
    s('traction', 'proof', 'chart', 'light', 'cobalt'),
    s('platform', 'solution', 'grid', 'light', 'white'),
    s('comparison', 'insight', 'comparison', 'light', 'ivory'),
    s('problem', 'tension', 'split', 'light', 'cobalt'),
    s('close', 'close', 'statement', 'light', 'white'),
    s('roadmap', 'plan', 'timeline', 'light', 'ivory'),
    s('ask', 'close', 'metric', 'light', 'cobalt')
  ],
  'board-briefing': [
    s('thesis', 'opener', 'statement', 'light', 'ivory'),
    s('cover', 'opener', 'cover', 'light', 'white'),
    s('comparison', 'insight', 'comparison', 'light', 'cobalt'),
    s('market', 'evidence', 'metric', 'light', 'ivory'),
    s('problem', 'tension', 'split', 'light', 'white'),
    s('traction', 'proof', 'chart', 'light', 'cobalt'),
    s('platform', 'solution', 'grid', 'light', 'ivory'),
    s('quote-customer', 'proof', 'quote', 'accent', 'cobalt'),
    s('close', 'close', 'statement', 'light', 'white'),
    s('process', 'plan', 'process', 'light', 'ivory')
  ],
  'quarterly-review': [
    s('cover', 'opener', 'cover', 'light', 'white'),
    s('market', 'evidence', 'metric', 'light', 'cobalt'),
    s('traction', 'proof', 'chart', 'light', 'ivory'),
    s('roadmap', 'plan', 'timeline', 'light', 'white'),
    s('platform', 'solution', 'grid', 'light', 'cobalt'),
    s('comparison', 'insight', 'comparison', 'light', 'ivory'),
    s('problem', 'tension', 'split', 'light', 'white'),
    s('metrics-snapshot', 'proof', 'metric', 'light', 'cobalt'),
    s('close', 'close', 'statement', 'light', 'ivory'),
    s('quote-founder', 'proof', 'quote', 'accent', 'cobalt')
  ],
  'brand-guidelines-deck': [
    s('cover', 'opener', 'cover', 'light', 'ivory'),
    s('platform', 'solution', 'grid', 'light', 'white'),
    s('thesis', 'context', 'statement', 'light', 'ivory'),
    s('highlights', 'proof', 'grid', 'accent', 'yellow'),
    s('problem', 'context', 'split', 'light', 'white'),
    s('market', 'evidence', 'metric', 'light', 'ivory'),
    s('comparison', 'insight', 'comparison', 'light', 'white'),
    s('quote-founder', 'proof', 'quote', 'light', 'cobalt'),
    s('close', 'close', 'statement', 'light', 'ivory'),
    s('agenda', 'close', 'list', 'light', 'white')
  ],
  'training-deck': [
    s('cover', 'opener', 'cover', 'light', 'cobalt'),
    s('process', 'solution', 'process', 'light', 'white'),
    s('agenda', 'context', 'list', 'light', 'ivory'),
    s('problem', 'tension', 'split', 'light', 'white'),
    s('platform', 'solution', 'grid', 'light', 'cobalt'),
    s('market', 'evidence', 'metric', 'light', 'ivory'),
    s('traction', 'proof', 'chart', 'light', 'white'),
    s('comparison', 'insight', 'comparison', 'light', 'cobalt'),
    s('close', 'close', 'statement', 'light', 'ivory'),
    s('roadmap', 'plan', 'process', 'light', 'white')
  ],
  'webinar-deck': [
    s('cover', 'opener', 'cover', 'accent', 'cobalt'),
    s('market', 'evidence', 'metric', 'light', 'white'),
    s('quote-customer', 'proof', 'quote', 'accent', 'lime'),
    s('platform', 'solution', 'grid', 'light', 'ivory'),
    s('traction', 'proof', 'chart', 'light', 'cobalt'),
    s('problem', 'tension', 'split', 'light', 'white'),
    s('comparison', 'insight', 'comparison', 'light', 'ivory'),
    s('process', 'plan', 'process', 'light', 'cobalt'),
    s('close', 'close', 'statement', 'light', 'white'),
    s('metrics-snapshot', 'proof', 'metric', 'light', 'cobalt')
  ],
  'case-study-deck': [
    s('cover', 'opener', 'cover', 'light', 'white'),
    s('comparison', 'insight', 'comparison', 'light', 'cobalt'),
    s('traction', 'proof', 'chart', 'light', 'ivory'),
    s('problem', 'tension', 'split', 'light', 'white'),
    s('market', 'evidence', 'metric', 'light', 'cobalt'),
    s('platform', 'solution', 'grid', 'light', 'ivory'),
    s('quote-customer', 'proof', 'quote', 'accent', 'pink'),
    s('process', 'plan', 'process', 'light', 'white'),
    s('close', 'close', 'statement', 'light', 'cobalt'),
    s('metrics-snapshot', 'proof', 'metric', 'light', 'ivory')
  ],
  'roadmap-deck': [
    s('cover', 'opener', 'cover', 'light', 'cobalt'),
    s('roadmap', 'plan', 'timeline', 'light', 'white'),
    s('process', 'solution', 'process', 'light', 'ivory'),
    s('market', 'evidence', 'metric', 'light', 'cobalt'),
    s('traction', 'proof', 'chart', 'light', 'white'),
    s('platform', 'solution', 'grid', 'light', 'ivory'),
    s('comparison', 'insight', 'comparison', 'light', 'cobalt'),
    s('problem', 'tension', 'split', 'light', 'white'),
    s('close', 'close', 'statement', 'light', 'ivory'),
    s('quote-customer', 'proof', 'quote', 'accent', 'lime')
  ],
  'okr-review': [
    s('cover', 'opener', 'cover', 'light', 'white'),
    s('platform', 'solution', 'grid', 'light', 'cobalt'),
    s('market', 'evidence', 'metric', 'light', 'ivory'),
    s('traction', 'proof', 'chart', 'light', 'white'),
    s('comparison', 'insight', 'comparison', 'light', 'cobalt'),
    s('roadmap', 'plan', 'timeline', 'light', 'ivory'),
    s('problem', 'tension', 'split', 'light', 'white'),
    s('highlights', 'proof', 'grid', 'accent', 'lime'),
    s('close', 'close', 'statement', 'light', 'cobalt'),
    s('metrics-snapshot', 'proof', 'metric', 'light', 'white')
  ],
  'all-hands': [
    s('cover', 'opener', 'cover', 'accent', 'orange'),
    s('quote-founder', 'context', 'quote', 'accent', 'pink'),
    s('vision', 'context', 'statement', 'light', 'white'),
    s('platform', 'solution', 'grid', 'light', 'yellow'),
    s('market', 'evidence', 'metric', 'light', 'ivory'),
    s('traction', 'proof', 'chart', 'light', 'white'),
    s('comparison', 'insight', 'comparison', 'light', 'cobalt'),
    s('problem', 'context', 'split', 'light', 'ivory'),
    s('process', 'plan', 'process', 'light', 'white'),
    s('close', 'close', 'statement', 'accent', 'orange')
  ],
  'customer-success': [
    s('quote-customer', 'opener', 'quote', 'accent', 'lime'),
    s('cover', 'opener', 'cover', 'light', 'white'),
    s('market', 'evidence', 'metric', 'light', 'cobalt'),
    s('traction', 'proof', 'chart', 'light', 'ivory'),
    s('platform', 'solution', 'grid', 'light', 'white'),
    s('comparison', 'insight', 'comparison', 'light', 'cobalt'),
    s('problem', 'tension', 'split', 'light', 'ivory'),
    s('quote-founder', 'proof', 'quote', 'accent', 'pink'),
    s('close', 'close', 'statement', 'light', 'white'),
    s('process', 'plan', 'process', 'light', 'cobalt')
  ],
  'partner-pitch': [
    s('cover', 'opener', 'cover', 'light', 'cobalt'),
    s('problem', 'tension', 'split', 'light', 'white'),
    s('platform', 'solution', 'grid', 'light', 'ivory'),
    s('comparison', 'insight', 'comparison', 'light', 'cobalt'),
    s('market', 'evidence', 'metric', 'light', 'white'),
    s('traction', 'proof', 'chart', 'light', 'ivory'),
    s('process', 'plan', 'process', 'light', 'cobalt'),
    s('highlights', 'proof', 'grid', 'accent', 'lime'),
    s('close', 'close', 'statement', 'light', 'white'),
    s('quote-customer', 'proof', 'quote', 'accent', 'cobalt')
  ],
  'grant-pitch': [
    s('cover', 'opener', 'cover', 'light', 'forest'),
    s('thesis', 'context', 'statement', 'light', 'ivory'),
    s('market', 'evidence', 'metric', 'light', 'white'),
    s('platform', 'solution', 'grid', 'light', 'forest'),
    s('traction', 'proof', 'chart', 'light', 'ivory'),
    s('comparison', 'insight', 'comparison', 'light', 'white'),
    s('problem', 'tension', 'split', 'light', 'forest'),
    s('quote-customer', 'proof', 'quote', 'accent', 'lime'),
    s('close', 'close', 'statement', 'light', 'ivory'),
    s('ask', 'close', 'metric', 'light', 'forest')
  ],
  'nonprofit-pitch': [
    s('cover', 'opener', 'cover', 'accent', 'forest'),
    s('thesis', 'context', 'statement', 'light', 'ivory'),
    s('platform', 'solution', 'grid', 'light', 'forest'),
    s('market', 'evidence', 'metric', 'light', 'white'),
    s('quote-customer', 'proof', 'quote', 'accent', 'lime'),
    s('traction', 'proof', 'chart', 'light', 'ivory'),
    s('comparison', 'insight', 'comparison', 'light', 'forest'),
    s('process', 'plan', 'process', 'light', 'white'),
    s('close', 'close', 'statement', 'light', 'ivory'),
    s('highlights', 'proof', 'grid', 'accent', 'forest')
  ],
  'real-estate-pitch': [
    s('cover', 'opener', 'cover', 'light', 'ivory'),
    s('market', 'evidence', 'metric', 'light', 'white'),
    s('platform', 'solution', 'grid', 'light', 'cobalt'),
    s('problem', 'tension', 'split', 'light', 'ivory'),
    s('traction', 'proof', 'chart', 'light', 'white'),
    s('comparison', 'insight', 'comparison', 'light', 'cobalt'),
    s('metrics-snapshot', 'proof', 'metric', 'light', 'ivory'),
    s('quote-customer', 'proof', 'quote', 'accent', 'yellow'),
    s('close', 'close', 'statement', 'light', 'white'),
    s('roadmap', 'plan', 'timeline', 'light', 'ivory')
  ],
  'healthcare-pitch': [
    s('cover', 'opener', 'cover', 'light', 'cobalt'),
    s('problem', 'tension', 'split', 'light', 'white'),
    s('market', 'evidence', 'metric', 'light', 'ivory'),
    s('traction', 'proof', 'chart', 'light', 'cobalt'),
    s('platform', 'solution', 'grid', 'light', 'white'),
    s('comparison', 'insight', 'comparison', 'light', 'ivory'),
    s('quote-customer', 'proof', 'quote', 'accent', 'cobalt'),
    s('process', 'plan', 'process', 'light', 'white'),
    s('close', 'close', 'statement', 'light', 'cobalt'),
    s('metrics-snapshot', 'proof', 'metric', 'light', 'ivory')
  ],
  'education-pitch': [
    s('cover', 'opener', 'cover', 'accent', 'yellow'),
    s('agenda', 'context', 'list', 'light', 'white'),
    s('thesis', 'context', 'statement', 'light', 'ivory'),
    s('platform', 'solution', 'grid', 'light', 'yellow'),
    s('market', 'evidence', 'metric', 'light', 'white'),
    s('traction', 'proof', 'chart', 'light', 'ivory'),
    s('comparison', 'insight', 'comparison', 'light', 'yellow'),
    s('process', 'plan', 'process', 'light', 'white'),
    s('quote-customer', 'proof', 'quote', 'accent', 'cobalt'),
    s('close', 'close', 'statement', 'light', 'ivory')
  ],
  'startup-pitch': [
    s('cover', 'opener', 'cover', 'light', 'white'),
    s('agenda', 'context', 'list', 'light', 'cobalt'),
    s('market', 'evidence', 'metric', 'light', 'ivory'),
    s('traction', 'proof', 'chart', 'light', 'white'),
    s('comparison', 'insight', 'comparison', 'light', 'cobalt'),
    s('platform', 'solution', 'grid', 'light', 'ivory'),
    s('problem', 'tension', 'split', 'light', 'white'),
    s('close', 'close', 'statement', 'light', 'cobalt'),
    s('metrics-snapshot', 'proof', 'metric', 'light', 'ivory'),
    s('quote-founder', 'proof', 'quote', 'accent', 'orange')
  ],
  'investor-update': [
    s('cover', 'opener', 'cover', 'light', 'cobalt'),
    s('market', 'evidence', 'metric', 'light', 'white'),
    s('roadmap', 'plan', 'timeline', 'light', 'ivory'),
    s('traction', 'proof', 'chart', 'light', 'cobalt'),
    s('platform', 'solution', 'grid', 'light', 'white'),
    s('comparison', 'insight', 'comparison', 'light', 'ivory'),
    s('problem', 'context', 'split', 'light', 'cobalt'),
    s('close', 'close', 'statement', 'light', 'white'),
    s('metrics-snapshot', 'proof', 'metric', 'light', 'ivory'),
    s('quote-founder', 'proof', 'quote', 'accent', 'cobalt')
  ],
  'competitive-analysis': [
    s('cover', 'opener', 'cover', 'light', 'white'),
    s('comparison', 'insight', 'comparison', 'light', 'cobalt'),
    s('platform', 'solution', 'grid', 'light', 'ivory'),
    s('market', 'evidence', 'metric', 'light', 'white'),
    s('traction', 'proof', 'chart', 'light', 'cobalt'),
    s('problem', 'tension', 'split', 'light', 'ivory'),
    s('comparison', 'evidence', 'comparison', 'light', 'white'),
    s('close', 'close', 'statement', 'light', 'cobalt'),
    s('metrics-snapshot', 'proof', 'metric', 'light', 'ivory'),
    s('highlights', 'proof', 'grid', 'accent', 'lime')
  ],
  'event-pitch': [
    s('cover', 'opener', 'cover', 'accent', 'pink'),
    s('platform', 'solution', 'grid', 'accent', 'yellow'),
    s('quote-customer', 'proof', 'quote', 'accent', 'orange'),
    s('market', 'evidence', 'metric', 'light', 'white'),
    s('traction', 'proof', 'chart', 'light', 'pink'),
    s('problem', 'tension', 'split', 'light', 'ivory'),
    s('highlights', 'proof', 'grid', 'accent', 'lime'),
    s('comparison', 'insight', 'comparison', 'light', 'white'),
    s('close', 'close', 'statement', 'accent', 'pink'),
    s('process', 'plan', 'process', 'light', 'ivory')
  ]
};

const MS_DECK_TONES: Record<string, DeckArchetype['deckTone']> = {
  keynote: 'executive',
  'product-launch': 'executive',
  'financial-review': 'executive',
  'board-briefing': 'executive',
  'education-pitch': 'campus',
  'academic-presentation': 'campus',
  'training-deck': 'detailed',
  'quarterly-review': 'detailed'
};

export const microsoftDeckArchetypes: DeckArchetype[] = microsoftPowerPointRefs.map((ref) => {
  const blueprint = MS_BLUEPRINTS[ref.id];
  if (!blueprint) {
    throw new Error(`Missing Microsoft deck blueprint for ${ref.id}`);
  }
  return msArchetype(
    ref.id,
    `MS ${ref.category}`,
    ref.category,
    `${ref.designMood} — inspired by Microsoft Create (${ref.msUrl}).`,
    MS_DECK_TONES[ref.id] ?? 'professional',
    blueprint
  );
});

export const microsoftDeckArchetypeCount = microsoftDeckArchetypes.length;