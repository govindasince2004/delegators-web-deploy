import { getPeakArtifact } from './peakArtifacts/registry.js';
import { resolveDesignPreset } from './designPresets.js';
import { findSkillById } from './skills.js';
import type { ArtifactDocument, ArtifactSection, Slide } from './shared.js';
import { resolveTemplateMetadata, type WorkbenchTemplate } from './workbenchTemplates.js';

type DeckScaffold = {
  id: string;
  slideRoles: Slide['role'][];
  layoutRhythm: NonNullable<Slide['layout']>[];
  slideTitles: string[];
};

const deckScaffolds: Record<string, DeckScaffold> = {
  'investor-12': {
    id: 'investor-12',
    slideRoles: ['opener', 'context', 'tension', 'evidence', 'insight', 'solution', 'proof', 'plan', 'proof', 'plan', 'close', 'close'],
    layoutRhythm: ['cover', 'statement', 'chart', 'split', 'metric', 'list', 'comparison', 'timeline', 'chart', 'grid', 'statement', 'cover'],
    slideTitles: [
      'Investment thesis',
      'Market tension',
      'Why now',
      'Evidence snapshot',
      'Product insight',
      'Solution architecture',
      'Traction proof',
      'Go-to-market plan',
      'Unit economics',
      'Roadmap milestones',
      'The ask',
      'Appendix'
    ]
  },
  'board-8': {
    id: 'board-8',
    slideRoles: ['opener', 'context', 'tension', 'evidence', 'insight', 'plan', 'proof', 'close'],
    layoutRhythm: ['cover', 'statement', 'split', 'chart', 'comparison', 'timeline', 'metric', 'statement'],
    slideTitles: [
      'Board recommendation',
      'Context',
      'Key risks',
      'Evidence',
      'Decision frame',
      'Execution plan',
      'Proof points',
      'Next steps'
    ]
  },
  'academic-10': {
    id: 'academic-10',
    slideRoles: ['opener', 'context', 'context', 'evidence', 'evidence', 'insight', 'insight', 'solution', 'proof', 'close'],
    layoutRhythm: ['cover', 'statement', 'list', 'quote', 'chart', 'split', 'grid', 'comparison', 'list', 'statement'],
    slideTitles: [
      'Research question',
      'Framing',
      'Theory overview',
      'Primary evidence',
      'Secondary evidence',
      'Critical insight',
      'Synthesis',
      'Implications',
      'Limitations',
      'Conclusion'
    ]
  }
};

const reportScaffolds: Record<string, string[]> = {
  'executive-memo': [
    'Executive summary',
    'Background',
    'Analysis',
    'Options',
    'Recommendation',
    'Risks',
    'Next steps',
    'Appendix'
  ],
  'research-brief': [
    'Research question',
    'Methods',
    'Findings',
    'Implications',
    'Limitations',
    'Sources'
  ]
};

const previewCache = new Map<string, ArtifactDocument>();

export function buildTemplatePreviewArtifact(template: WorkbenchTemplate): ArtifactDocument {
  const cacheKey = template.peakArtifactId ?? template.id;
  const cached = previewCache.get(cacheKey);
  if (cached) return cached;

  const peakArtifact = getPeakArtifact(template.peakArtifactId);
  if (peakArtifact) {
    previewCache.set(cacheKey, peakArtifact);
    return peakArtifact;
  }

  if (template.peakArtifactId) {
    throw new Error(`Missing peak artifact for template ${template.id} (${template.peakArtifactId})`);
  }

  const enriched = resolveTemplateMetadata(template);
  const skill = findSkillById(enriched.skillId);
  const primaryFormat = skill?.primaryOutput ?? 'pdf';
  const preset = resolveDesignPreset(enriched.designPreset, enriched.format);
  const design = {
    template: preset.template,
    visualDirection: enriched.visualDirection ?? preset.visualDirection,
    headingFontFamily: preset.headingFont,
    bodyFontFamily: preset.bodyFont,
    slideAspect: preset.slideAspect,
    density: preset.density,
    palette: preset.palette,
    includePageNumbers: enriched.format !== 'deck',
    showSectionNumbers: enriched.format !== 'resume'
  };

  const base: ArtifactDocument = {
    kind: enriched.format,
    primaryFormat,
    title: enriched.name,
    audience: enriched.audience ?? 'Professional audience',
    tone: 'professional',
    executiveSummary: enriched.description,
    sections: buildDocumentSections(enriched),
    citations: [{ id: 'S1', label: 'Template preview — replace with your sources', url: enriched.sourceUrl }],
    nextQuestions: [],
    design,
    assets: []
  };

  let artifact = base;
  if (enriched.format === 'deck') {
    artifact = { ...base, slides: buildDeckSlides(enriched) };
  } else if (enriched.format === 'sheet') {
    artifact = { ...base, sheet: buildSheetPreview(enriched) };
  } else if (enriched.format === 'resume') {
    artifact = { ...base, resume: buildResumePreview(enriched) };
  }

  previewCache.set(cacheKey, artifact);
  return artifact;
}

function buildDeckSlides(template: WorkbenchTemplate): Slide[] {
  const scaffold = template.scaffoldId ? deckScaffolds[template.scaffoldId] : undefined;
  if (scaffold) {
    return scaffold.slideTitles.map((title, index) => {
      const layout = scaffold.layoutRhythm[index] ?? 'list';
      const role = scaffold.slideRoles[index];
      const theme = slideThemeForLayout(layout, template.designPreset, index);
      const slide: Slide = {
        title: personalize(title, template),
        role,
        layout,
        theme,
        eyebrow: template.category,
        bullets: slideBullets(template, layout, index),
        subtitle: layout === 'cover' ? template.description : layout === 'split' ? template.useCase : undefined
      };
      if (layout === 'metric') {
        slide.metrics = [
          { value: '38%', label: 'Growth', detail: 'Preview metric' },
          { value: '$2.4M', label: 'ARR', detail: 'Sample data' },
          { value: '12 wk', label: 'Payback', detail: 'Illustrative' }
        ];
      }
      if (layout === 'comparison') {
        slide.columns = [
          { heading: 'Current state', bullets: ['Manual workflows', 'Fragmented data'] },
          { heading: 'With this approach', bullets: ['Automated pipeline', 'Single source of truth'] }
        ];
      }
      if (layout === 'chart') {
        slide.chart = {
          type: 'column',
          title: 'Trend preview',
          labels: ['Q1', 'Q2', 'Q3', 'Q4'],
          series: [{ name: 'Performance', values: [42, 58, 71, 86] }],
          unit: '%'
        };
      }
      if (layout === 'quote') {
        slide.quote = `"${template.description}"`;
        slide.quoteAttribution = template.category;
      }
      return slide;
    });
  }

  const defaultTitles = [
    'Opening statement',
    'Context and stakes',
    'Evidence',
    'Plan forward',
    'Proof points',
    'Close'
  ];
  const layouts: NonNullable<Slide['layout']>[] = ['cover', 'statement', 'metric', 'split', 'list', 'statement'];
  return defaultTitles.map((title, index) => ({
    title: personalize(title, template),
    role: index === 0 ? 'opener' : index === defaultTitles.length - 1 ? 'close' : 'evidence',
    layout: layouts[index],
    theme: slideThemeForLayout(layouts[index], template.designPreset, index),
    bullets: slideBullets(template, layouts[index], index),
    subtitle: index === 0 ? template.description : undefined,
    metrics: layouts[index] === 'metric'
      ? [{ value: '24%', label: 'Lift', detail: 'Preview' }]
      : undefined
  }));
}

function slideBullets(
  template: WorkbenchTemplate,
  layout: NonNullable<Slide['layout']>,
  index: number
): string[] {
  if (layout === 'grid') {
    return ['Capability one', 'Capability two', 'Capability three', 'Capability four'];
  }
  if (layout === 'timeline' || layout === 'process') {
    return ['Phase 1 — Discovery', 'Phase 2 — Build', 'Phase 3 — Launch', 'Phase 4 — Scale'];
  }
  const hints = template.structureHints ?? [];
  const hint = hints[index % Math.max(hints.length, 1)] ?? template.useCase;
  return [
    hint,
    `Designed for ${template.category.toLowerCase()} workflows`,
    'Replace with your facts and metrics'
  ].slice(0, layout === 'list' ? 5 : 3);
}

function buildDocumentSections(template: WorkbenchTemplate): ArtifactSection[] {
  const scaffoldSections = template.scaffoldId ? reportScaffolds[template.scaffoldId] : undefined;
  const headings = scaffoldSections ?? categorySectionHeadings(template);
  return headings.map((heading, index) => ({
    heading: personalize(heading, template),
    body: sectionBody(template, heading, index),
    bullets: sectionBullets(template, index),
    table: index === headings.length - 1 && template.format === 'report' ? summaryTable(template) : undefined
  }));
}

function categorySectionHeadings(template: WorkbenchTemplate): string[] {
  const category = template.category.toLowerCase();
  if (template.format === 'assignment') {
    return ['Introduction', 'Literature review', 'Methodology', 'Analysis', 'Conclusion', 'References'];
  }
  if (template.format === 'email') {
    return ['Purpose', 'Details', 'Action items'];
  }
  if (category.includes('invoice') || category.includes('proposal')) {
    return ['Overview', 'Scope', 'Deliverables', 'Timeline', 'Terms'];
  }
  if (category.includes('marketing') || category.includes('brochure')) {
    return ['Hero message', 'Benefits', 'Proof points', 'Call to action'];
  }
  return ['Summary', 'Background', 'Analysis', 'Recommendation', 'Next steps'];
}

function sectionBody(template: WorkbenchTemplate, heading: string, index: number): string {
  if (index === 0) return template.description;
  if (heading.toLowerCase().includes('appendix') || heading.toLowerCase().includes('sources')) {
    return 'Supporting tables, citations, and reference material appear here in the final export.';
  }
  return `${template.useCase} This section follows the ${template.name} structure and can be filled with your specifics.`;
}

function sectionBullets(template: WorkbenchTemplate, index: number): string[] {
  const hints = template.structureHints ?? [];
  if (!hints.length) {
    return index === 0
      ? ['Bottom line up front', 'Key decision or takeaway']
      : ['Evidence-backed point', 'Implication for the reader'];
  }
  const hint = hints[index % hints.length];
  return hint.split(/[;·]/).map((part) => part.trim()).filter(Boolean).slice(0, 4);
}

function summaryTable(template: WorkbenchTemplate) {
  return {
    columns: ['Item', 'Status', 'Owner'],
    rows: [
      ['Milestone A', 'On track', 'Preview'],
      ['Milestone B', 'Planned', 'Your team'],
      [template.category, 'Template', 'Workbench']
    ]
  };
}

function buildSheetPreview(template: WorkbenchTemplate) {
  const category = template.category.toLowerCase();
  if (category.includes('invoice')) {
    return {
      sheets: [{
        name: 'Invoice',
        columns: ['Description', 'Qty', 'Rate', 'Amount'],
        rows: [
          ['Consulting services', '12', '$150', '=B2*C2'],
          ['Materials', '1', '$420', '=B3*C3'],
          ['Subtotal', '', '', '=SUM(D2:D3)'],
          ['Tax (8%)', '', '', '=D4*0.08'],
          ['Total due', '', '', '=D4+D5']
        ]
      }]
    };
  }
  if (category.includes('budget')) {
    return {
      sheets: [{
        name: 'Monthly budget',
        columns: ['Category', 'Budget', 'Actual', 'Variance'],
        rows: [
          ['Housing', '$1,800', '$1,750', '=C2-B2'],
          ['Food', '$600', '$540', '=C3-B3'],
          ['Transport', '$320', '$380', '=C4-B4'],
          ['Savings', '$500', '$500', '=C5-B5'],
          ['Total', '=SUM(B2:B5)', '=SUM(C2:C5)', '=C6-B6']
        ]
      }]
    };
  }
  if (category.includes('gantt') || category.includes('project')) {
    return {
      sheets: [{
        name: 'Timeline',
        columns: ['Phase', 'Owner', 'Start', 'End', 'Status'],
        rows: [
          ['Discovery', 'Alex', '2026-01-06', '2026-01-20', 'Complete'],
          ['Build', 'Jordan', '2026-01-21', '2026-02-28', 'In progress'],
          ['Launch', 'Sam', '2026-03-01', '2026-03-15', 'Planned']
        ]
      }]
    };
  }
  if (category.includes('expense')) {
    return {
      sheets: [{
        name: 'Expenses',
        columns: ['Date', 'Category', 'Description', 'Amount'],
        rows: [
          ['2026-06-01', 'Travel', 'Client visit', '$186.40'],
          ['2026-06-03', 'Meals', 'Team lunch', '$64.20'],
          ['2026-06-05', 'Supplies', 'Office materials', '$42.00'],
          ['Total', '', '', '=SUM(D2:D4)']
        ]
      }]
    };
  }
  if (category.includes('inventory')) {
    return {
      sheets: [{
        name: 'Stock',
        columns: ['SKU', 'Item', 'Qty', 'Location', 'Reorder'],
        rows: [
          ['SKU-101', 'Widget A', '240', 'Aisle 3', 'No'],
          ['SKU-204', 'Widget B', '18', 'Aisle 1', 'Yes'],
          ['SKU-318', 'Widget C', '96', 'Aisle 5', 'No']
        ]
      }]
    };
  }
  if (category.includes('task') || category.includes('kanban') || category.includes('todo')) {
    return {
      sheets: [
        {
          name: 'To Do',
          columns: ['Task', 'Owner', 'Due'],
          rows: [['Draft outline', 'You', 'Mon'], ['Review sources', 'You', 'Tue']]
        },
        {
          name: 'In Progress',
          columns: ['Task', 'Owner', 'Due'],
          rows: [['Build spreadsheet', 'You', 'Wed']]
        },
        {
          name: 'Done',
          columns: ['Task', 'Owner', 'Due'],
          rows: [['Pick template', 'You', 'Today']]
        }
      ]
    };
  }
  return {
    sheets: [{
      name: template.name.slice(0, 31),
      columns: ['Column A', 'Column B', 'Column C'],
      rows: [
        ['Input', 'Value', 'Notes'],
        ['Sample row', '42', template.category],
        ['Formula row', '=B2*2', '84']
      ]
    }]
  };
}

function buildResumePreview(template: WorkbenchTemplate) {
  const isCoverLetter = template.skillId === 'cover-letter' || template.category.toLowerCase().includes('cover');
  const name = isCoverLetter ? 'Your Name' : 'Alex Morgan';
  return {
    name,
    headline: isCoverLetter
      ? `Application — ${template.name}`
      : `${template.category} professional`,
    contact: ['you@email.com', 'City, State', 'linkedin.com/in/you'],
    summary: template.description,
    skills: ['Communication', 'Analysis', 'Project delivery', 'Stakeholder management'],
    experience: [{
      heading: isCoverLetter ? 'Relevant experience' : 'Senior Analyst | Example Co.',
      body: '2022 — Present',
      bullets: [
        'Led cross-functional initiatives with measurable outcomes.',
        `Partnered with stakeholders to deliver on ${template.category.toLowerCase()} goals.`
      ]
    }],
    education: [{
      heading: 'B.A. | State University',
      body: '2020',
      bullets: ['Honors program']
    }],
    projects: isCoverLetter ? [] : [{
      heading: `${template.name} portfolio piece`,
      body: 'Sample project',
      bullets: ['Demonstrates structure and clarity expected in this template.']
    }]
  };
}

function slideThemeForLayout(
  layout: NonNullable<Slide['layout']>,
  presetId: string | undefined,
  index: number
): NonNullable<Slide['theme']> {
  const darkPresets = new Set(['midnight-aurora', 'noir-lumina', 'teal-momentum', 'executive-slate']);
  const accentPresets = new Set(['bold-pop', 'signal-orange', 'lime-metric', 'wellness-signal', 'spreadsheet-forest', 'spreadsheet-royal', 'rose-editorial']);
  if (layout === 'cover' || layout === 'statement') {
    if (darkPresets.has(presetId ?? '')) return 'dark';
    if (accentPresets.has(presetId ?? '')) return 'accent';
    return 'dark';
  }
  if (darkPresets.has(presetId ?? '')) return index % 2 === 0 ? 'dark' : 'light';
  if (accentPresets.has(presetId ?? '')) return index % 2 === 0 ? 'accent' : 'light';
  return 'light';
}

function personalize(value: string, template: WorkbenchTemplate): string {
  if (value.toLowerCase().includes('thesis') && template.category.toLowerCase().includes('investor')) {
    return `${template.name} — thesis`;
  }
  return value;
}

export function groupTemplatesByCategory(templates: WorkbenchTemplate[]): Array<{ category: string; templates: WorkbenchTemplate[] }> {
  const groups = new Map<string, WorkbenchTemplate[]>();
  for (const template of templates) {
    const list = groups.get(template.category) ?? [];
    list.push(template);
    groups.set(template.category, list);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([category, items]) => ({
      category,
      templates: items.sort((left, right) => left.sortOrder - right.sortOrder)
    }));
}