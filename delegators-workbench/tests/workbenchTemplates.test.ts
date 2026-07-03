import { describe, expect, it } from 'vitest';
import {
  buildTemplateComposerPrompt,
  filterWorkbenchTemplates,
  resolveTemplateMetadata,
  workbenchTemplates
} from '../src/lib/workbenchTemplates';

describe('workbench template dataset', () => {
  it('ships a substantial curated starter library', () => {
    expect(workbenchTemplates.length).toBeGreaterThan(130);
    expect(workbenchTemplates.some((template) => template.peakArtifactId)).toBe(true);
    expect(workbenchTemplates.some((template) => template.format === 'deck')).toBe(true);
    expect(workbenchTemplates.some((template) => template.format === 'sheet')).toBe(true);
    expect(workbenchTemplates.some((template) => template.format === 'resume')).toBe(true);
  });

  it('filters by format, audience, and search query', () => {
    const decks = filterWorkbenchTemplates(workbenchTemplates, 'deck', '');
    expect(decks.every((template) => template.format === 'deck')).toBe(true);

    const invoices = filterWorkbenchTemplates(workbenchTemplates, 'all', 'invoice');
    expect(invoices.length).toBeGreaterThan(3);

    const campus = filterWorkbenchTemplates(workbenchTemplates, 'all', '', 'college');
    expect(campus.some((template) => template.tags.includes('college'))).toBe(true);
  });

  it('builds composer prompts with skill tags and design presets', () => {
    const template = workbenchTemplates.find((item) => item.id === 'wb-midnight-investor');
    expect(template).toBeTruthy();
    const prompt = buildTemplateComposerPrompt(template!);
    expect(prompt.startsWith('@ppt')).toBe(true);
    expect(prompt).toContain('bold-pop');
    expect(prompt).toContain('peak-xboard-lime-hr');
    expect(prompt).toContain('investor-12');
    expect(prompt).toContain('Target audience:');
  });

  it('enriches templates with inferred audience and structure hints', () => {
    const template = workbenchTemplates.find((item) => item.id === 'wb-executive-memo');
    expect(template).toBeTruthy();
    const enriched = resolveTemplateMetadata(template!);
    expect(enriched.audience).toContain('Executive');
    expect(enriched.structureHints?.length).toBeGreaterThan(0);
  });
});