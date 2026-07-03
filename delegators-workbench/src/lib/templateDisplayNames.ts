import type { ArtifactKind } from './shared.js';
import type { WorkbenchTemplate } from './workbenchTemplates.js';

const FORMAT_PREFIX: Record<ArtifactKind, string> = {
  deck: 'PPT',
  report: 'PDF',
  sheet: 'XLS',
  resume: 'CV',
  email: 'Mail',
  assignment: 'Doc'
};

let displayNameById: Map<string, string> | null = null;

export function buildTemplateDisplayNameMap(templates: WorkbenchTemplate[]): Map<string, string> {
  const counters: Partial<Record<ArtifactKind, number>> = {};
  const sorted = [...templates].sort((left, right) => left.sortOrder - right.sortOrder);
  const map = new Map<string, string>();

  for (const template of sorted) {
    const prefix = FORMAT_PREFIX[template.format] ?? 'Template';
    counters[template.format] = (counters[template.format] ?? 0) + 1;
    map.set(template.id, `${prefix} Template ${counters[template.format]}`);
  }

  return map;
}

export function resolveTemplateDisplayName(
  template: WorkbenchTemplate,
  templates?: WorkbenchTemplate[]
): string {
  if (!displayNameById) {
    displayNameById = buildTemplateDisplayNameMap(templates ?? [template]);
  }
  return displayNameById.get(template.id) ?? template.name;
}

export function resetTemplateDisplayNameCache(): void {
  displayNameById = null;
}

export function formatGroupLabel(format: ArtifactKind): string {
  return `${FORMAT_PREFIX[format]} Templates`;
}