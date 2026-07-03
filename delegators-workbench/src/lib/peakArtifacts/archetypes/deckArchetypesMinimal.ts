import type { DeckArchetype, SlideBlueprint } from './deckArchetypes.js';

function sequence(blueprint: SlideBlueprint[]): string {
  return blueprint.map((slide) => slide.layout).join('>');
}

function minimalArchetype(
  id: string,
  name: string,
  category: string,
  designPreset: string,
  visualDirection: string,
  slideBlueprint: SlideBlueprint[]
): DeckArchetype {
  return {
    id,
    name,
    category: category,
    designPreset,
    layoutSequence: sequence(slideBlueprint),
    slideBlueprint,
    visualDirection,
    deckTone: 'minimal'
  };
}

const s = (
  contentKey: string,
  role: SlideBlueprint['role'],
  layout: SlideBlueprint['layout'],
  theme: SlideBlueprint['theme'],
  tone: SlideBlueprint['tone']
): SlideBlueprint => ({ contentKey, role, layout, theme, tone });

/** 12 sparse minimalist decks — whitespace-first, statement-led rhythm. */
export const minimalistDeckArchetypes: DeckArchetype[] = [
  minimalArchetype(
    'swiss-grid',
    'Swiss Grid',
    'Minimal pitch',
    'notion-minimal',
    'Swiss modernism with strict grid, monochrome type, and single accent line.',
    [
      s('cover', 'opener', 'cover', 'light', 'white'),
      s('thesis', 'opener', 'statement', 'light', 'ivory'),
      s('market', 'evidence', 'metric', 'light', 'white'),
      s('vision', 'context', 'statement', 'light', 'ivory'),
      s('comparison', 'insight', 'comparison', 'light', 'white'),
      s('close', 'close', 'statement', 'light', 'ivory')
    ]
  ),
  minimalArchetype(
    'japanese-ink',
    'Japanese Ink',
    'Minimal pitch',
    'editorial-ivory',
    'Ink-wash minimalism with oversized kanji-inspired negative space and serif statements.',
    [
      s('thesis', 'opener', 'statement', 'light', 'ivory'),
      s('cover', 'opener', 'cover', 'light', 'white'),
      s('problem', 'tension', 'statement', 'light', 'ivory'),
      s('platform', 'solution', 'split', 'light', 'white'),
      s('quote-founder', 'proof', 'quote', 'light', 'ivory'),
      s('cover-close', 'close', 'cover', 'light', 'white')
    ]
  ),
  minimalArchetype(
    'mono-line',
    'Mono Line',
    'Minimal pitch',
    'consulting-mono',
    'Single-weight typography with hairline rules and one red accent per slide.',
    [
      s('cover', 'opener', 'cover', 'light', 'white'),
      s('agenda', 'context', 'list', 'light', 'ivory'),
      s('thesis', 'opener', 'statement', 'light', 'white'),
      s('traction', 'proof', 'chart', 'light', 'ivory'),
      s('ask', 'close', 'metric', 'light', 'white'),
      s('close', 'close', 'statement', 'light', 'ivory')
    ]
  ),
  minimalArchetype(
    'sparse-statement',
    'Sparse Statement',
    'Minimal pitch',
    'dropbox-simple',
    'Radically sparse — one sentence per slide, no charts until the close.',
    [
      s('cover', 'opener', 'cover', 'light', 'white'),
      s('thesis', 'opener', 'statement', 'light', 'ivory'),
      s('vision', 'context', 'statement', 'light', 'white'),
      s('problem', 'tension', 'statement', 'light', 'ivory'),
      s('platform', 'solution', 'statement', 'light', 'white'),
      s('close', 'close', 'statement', 'light', 'ivory'),
      s('cover-close', 'close', 'cover', 'light', 'white')
    ]
  ),
  minimalArchetype(
    'quiet-metric',
    'Quiet Metric',
    'Minimal pitch',
    'executive-slate',
    'Quiet slate metrics with whisper typography and airy metric tiles.',
    [
      s('cover', 'opener', 'cover', 'light', 'white'),
      s('metrics-snapshot', 'evidence', 'metric', 'light', 'ivory'),
      s('thesis', 'context', 'statement', 'light', 'white'),
      s('market', 'evidence', 'metric', 'light', 'ivory'),
      s('comparison', 'insight', 'comparison', 'light', 'white'),
      s('close', 'close', 'statement', 'light', 'ivory')
    ]
  ),
  minimalArchetype(
    'nordic-calm',
    'Nordic Calm',
    'Minimal pitch',
    'notion-minimal',
    'Scandinavian calm with cool gray surfaces and soft cobalt accents.',
    [
      s('cover', 'opener', 'cover', 'light', 'cobalt'),
      s('problem', 'tension', 'split', 'light', 'white'),
      s('thesis', 'context', 'statement', 'light', 'ivory'),
      s('process', 'plan', 'process', 'light', 'white'),
      s('quote-customer', 'proof', 'quote', 'light', 'ivory'),
      s('vision', 'close', 'statement', 'light', 'cobalt')
    ]
  ),
  minimalArchetype(
    'bauhaus-block',
    'Bauhaus Block',
    'Minimal pitch',
    'dribbble-colorblock',
    'Bauhaus geometry with three primary color blocks and strict alignment.',
    [
      s('cover', 'opener', 'cover', 'accent', 'cobalt'),
      s('platform', 'solution', 'grid', 'light', 'white'),
      s('thesis', 'context', 'statement', 'accent', 'yellow'),
      s('market', 'evidence', 'metric', 'light', 'white'),
      s('highlights', 'proof', 'grid', 'accent', 'orange'),
      s('close', 'close', 'statement', 'light', 'ivory')
    ]
  ),
  minimalArchetype(
    'zen-list',
    'Zen List',
    'Minimal pitch',
    'notion-minimal',
    'List-only narrative with numbered insights and zero chart clutter.',
    [
      s('cover', 'opener', 'cover', 'light', 'white'),
      s('agenda', 'context', 'list', 'light', 'ivory'),
      s('problem', 'tension', 'list', 'light', 'white'),
      s('platform', 'solution', 'list', 'light', 'ivory'),
      s('gtm', 'plan', 'list', 'light', 'white'),
      s('close', 'close', 'list', 'light', 'ivory')
    ]
  ),
  minimalArchetype(
    'paper-ivory',
    'Paper Ivory',
    'Minimal pitch',
    'sequoia-editorial',
    'Uncoated paper ivory deck with margin breathing room and serif cover.',
    [
      s('cover', 'opener', 'cover', 'light', 'ivory'),
      s('thesis', 'opener', 'statement', 'light', 'white'),
      s('origin', 'context', 'split', 'light', 'ivory'),
      s('market', 'evidence', 'metric', 'light', 'white'),
      s('quote-founder', 'proof', 'quote', 'light', 'ivory'),
      s('ask', 'close', 'metric', 'light', 'white'),
      s('close', 'close', 'statement', 'light', 'ivory')
    ]
  ),
  minimalArchetype(
    'glass-light',
    'Glass Light',
    'Minimal pitch',
    'stripe-fintech',
    'Glassmorphism-inspired light deck with frosted panels and thin borders.',
    [
      s('cover', 'opener', 'cover', 'light', 'white'),
      s('vision', 'context', 'statement', 'light', 'cobalt'),
      s('platform', 'solution', 'grid', 'light', 'white'),
      s('metrics-snapshot', 'evidence', 'metric', 'light', 'ivory'),
      s('comparison', 'insight', 'comparison', 'light', 'white'),
      s('roadmap', 'plan', 'timeline', 'light', 'cobalt'),
      s('close', 'close', 'statement', 'light', 'white')
    ]
  ),
  minimalArchetype(
    'single-accent',
    'Single Accent',
    'Minimal pitch',
    'cobalt-bold',
    'Monochrome deck with exactly one cobalt accent element per slide.',
    [
      s('statement', 'opener', 'statement', 'light', 'white'),
      s('cover', 'opener', 'cover', 'light', 'cobalt'),
      s('problem', 'tension', 'split', 'light', 'white'),
      s('traction', 'proof', 'chart', 'light', 'ivory'),
      s('team', 'proof', 'grid', 'light', 'white'),
      s('close', 'close', 'statement', 'light', 'cobalt')
    ]
  ),
  minimalArchetype(
    'breath-white',
    'Breath White',
    'Minimal pitch',
    'dropbox-simple',
    'All-white canvas with micro-type eyebrows and giant headline hierarchy.',
    [
      s('cover', 'opener', 'cover', 'light', 'white'),
      s('thesis', 'opener', 'statement', 'light', 'white'),
      s('highlights', 'evidence', 'list', 'light', 'ivory'),
      s('market', 'context', 'metric', 'light', 'white'),
      s('quote-customer', 'proof', 'quote', 'light', 'ivory'),
      s('cover-close', 'close', 'cover', 'light', 'white')
    ]
  )
];

export const minimalistDeckArchetypeCount = minimalistDeckArchetypes.length;