import { describe, expect, it } from 'vitest';
import { ArtifactDocumentSchema } from '../src/lib/shared';
import { buildTemplatePreviewArtifact } from '../src/lib/templatePreviewArtifacts';
import { workbenchTemplates } from '../src/lib/workbenchTemplates';

describe('template preview artifacts', () => {
  it('builds valid deck previews with scaffold slides', () => {
    const template = workbenchTemplates.find((item) => item.id === 'wb-midnight-investor');
    expect(template).toBeTruthy();
    const artifact = buildTemplatePreviewArtifact(template!);
    expect(artifact.kind).toBe('deck');
    expect(artifact.slides?.length).toBe(10);
    expect(artifact.design.template).toBe('bold-pop');
    expect(artifact.slides?.some((slide) => slide.tone === 'lime')).toBe(true);
    expect(ArtifactDocumentSchema.safeParse(artifact).success).toBe(true);
  });

  it('builds valid sheet previews with workbook data', () => {
    const template = workbenchTemplates.find((item) => item.id === 'ms-invoice-classic');
    expect(template).toBeTruthy();
    const artifact = buildTemplatePreviewArtifact(template!);
    expect(artifact.kind).toBe('sheet');
    expect(artifact.sheet?.sheets.length).toBeGreaterThan(0);
    expect(ArtifactDocumentSchema.safeParse(artifact).success).toBe(true);
  });

  it('builds valid resume previews', () => {
    const template = workbenchTemplates.find((item) => item.id === 'wb-classic-ats');
    expect(template).toBeTruthy();
    const artifact = buildTemplatePreviewArtifact(template!);
    expect(artifact.kind).toBe('resume');
    expect(artifact.resume?.name).toBeTruthy();
    expect(ArtifactDocumentSchema.safeParse(artifact).success).toBe(true);
  });

  it('builds valid report previews with executive memo scaffold', () => {
    const template = workbenchTemplates.find((item) => item.id === 'wb-executive-memo');
    expect(template).toBeTruthy();
    const artifact = buildTemplatePreviewArtifact(template!);
    expect(artifact.kind).toBe('report');
    expect(artifact.sections.length).toBeGreaterThanOrEqual(6);
    expect(ArtifactDocumentSchema.safeParse(artifact).success).toBe(true);
  });

  it('applies non-blue sheet presets to invoice previews', () => {
    const template = workbenchTemplates.find((item) => item.id === 'ms-invoice-classic');
    expect(template).toBeTruthy();
    const artifact = buildTemplatePreviewArtifact(template!);
    expect(artifact.design.template).toBe('executive-slate');
    expect(artifact.design.palette?.primary).toBe('#217346');
  });
});