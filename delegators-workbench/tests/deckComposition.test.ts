import { describe, expect, it } from 'vitest';
import { applyInvestorDeckDesign, inferInvestorDeckTemplate, stabilizeDeckComposition } from '../server/deckComposition';
import { ArtifactDocumentSchema } from '../src/lib/shared';

function deck(slides: Array<Record<string, unknown>>) {
  return ArtifactDocumentSchema.parse({
    kind: 'deck',
    primaryFormat: 'pptx',
    title: 'Operating review',
    audience: 'Leadership',
    tone: 'executive',
    executiveSummary: 'A decision-oriented operating review.',
    sections: [{ heading: 'Review', body: 'Evidence and recommendation.', bullets: [] }],
    slides,
    citations: [],
    design: { template: 'consulting-mono' }
  });
}

describe('deck composition stabilization', () => {
  it('turns an unstructured long deck into a coherent role and theme sequence', () => {
    const artifact = deck(Array.from({ length: 9 }, (_, index) => ({
      title: index === 3 ? 'Evidence changes the decision' : index === 6 ? 'The rollout has three phases' : `Point ${index + 1}`,
      bullets: ['One concise point', 'One supporting point'],
      ...(index === 3 ? { chart: { type: 'line', labels: ['Q1', 'Q2'], series: [{ name: 'Adoption', values: [20, 40] }] } } : {})
    })));

    const stabilized = stabilizeDeckComposition(artifact);
    const slides = stabilized.slides!;
    expect(slides[0]).toMatchObject({ role: 'opener', layout: 'cover', theme: 'dark' });
    expect(slides.at(-1)).toMatchObject({ role: 'close', layout: 'statement', theme: 'dark' });
    expect(slides[3]).toMatchObject({ role: 'evidence', layout: 'chart', theme: 'light' });
    expect(slides[6]).toMatchObject({ role: 'plan' });
    expect(slides.slice(1, -1).filter((slide) => slide.theme === 'accent')).toHaveLength(0);
    expect(slides.slice(1, -1).every((slide) => slide.theme === 'light')).toBe(true);
  });

  it('preserves structured visual jobs and an explicitly uniform dark treatment', () => {
    const artifact = deck([
      { title: 'Opening', subtitle: 'Decision', bullets: ['Approve'], layout: 'cover', theme: 'dark' },
      { title: 'Three proof points', bullets: [], layout: 'metric', theme: 'dark', metrics: [{ value: '3', label: 'proof points' }] },
      { title: 'Choose the target model', bullets: [], layout: 'comparison', theme: 'dark', columns: [{ heading: 'Now', bullets: ['Manual'] }, { heading: 'Next', bullets: ['Automated'] }] },
      { title: 'Close', bullets: ['Approve the launch'], layout: 'statement', theme: 'dark' }
    ]);

    const stabilized = stabilizeDeckComposition(artifact, 'Use a dark treatment throughout every slide.');
    expect(stabilized.slides?.map((slide) => slide.layout)).toEqual(['cover', 'metric', 'comparison', 'statement']);
    expect(stabilized.slides?.every((slide) => slide.theme === 'dark')).toBe(true);
  });

  it('applies investor-grade templates from brief signals', () => {
    const spaceBrief = 'SpaceX Starship launch briefing with orbital imagery';
    expect(inferInvestorDeckTemplate(spaceBrief).name).toBe('midnight-aurora');
    const cursorBrief = 'Cursor AI-native software developer workflow briefing';
    expect(inferInvestorDeckTemplate(cursorBrief).name).toBe('noir-lumina');

    const bare = ArtifactDocumentSchema.parse({
      kind: 'deck',
      primaryFormat: 'pptx',
      title: 'Operating review',
      audience: 'Leadership',
      tone: 'executive',
      executiveSummary: 'A decision-oriented operating review.',
      sections: [{ heading: 'Review', body: 'Evidence and recommendation.', bullets: [] }],
      slides: [{ title: 'Cover', bullets: ['Thesis'] }],
      citations: []
    });
    const designed = applyInvestorDeckDesign(bare, spaceBrief);
    expect(designed.design.template).toBe('midnight-aurora');
    expect(designed.design.palette?.background).toBe('#070B12');
    expect(designed.design.slideAspect).toBe('wide');
  });

  it('uses a statement rather than a sparse split for a low-content insight', () => {
    const artifact = deck([
      { title: 'Opening', subtitle: 'Decision', bullets: ['Approve'] },
      {
        title: 'The implication is decisive',
        subtitle: 'Variation without a system feels cheap',
        bullets: ['Use one visual grammar'],
        role: 'insight'
      },
      { title: 'Close', bullets: ['Ship it'] }
    ]);

    expect(stabilizeDeckComposition(artifact).slides?.[1].layout).toBe('statement');
  });
});
