import type { ArtifactDesign } from '../../shared.js';
import type { Slide } from '../../shared.js';
import type { DeckVertical } from './deckBuilder.js';

type Palette = NonNullable<ArtifactDesign['palette']>;

const SLIDE_TONES: NonNullable<Slide['tone']>[] = [
  'cobalt',
  'forest',
  'ivory',
  'lime',
  'noir',
  'orange',
  'pink',
  'white',
  'yellow'
];

/** Per-vertical accent DNA — each industry gets a unmistakably different color story. */
const VERTICAL_ACCENT_DNA: Record<
  string,
  { primary: string; accent: string; surface: string; headingFont?: string }
> = {
  hr: { primary: '#4F46E5', accent: '#A78BFA', surface: '#EEF2FF' },
  fintech: { primary: '#0891B2', accent: '#22D3EE', surface: '#ECFEFF' },
  edtech: { primary: '#CA8A04', accent: '#FACC15', surface: '#FEF9C3' },
  health: { primary: '#0369A1', accent: '#38BDF8', surface: '#E0F2FE' },
  logistics: { primary: '#B45309', accent: '#FB923C', surface: '#FFEDD5' },
  commerce: { primary: '#BE185D', accent: '#F472B6', surface: '#FCE7F3' },
  climate: { primary: '#15803D', accent: '#4ADE80', surface: '#DCFCE7' },
  ai: { primary: '#7C3AED', accent: '#C084FC', surface: '#F3E8FF' },
  devtools: { primary: '#1D4ED8', accent: '#60A5FA', surface: '#DBEAFE' },
  proptech: { primary: '#57534E', accent: '#D97706', surface: '#F5F5F4' }
};

const VERTICAL_DENSITY: Record<string, ArtifactDesign['density']> = {
  hr: 'airy',
  fintech: 'balanced',
  edtech: 'airy',
  health: 'balanced',
  logistics: 'compact',
  commerce: 'balanced',
  climate: 'airy',
  ai: 'balanced',
  devtools: 'compact',
  proptech: 'airy'
};

function rotateTone(tone: Slide['tone'], verticalId: string, slideIndex: number): Slide['tone'] {
  if (!tone) return tone;
  const base = SLIDE_TONES.indexOf(tone);
  if (base < 0) return tone;
  const verticalOffset = [...verticalId].reduce((sum, char) => sum + char.charCodeAt(0), 0) % SLIDE_TONES.length;
  return SLIDE_TONES[(base + verticalOffset + slideIndex) % SLIDE_TONES.length];
}

function blendPalette(base: Palette, verticalId: string): Palette {
  const dna = VERTICAL_ACCENT_DNA[verticalId];
  if (!dna) return { ...base };
  return {
    background: base.background,
    surface: dna.surface,
    text: base.text,
    muted: base.muted,
    primary: dna.primary,
    accent: dna.accent
  };
}

export type DeckVisualVariant = {
  slides: Slide[];
  palette: Palette;
  headingFontFamily?: string;
  density?: ArtifactDesign['density'];
  visualSuffix: string;
};

export function applyDeckVisualVariant(
  vertical: DeckVertical,
  slides: Slide[],
  basePalette: Palette,
  baseHeadingFont: string
): DeckVisualVariant {
  const variantSlides = slides.map((slide, index) => ({
    ...slide,
    tone: rotateTone(slide.tone, vertical.id, index)
  }));

  const dna = VERTICAL_ACCENT_DNA[vertical.id];
  return {
    slides: variantSlides,
    palette: blendPalette(basePalette, vertical.id),
    headingFontFamily: dna?.headingFont ?? baseHeadingFont,
    density: VERTICAL_DENSITY[vertical.id] ?? 'balanced',
    visualSuffix: `${vertical.category} · ${vertical.id} palette`
  };
}

export function verticalPaletteDiffers(aVerticalId: string, bVerticalId: string): boolean {
  const a = VERTICAL_ACCENT_DNA[aVerticalId];
  const b = VERTICAL_ACCENT_DNA[bVerticalId];
  if (!a || !b) return aVerticalId !== bVerticalId;
  return a.primary !== b.primary || a.accent !== b.accent;
}