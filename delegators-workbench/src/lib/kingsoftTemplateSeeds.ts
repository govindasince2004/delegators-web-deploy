import {
  kingsoftExcelRefs,
  kingsoftPowerPointRefs,
  kingsoftWordRefs,
  resolveKingsoftDeckUrl,
  resolveKingsoftSheetUrl,
  resolveKingsoftWordUrl
} from './peakArtifacts/archetypes/kingsoftInspiredCatalog.js';
import type { PeakTemplateSeed } from './peakArtifacts/archetypes/seedFactory.js';

const MS_DECK_ARCHETYPE_IDS = [
  'ms-business-presentation',
  'ms-timeline-slides',
  'ms-marketing-deck',
  'ms-academic-presentation',
  'ms-sales-deck',
  'ms-product-launch',
  'ms-proposal-presentation',
  'ms-keynote',
  'ms-portfolio',
  'ms-quarterly-review',
  'ms-case-study-deck',
  'ms-roadmap-deck'
] as const;

const WPS_PRESETS = [
  'teal-momentum',
  'rose-editorial',
  'bold-pop',
  'wellness-signal',
  'modern-indigo',
  'editorial-warm',
  'spreadsheet-royal',
  'lime-metric'
] as const;

const WPS_SHEET_STRUCTURES = [
  'dashboard',
  'budget',
  'invoice',
  'expense-tracker',
  'inventory',
  'project-timeline',
  'sales-pipeline',
  'okr-tracker'
] as const;

const WPS_REPORT_STRUCTURES = [
  'business-report',
  'white-paper',
  'case-study',
  'market-analysis',
  'quarterly-review',
  'proposal-doc',
  'brand-guidelines',
  'training-handbook'
] as const;

export function buildKingsoftDeckSeeds(startSortOrder = 900): PeakTemplateSeed[] {
  return kingsoftPowerPointRefs.map((ref, index) => {
    const archetypeId = MS_DECK_ARCHETYPE_IDS[index % MS_DECK_ARCHETYPE_IDS.length];
    const verticalId = 'hr';
    const id = `peak-wps-${ref.id}-${verticalId}`;
    return {
      id,
      name: `WPS ${ref.category}`,
      category: ref.category,
      format: 'deck',
      skillId: 'ppt',
      thumbFolder: 'pptx',
      thumbIndex: (index % 6) + 1,
      sourceUrl: resolveKingsoftDeckUrl(ref.id),
      description: `${ref.designMood} — inspired by Kingsoft WPS template gallery.`,
      useCase: `${ref.category} presentation with WPS-style layout rhythm.`,
      source: 'kingsoft-wps',
      tags: ['wps', 'kingsoft', 'peak-artifact', ref.id, archetypeId, verticalId],
      designPreset: WPS_PRESETS[index % WPS_PRESETS.length],
      scaffoldId: 'investor-12',
      peakArtifactId: `peak-archetype-${archetypeId}-${verticalId}`,
      peakFamily: `wps-${ref.id}`,
      visualDirection: ref.designMood,
      audience: 'Business and creative professionals',
      visualStyle: `WPS ${ref.category} with gradient fluid pacing`,
      structureHints: [
        `WPS ${ref.category} layout fingerprint`,
        'Preserve slide order and tone blocks from the peak harness',
        'Use supplied facts only — do not invent metrics'
      ],
      featured: index < 4,
      sortOrder: startSortOrder + index,
      starterPrompt: `Create a ${ref.category.toLowerCase()} deck using the WPS ${ref.category} visual rhythm.`
    };
  });
}

export function buildKingsoftSheetSeeds(startSortOrder = 920): PeakTemplateSeed[] {
  return kingsoftExcelRefs.map((ref, index) => {
    const structure = WPS_SHEET_STRUCTURES[index % WPS_SHEET_STRUCTURES.length];
    const id = `peak-wps-sheet-${ref.id}`;
    const msSheetId = `ms-excel-${['planner-tracker', 'gantt-chart', 'invoice', 'budget', 'dashboard-kpi', 'expense-report', 'profit-loss', 'inventory'][index]}`;
    return {
      id,
      name: `WPS ${ref.category}`,
      category: ref.category,
      format: 'sheet',
      skillId: 'xlsx',
      thumbFolder: 'excel',
      thumbIndex: (index % 8) + 1,
      sourceUrl: resolveKingsoftSheetUrl(ref.id),
      description: `${ref.designMood} — Kingsoft WPS spreadsheet template.`,
      useCase: `${ref.category} workbook for operations teams.`,
      source: 'kingsoft-wps',
      tags: ['wps', 'kingsoft', 'sheet', 'peak-artifact', structure, ref.id],
      designPreset: WPS_PRESETS[index % WPS_PRESETS.length],
      peakArtifactId: `peak-sheet-${msSheetId}`,
      peakFamily: `wps-sheet-${ref.id}`,
      visualDirection: ref.designMood,
      audience: 'Finance and operations teams',
      visualStyle: `WPS ${ref.category} with structured tables`,
      structureHints: [`Structure: ${structure}`, `WPS category: ${ref.category}`],
      featured: index < 2,
      sortOrder: startSortOrder + index,
      starterPrompt: `Create a ${ref.category.toLowerCase()} spreadsheet in WPS style for Fabrikam Operations.`
    };
  });
}

export function buildKingsoftReportSeeds(startSortOrder = 930): PeakTemplateSeed[] {
  const msReportIds = [
    'ms-word-business-report-1',
    'ms-word-white-paper-2',
    'ms-word-cover-letter-4',
    'ms-word-brochure-5',
    'ms-word-newsletter-6'
  ];

  return kingsoftWordRefs.map((ref, index) => {
    const structure = WPS_REPORT_STRUCTURES[index % WPS_REPORT_STRUCTURES.length];
    const id = `peak-wps-report-${ref.id}`;
    const format = ref.id === 'resume' ? 'resume' as const : 'report' as const;
    const skillId = format === 'resume' ? 'resume' as const : 'pdf' as const;
    const peakArtifactId = format === 'resume'
      ? `peak-resume-ms-resume-${(index % 20) + 1}`
      : `peak-report-${msReportIds[index % msReportIds.length]}`;
    return {
      id,
      name: `WPS ${ref.category}`,
      category: ref.category,
      format,
      skillId,
      thumbFolder: format === 'resume' ? 'resume' : 'pdf',
      thumbIndex: (index % 8) + 1,
      sourceUrl: resolveKingsoftWordUrl(ref.id),
      description: `${ref.designMood} — Kingsoft WPS document template.`,
      useCase: `${ref.category} for professional workflows.`,
      source: 'kingsoft-wps',
      tags: ['wps', 'kingsoft', format, 'peak-artifact', structure, ref.id],
      designPreset: WPS_PRESETS[index % WPS_PRESETS.length],
      peakArtifactId,
      peakFamily: `wps-doc-${ref.id}`,
      visualDirection: ref.designMood,
      audience: format === 'resume' ? 'Hiring managers and recruiters' : 'Business stakeholders',
      visualStyle: `WPS ${ref.category} document hierarchy`,
      structureHints: [`Structure: ${structure}`, `WPS category: ${ref.category}`],
      featured: index < 2,
      sortOrder: startSortOrder + index,
      starterPrompt: `Create a ${ref.category.toLowerCase()} document using WPS ${ref.category} styling.`
    };
  });
}

export const kingsoftTemplateSeeds: PeakTemplateSeed[] = [
  ...buildKingsoftDeckSeeds(),
  ...buildKingsoftSheetSeeds(),
  ...buildKingsoftReportSeeds()
];