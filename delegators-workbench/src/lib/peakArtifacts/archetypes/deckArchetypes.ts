import type { Slide } from '../../shared.js';

export type SlideBlueprint = {
  contentKey: string;
  role: NonNullable<Slide['role']>;
  layout: NonNullable<Slide['layout']>;
  theme: NonNullable<Slide['theme']>;
  tone: NonNullable<Slide['tone']>;
};

export type DeckArchetype = {
  id: string;
  name: string;
  category: string;
  designPreset: string;
  /** Unique fingerprint for dedup validation — derived from slide layout order. */
  layoutSequence: string;
  slideBlueprint: SlideBlueprint[];
  visualDirection: string;
  deckTone: 'professional' | 'minimal' | 'executive' | 'campus' | 'detailed';
};

function sequence(blueprint: SlideBlueprint[]): string {
  return blueprint.map((slide) => slide.layout).join('>');
}

function archetype(
  id: string,
  name: string,
  category: string,
  designPreset: string,
  visualDirection: string,
  deckTone: DeckArchetype['deckTone'],
  slideBlueprint: SlideBlueprint[]
): DeckArchetype {
  return {
    id,
    name,
    category,
    designPreset,
    layoutSequence: sequence(slideBlueprint),
    slideBlueprint,
    visualDirection,
    deckTone
  };
}

import { microsoftDeckArchetypes } from './deckArchetypesMicrosoft.js';
import { minimalistDeckArchetypes } from './deckArchetypesMinimal.js';

/** Brand-inspired + Microsoft Create + minimalist pitch-deck archetypes — each with a distinct layout fingerprint. */
const brandDeckArchetypes: DeckArchetype[] = [
  archetype(
    'sequoia-editorial',
    'Sequoia Editorial',
    'Investor pitch',
    'sequoia-editorial',
    'Minimal serif editorial with oversized thesis statements and restrained ivory surfaces.',
    'professional',
    [
      { contentKey: 'thesis', role: 'opener', layout: 'statement', theme: 'light', tone: 'ivory' },
      { contentKey: 'cover', role: 'opener', layout: 'cover', theme: 'light', tone: 'white' },
      { contentKey: 'vision', role: 'context', layout: 'statement', theme: 'light', tone: 'ivory' },
      { contentKey: 'problem', role: 'tension', layout: 'split', theme: 'light', tone: 'white' },
      { contentKey: 'market', role: 'context', layout: 'metric', theme: 'light', tone: 'ivory' },
      { contentKey: 'traction', role: 'proof', layout: 'chart', theme: 'light', tone: 'white' },
      { contentKey: 'comparison', role: 'insight', layout: 'comparison', theme: 'light', tone: 'ivory' },
      { contentKey: 'platform', role: 'solution', layout: 'grid', theme: 'light', tone: 'white' },
      { contentKey: 'quote-customer', role: 'proof', layout: 'quote', theme: 'light', tone: 'ivory' },
      { contentKey: 'close', role: 'close', layout: 'statement', theme: 'light', tone: 'white' }
    ]
  ),
  archetype(
    'airbnb-story',
    'Airbnb Story',
    'Startup pitch',
    'airbnb-story',
    'Photo-led narrative rhythm using geometric shape panels instead of imagery.',
    'professional',
    [
      { contentKey: 'cover', role: 'opener', layout: 'cover', theme: 'accent', tone: 'cobalt' },
      { contentKey: 'origin', role: 'context', layout: 'split', theme: 'light', tone: 'white' },
      { contentKey: 'problem', role: 'tension', layout: 'split', theme: 'light', tone: 'pink' },
      { contentKey: 'quote-founder', role: 'insight', layout: 'quote', theme: 'accent', tone: 'cobalt' },
      { contentKey: 'process', role: 'solution', layout: 'process', theme: 'light', tone: 'white' },
      { contentKey: 'platform', role: 'solution', layout: 'grid', theme: 'light', tone: 'yellow' },
      { contentKey: 'traction', role: 'proof', layout: 'chart', theme: 'light', tone: 'white' },
      { contentKey: 'market', role: 'context', layout: 'metric', theme: 'light', tone: 'orange' },
      { contentKey: 'comparison', role: 'insight', layout: 'comparison', theme: 'light', tone: 'white' },
      { contentKey: 'vision', role: 'close', layout: 'statement', theme: 'accent', tone: 'cobalt' },
      { contentKey: 'cover-close', role: 'close', layout: 'cover', theme: 'dark', tone: 'noir' }
    ]
  ),
  archetype(
    'apple-keynote',
    'Apple Keynote',
    'Product launch',
    'apple-keynote',
    'Dark cinematic keynote with huge type and sparse luminous accents.',
    'executive',
    [
      { contentKey: 'cover', role: 'opener', layout: 'cover', theme: 'dark', tone: 'noir' },
      { contentKey: 'thesis', role: 'opener', layout: 'statement', theme: 'dark', tone: 'noir' },
      { contentKey: 'vision', role: 'context', layout: 'statement', theme: 'dark', tone: 'cobalt' },
      { contentKey: 'problem', role: 'tension', layout: 'split', theme: 'dark', tone: 'noir' },
      { contentKey: 'metrics-snapshot', role: 'evidence', layout: 'metric', theme: 'dark', tone: 'cobalt' },
      { contentKey: 'traction', role: 'proof', layout: 'chart', theme: 'dark', tone: 'noir' },
      { contentKey: 'platform', role: 'solution', layout: 'statement', theme: 'dark', tone: 'cobalt' },
      { contentKey: 'roadmap', role: 'plan', layout: 'process', theme: 'dark', tone: 'noir' },
      { contentKey: 'close', role: 'close', layout: 'cover', theme: 'dark', tone: 'cobalt' }
    ]
  ),
  archetype(
    'stripe-fintech',
    'Stripe Fintech',
    'Fintech pitch',
    'stripe-fintech',
    'Clean grid metrics with precise indigo fintech hierarchy.',
    'professional',
    [
      { contentKey: 'cover', role: 'opener', layout: 'cover', theme: 'light', tone: 'white' },
      { contentKey: 'platform', role: 'solution', layout: 'grid', theme: 'light', tone: 'cobalt' },
      { contentKey: 'metrics-snapshot', role: 'evidence', layout: 'metric', theme: 'light', tone: 'white' },
      { contentKey: 'market', role: 'context', layout: 'metric', theme: 'light', tone: 'cobalt' },
      { contentKey: 'traction', role: 'proof', layout: 'chart', theme: 'light', tone: 'white' },
      { contentKey: 'comparison', role: 'insight', layout: 'comparison', theme: 'light', tone: 'ivory' },
      { contentKey: 'highlights', role: 'evidence', layout: 'grid', theme: 'light', tone: 'white' },
      { contentKey: 'problem', role: 'tension', layout: 'split', theme: 'light', tone: 'cobalt' },
      { contentKey: 'vision', role: 'close', layout: 'statement', theme: 'light', tone: 'white' },
      { contentKey: 'ask', role: 'close', layout: 'metric', theme: 'accent', tone: 'cobalt' }
    ]
  ),
  archetype(
    'mckinsey-pyramid',
    'McKinsey Pyramid',
    'Consulting pitch',
    'mckinsey-pyramid',
    'Pyramid consulting structure with evidence grids and sourced metrics.',
    'executive',
    [
      { contentKey: 'cover', role: 'opener', layout: 'cover', theme: 'light', tone: 'white' },
      { contentKey: 'agenda', role: 'context', layout: 'list', theme: 'light', tone: 'ivory' },
      { contentKey: 'thesis', role: 'opener', layout: 'statement', theme: 'light', tone: 'white' },
      { contentKey: 'problem', role: 'tension', layout: 'split', theme: 'light', tone: 'ivory' },
      { contentKey: 'platform', role: 'solution', layout: 'grid', theme: 'light', tone: 'white' },
      { contentKey: 'market', role: 'context', layout: 'metric', theme: 'light', tone: 'ivory' },
      { contentKey: 'comparison', role: 'insight', layout: 'comparison', theme: 'light', tone: 'white' },
      { contentKey: 'traction', role: 'proof', layout: 'chart', theme: 'light', tone: 'ivory' },
      { contentKey: 'gtm', role: 'plan', layout: 'process', theme: 'light', tone: 'white' },
      { contentKey: 'highlights', role: 'evidence', layout: 'grid', theme: 'light', tone: 'ivory' },
      { contentKey: 'quote-customer', role: 'proof', layout: 'quote', theme: 'light', tone: 'white' },
      { contentKey: 'close', role: 'close', layout: 'statement', theme: 'light', tone: 'ivory' }
    ]
  ),
  archetype(
    'dribbble-colorblock',
    'Dribbble Colorblock',
    'Creative pitch',
    'dribbble-colorblock',
    'Bold color panels with playful grid blocks and saturated accents.',
    'professional',
    [
      { contentKey: 'cover', role: 'opener', layout: 'cover', theme: 'accent', tone: 'pink' },
      { contentKey: 'platform', role: 'solution', layout: 'grid', theme: 'accent', tone: 'lime' },
      { contentKey: 'thesis', role: 'opener', layout: 'statement', theme: 'accent', tone: 'orange' },
      { contentKey: 'highlights', role: 'evidence', layout: 'grid', theme: 'accent', tone: 'yellow' },
      { contentKey: 'market', role: 'context', layout: 'metric', theme: 'light', tone: 'pink' },
      { contentKey: 'comparison', role: 'insight', layout: 'comparison', theme: 'light', tone: 'lime' },
      { contentKey: 'traction', role: 'proof', layout: 'chart', theme: 'light', tone: 'orange' },
      { contentKey: 'problem', role: 'tension', layout: 'split', theme: 'accent', tone: 'cobalt' },
      { contentKey: 'close', role: 'close', layout: 'statement', theme: 'accent', tone: 'pink' }
    ]
  ),
  archetype(
    'notion-minimal',
    'Notion Minimal',
    'Startup pitch',
    'notion-minimal',
    'Soft neutral surfaces with quiet hierarchy and breathable whitespace.',
    'minimal',
    [
      { contentKey: 'cover', role: 'opener', layout: 'cover', theme: 'light', tone: 'ivory' },
      { contentKey: 'agenda', role: 'context', layout: 'list', theme: 'light', tone: 'white' },
      { contentKey: 'problem', role: 'tension', layout: 'split', theme: 'light', tone: 'ivory' },
      { contentKey: 'platform', role: 'solution', layout: 'grid', theme: 'light', tone: 'white' },
      { contentKey: 'market', role: 'context', layout: 'metric', theme: 'light', tone: 'ivory' },
      { contentKey: 'comparison', role: 'insight', layout: 'comparison', theme: 'light', tone: 'white' },
      { contentKey: 'traction', role: 'proof', layout: 'chart', theme: 'light', tone: 'ivory' },
      { contentKey: 'close', role: 'close', layout: 'statement', theme: 'light', tone: 'white' }
    ]
  ),
  archetype(
    'linear-dark',
    'Linear Dark',
    'Product launch',
    'linear-dark',
    'Dark product-launch deck with crisp split panels and neon workflow accents.',
    'professional',
    [
      { contentKey: 'cover', role: 'opener', layout: 'cover', theme: 'dark', tone: 'noir' },
      { contentKey: 'thesis', role: 'opener', layout: 'statement', theme: 'dark', tone: 'cobalt' },
      { contentKey: 'problem', role: 'tension', layout: 'split', theme: 'dark', tone: 'noir' },
      { contentKey: 'platform', role: 'solution', layout: 'grid', theme: 'dark', tone: 'cobalt' },
      { contentKey: 'traction', role: 'proof', layout: 'chart', theme: 'dark', tone: 'noir' },
      { contentKey: 'metrics-snapshot', role: 'evidence', layout: 'metric', theme: 'dark', tone: 'cobalt' },
      { contentKey: 'roadmap', role: 'plan', layout: 'process', theme: 'dark', tone: 'noir' },
      { contentKey: 'comparison', role: 'insight', layout: 'comparison', theme: 'dark', tone: 'cobalt' },
      { contentKey: 'vision', role: 'close', layout: 'statement', theme: 'dark', tone: 'noir' },
      { contentKey: 'ask', role: 'close', layout: 'metric', theme: 'dark', tone: 'cobalt' }
    ]
  ),
  archetype(
    'figma-creative',
    'Figma Creative',
    'Creative pitch',
    'figma-creative',
    'Vibrant split layouts with creative dual-tone panels and design-forward grids.',
    'professional',
    [
      { contentKey: 'problem', role: 'tension', layout: 'split', theme: 'accent', tone: 'pink' },
      { contentKey: 'cover', role: 'opener', layout: 'cover', theme: 'accent', tone: 'cobalt' },
      { contentKey: 'platform', role: 'solution', layout: 'grid', theme: 'accent', tone: 'lime' },
      { contentKey: 'origin', role: 'context', layout: 'split', theme: 'light', tone: 'yellow' },
      { contentKey: 'thesis', role: 'opener', layout: 'statement', theme: 'accent', tone: 'orange' },
      { contentKey: 'traction', role: 'proof', layout: 'chart', theme: 'light', tone: 'pink' },
      { contentKey: 'comparison', role: 'insight', layout: 'comparison', theme: 'light', tone: 'cobalt' },
      { contentKey: 'process', role: 'plan', layout: 'process', theme: 'light', tone: 'lime' },
      { contentKey: 'market', role: 'context', layout: 'metric', theme: 'accent', tone: 'yellow' },
      { contentKey: 'quote-customer', role: 'proof', layout: 'quote', theme: 'light', tone: 'orange' },
      { contentKey: 'close', role: 'close', layout: 'statement', theme: 'accent', tone: 'cobalt' }
    ]
  ),
  archetype(
    'spotify-bold',
    'Spotify Bold',
    'Growth pitch',
    'spotify-bold',
    'Neon accent growth deck with bold grids and high-contrast dark slides.',
    'professional',
    [
      { contentKey: 'cover', role: 'opener', layout: 'cover', theme: 'dark', tone: 'noir' },
      { contentKey: 'thesis', role: 'opener', layout: 'statement', theme: 'dark', tone: 'lime' },
      { contentKey: 'platform', role: 'solution', layout: 'grid', theme: 'dark', tone: 'noir' },
      { contentKey: 'traction', role: 'proof', layout: 'chart', theme: 'dark', tone: 'lime' },
      { contentKey: 'market', role: 'context', layout: 'metric', theme: 'dark', tone: 'noir' },
      { contentKey: 'quote-customer', role: 'proof', layout: 'quote', theme: 'dark', tone: 'lime' },
      { contentKey: 'comparison', role: 'insight', layout: 'comparison', theme: 'dark', tone: 'noir' },
      { contentKey: 'gtm', role: 'plan', layout: 'process', theme: 'dark', tone: 'lime' },
      { contentKey: 'problem', role: 'tension', layout: 'split', theme: 'dark', tone: 'noir' },
      { contentKey: 'close', role: 'close', layout: 'statement', theme: 'dark', tone: 'lime' }
    ]
  ),
  archetype(
    'yc-seed',
    'YC Seed',
    'Investor pitch',
    'yc-seed',
    'Classic seed narrative with list agenda and proof-first metric slides.',
    'professional',
    [
      { contentKey: 'cover', role: 'opener', layout: 'cover', theme: 'light', tone: 'white' },
      { contentKey: 'agenda', role: 'context', layout: 'list', theme: 'light', tone: 'ivory' },
      { contentKey: 'problem', role: 'tension', layout: 'split', theme: 'light', tone: 'white' },
      { contentKey: 'market', role: 'context', layout: 'metric', theme: 'light', tone: 'ivory' },
      { contentKey: 'traction', role: 'proof', layout: 'chart', theme: 'light', tone: 'white' },
      { contentKey: 'comparison', role: 'insight', layout: 'comparison', theme: 'light', tone: 'ivory' },
      { contentKey: 'platform', role: 'solution', layout: 'grid', theme: 'light', tone: 'white' },
      { contentKey: 'close', role: 'close', layout: 'statement', theme: 'light', tone: 'ivory' },
      { contentKey: 'ask', role: 'close', layout: 'metric', theme: 'accent', tone: 'cobalt' }
    ]
  ),
  archetype(
    'uber-momentum',
    'Uber Momentum',
    'Growth pitch',
    'uber-momentum',
    'Momentum-first deck stacking metrics and dual chart proof slides.',
    'executive',
    [
      { contentKey: 'cover', role: 'opener', layout: 'cover', theme: 'dark', tone: 'noir' },
      { contentKey: 'metrics-snapshot', role: 'evidence', layout: 'metric', theme: 'dark', tone: 'cobalt' },
      { contentKey: 'market', role: 'context', layout: 'metric', theme: 'dark', tone: 'noir' },
      { contentKey: 'traction', role: 'proof', layout: 'chart', theme: 'dark', tone: 'cobalt' },
      { contentKey: 'growth-chart', role: 'proof', layout: 'chart', theme: 'dark', tone: 'noir' },
      { contentKey: 'comparison', role: 'insight', layout: 'comparison', theme: 'dark', tone: 'cobalt' },
      { contentKey: 'platform', role: 'solution', layout: 'grid', theme: 'dark', tone: 'noir' },
      { contentKey: 'gtm', role: 'plan', layout: 'process', theme: 'dark', tone: 'cobalt' },
      { contentKey: 'vision', role: 'close', layout: 'statement', theme: 'dark', tone: 'noir' },
      { contentKey: 'ask', role: 'close', layout: 'metric', theme: 'dark', tone: 'cobalt' }
    ]
  ),
  archetype(
    'slack-playful',
    'Slack Playful',
    'Startup pitch',
    'slack-playful',
    'Conversational rhythm with quote interludes and playful process slides.',
    'professional',
    [
      { contentKey: 'cover', role: 'opener', layout: 'cover', theme: 'accent', tone: 'pink' },
      { contentKey: 'quote-customer', role: 'proof', layout: 'quote', theme: 'light', tone: 'cobalt' },
      { contentKey: 'problem', role: 'tension', layout: 'split', theme: 'light', tone: 'yellow' },
      { contentKey: 'platform', role: 'solution', layout: 'grid', theme: 'light', tone: 'lime' },
      { contentKey: 'process', role: 'plan', layout: 'process', theme: 'light', tone: 'pink' },
      { contentKey: 'traction', role: 'proof', layout: 'chart', theme: 'light', tone: 'cobalt' },
      { contentKey: 'comparison', role: 'insight', layout: 'comparison', theme: 'light', tone: 'orange' },
      { contentKey: 'market', role: 'context', layout: 'metric', theme: 'light', tone: 'yellow' },
      { contentKey: 'quote-founder', role: 'insight', layout: 'quote', theme: 'accent', tone: 'lime' },
      { contentKey: 'close', role: 'close', layout: 'statement', theme: 'accent', tone: 'cobalt' },
      { contentKey: 'agenda', role: 'context', layout: 'list', theme: 'light', tone: 'white' }
    ]
  ),
  archetype(
    'openai-research',
    'OpenAI Research',
    'Deep tech pitch',
    'openai-research',
    'Research-grade evidence grids with chart-led insight slides.',
    'executive',
    [
      { contentKey: 'cover', role: 'opener', layout: 'cover', theme: 'dark', tone: 'noir' },
      { contentKey: 'thesis', role: 'opener', layout: 'statement', theme: 'dark', tone: 'cobalt' },
      { contentKey: 'highlights', role: 'evidence', layout: 'grid', theme: 'dark', tone: 'noir' },
      { contentKey: 'traction', role: 'proof', layout: 'chart', theme: 'dark', tone: 'cobalt' },
      { contentKey: 'comparison', role: 'insight', layout: 'comparison', theme: 'dark', tone: 'noir' },
      { contentKey: 'market', role: 'context', layout: 'metric', theme: 'dark', tone: 'cobalt' },
      { contentKey: 'problem', role: 'tension', layout: 'split', theme: 'dark', tone: 'noir' },
      { contentKey: 'roadmap', role: 'plan', layout: 'process', theme: 'dark', tone: 'cobalt' },
      { contentKey: 'platform', role: 'solution', layout: 'grid', theme: 'dark', tone: 'noir' },
      { contentKey: 'close', role: 'close', layout: 'statement', theme: 'dark', tone: 'cobalt' }
    ]
  ),
  archetype(
    'canva-vibrant',
    'Canva Vibrant',
    'Creative pitch',
    'canva-vibrant',
    'Vibrant multi-hue grids with energetic split hero slides.',
    'professional',
    [
      { contentKey: 'cover', role: 'opener', layout: 'cover', theme: 'accent', tone: 'orange' },
      { contentKey: 'platform', role: 'solution', layout: 'grid', theme: 'accent', tone: 'pink' },
      { contentKey: 'origin', role: 'context', layout: 'split', theme: 'accent', tone: 'lime' },
      { contentKey: 'market', role: 'context', layout: 'metric', theme: 'light', tone: 'yellow' },
      { contentKey: 'traction', role: 'proof', layout: 'chart', theme: 'light', tone: 'cobalt' },
      { contentKey: 'highlights', role: 'evidence', layout: 'grid', theme: 'accent', tone: 'orange' },
      { contentKey: 'comparison', role: 'insight', layout: 'comparison', theme: 'light', tone: 'pink' },
      { contentKey: 'vision', role: 'close', layout: 'statement', theme: 'accent', tone: 'lime' },
      { contentKey: 'quote-customer', role: 'proof', layout: 'quote', theme: 'light', tone: 'yellow' }
    ]
  ),
  archetype(
    'intercom-conversation',
    'Intercom Conversation',
    'SaaS pitch',
    'intercom-conversation',
    'Conversation-led flow opening with customer quotes and support metrics.',
    'professional',
    [
      { contentKey: 'quote-customer', role: 'opener', layout: 'quote', theme: 'light', tone: 'cobalt' },
      { contentKey: 'cover', role: 'opener', layout: 'cover', theme: 'light', tone: 'white' },
      { contentKey: 'problem', role: 'tension', layout: 'split', theme: 'light', tone: 'ivory' },
      { contentKey: 'quote-founder', role: 'insight', layout: 'quote', theme: 'accent', tone: 'orange' },
      { contentKey: 'platform', role: 'solution', layout: 'grid', theme: 'light', tone: 'white' },
      { contentKey: 'market', role: 'context', layout: 'metric', theme: 'light', tone: 'cobalt' },
      { contentKey: 'traction', role: 'proof', layout: 'chart', theme: 'light', tone: 'ivory' },
      { contentKey: 'comparison', role: 'insight', layout: 'comparison', theme: 'light', tone: 'white' },
      { contentKey: 'gtm', role: 'plan', layout: 'process', theme: 'light', tone: 'cobalt' },
      { contentKey: 'close', role: 'close', layout: 'statement', theme: 'light', tone: 'white' }
    ]
  ),
  archetype(
    'shopify-commerce',
    'Shopify Commerce',
    'Commerce pitch',
    'shopify-commerce',
    'Commerce metrics with comparison tables and operational process grids.',
    'professional',
    [
      { contentKey: 'cover', role: 'opener', layout: 'cover', theme: 'light', tone: 'forest' },
      { contentKey: 'metrics-snapshot', role: 'evidence', layout: 'metric', theme: 'light', tone: 'white' },
      { contentKey: 'platform', role: 'solution', layout: 'grid', theme: 'light', tone: 'forest' },
      { contentKey: 'comparison', role: 'insight', layout: 'comparison', theme: 'light', tone: 'white' },
      { contentKey: 'traction', role: 'proof', layout: 'chart', theme: 'light', tone: 'forest' },
      { contentKey: 'problem', role: 'tension', layout: 'split', theme: 'light', tone: 'white' },
      { contentKey: 'market', role: 'context', layout: 'metric', theme: 'light', tone: 'forest' },
      { contentKey: 'process', role: 'plan', layout: 'process', theme: 'light', tone: 'white' },
      { contentKey: 'highlights', role: 'evidence', layout: 'grid', theme: 'light', tone: 'forest' },
      { contentKey: 'vision', role: 'close', layout: 'statement', theme: 'light', tone: 'white' },
      { contentKey: 'ask', role: 'close', layout: 'metric', theme: 'accent', tone: 'forest' }
    ]
  ),
  archetype(
    'robinhood-finance',
    'Robinhood Finance',
    'Fintech pitch',
    'robinhood-finance',
    'Chart-dense finance deck with dual metrics and investor quote close.',
    'professional',
    [
      { contentKey: 'cover', role: 'opener', layout: 'cover', theme: 'dark', tone: 'noir' },
      { contentKey: 'traction', role: 'proof', layout: 'chart', theme: 'dark', tone: 'lime' },
      { contentKey: 'metrics-snapshot', role: 'evidence', layout: 'metric', theme: 'dark', tone: 'noir' },
      { contentKey: 'growth-chart', role: 'proof', layout: 'chart', theme: 'dark', tone: 'lime' },
      { contentKey: 'comparison', role: 'insight', layout: 'comparison', theme: 'dark', tone: 'noir' },
      { contentKey: 'platform', role: 'solution', layout: 'grid', theme: 'dark', tone: 'lime' },
      { contentKey: 'problem', role: 'tension', layout: 'split', theme: 'dark', tone: 'noir' },
      { contentKey: 'vision', role: 'close', layout: 'statement', theme: 'dark', tone: 'lime' },
      { contentKey: 'market', role: 'context', layout: 'metric', theme: 'dark', tone: 'noir' },
      { contentKey: 'quote-customer', role: 'proof', layout: 'quote', theme: 'dark', tone: 'lime' }
    ]
  ),
  archetype(
    'nike-athletic',
    'Nike Athletic',
    'Brand pitch',
    'nike-athletic',
    'Athletic statement openers with timeline momentum and bold closes.',
    'executive',
    [
      { contentKey: 'thesis', role: 'opener', layout: 'statement', theme: 'dark', tone: 'noir' },
      { contentKey: 'cover', role: 'opener', layout: 'cover', theme: 'dark', tone: 'orange' },
      { contentKey: 'roadmap', role: 'plan', layout: 'timeline', theme: 'dark', tone: 'noir' },
      { contentKey: 'market', role: 'context', layout: 'metric', theme: 'dark', tone: 'orange' },
      { contentKey: 'comparison', role: 'insight', layout: 'comparison', theme: 'dark', tone: 'noir' },
      { contentKey: 'traction', role: 'proof', layout: 'chart', theme: 'dark', tone: 'orange' },
      { contentKey: 'vision', role: 'insight', layout: 'statement', theme: 'dark', tone: 'noir' },
      { contentKey: 'process', role: 'plan', layout: 'process', theme: 'dark', tone: 'orange' },
      { contentKey: 'cover-close', role: 'close', layout: 'cover', theme: 'dark', tone: 'noir' }
    ]
  ),
  archetype(
    'tesla-future',
    'Tesla Future',
    'Deep tech pitch',
    'tesla-future',
    'Future-forward dark deck with process reveals and timeline proof.',
    'executive',
    [
      { contentKey: 'cover', role: 'opener', layout: 'cover', theme: 'dark', tone: 'noir' },
      { contentKey: 'vision', role: 'context', layout: 'statement', theme: 'dark', tone: 'cobalt' },
      { contentKey: 'process', role: 'solution', layout: 'process', theme: 'dark', tone: 'noir' },
      { contentKey: 'problem', role: 'tension', layout: 'split', theme: 'dark', tone: 'cobalt' },
      { contentKey: 'market', role: 'context', layout: 'metric', theme: 'dark', tone: 'noir' },
      { contentKey: 'traction', role: 'proof', layout: 'chart', theme: 'dark', tone: 'cobalt' },
      { contentKey: 'comparison', role: 'insight', layout: 'comparison', theme: 'dark', tone: 'noir' },
      { contentKey: 'roadmap', role: 'plan', layout: 'timeline', theme: 'dark', tone: 'cobalt' },
      { contentKey: 'thesis', role: 'close', layout: 'statement', theme: 'dark', tone: 'noir' },
      { contentKey: 'ask', role: 'close', layout: 'metric', theme: 'dark', tone: 'cobalt' }
    ]
  ),
  archetype(
    'bloomberg-data',
    'Bloomberg Data',
    'Fintech pitch',
    'bloomberg-data',
    'Data-wall opener with stacked charts and dense metric grids.',
    'executive',
    [
      { contentKey: 'metrics-snapshot', role: 'opener', layout: 'metric', theme: 'dark', tone: 'cobalt' },
      { contentKey: 'cover', role: 'opener', layout: 'cover', theme: 'dark', tone: 'noir' },
      { contentKey: 'traction', role: 'proof', layout: 'chart', theme: 'dark', tone: 'cobalt' },
      { contentKey: 'highlights', role: 'evidence', layout: 'grid', theme: 'dark', tone: 'noir' },
      { contentKey: 'market', role: 'context', layout: 'metric', theme: 'dark', tone: 'cobalt' },
      { contentKey: 'growth-chart', role: 'proof', layout: 'chart', theme: 'dark', tone: 'noir' },
      { contentKey: 'comparison', role: 'insight', layout: 'comparison', theme: 'dark', tone: 'cobalt' },
      { contentKey: 'problem', role: 'tension', layout: 'split', theme: 'dark', tone: 'noir' },
      { contentKey: 'platform', role: 'solution', layout: 'grid', theme: 'dark', tone: 'cobalt' },
      { contentKey: 'vision', role: 'close', layout: 'statement', theme: 'dark', tone: 'noir' },
      { contentKey: 'ask', role: 'close', layout: 'metric', theme: 'dark', tone: 'cobalt' }
    ]
  ),
  archetype(
    'hubspot-inbound',
    'HubSpot Inbound',
    'SaaS pitch',
    'hubspot-inbound',
    'Inbound list agenda with quote proof and GTM process close.',
    'professional',
    [
      { contentKey: 'cover', role: 'opener', layout: 'cover', theme: 'light', tone: 'orange' },
      { contentKey: 'agenda', role: 'context', layout: 'list', theme: 'light', tone: 'white' },
      { contentKey: 'platform', role: 'solution', layout: 'grid', theme: 'light', tone: 'orange' },
      { contentKey: 'problem', role: 'tension', layout: 'split', theme: 'light', tone: 'white' },
      { contentKey: 'market', role: 'context', layout: 'metric', theme: 'light', tone: 'orange' },
      { contentKey: 'traction', role: 'proof', layout: 'chart', theme: 'light', tone: 'white' },
      { contentKey: 'comparison', role: 'insight', layout: 'comparison', theme: 'light', tone: 'orange' },
      { contentKey: 'quote-customer', role: 'proof', layout: 'quote', theme: 'light', tone: 'white' },
      { contentKey: 'gtm', role: 'plan', layout: 'process', theme: 'light', tone: 'orange' },
      { contentKey: 'close', role: 'close', layout: 'statement', theme: 'light', tone: 'white' }
    ]
  ),
  archetype(
    'pitch-classic',
    'Pitch Classic',
    'Investor pitch',
    'pitch-classic',
    'Tight eight-slide investor arc with early comparison and metric ask.',
    'professional',
    [
      { contentKey: 'cover', role: 'opener', layout: 'cover', theme: 'light', tone: 'cobalt' },
      { contentKey: 'comparison', role: 'insight', layout: 'comparison', theme: 'light', tone: 'white' },
      { contentKey: 'problem', role: 'tension', layout: 'split', theme: 'light', tone: 'ivory' },
      { contentKey: 'market', role: 'context', layout: 'metric', theme: 'light', tone: 'cobalt' },
      { contentKey: 'traction', role: 'proof', layout: 'chart', theme: 'light', tone: 'white' },
      { contentKey: 'platform', role: 'solution', layout: 'grid', theme: 'light', tone: 'ivory' },
      { contentKey: 'vision', role: 'close', layout: 'statement', theme: 'light', tone: 'cobalt' },
      { contentKey: 'ask', role: 'close', layout: 'metric', theme: 'accent', tone: 'white' }
    ]
  ),
  archetype(
    'bessemer-cloud',
    'Bessemer Cloud',
    'Investor pitch',
    'bessemer-cloud',
    'Cloud metrics pyramid with layered proof and investor quote.',
    'executive',
    [
      { contentKey: 'cover', role: 'opener', layout: 'cover', theme: 'light', tone: 'cobalt' },
      { contentKey: 'metrics-snapshot', role: 'evidence', layout: 'metric', theme: 'light', tone: 'white' },
      { contentKey: 'thesis', role: 'opener', layout: 'statement', theme: 'light', tone: 'ivory' },
      { contentKey: 'platform', role: 'solution', layout: 'grid', theme: 'light', tone: 'cobalt' },
      { contentKey: 'traction', role: 'proof', layout: 'chart', theme: 'light', tone: 'white' },
      { contentKey: 'market', role: 'context', layout: 'metric', theme: 'light', tone: 'ivory' },
      { contentKey: 'comparison', role: 'insight', layout: 'comparison', theme: 'light', tone: 'cobalt' },
      { contentKey: 'gtm', role: 'plan', layout: 'process', theme: 'light', tone: 'white' },
      { contentKey: 'problem', role: 'tension', layout: 'split', theme: 'light', tone: 'ivory' },
      { contentKey: 'highlights', role: 'evidence', layout: 'grid', theme: 'light', tone: 'cobalt' },
      { contentKey: 'quote-customer', role: 'proof', layout: 'quote', theme: 'light', tone: 'white' },
      { contentKey: 'close', role: 'close', layout: 'statement', theme: 'light', tone: 'ivory' }
    ]
  ),
  archetype(
    'a16z-thesis',
    'a16z Thesis',
    'Investor pitch',
    'a16z-thesis',
    'Thesis-first narrative with stacked statements and split market proof.',
    'executive',
    [
      { contentKey: 'thesis', role: 'opener', layout: 'statement', theme: 'dark', tone: 'noir' },
      { contentKey: 'cover', role: 'opener', layout: 'cover', theme: 'dark', tone: 'cobalt' },
      { contentKey: 'problem', role: 'tension', layout: 'split', theme: 'dark', tone: 'noir' },
      { contentKey: 'vision', role: 'context', layout: 'statement', theme: 'dark', tone: 'cobalt' },
      { contentKey: 'market', role: 'context', layout: 'metric', theme: 'dark', tone: 'noir' },
      { contentKey: 'traction', role: 'proof', layout: 'chart', theme: 'dark', tone: 'cobalt' },
      { contentKey: 'platform', role: 'solution', layout: 'grid', theme: 'dark', tone: 'noir' },
      { contentKey: 'comparison', role: 'insight', layout: 'comparison', theme: 'dark', tone: 'cobalt' },
      { contentKey: 'roadmap', role: 'plan', layout: 'process', theme: 'dark', tone: 'noir' },
      { contentKey: 'close', role: 'close', layout: 'statement', theme: 'dark', tone: 'cobalt' }
    ]
  ),
  archetype(
    'duolingo-growth',
    'Duolingo Growth',
    'Growth pitch',
    'duolingo-growth',
    'Playful growth loops with process steps and dual grid proof.',
    'professional',
    [
      { contentKey: 'cover', role: 'opener', layout: 'cover', theme: 'accent', tone: 'lime' },
      { contentKey: 'platform', role: 'solution', layout: 'grid', theme: 'accent', tone: 'yellow' },
      { contentKey: 'traction', role: 'proof', layout: 'chart', theme: 'light', tone: 'lime' },
      { contentKey: 'market', role: 'context', layout: 'metric', theme: 'light', tone: 'yellow' },
      { contentKey: 'comparison', role: 'insight', layout: 'comparison', theme: 'light', tone: 'lime' },
      { contentKey: 'process', role: 'plan', layout: 'process', theme: 'light', tone: 'yellow' },
      { contentKey: 'quote-customer', role: 'proof', layout: 'quote', theme: 'accent', tone: 'lime' },
      { contentKey: 'highlights', role: 'evidence', layout: 'grid', theme: 'accent', tone: 'yellow' },
      { contentKey: 'close', role: 'close', layout: 'statement', theme: 'accent', tone: 'lime' }
    ]
  ),
  archetype(
    'asana-workflow',
    'Asana Workflow',
    'SaaS pitch',
    'asana-workflow',
    'Workflow-first deck with process and timeline planning slides.',
    'professional',
    [
      { contentKey: 'cover', role: 'opener', layout: 'cover', theme: 'light', tone: 'cobalt' },
      { contentKey: 'process', role: 'solution', layout: 'process', theme: 'light', tone: 'white' },
      { contentKey: 'roadmap', role: 'plan', layout: 'timeline', theme: 'light', tone: 'cobalt' },
      { contentKey: 'platform', role: 'solution', layout: 'grid', theme: 'light', tone: 'white' },
      { contentKey: 'problem', role: 'tension', layout: 'split', theme: 'light', tone: 'ivory' },
      { contentKey: 'market', role: 'context', layout: 'metric', theme: 'light', tone: 'cobalt' },
      { contentKey: 'traction', role: 'proof', layout: 'chart', theme: 'light', tone: 'white' },
      { contentKey: 'comparison', role: 'insight', layout: 'comparison', theme: 'light', tone: 'ivory' },
      { contentKey: 'vision', role: 'close', layout: 'statement', theme: 'light', tone: 'cobalt' },
      { contentKey: 'agenda', role: 'context', layout: 'list', theme: 'light', tone: 'white' }
    ]
  ),
  archetype(
    'dropbox-simple',
    'Dropbox Simple',
    'Startup pitch',
    'dropbox-simple',
    'Radically simple list-driven deck with minimal slide count.',
    'minimal',
    [
      { contentKey: 'cover', role: 'opener', layout: 'cover', theme: 'light', tone: 'cobalt' },
      { contentKey: 'agenda', role: 'context', layout: 'list', theme: 'light', tone: 'white' },
      { contentKey: 'thesis', role: 'opener', layout: 'statement', theme: 'light', tone: 'ivory' },
      { contentKey: 'market', role: 'context', layout: 'metric', theme: 'light', tone: 'white' },
      { contentKey: 'comparison', role: 'insight', layout: 'comparison', theme: 'light', tone: 'cobalt' },
      { contentKey: 'traction', role: 'proof', layout: 'chart', theme: 'light', tone: 'white' },
      { contentKey: 'platform', role: 'solution', layout: 'grid', theme: 'light', tone: 'ivory' },
      { contentKey: 'close', role: 'close', layout: 'statement', theme: 'light', tone: 'cobalt' }
    ]
  )
];

export const deckArchetypes: DeckArchetype[] = [
  ...brandDeckArchetypes,
  ...microsoftDeckArchetypes,
  ...minimalistDeckArchetypes
];

function assertUniqueLayoutSequences(archetypes: DeckArchetype[]): void {
  const seen = new Map<string, string>();
  for (const archetypeDef of archetypes) {
    const prior = seen.get(archetypeDef.layoutSequence);
    if (prior) {
      throw new Error(
        `Duplicate layout sequence "${archetypeDef.layoutSequence}" on ${prior} and ${archetypeDef.id}`
      );
    }
    seen.set(archetypeDef.layoutSequence, archetypeDef.id);
  }
}

assertUniqueLayoutSequences(deckArchetypes);

export function getArchetypeById(id: string): DeckArchetype | undefined {
  return deckArchetypes.find((archetypeDef) => archetypeDef.id === id);
}

export const archetypeCount = deckArchetypes.length;