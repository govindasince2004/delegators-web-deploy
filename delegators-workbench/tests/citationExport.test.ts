import { describe, expect, it } from 'vitest';
import { ArtifactDocumentSchema } from '../src/lib/shared';
import {
  enrichArtifactForExport,
  exportClaimText,
  formattedCitationLine,
  orderedCitationsForExport
} from '../server/citationExport';
import { buildExport } from '../server/exporters';

describe('citation export apparatus', () => {
  const artifact = ArtifactDocumentSchema.parse({
    kind: 'report',
    primaryFormat: 'pdf',
    title: 'Market scan',
    audience: 'Team',
    tone: 'professional',
    executiveSummary: 'Revenue grew 18% year over year.',
    sections: [{
      heading: 'Findings',
      body: 'Enterprise adoption accelerated in Q1.',
      bullets: ['Cloud spend rose 12%'],
      sourceIds: ['S1']
    }],
    citations: [
      { id: 'S1', label: 'Industry benchmark report', url: 'https://example.com/benchmark' },
      { id: 'S2', label: 'Unused source', url: 'https://example.com/unused' }
    ]
  });

  it('labels unverified claims and appends source markers', () => {
    expect(exportClaimText('Enterprise adoption accelerated.', ['S1'])).toMatch(/\[CONFIRMED\].*\[S1\]/);
    expect(exportClaimText('A speculative market claim.', undefined, { citationsExpected: true })).toMatch(/\[UNVERIFIED\]/);
  });

  it('orders referenced citations before unused bibliography entries', () => {
    const ordered = orderedCitationsForExport(artifact);
    expect(ordered[0]?.id).toBe('S1');
    expect(formattedCitationLine(ordered[0]!)).toContain('https://example.com/benchmark');
  });

  it('exports methodology and sources sections in DOCX output', async () => {
    const enriched = enrichArtifactForExport(artifact);
    const exported = await buildExport(enriched, 'docx');
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(exported.body);
    const document = await zip.file('word/document.xml')!.async('string');
    expect(document).toContain('Methodology');
    expect(document).toContain('S1');
    expect(document).toContain('[CONFIRMED]');
  });
});