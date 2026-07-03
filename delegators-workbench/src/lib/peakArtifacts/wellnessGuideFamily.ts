import type { ArtifactDocument } from '../shared.js';

const guideVariants = [
  { id: 'skincare', title: 'Personalized Skincare Guide', brand: 'Hi.skin' },
  { id: 'fitness', title: 'Wellness Coaching Guide', brand: 'Pulseform' },
  { id: 'nutrition', title: 'Nutrition Playbook', brand: 'Nourish' },
  { id: 'sleep', title: 'Sleep Optimization Guide', brand: 'Restlab' },
  { id: 'onboarding', title: 'Client Onboarding Guide', brand: 'Studio One' }
];

export function buildWellnessGuideArtifact(variantId: string): ArtifactDocument | undefined {
  const variant = guideVariants.find((item) => item.id === variantId);
  if (!variant) return undefined;
  return {
    kind: 'report',
    primaryFormat: 'pdf',
    title: variant.title,
    audience: 'Clients and members',
    tone: 'professional',
    executiveSummary: `Personalized ${variant.brand} guide with routines, product grids, and progress tracking.`,
    sections: [
      {
        heading: 'Your profile',
        body: 'Skin type, goals, and current routine baseline.',
        bullets: ['Morning focus: hydration and protection', 'Evening focus: repair and consistency']
      },
      {
        heading: 'Recommended routine',
        body: 'AM/PM product sequence with usage notes.',
        bullets: [],
        table: {
          columns: ['Step', 'Product', 'Frequency'],
          rows: [['Cleanse', 'Gentle gel cleanser', 'Daily'], ['Treat', 'Vitamin C serum', 'AM'], ['Moisturize', 'Barrier cream', 'AM/PM']]
        }
      },
      {
        heading: 'Progress tracker',
        body: 'Weekly check-ins with photo and note slots.',
        bullets: ['Week 1 baseline', 'Week 4 texture check', 'Week 8 glow review']
      },
      {
        heading: 'Membership offer',
        body: 'Upgrade path with bundled consults and replenishment.',
        bullets: ['Quarterly dermatology review', 'Auto-replenish cadence', 'Member-only treatment menu']
      }
    ],
    citations: [{ id: 'S1', label: 'Peak reference family: Personalized wellness PDF', url: 'https://word.cloud.microsoft/create/en/templates/' }],
    nextQuestions: [],
    design: {
      template: 'signal-orange',
      headingFontFamily: 'Aptos Display',
      bodyFontFamily: 'Aptos',
      pageSize: 'letter',
      orientation: 'portrait',
      density: 'airy',
      palette: {
        background: '#FFFFFF',
        surface: '#FFF1E8',
        text: '#0F172A',
        muted: '#64748B',
        primary: '#FF5A1F',
        accent: '#1D4ED8'
      }
    },
    assets: []
  };
}

export const wellnessGuideVariants = guideVariants;