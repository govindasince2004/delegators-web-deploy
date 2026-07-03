import { findWorkbenchTemplate } from '../src/lib/templateHarness.js';
import { resolveTemplateMetadata } from '../src/lib/workbenchTemplates.js';
import type { ArtifactKind, ArtifactPrimaryFormat } from '../src/lib/shared.js';
import {
  kingsoftExcelRefs,
  kingsoftPowerPointRefs,
  kingsoftWordRefs,
  resolveKingsoftDeckUrl,
  resolveKingsoftSheetUrl,
  resolveKingsoftWordUrl,
  type KingsoftTemplateRef
} from '../src/lib/peakArtifacts/archetypes/kingsoftInspiredCatalog.js';

export type WpsWorkspaceProfile = {
  templateId: string;
  templateName: string;
  product: KingsoftTemplateRef['product'];
  category: string;
  designMood: string;
  galleryUrl: string;
};

export function isWpsTemplateId(templateId?: string): boolean {
  if (!templateId?.trim()) return false;
  const template = findWorkbenchTemplate(templateId);
  return template?.source === 'kingsoft-wps'
    || templateId.startsWith('peak-wps-')
    || Boolean(template?.tags?.includes('wps'));
}

export function resolveWpsRefFromTemplateId(templateId: string): KingsoftTemplateRef | null {
  const peakSuffix = templateId.match(/^peak-wps-(?:sheet-|report-)?([^-]+(?:-[^-]+)?)/)?.[1]
    ?? templateId.replace(/^peak-wps-/, '').split('-')[0];
  if (!peakSuffix) return null;
  return (
    kingsoftPowerPointRefs.find((ref) => ref.id === peakSuffix || templateId.includes(ref.id))
    ?? kingsoftExcelRefs.find((ref) => ref.id === peakSuffix || templateId.includes(`sheet-${ref.id}`))
    ?? kingsoftWordRefs.find((ref) => ref.id === peakSuffix || templateId.includes(`report-${ref.id}`))
    ?? null
  );
}

export function resolveWpsWorkspaceProfile(templateId?: string): WpsWorkspaceProfile | null {
  if (!isWpsTemplateId(templateId)) return null;
  const id = templateId!.trim();
  const template = findWorkbenchTemplate(id);
  const enriched = template ? resolveTemplateMetadata(template) : null;
  const ref = resolveWpsRefFromTemplateId(id);
  const product = ref?.product
    ?? (enriched?.format === 'deck' ? 'powerpoint' : enriched?.format === 'sheet' ? 'excel' : 'word');
  const galleryUrl = ref
    ? ref.wpsUrl
    : product === 'powerpoint'
      ? resolveKingsoftDeckUrl('business-report')
      : product === 'excel'
        ? resolveKingsoftSheetUrl('charts')
        : resolveKingsoftWordUrl('resume');
  return {
    templateId: id,
    templateName: enriched?.name ?? ref?.category ?? 'WPS template',
    product,
    category: ref?.category ?? enriched?.category ?? 'WPS Office',
    designMood: ref?.designMood ?? enriched?.visualStyle ?? 'Clean WPS-native hierarchy with export-safe spacing',
    galleryUrl
  };
}

export function wpsHarnessGuidanceLines(profile: WpsWorkspaceProfile): string[] {
  return [
    'WPS WORKSPACE (built-in): this deliverable targets Kingsoft WPS Office — match gallery rhythm, not generic SaaS chrome.',
    `WPS reference: ${profile.templateName} (${profile.category}) — ${profile.designMood}.`,
    `Gallery anchor: ${profile.galleryUrl}`,
    'Exports must open cleanly in WPS Presentation/Writer/Spreadsheet: real tables, editable charts, no broken merge fields, no web-only widgets.',
    'Prefer design systems that survive round-trip in WPS: executive-slate, editorial-ivory, consulting-mono, modern-indigo when compatible with the brief.',
    'Cite the WPS gallery as a design source when the artifact uses this template family (provider: web, nativeUrl optional).'
  ];
}

export function wpsExportCompatLines(kind: ArtifactKind, primaryFormat?: ArtifactPrimaryFormat): string[] {
  const format = primaryFormat ?? (kind === 'deck' ? 'pptx' : kind === 'sheet' ? 'xlsx' : kind === 'report' ? 'pdf' : 'docx');
  const lines = [
    'WPS export compatibility: structure must survive DOCX/PPTX/XLSX/PDF export without placeholder tokens or empty shells.'
  ];
  if (format === 'pptx' || kind === 'deck') {
    lines.push('Deck: every slide needs a title; vary layouts; charts must include labels + series with equal-length value arrays.');
  }
  if (format === 'xlsx' || kind === 'sheet') {
    lines.push('Sheet: include sheet.sheets with named tabs, typed columns, and computed-ready numeric cells — not prose-only tables.');
  }
  if (format === 'docx' || kind === 'report' || kind === 'assignment') {
    lines.push('Document: section headings must be unique; tables need header rows; long bodies split across sections for WPS pagination.');
  }
  return lines;
}

export function buildWpsWorkspaceSeed(profile: WpsWorkspaceProfile, kind: ArtifactKind, primaryFormat?: ArtifactPrimaryFormat): string {
  return [
    '# WPS Office workspace profile',
    '',
    `- Template: ${profile.templateName} (${profile.templateId})`,
    `- Product: WPS ${profile.product}`,
    `- Category: ${profile.category}`,
    `- Design mood: ${profile.designMood}`,
    `- Gallery: ${profile.galleryUrl}`,
    '',
    '## Export targets',
    ...wpsExportCompatLines(kind, primaryFormat).map((line) => `- ${line}`),
    '',
    '## Quality bar',
    '- Match the gallery rhythm: spacing, hierarchy, and evidence placement.',
    '- Bind claims to sources; never invent metrics to fill WPS-style KPI tiles.',
    '- Final artifact JSON must be complete enough to export without repair.'
  ].join('\n');
}