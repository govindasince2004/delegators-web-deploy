import { describe, expect, it } from 'vitest';
import { ArtifactDocumentSchema } from '../src/lib/shared';
import {
  enrichCoverSlide,
  repairArtifactCredibility,
  sanitizeText
} from '../server/artifactCredibilityRepair';
import { stabilizeDeckComposition } from '../server/deckComposition';

describe('artifact credibility repair', () => {
  it('strips hype and fake authority from prose', () => {
    const cleaned = sanitizeText(
      'This is the most consequential strategic analysis of an unprecedented new chapter. Analysts, researchers, and technology strategists agree.'
    );
    expect(cleaned).not.toMatch(/most consequential|unprecedented|Analysts, researchers/i);
    expect(cleaned).toMatch(/Source review required|significant|notable/i);
  });

  it('enriches sparse deck covers with scope, as-of, and honest byline', () => {
    const artifact = ArtifactDocumentSchema.parse({
      kind: 'deck',
      primaryFormat: 'pptx',
      title: 'Market scan',
      audience: 'Analysts, researchers, and technology strategists',
      tone: 'Executive',
      executiveSummary: 'A plain review of the market landscape.',
      sections: [{ heading: 'Context', body: 'Background facts.', bullets: [] }],
      slides: [{ title: 'A new chapter', bullets: ['Most consequential event.'] }]
    });

    const repaired = repairArtifactCredibility(artifact, {
      brief: 'Create a deck on market scan',
      audienceProfile: {
        audience: 'corporate',
        label: 'Corporate professional',
        deckTemplate: 'consulting-mono',
        documentTemplate: 'executive-slate',
        tone: 'professional',
        density: 'balanced',
        citationStrictness: 'standard'
      }
    });

    const opener = repaired.slides?.[0];
    expect(opener?.layout).toBe('cover');
    expect(opener?.subtitle).toBeTruthy();
    expect(opener?.bullets.length).toBeGreaterThanOrEqual(2);
    expect(repaired.audience).toBe('Corporate professional');
    expect(opener?.bullets.join(' ')).toMatch(/Prepared by Delegators Workbench/i);
  });

  it('adds source appendix scaffolding when citations exist', () => {
    const artifact = ArtifactDocumentSchema.parse({
      kind: 'report',
      primaryFormat: 'pdf',
      title: 'Research brief',
      audience: 'Team',
      tone: 'professional',
      executiveSummary: 'Summary.',
      sections: [{ heading: 'Findings', body: 'Key point.', bullets: [] }],
      citations: [{ id: 'S1', label: 'Example source', url: 'https://example.com' }]
    });

    const repaired = repairArtifactCredibility(artifact, { hasResearchSources: true });
    expect(repaired.sections.some((section) => /^sources$/i.test(section.heading))).toBe(true);
    expect(repaired.sections.some((section) => /methodology/i.test(section.heading))).toBe(true);
  });

  it('stabilizes deck composition with enriched cover', () => {
    const artifact = ArtifactDocumentSchema.parse({
      kind: 'deck',
      primaryFormat: 'pptx',
      title: 'Class deck',
      audience: 'Students',
      tone: 'clear',
      executiveSummary: 'Teaching overview.',
      sections: [{ heading: 'Intro', body: 'Overview.', bullets: [] }],
      slides: [{ title: 'Intro', bullets: ['Point'] }]
    });

    const stabilized = stabilizeDeckComposition(artifact, 'school class presentation for students');
    expect(stabilized.slides?.[0]).toMatchObject({
      layout: 'cover',
      eyebrow: expect.any(String),
      subtitle: expect.any(String)
    });
    expect(enrichCoverSlide(stabilized.slides![0], artifact, 'school class presentation', 'June 2026', 'Student presentation').bullets.length).toBeGreaterThanOrEqual(2);
  });
});