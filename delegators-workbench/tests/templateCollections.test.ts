import { describe, expect, it } from 'vitest';
import {
  filterBrowseTemplates,
  groupTemplatesByCollection,
  isHiddenVariant
} from '../src/lib/templateCollections';
import { workbenchTemplates } from '../src/lib/workbenchTemplates';

describe('template collections', () => {
  it('shows only complete peak artifacts in curated browse by default', () => {
    const curated = filterBrowseTemplates(workbenchTemplates, false);
    expect(curated.length).toBeLessThan(workbenchTemplates.length);
    expect(curated.every((template) => template.peakArtifactId || template.tags.includes('peak-artifact'))).toBe(true);
    expect(curated.some((template) => template.id === 'ms-invoice-teal')).toBe(false);
    expect(curated.some((template) => template.id === 'ms-aura-deck')).toBe(false);
    expect(curated.some((template) => template.id.startsWith('peak-'))).toBe(true);
  });

  it('marks invoice palette rows as hidden variants', () => {
    const teal = workbenchTemplates.find((template) => template.id === 'ms-invoice-teal');
    expect(teal).toBeTruthy();
    expect(isHiddenVariant(teal!)).toBe(true);
  });

  it('groups curated templates into artifact collections', () => {
    const curated = filterBrowseTemplates(workbenchTemplates, false);
    const grouped = groupTemplatesByCollection(curated);
    expect(grouped.length).toBeGreaterThan(4);
    expect(grouped.some((group) => group.collection.label.includes('Pitch'))).toBe(true);
    expect(grouped.some((group) => group.collection.label.includes('Invoice'))).toBe(true);
  });
});