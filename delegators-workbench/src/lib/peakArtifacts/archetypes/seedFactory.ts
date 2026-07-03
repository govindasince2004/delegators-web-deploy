import type { DeckArchetype } from './deckArchetypes.js';
import { deckArchetypes } from './deckArchetypes.js';
import { reportArchetypes } from './reportArchetypes.js';
import { resumeArchetypes } from './resumeArchetypes.js';
import { sheetArchetypes } from './sheetArchetypes.js';
import type { DeckVertical } from '../builders/deckBuilder.js';
import { buildDeckArtifactId } from '../builders/deckBuilder.js';
import { deckVerticals } from '../decks/premiumDecks.js';
import {
  isMicrosoftArchetypeId,
  resolveMicrosoftDeckUrl,
  resolveMicrosoftReportUrl,
  resolveMicrosoftResumeUrl,
  resolveMicrosoftSheetUrl
} from './microsoftInspiredCatalog.js';

const MS_PITCH = 'https://powerpoint.cloud.microsoft/create/en/pitch-deck-templates/';
const MS_WORD = 'https://word.cloud.microsoft/create/en/templates/';
const MS_XLS = 'https://excel.cloud.microsoft/create/en/templates/';

export type PeakTemplateSeed = {
  id: string;
  name: string;
  category: string;
  format: 'deck' | 'report' | 'sheet' | 'resume';
  skillId: 'ppt' | 'pdf' | 'xlsx' | 'resume';
  thumbFolder?: 'pptx' | 'excel' | 'pdf' | 'resume';
  thumbIndex?: number;
  sourceUrl: string;
  description: string;
  useCase: string;
  source: 'workbench-curated' | 'microsoft-create' | 'kingsoft-wps';
  tags: string[];
  designPreset: string;
  scaffoldId?: string;
  peakArtifactId: string;
  peakFamily: string;
  visualDirection: string;
  audience: string;
  visualStyle: string;
  structureHints: string[];
  featured: boolean;
  sortOrder: number;
  starterPrompt: string;
};

function archetypeSeed(
  archetype: DeckArchetype,
  vertical: DeckVertical,
  sortOrder: number,
  thumbIndex: number,
  featured: boolean
): PeakTemplateSeed {
  const id = buildDeckArtifactId(archetype.id, vertical.id);
  const msDeck = isMicrosoftArchetypeId(archetype.id);
  return {
    id,
    name: `${archetype.name} — ${vertical.product}`,
    category: archetype.category,
    format: 'deck',
    skillId: 'ppt',
    thumbFolder: 'pptx',
    thumbIndex: ((thumbIndex - 1) % 6) + 1,
    sourceUrl: msDeck ? resolveMicrosoftDeckUrl(archetype.id) : MS_PITCH,
    description: `${vertical.thesis}. ${archetype.visualDirection}`,
    useCase: msDeck
      ? `${archetype.category} deck for ${vertical.category} — Microsoft Create layout fingerprint.`
      : `${vertical.category} fundraising with ${archetype.name} layout fingerprint.`,
    source: msDeck ? 'microsoft-create' : 'workbench-curated',
    tags: [
      'investor',
      'pitch',
      'peak-artifact',
      'archetype',
      archetype.id,
      vertical.id,
      ...(archetype.deckTone === 'minimal' ? ['minimalist'] : []),
      ...(msDeck ? ['microsoft'] : [])
    ],
    designPreset: archetype.designPreset,
    scaffoldId: 'investor-12',
    peakArtifactId: id,
    peakFamily: `archetype-${archetype.id}`,
    visualDirection: archetype.visualDirection,
    audience: 'Investors and fundraising stakeholders',
    visualStyle: archetype.visualDirection,
    structureHints: [
      `${archetype.slideBlueprint.length}-slide arc · layout fingerprint: ${archetype.layoutSequence}`,
      `${vertical.category} visual variant — unique palette per industry vertical`,
      `Unique ${archetype.id} tone and layout rhythm — do not swap slide order`
    ],
    featured,
    sortOrder,
    starterPrompt: `Create a ${archetype.slideBlueprint.length}-slide ${vertical.category} investor deck using the ${archetype.name} archetype (${archetype.layoutSequence}).`
  };
}

export function buildArchetypeTemplateSeeds(): PeakTemplateSeed[] {
  const seeds: PeakTemplateSeed[] = [];
  let sortOrder = 200;

  deckArchetypes.forEach((archetype, archetypeIndex) => {
    deckVerticals.forEach((vertical, verticalIndex) => {
      seeds.push(
        archetypeSeed(
          archetype,
          vertical,
          sortOrder,
          archetypeIndex + verticalIndex + 1,
          archetypeIndex < 3 && verticalIndex === 0
        )
      );
      sortOrder += 1;
    });
  });

  return seeds;
}

export function buildReportTemplateSeeds(startSortOrder = 500): PeakTemplateSeed[] {
  return reportArchetypes.map((archetype, index) => {
    const msReport = archetype.id.startsWith('ms-word-');
    return {
    id: `peak-report-${archetype.id}`,
    name: archetype.title,
    category: archetype.category,
    format: 'report',
    skillId: 'pdf',
    thumbFolder: 'pdf',
    thumbIndex: (index % 8) + 1,
    sourceUrl: msReport ? resolveMicrosoftReportUrl(archetype.id) : MS_WORD,
    description: `${archetype.orgName} ${archetype.structure.replace(/-/g, ' ')} with unique section structure and ${archetype.designPreset} styling.`,
    useCase: `${archetype.category} for ${archetype.audience.toLowerCase()}.`,
    source: msReport ? 'microsoft-create' as const : 'workbench-curated' as const,
    tags: ['report', 'peak-artifact', archetype.structure, archetype.id, ...(msReport ? ['microsoft'] : [])],
    designPreset: archetype.designPreset,
    peakArtifactId: `peak-report-${archetype.id}`,
    peakFamily: 'report-archetypes',
    visualDirection: `${archetype.headingFont} headings, ${archetype.bodyFont} body, ${archetype.palette.primary} primary palette.`,
    audience: archetype.audience,
    visualStyle: `${archetype.category} layout with ${archetype.structure.replace(/-/g, ' ')} sections`,
    structureHints: [
      `Structure: ${archetype.structure}`,
      `Subject: ${archetype.subject}`,
      `Palette primary: ${archetype.palette.primary}`
    ],
    featured: index < 3,
    sortOrder: startSortOrder + index,
    starterPrompt: `Create a ${archetype.category.toLowerCase()} for ${archetype.orgName} covering ${archetype.subject}.`
  };
  });
}

export function buildSheetTemplateSeeds(startSortOrder = 600): PeakTemplateSeed[] {
  return sheetArchetypes.map((archetype, index) => {
    const msSheet = archetype.id.startsWith('ms-excel-');
    return {
    id: `peak-sheet-${archetype.id}`,
    name: archetype.title,
    category: archetype.category,
    format: 'sheet',
    skillId: 'xlsx',
    thumbFolder: 'excel',
    thumbIndex: (index % 8) + 1,
    sourceUrl: msSheet ? resolveMicrosoftSheetUrl(archetype.id) : MS_XLS,
    description: `${archetype.entity} ${archetype.structure.replace(/-/g, ' ')} with ${archetype.designPreset} header styling.`,
    useCase: `${archetype.category} workbook for ${archetype.audience.toLowerCase()}.`,
    source: msSheet ? 'microsoft-create' as const : 'workbench-curated' as const,
    tags: ['sheet', 'peak-artifact', archetype.structure, archetype.id, ...(msSheet ? ['microsoft'] : [])],
    designPreset: archetype.designPreset,
    peakArtifactId: `peak-sheet-${archetype.id}`,
    peakFamily: 'sheet-archetypes',
    visualDirection: `${archetype.palette.primary} header band with ${archetype.headingFont} column labels.`,
    audience: archetype.audience,
    visualStyle: `${archetype.category} spreadsheet with unique column structure`,
    structureHints: [
      `Structure: ${archetype.structure}`,
      `Entity: ${archetype.entity}`,
      `Header color: ${archetype.palette.primary}`
    ],
    featured: index < 3,
    sortOrder: startSortOrder + index,
    starterPrompt: `Create a ${archetype.category.toLowerCase()} spreadsheet for ${archetype.entity}.`
  };
  });
}

export function buildResumeTemplateSeeds(startSortOrder = 700): PeakTemplateSeed[] {
  return resumeArchetypes.map((archetype, index) => {
    const msResume = archetype.id.startsWith('ms-resume-');
    return {
    id: `peak-resume-${archetype.id}`,
    name: `${archetype.name} ${archetype.role}`,
    category: archetype.category,
    format: 'resume',
    skillId: 'resume',
    thumbFolder: 'resume',
    thumbIndex: (index % 8) + 1,
    sourceUrl: msResume ? resolveMicrosoftResumeUrl(archetype.id) : MS_WORD,
    description: `${archetype.layout.replace(/-/g, ' ')} resume for ${archetype.role} with ${archetype.designPreset} typography.`,
    useCase: `${archetype.category} for ${archetype.audience.toLowerCase()}.`,
    source: msResume ? 'microsoft-create' as const : 'workbench-curated' as const,
    tags: ['resume', 'peak-artifact', archetype.layout, archetype.id, ...(msResume ? ['microsoft'] : [])],
    designPreset: archetype.designPreset,
    peakArtifactId: `peak-resume-${archetype.id}`,
    peakFamily: 'resume-archetypes',
    visualDirection: `${archetype.layout.replace(/-/g, ' ')} layout with ${archetype.headingFont} headings.`,
    audience: archetype.audience,
    visualStyle: `${archetype.category} with ${archetype.layout.replace(/-/g, ' ')} section hierarchy`,
    structureHints: [
      `Layout: ${archetype.layout}`,
      `Role: ${archetype.role}`,
      `Accent: ${archetype.palette.accent}`
    ],
    featured: index < 3,
    sortOrder: startSortOrder + index,
    starterPrompt: `Create a ${archetype.layout.replace(/-/g, ' ')} resume for ${archetype.role} using only the facts I provide.`
  };
  });
}

export const archetypeSeedCounts = {
  decks: deckArchetypes.length * deckVerticals.length,
  reports: reportArchetypes.length,
  sheets: sheetArchetypes.length,
  resumes: resumeArchetypes.length
};

export const archetypeTemplateSeeds: PeakTemplateSeed[] = [
  ...buildArchetypeTemplateSeeds(),
  ...buildReportTemplateSeeds(),
  ...buildSheetTemplateSeeds(),
  ...buildResumeTemplateSeeds()
];