import { describe, expect, it } from 'vitest';
import {
  browseTemplates,
  dedupeTemplatesByDesign,
  filterTemplatesByStyle,
  resolveTemplateStyle
} from '../src/lib/templateBrowse';
import { filterBrowseTemplates } from '../src/lib/templateCollections';
import { workbenchTemplates } from '../src/lib/workbenchTemplates';

describe('template browse', () => {
  it('dedupes archetype deck variants to one row per design family', () => {
    const curated = filterBrowseTemplates(workbenchTemplates, false).filter((template) => template.format === 'deck');
    const deduped = dedupeTemplatesByDesign(curated);
    expect(deduped.length).toBeLessThan(curated.length);
    expect(deduped.length).toBeGreaterThan(60);
  });

  it('filters minimalist and microsoft styles', () => {
    const curated = filterBrowseTemplates(workbenchTemplates, false);
    const minimalist = filterTemplatesByStyle(curated, 'minimalist');
    const microsoft = filterTemplatesByStyle(curated, 'microsoft');
    expect(minimalist.length).toBeGreaterThan(10);
    expect(microsoft.length).toBeGreaterThan(80);
    expect(minimalist.every((template) => resolveTemplateStyle(template) === 'minimalist')).toBe(true);
  });

  it('switches deck vertical while preserving archetype family', () => {
    const browsed = browseTemplates(filterBrowseTemplates(workbenchTemplates, false), {
      uniqueDesigns: true,
      verticalId: 'fintech',
      allTemplates: workbenchTemplates
    });
    const sample = browsed.find((template) => template.id.startsWith('peak-archetype-sequoia-editorial-'));
    expect(sample?.id).toBe('peak-archetype-sequoia-editorial-fintech');
    expect(sample?.name).toContain('Ledgerlane');
  });
});