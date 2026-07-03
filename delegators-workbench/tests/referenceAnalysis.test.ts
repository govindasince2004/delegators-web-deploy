import { describe, expect, it } from 'vitest';
import {
  attachReferenceAnalysis,
  buildReferenceAnalysisJobs,
  buildReferenceAnalysisMessages,
  buildReferenceGenerationContext,
  buildReferenceSynthesisMessages
} from '../server/referenceAnalysis';
import type { ReferencePack } from '../server/references';

describe('reference analysis', () => {
  it('grounds the analysis request in extracted upload content before artifact planning', () => {
    const messages = buildReferenceAnalysisMessages(referencePack(), 'Create a board-ready review.');
    const serialized = JSON.stringify(messages);

    expect(serialized).toContain('Revenue declined from 18 to 14');
    expect(serialized).toContain('Create a board-ready review.');
    expect(serialized).toMatch(/facts|evidence/i);
    expect(serialized).toMatch(/contradictions|gaps/i);
    expect(serialized).toMatch(/avoid generic|no generic/i);
  });

  it('persists the grounded analysis beside the uploaded source pack', () => {
    const next = attachReferenceAnalysis(
      referencePack(),
      'Evidence: revenue declined. Gap: no explanation was supplied.'
    );

    expect(next.analysis).toContain('revenue declined');
    expect(next.markdown).toContain('# Grounded Upload Analysis');
    expect(next.seedFiles).toContainEqual({
      path: 'references/analysis.md',
      content: 'Evidence: revenue declined. Gap: no explanation was supplied.'
    });
  });

  it('analyzes every uploaded reference independently before synthesis', () => {
    const pack = referencePack();
    pack.references.push({
      id: 'R2',
      kind: 'file',
      name: 'brand-board.png',
      mimeType: 'image/png',
      bytes: 2048,
      extractor: 'gateway-vision',
      text: 'Typography: condensed sans serif. Primary color: approximately #16324F.',
      warnings: []
    });

    const jobs = buildReferenceAnalysisJobs(pack, 'Create a board-ready review.');
    expect(jobs).toHaveLength(2);
    expect(JSON.stringify(jobs[0]?.messages)).toContain('Revenue declined from 18 to 14');
    expect(JSON.stringify(jobs[0]?.messages)).not.toContain('condensed sans serif');
    expect(JSON.stringify(jobs[1]?.messages)).toContain('condensed sans serif');

    const synthesis = buildReferenceSynthesisMessages(
      jobs.map((job) => ({
        referenceId: job.referenceId,
        name: job.name,
        analysis: `Analysis for ${job.referenceId}`
      })),
      'Create a board-ready review.'
    );
    expect(JSON.stringify(synthesis)).toContain('Analysis for R1');
    expect(JSON.stringify(synthesis)).toContain('Analysis for R2');
  });

  it('builds bounded generation context while preserving analysis and evidence from each file', () => {
    const pack = referencePack();
    pack.analysis = 'Verified synthesis with exact figures and visual-system guidance.';
    pack.references.push({
      id: 'R2',
      kind: 'text',
      name: 'long-notes.txt',
      mimeType: 'text/plain',
      bytes: 200_000,
      extractor: 'plain-text',
      text: `START_MARKER ${'middle '.repeat(20_000)} END_MARKER`,
      warnings: []
    });

    const context = buildReferenceGenerationContext(pack, 12_000);
    expect(context.length).toBeLessThanOrEqual(12_000);
    expect(context).toContain('Verified synthesis');
    expect(context).toContain('R1: quarterly-review.docx');
    expect(context).toContain('R2: long-notes.txt');
    expect(context).toContain('START_MARKER');
    expect(context).toContain('END_MARKER');
    expect(context).toContain('references/extracted');
  });
});

function referencePack(): ReferencePack {
  return {
    capturedAt: '2026-06-15T00:00:00.000Z',
    references: [{
      id: 'R1',
      kind: 'file',
      name: 'quarterly-review.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      bytes: 1024,
      extractor: 'markitdown',
      text: 'Revenue declined from 18 to 14. Customer retention improved.',
      warnings: []
    }],
    assets: [],
    markdown: '# Reference Pack\n\nRevenue declined from 18 to 14.',
    seedFiles: []
  };
}
