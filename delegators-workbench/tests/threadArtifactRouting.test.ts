import { describe, expect, it } from 'vitest';
import { ArtifactDocumentSchema } from '../src/lib/shared';
import { buildGenerationBrief } from '../src/lib/templateHarness';
import { findWorkbenchTemplate } from '../src/lib/templateHarness';
import { getPeakArtifact } from '../src/lib/peakArtifacts/registry';
import {
  inferSkillFromThreadRequest,
  inspectPriorArtifactNovelty,
  isImplicitArtifactRequest,
  resolveThreadArtifactIntent,
  shouldGenerateNewArtifact
} from '../src/lib/threadArtifactRouting';

const deck = ArtifactDocumentSchema.parse({
  kind: 'deck',
  primaryFormat: 'pptx',
  title: 'SpaceX Deck',
  audience: 'Board',
  tone: 'Executive',
  executiveSummary: 'SpaceX update for the board.',
  sections: [{ heading: 'Launch', body: 'Starship flew.', bullets: [] }],
  slides: [{ title: 'Launch', bullets: ['Starship flew.'] }]
});

describe('thread artifact routing', () => {
  it('infers a new report request after a deck without an @ tag', () => {
    const skill = inferSkillFromThreadRequest('Create a pdf report from our research', [deck]);
    expect(skill?.kind).toBe('report');
  });

  it('detects implicit new artifact requests without @ tags', () => {
    expect(isImplicitArtifactRequest('Also create a pdf report on the funding round')).toBe(true);
    expect(isImplicitArtifactRequest('Document the competitive landscape from our research')).toBe(true);
    expect(shouldGenerateNewArtifact('Now make a presentation on go-to-market', [deck])).toBe(true);
    expect(shouldGenerateNewArtifact('Shorten slide 3', [deck])).toBe(false);
  });

  it('routes another deck in the same thread as a fresh deliverable', () => {
    const intent = resolveThreadArtifactIntent({
      brief: 'Create another 10-slide deck on climate policy',
      priorArtifacts: [deck]
    });
    expect(intent.mode).not.toBe('refine');
    expect(intent.routingLines.join(' ')).toMatch(/fresh production run|NEW/i);
  });

  it('flags near-duplicate thread artifacts as non-novel', () => {
    const replay = ArtifactDocumentSchema.parse({
      ...deck,
      title: 'SpaceX Deck',
      slides: deck.slides
    });
    const issues: string[] = [];
    inspectPriorArtifactNovelty(deck, replay, 'reuse-content', issues);
    expect(issues.join(' ')).toMatch(/prior thread file/i);
  });

  it('routes template generation as skeleton fill, not a from-scratch build', () => {
    const template = findWorkbenchTemplate('wb-midnight-investor')!;
    const preview = getPeakArtifact(template.peakArtifactId)!;
    const brief = buildGenerationBrief(
      template,
      'Acme Corp — B2B HR platform, $4.2M ARR, 180 customers, raising $8M Series A.',
      [preview]
    );
    const intent = resolveThreadArtifactIntent({
      brief,
      priorArtifacts: [preview],
      artifactKind: 'deck',
      templateId: template.id
    });
    expect(intent.mode).toBe('template-fill');
    expect(intent.routingLines.join(' ')).toMatch(/SKELETON/i);
    expect(intent.routingLines.join(' ')).not.toMatch(/fresh production run/i);
  });

  it('routes cross-format thread work as reuse-content, not replay', () => {
    const intent = resolveThreadArtifactIntent({
      brief: '@pdf turn this into an executive report with sources',
      priorArtifacts: [deck],
      skill: { id: 'pdf', tag: '@pdf', label: 'PDF', kind: 'report', category: 'Office', description: 'Structured reports, project PDFs, and formal writeups.', instruction: 'Create a complete PDF-ready document.', primaryOutput: 'pdf', aliases: ['@pdf'], outputs: ['pdf'] },
      artifactKind: 'report',
      outputFormat: 'pdf'
    });
    expect(intent.mode).toBe('reuse-content');
    expect(intent.targetKind).toBe('report');
    expect(intent.routingLines.join(' ')).toMatch(/NEW report/i);
    expect(intent.routingLines.join(' ')).toMatch(/Do NOT recreate the prior deck/i);
  });
});