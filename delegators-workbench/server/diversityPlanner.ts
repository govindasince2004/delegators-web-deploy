import type { Slide } from '../src/lib/shared.js';

type OutlineSlide = {
  role?: Slide['role'];
  title?: string;
  message?: string;
  layout?: Slide['layout'];
};

const layoutRotation: Slide['layout'][] = [
  'cover',
  'statement',
  'split',
  'chart',
  'metric',
  'comparison',
  'list',
  'grid',
  'timeline',
  'quote',
  'image',
  'statement'
];

export function suggestedLayoutForIndex(index: number, total: number, planned?: Slide['layout']): Slide['layout'] {
  if (planned) return planned;
  if (index === 0) return 'cover';
  if (index === total - 1) return 'statement';
  return layoutRotation[(index - 1) % layoutRotation.length] ?? 'list';
}

export function diversityDirectiveForSlide(index: number, total: number, slide: OutlineSlide): string[] {
  const layout = suggestedLayoutForIndex(index, total, slide.layout);
  const lines = [`Use layout "${layout}" for visual variety.`];
  if (layout === 'chart') lines.push('Include a chart only when numeric evidence exists in sources.');
  if (layout === 'comparison') lines.push('Use exactly two columns for a sharp contrast.');
  if (layout === 'metric') lines.push('Use 2-4 sourced metrics, not decorative numbers.');
  if (index > 0 && index < total - 1 && slide.role === 'evidence') {
    lines.push('This slide should carry sourced evidence — bind claims to sourceIds.');
  }
  return lines;
}

export function outlineDiversityIssues(slides: OutlineSlide[]): string[] {
  const issues: string[] = [];
  if (slides.length < 4) return issues;
  const layouts = slides.map((slide, index) => suggestedLayoutForIndex(index, slides.length, slide.layout));
  const uniqueLayouts = new Set(layouts);
  if (slides.length >= 6 && uniqueLayouts.size < 3) {
    issues.push('Outline layouts are too repetitive; vary compositions across chart, split, metric, comparison, and statement.');
  }
  const genericTitles = slides.filter((slide) =>
    /^(?:overview|introduction|agenda|background|problem|solution|market|conclusion|next steps)$/i.test((slide.title ?? '').trim())
  );
  if (genericTitles.length >= 2) {
    issues.push('Outline slide titles are topic labels, not message titles.');
  }
  let streak = 1;
  for (let index = 1; index < layouts.length; index += 1) {
    if (layouts[index] === layouts[index - 1]) streak += 1;
    else streak = 1;
    if (streak >= 3) {
      issues.push('Outline repeats the same layout three times in a row; change the visual rhythm.');
      break;
    }
  }
  return issues;
}

export function diversityPromptLines(slides: OutlineSlide[]): string[] {
  const issues = outlineDiversityIssues(slides);
  if (issues.length === 0) return ['Vary slide layouts deliberately across the deck.'];
  return ['Diversity fixes required:', ...issues.map((issue) => `- ${issue}`)];
}