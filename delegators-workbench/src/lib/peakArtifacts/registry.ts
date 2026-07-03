import type { ArtifactDocument } from '../shared.js';
import { reportArchetypeIds } from './archetypes/reportArchetypes.js';
import { resumeArchetypeIds } from './archetypes/resumeArchetypes.js';
import { sheetArchetypeIds } from './archetypes/sheetArchetypes.js';
import { buildAtsResumeArtifact } from './atsResumeFamily.js';
import { buildReportArtifact } from './builders/reportBuilder.js';
import { buildResumeArtifact } from './builders/resumeBuilder.js';
import { buildSheetArtifact } from './builders/sheetBuilder.js';
import { buildCobaltSaasDeck } from './cobaltSaasFamily.js';
import { premiumDeckEntries } from './decks/premiumDecks.js';
import { buildForestInvoiceArtifact } from './forestInvoiceFamily.js';
import { buildWellnessGuideArtifact } from './wellnessGuideFamily.js';
import { buildXboardLimeDeck, xboardVerticals } from './xboardLimeFamily.js';

const peakArtifacts = new Map<string, ArtifactDocument>();

function register(id: string, artifact: ArtifactDocument) {
  peakArtifacts.set(id, artifact);
}

for (const vertical of xboardVerticals) {
  register(`peak-xboard-lime-${vertical.id}`, buildXboardLimeDeck(vertical));
}

const cobaltIds = ['scheduling', 'crm', 'support', 'analytics', 'security', 'billing', 'collab', 'compliance'] as const;
for (const id of cobaltIds) {
  const artifact = buildCobaltSaasDeck(id);
  if (artifact) register(`peak-cobalt-saas-${id}`, artifact);
}

const invoiceIds = ['consulting', 'agency', 'freelance', 'vendor', 'retainer', 'services', 'product', 'maintenance'] as const;
for (const id of invoiceIds) {
  const artifact = buildForestInvoiceArtifact(id);
  if (artifact) register(`peak-forest-invoice-${id}`, artifact);
}

const guideIds = ['skincare', 'fitness', 'nutrition', 'sleep', 'onboarding'] as const;
for (const id of guideIds) {
  const artifact = buildWellnessGuideArtifact(id);
  if (artifact) register(`peak-wellness-guide-${id}`, artifact);
}

const resumeIds = ['engineer', 'marketing', 'finance', 'campus', 'executive', 'designer', 'pm'] as const;
for (const id of resumeIds) {
  const artifact = buildAtsResumeArtifact(id);
  if (artifact) register(`peak-ats-resume-${id}`, artifact);
}

for (const entry of premiumDeckEntries) {
  register(entry.id, entry.artifact);
}

for (const id of reportArchetypeIds) {
  const artifact = buildReportArtifact(id);
  if (artifact) register(`peak-report-${id}`, artifact);
}

for (const id of sheetArchetypeIds) {
  const artifact = buildSheetArtifact(id);
  if (artifact) register(`peak-sheet-${id}`, artifact);
}

for (const id of resumeArchetypeIds) {
  const artifact = buildResumeArtifact(id);
  if (artifact) register(`peak-resume-${id}`, artifact);
}

export function getPeakArtifact(peakArtifactId: string | undefined): ArtifactDocument | undefined {
  if (!peakArtifactId) return undefined;
  return peakArtifacts.get(peakArtifactId);
}

export function listPeakArtifactIds(): string[] {
  return [...peakArtifacts.keys()];
}

export function peakArtifactSlideSummary(peakArtifactId: string | undefined): string[] {
  const artifact = getPeakArtifact(peakArtifactId);
  if (!artifact) return [];
  if (artifact.kind === 'deck' && artifact.slides?.length) {
    return artifact.slides.map((slide, index) => {
      const layout = slide.layout ?? 'list';
      const tone = slide.tone ? ` tone-${slide.tone}` : '';
      return `Slide ${index + 1}: ${slide.title} (${layout}${tone})`;
    });
  }
  if (artifact.kind === 'sheet' && artifact.sheet?.sheets.length) {
    return artifact.sheet.sheets.map((sheet) => `Sheet: ${sheet.name} (${sheet.columns.length} columns)`);
  }
  if (artifact.kind === 'resume') {
    return ['Resume: header band, summary, experience, education, skills'];
  }
  return artifact.sections.map((section, index) => `Section ${index + 1}: ${section.heading}`);
}

export const peakArtifactCount = peakArtifacts.size;