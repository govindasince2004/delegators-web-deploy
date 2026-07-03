import type { DeckVertical } from './peakArtifacts/builders/deckBuilder.js';
import { xboardVerticals } from './peakArtifacts/xboardLimeFamily.js';
import type { ArtifactKind } from './shared.js';
import {
  groupTemplatesByCollection,
  resolveTemplateCollection,
  type TemplateCollection
} from './templateCollections.js';
import type { WorkbenchTemplate } from './workbenchTemplates.js';

export type TemplateStyleFilter =
  | 'all'
  | 'minimalist'
  | 'bold'
  | 'dark'
  | 'editorial'
  | 'microsoft'
  | 'wps';

export type TemplateSort = 'featured' | 'name' | 'format';

export const templateStyleTabs: Array<{ id: TemplateStyleFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'microsoft', label: 'Microsoft' },
  { id: 'wps', label: 'WPS' },
  { id: 'minimalist', label: 'Minimal' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'bold', label: 'Bold' },
  { id: 'dark', label: 'Dark' }
];

export const deckVerticalOptions = xboardVerticals.map((vertical) => ({
  id: vertical.id,
  label: vertical.product
}));

const MINIMALIST_MARKERS = ['minimal', 'notion', 'dropbox', 'swiss', 'japanese', 'mono', 'sparse', 'quiet'];
const BOLD_MARKERS = ['bold', 'colorblock', 'vibrant', 'playful', 'duolingo', 'canva', 'dribbble', 'spotify', 'event'];
const DARK_MARKERS = ['dark', 'noir', 'midnight', 'linear', 'apple', 'tesla', 'uber', 'keynote', 'cinematic'];
const EDITORIAL_MARKERS = ['editorial', 'sequoia', 'ivory', 'georgia', 'warm', 'rose', 'brand-guidelines'];

export function resolveTemplateStyle(template: WorkbenchTemplate): TemplateStyleFilter {
  if (
    template.source === 'kingsoft-wps'
    || template.id.startsWith('peak-wps-')
    || template.peakFamily?.startsWith('wps-')
    || template.tags.includes('wps')
  ) {
    return 'wps';
  }
  if (
    template.source === 'microsoft-create'
    || template.id.startsWith('ms-')
    || template.id.startsWith('peak-archetype-ms-')
    || template.peakFamily?.startsWith('archetype-ms-')
  ) {
    return 'microsoft';
  }
  const haystack = [
    template.id,
    template.designPreset ?? '',
    template.visualDirection ?? '',
    template.visualStyle ?? '',
    template.category,
    ...template.tags
  ].join(' ').toLowerCase();

  if (MINIMALIST_MARKERS.some((marker) => haystack.includes(marker))) return 'minimalist';
  if (DARK_MARKERS.some((marker) => haystack.includes(marker))) return 'dark';
  if (BOLD_MARKERS.some((marker) => haystack.includes(marker))) return 'bold';
  if (EDITORIAL_MARKERS.some((marker) => haystack.includes(marker))) return 'editorial';
  if (template.tags.includes('microsoft')) return 'microsoft';
  return 'all';
}

export function resolveTemplateDesignKey(template: WorkbenchTemplate): string {
  if (template.peakFamily) return template.peakFamily;
  return template.id;
}

/** One row per unique layout family — avoids 10 duplicate archetype rows in browse. */
export function dedupeTemplatesByDesign(templates: WorkbenchTemplate[]): WorkbenchTemplate[] {
  const seen = new Map<string, WorkbenchTemplate>();
  for (const template of templates) {
    const key = resolveTemplateDesignKey(template);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, template);
      continue;
    }
    if (template.featured && !existing.featured) {
      seen.set(key, template);
      continue;
    }
    if (template.sortOrder < existing.sortOrder) {
      seen.set(key, template);
    }
  }
  return [...seen.values()].sort((left, right) => left.sortOrder - right.sortOrder);
}

function archetypeStemFromTemplateId(templateId: string): string | undefined {
  if (!templateId.startsWith('peak-archetype-')) return undefined;
  const suffix = templateId.slice('peak-archetype-'.length);
  const lastDash = suffix.lastIndexOf('-');
  if (lastDash < 0) return undefined;
  const verticalId = suffix.slice(lastDash + 1);
  if (!xboardVerticals.some((vertical) => vertical.id === verticalId)) return undefined;
  return suffix.slice(0, lastDash);
}

export function switchTemplateVertical(
  template: WorkbenchTemplate,
  verticalId: string,
  templates: WorkbenchTemplate[]
): WorkbenchTemplate | undefined {
  const archetypeStem = archetypeStemFromTemplateId(template.id)
    ?? (template.peakFamily?.startsWith('archetype-') ? template.peakFamily.replace('archetype-', '') : undefined);
  if (!archetypeStem) return template;
  const targetId = `peak-archetype-${archetypeStem}-${verticalId}`;
  return templates.find((item) => item.id === targetId) ?? template;
}

export function resolveDeckVerticalId(template: WorkbenchTemplate): string | undefined {
  if (!template.id.startsWith('peak-archetype-')) return undefined;
  const suffix = template.id.slice('peak-archetype-'.length);
  const verticalId = suffix.slice(suffix.lastIndexOf('-') + 1);
  return xboardVerticals.some((vertical) => vertical.id === verticalId) ? verticalId : undefined;
}

export function filterTemplatesByStyle(
  templates: WorkbenchTemplate[],
  style: TemplateStyleFilter
): WorkbenchTemplate[] {
  if (style === 'all') return templates;
  return templates.filter((template) => resolveTemplateStyle(template) === style);
}

export function filterTemplatesByCollection(
  templates: WorkbenchTemplate[],
  collectionId: string | 'all'
): WorkbenchTemplate[] {
  if (collectionId === 'all') return templates;
  return templates.filter((template) => resolveTemplateCollection(template) === collectionId);
}

export function sortTemplates(templates: WorkbenchTemplate[], sort: TemplateSort): WorkbenchTemplate[] {
  const list = [...templates];
  if (sort === 'name') {
    return list.sort((left, right) => left.name.localeCompare(right.name));
  }
  if (sort === 'format') {
    return list.sort((left, right) => left.format.localeCompare(right.format) || left.sortOrder - right.sortOrder);
  }
  return list.sort((left, right) => {
    if (left.featured !== right.featured) return left.featured ? -1 : 1;
    return left.sortOrder - right.sortOrder;
  });
}

export function buildCollectionFilterOptions(
  templates: WorkbenchTemplate[]
): Array<{ id: string; label: string; count: number }> {
  const grouped = groupTemplatesByCollection(templates);
  return [
    { id: 'all', label: 'All collections', count: templates.length },
    ...grouped.map((group) => ({
      id: group.collection.id,
      label: group.collection.label,
      count: group.templates.length
    }))
  ];
}

export function browseTemplates(
  templates: WorkbenchTemplate[],
  options: {
    uniqueDesigns?: boolean;
    style?: TemplateStyleFilter;
    collectionId?: string | 'all';
    verticalId?: string;
    sort?: TemplateSort;
    allTemplates?: WorkbenchTemplate[];
  }
): WorkbenchTemplate[] {
  let list = templates;
  if (options.uniqueDesigns) list = dedupeTemplatesByDesign(list);
  if (options.style && options.style !== 'all') list = filterTemplatesByStyle(list, options.style);
  if (options.collectionId && options.collectionId !== 'all') {
    list = filterTemplatesByCollection(list, options.collectionId);
  }
  if (options.verticalId && options.allTemplates) {
    list = list.map((template) => switchTemplateVertical(template, options.verticalId!, options.allTemplates!) ?? template);
  }
  return sortTemplates(list, options.sort ?? 'featured');
}

export function templateDesignSubtitle(template: WorkbenchTemplate): string {
  const style = resolveTemplateStyle(template);
  if (style === 'microsoft') return 'Microsoft Create';
  if (style === 'wps') return 'Kingsoft WPS';
  if (style === 'minimalist') return 'Minimal layout';
  if (style === 'editorial') return 'Editorial layout';
  if (style === 'bold') return 'Bold layout';
  if (style === 'dark') return 'Dark layout';
  return template.category;
}

export type DeckVerticalOption = Pick<DeckVertical, 'id' | 'product' | 'category'>;

export function listDeckVerticals(): DeckVerticalOption[] {
  return xboardVerticals;
}

export type GroupedBrowse = {
  collection: TemplateCollection;
  templates: WorkbenchTemplate[];
};

const FORMAT_GROUP_ORDER: ArtifactKind[] = ['deck', 'report', 'sheet', 'resume', 'email', 'assignment'];

export function groupBrowseTemplates(templates: WorkbenchTemplate[]): GroupedBrowse[] {
  const buckets = new Map<ArtifactKind, WorkbenchTemplate[]>();
  for (const template of templates) {
    const list = buckets.get(template.format) ?? [];
    list.push(template);
    buckets.set(template.format, list);
  }
  return FORMAT_GROUP_ORDER
    .filter((format) => buckets.has(format))
    .map((format) => ({
      collection: {
        id: format,
        label: format === 'deck' ? 'PPT' : format === 'report' ? 'PDF' : format === 'sheet' ? 'XLS' : format === 'resume' ? 'CV' : format === 'email' ? 'Mail' : 'Doc',
        formats: [format]
      },
      templates: buckets.get(format) ?? []
    }));
}