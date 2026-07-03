import type { ArtifactKind } from './shared.js';
import type { WorkbenchTemplate } from './workbenchTemplates.js';

export type TemplateCollection = {
  id: string;
  label: string;
  formats: ArtifactKind[] | 'all';
};

const collections: TemplateCollection[] = [
  { id: 'pitch', label: 'Pitch & fundraising', formats: ['deck'] },
  { id: 'board', label: 'Board & executive', formats: ['deck', 'report'] },
  { id: 'sales', label: 'Sales & GTM', formats: ['deck'] },
  { id: 'campus-deck', label: 'Campus & creative decks', formats: ['deck'] },
  { id: 'agency', label: 'Agency & launches', formats: ['deck'] },
  { id: 'minimalist-deck', label: 'Minimal & aesthetic', formats: ['deck'] },
  { id: 'microsoft-deck', label: 'Microsoft Create decks', formats: ['deck'] },
  { id: 'business-deck', label: 'Business presentations', formats: ['deck'] },
  { id: 'ms-excel', label: 'Microsoft Excel templates', formats: ['sheet'] },
  { id: 'ms-word', label: 'Microsoft Word templates', formats: ['report', 'resume'] },
  { id: 'brand-guide', label: 'Brand & guide PDFs', formats: ['report'] },
  { id: 'executive-doc', label: 'Executive & board docs', formats: ['report'] },
  { id: 'research-doc', label: 'Research & white papers', formats: ['report'] },
  { id: 'proposal-doc', label: 'Proposals & grants', formats: ['report'] },
  { id: 'invoice', label: 'Invoices & billing', formats: ['sheet'] },
  { id: 'budget', label: 'Budgets & planners', formats: ['sheet'] },
  { id: 'dashboard', label: 'Dashboards & KPIs', formats: ['sheet'] },
  { id: 'project-sheet', label: 'Project & operations', formats: ['sheet'] },
  { id: 'campus-sheet', label: 'Campus & personal sheets', formats: ['sheet'] },
  { id: 'ats-resume', label: 'ATS & classic resumes', formats: ['resume'] },
  { id: 'modern-resume', label: 'Modern & tech resumes', formats: ['resume'] },
  { id: 'executive-resume', label: 'Executive resumes', formats: ['resume'] },
  { id: 'cover-letter', label: 'Cover letters', formats: ['resume'] },
  { id: 'email', label: 'Professional email', formats: ['email'] },
  { id: 'campus-work', label: 'Campus assignments', formats: ['assignment'] }
];

export function isHiddenVariant(template: WorkbenchTemplate): boolean {
  if (template.tags.includes('variant')) return true;
  if (/^ms-invoice-(teal|navy|purple|coral|slate|forest|amber|minimal)$/.test(template.id)) return true;
  if (template.id.startsWith('wb-report-')) return true;
  if (template.id.startsWith('wb-sheet-')) return true;
  if (template.id.startsWith('wb-resume-variant-')) return true;
  return false;
}

export function hasCompletePeakArtifact(template: WorkbenchTemplate): boolean {
  return Boolean(template.peakArtifactId) || template.tags.includes('peak-artifact');
}

export function filterBrowseTemplates(
  templates: WorkbenchTemplate[],
  showAllStyles: boolean
): WorkbenchTemplate[] {
  const list = showAllStyles
    ? templates
    : templates.filter((template) => hasCompletePeakArtifact(template) && !isHiddenVariant(template));
  return list;
}

export function resolveTemplateCollection(template: WorkbenchTemplate): string {
  const category = template.category.toLowerCase();
  const tags = template.tags;

  if (tags.includes('peak-artifact') && template.peakFamily === 'xboard-lime') return 'pitch';
  if (tags.includes('peak-artifact') && template.peakFamily === 'cobalt-saas') return 'pitch';
  if (tags.includes('peak-artifact') && template.peakFamily === 'forest-invoice') return 'invoice';
  if (tags.includes('peak-artifact') && template.peakFamily === 'wellness-guide') return 'brand-guide';
  if (tags.includes('peak-artifact') && template.peakFamily === 'ats-resume') return 'ats-resume';

  if (template.format === 'deck') {
    if (template.id.includes('ms-') || template.peakFamily?.includes('archetype-ms-') || category.toLowerCase().startsWith('ms ')) {
      return 'microsoft-deck';
    }
    if (
      tags.includes('minimalist')
      || category.toLowerCase().includes('minimal')
      || ['notion-minimal', 'dropbox-simple', 'swiss-grid', 'japanese-ink', 'mono-line', 'sparse-statement', 'quiet-metric', 'nordic-calm', 'zen-list', 'paper-ivory', 'glass-light', 'single-accent', 'breath-white', 'bauhaus-block'].some((marker) => template.id.includes(marker) || template.peakFamily?.includes(marker))
    ) {
      return 'minimalist-deck';
    }
    if (tags.includes('investor') || category.includes('investor') || category.includes('pitch') || category.includes('startup') || category.includes('financial')) {
      return 'pitch';
    }
    if (tags.includes('board') || category.includes('board')) return 'board';
    if (tags.includes('sales') || category.includes('sales')) return 'sales';
    if (tags.includes('campus') || tags.includes('student') || category.includes('campus') || category.includes('academic') || category.includes('student')) {
      return 'campus-deck';
    }
    if (tags.includes('agency') || category.includes('agency') || category.includes('launch') || category.includes('keynote') || category.includes('product')) {
      return 'agency';
    }
    return 'business-deck';
  }

  if (template.format === 'report') {
    if (template.id.startsWith('peak-report-ms-') || template.id.startsWith('ms-word-')) return 'ms-word';
    if (category.includes('brand') || category.includes('guide') || category.includes('brochure')) return 'brand-guide';
    if (category.includes('board') || category.includes('memo') || category.includes('one-pager') || category.includes('executive')) return 'executive-doc';
    if (category.includes('research') || category.includes('white paper') || category.includes('status')) return 'research-doc';
    if (category.includes('grant') || category.includes('proposal')) return 'proposal-doc';
    if (tags.includes('board')) return 'executive-doc';
    return 'research-doc';
  }

  if (template.format === 'sheet') {
    if (template.id.startsWith('peak-sheet-ms-') || template.id.startsWith('ms-excel-')) return 'ms-excel';
    if (category.includes('invoice') || tags.includes('invoice')) return 'invoice';
    if (category.includes('budget') || category.includes('planner') || tags.includes('budget')) return 'budget';
    if (category.includes('dashboard') || category.includes('kpi') || tags.includes('saas') || category.includes('cap table')) return 'dashboard';
    if (category.includes('project') || category.includes('gantt') || category.includes('inventory') || category.includes('expense') || category.includes('pipeline') || category.includes('hiring')) {
      return 'project-sheet';
    }
    return 'campus-sheet';
  }

  if (template.format === 'resume') {
    if (template.id.startsWith('peak-resume-ms-') || template.id.startsWith('ms-resume-')) return 'ms-word';
    if (template.skillId === 'cover-letter' || category.includes('cover')) return 'cover-letter';
    if (tags.includes('executive') || category.includes('executive') || category.includes('tpm') || category.includes('finance')) return 'executive-resume';
    if (tags.includes('modern') || tags.includes('engineering') || tags.includes('marketing') || category.includes('modern') || category.includes('tech')) {
      return 'modern-resume';
    }
    return 'ats-resume';
  }

  if (template.format === 'email') return 'email';
  return 'campus-work';
}

export function groupTemplatesByCollection(
  templates: WorkbenchTemplate[]
): Array<{ collection: TemplateCollection; templates: WorkbenchTemplate[] }> {
  const buckets = new Map<string, WorkbenchTemplate[]>();
  for (const template of templates) {
    const id = resolveTemplateCollection(template);
    const list = buckets.get(id) ?? [];
    list.push(template);
    buckets.set(id, list);
  }

  const order = collections.map((collection) => collection.id);
  return order
    .map((id) => {
      const collection = collections.find((item) => item.id === id);
      const items = buckets.get(id);
      if (!collection || !items?.length) return null;
      return {
        collection,
        templates: items.sort((left, right) => left.sortOrder - right.sortOrder)
      };
    })
    .filter((group): group is { collection: TemplateCollection; templates: WorkbenchTemplate[] } => Boolean(group));
}

export function collectionLabelForFormat(format: ArtifactKind | 'all'): string {
  if (format === 'deck') return 'Presentation collections';
  if (format === 'report') return 'Document collections';
  if (format === 'sheet') return 'Spreadsheet collections';
  if (format === 'resume') return 'Resume collections';
  if (format === 'email') return 'Email templates';
  if (format === 'assignment') return 'Campus work';
  return 'Collections';
}