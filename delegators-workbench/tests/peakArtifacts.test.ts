import { describe, expect, it } from 'vitest';
import { archetypeSeedCounts } from '../src/lib/peakArtifacts/archetypes/seedFactory';
import { reportArchetypeIds } from '../src/lib/peakArtifacts/archetypes/reportArchetypes';
import { resumeArchetypeIds } from '../src/lib/peakArtifacts/archetypes/resumeArchetypes';
import { sheetArchetypeIds } from '../src/lib/peakArtifacts/archetypes/sheetArchetypes';
import { deckArchetypes } from '../src/lib/peakArtifacts/archetypes/deckArchetypes';
import { buildDeckArtifactId } from '../src/lib/peakArtifacts/builders/deckBuilder';
import { verticalPaletteDiffers } from '../src/lib/peakArtifacts/builders/deckVisualVariant';
import { getPeakArtifact, listPeakArtifactIds, peakArtifactCount } from '../src/lib/peakArtifacts/registry';
import { ArtifactDocumentSchema } from '../src/lib/shared';
import { buildTemplatePreviewArtifact } from '../src/lib/templatePreviewArtifacts';
import { workbenchTemplates } from '../src/lib/workbenchTemplates';

describe('peak artifact library', () => {
  it('registers 500+ peak artifacts with 50+ unique designs per non-deck format', () => {
    expect(deckArchetypes.length).toBeGreaterThanOrEqual(72);
    expect(reportArchetypeIds.length).toBeGreaterThanOrEqual(50);
    expect(sheetArchetypeIds.length).toBeGreaterThanOrEqual(40);
    expect(resumeArchetypeIds.length).toBeGreaterThanOrEqual(50);
    expect(archetypeSeedCounts.decks).toBeGreaterThanOrEqual(720);
    expect(archetypeSeedCounts.reports).toBeGreaterThanOrEqual(50);
    expect(archetypeSeedCounts.sheets).toBeGreaterThanOrEqual(40);
    expect(archetypeSeedCounts.resumes).toBeGreaterThanOrEqual(50);
    expect(peakArtifactCount).toBeGreaterThanOrEqual(900);
    expect(listPeakArtifactIds().some((id) => id.startsWith('peak-report-'))).toBe(true);
    expect(listPeakArtifactIds().some((id) => id.startsWith('peak-sheet-'))).toBe(true);
    expect(listPeakArtifactIds().some((id) => id.startsWith('peak-resume-'))).toBe(true);
    expect(listPeakArtifactIds().some((id) => id.startsWith('peak-xboard-lime-'))).toBe(true);
  });

  it('builds a brutal Xboard lime deck with ten mapped slides', () => {
    const artifact = getPeakArtifact('peak-xboard-lime-hr');
    expect(artifact).toBeTruthy();
    expect(artifact!.slides).toHaveLength(10);
    expect(artifact!.slides!.some((slide) => slide.tone === 'lime')).toBe(true);
    expect(artifact!.slides!.some((slide) => slide.tone === 'orange')).toBe(true);
    expect(artifact!.slides!.some((slide) => slide.tone === 'pink')).toBe(true);
    expect(artifact!.slides!.some((slide) => slide.chart)).toBe(true);
    expect(ArtifactDocumentSchema.safeParse(artifact).success).toBe(true);
  });

  it('wires peak artifacts into template previews instead of png pastes', () => {
    const template = workbenchTemplates.find((item) => item.id === 'peak-xboard-lime-fintech');
    expect(template?.peakArtifactId).toBe('peak-xboard-lime-fintech');
    const preview = buildTemplatePreviewArtifact(template!);
    expect(preview.title).toContain('Ledgerlane');
    expect(preview.slides?.length).toBe(10);
  });

  it('validates every registered peak artifact', () => {
    for (const id of listPeakArtifactIds()) {
      const artifact = getPeakArtifact(id);
      expect(artifact, id).toBeTruthy();
      const parsed = ArtifactDocumentSchema.safeParse(artifact);
      expect(parsed.success, `${id} should parse: ${JSON.stringify(parsed.success ? [] : parsed.error.issues.slice(0, 2))}`).toBe(true);
    }
  });

  it('builds unique report section structures per archetype', () => {
    const annual = getPeakArtifact('peak-report-annual-report');
    const whitepaper = getPeakArtifact('peak-report-whitepaper');
    expect(annual?.sections.map((s) => s.heading)).not.toEqual(whitepaper?.sections.map((s) => s.heading));
    expect(annual?.design?.palette?.primary).not.toBe(whitepaper?.design?.palette?.primary);
  });

  it('builds unique sheet column structures per archetype', () => {
    const dashboard = getPeakArtifact('peak-sheet-dashboard');
    const budget = getPeakArtifact('peak-sheet-budget');
    expect(dashboard?.sheet?.sheets[0].columns).not.toEqual(budget?.sheet?.sheets[0].columns);
    expect(dashboard?.design?.palette?.primary).not.toBe(budget?.design?.palette?.primary);
  });

  it('renders visually distinct deck variants per industry vertical', () => {
    const archetype = deckArchetypes[0];
    const hr = getPeakArtifact(buildDeckArtifactId(archetype.id, 'hr'));
    const fintech = getPeakArtifact(buildDeckArtifactId(archetype.id, 'fintech'));
    expect(hr?.design?.palette?.primary).not.toBe(fintech?.design?.palette?.primary);
    expect(hr?.design?.palette?.accent).not.toBe(fintech?.design?.palette?.accent);
    expect(verticalPaletteDiffers('hr', 'fintech')).toBe(true);
    expect(hr?.slides?.some((slide, index) => slide.tone !== fintech?.slides?.[index]?.tone)).toBe(true);
  });

  it('includes Microsoft Create–inspired deck archetypes', () => {
    expect(deckArchetypes.some((item) => item.id.startsWith('ms-'))).toBe(true);
    const msDeck = getPeakArtifact(buildDeckArtifactId('ms-keynote', 'hr'));
    expect(msDeck?.slides?.length).toBeGreaterThanOrEqual(8);
    expect(msDeck?.title).toContain('MS Keynote');
  });

  it('builds unique resume layouts per archetype', () => {
    const executive = getPeakArtifact('peak-resume-executive');
    const creative = getPeakArtifact('peak-resume-creative');
    expect(executive?.design?.visualDirection).not.toBe(creative?.design?.visualDirection);
    expect(executive?.resume?.skills).not.toEqual(creative?.resume?.skills);
  });
});