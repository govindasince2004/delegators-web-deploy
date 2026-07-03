import { describe, expect, it } from 'vitest';
import {
  resolveMicrosoftDeckUrl,
  resolveMicrosoftReportUrl,
  resolveMicrosoftResumeUrl,
  resolveMicrosoftSheetUrl
} from '../src/lib/peakArtifacts/archetypes/microsoftInspiredCatalog';
import { buildArchetypeTemplateSeeds, buildReportTemplateSeeds, buildSheetTemplateSeeds } from '../src/lib/peakArtifacts/archetypes/seedFactory';

describe('Microsoft Create URL mapping', () => {
  it('maps deck archetype ids to category-specific PowerPoint Create URLs', () => {
    expect(resolveMicrosoftDeckUrl('ms-pitch-deck')).toContain('pitch-deck-templates');
    expect(resolveMicrosoftDeckUrl('ms-keynote')).toContain('keynote-templates');
    expect(resolveMicrosoftDeckUrl('ms-gantt-chart')).toContain('templates');
  });

  it('maps report, sheet, and resume archetypes to Word/Excel Create URLs', () => {
    expect(resolveMicrosoftReportUrl('ms-word-white-paper-2')).toContain('white-paper-templates');
    expect(resolveMicrosoftSheetUrl('ms-excel-gantt-chart')).toContain('gantt-charts');
    expect(resolveMicrosoftResumeUrl('ms-resume-3')).toContain('resume-templates');
  });

  it('tags Microsoft archetype seeds with microsoft-create source', () => {
    const msDeck = buildArchetypeTemplateSeeds().find((seed) => seed.id.startsWith('peak-archetype-ms-pitch-deck-'));
    expect(msDeck?.source).toBe('microsoft-create');
    expect(msDeck?.sourceUrl).toContain('pitch-deck-templates');
    expect(msDeck?.tags).toContain('microsoft');

    const msReport = buildReportTemplateSeeds().find((seed) => seed.id.startsWith('peak-report-ms-word-'));
    expect(msReport?.source).toBe('microsoft-create');
    expect(msReport?.sourceUrl).not.toContain('/templates/');

    const msSheet = buildSheetTemplateSeeds().find((seed) => seed.id.startsWith('peak-sheet-ms-excel-'));
    expect(msSheet?.source).toBe('microsoft-create');
    expect(msSheet?.sourceUrl).toContain('excel.cloud.microsoft');
  });
});