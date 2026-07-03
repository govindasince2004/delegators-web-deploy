import { describe, expect, it } from 'vitest';
import { templateDisplayName, workbenchTemplates } from '../src/lib/workbenchTemplates';

describe('template display names', () => {
  it('assigns numbered names by format', () => {
    const ppt = workbenchTemplates.filter((template) => template.format === 'deck');
    expect(templateDisplayName(ppt[0])).toMatch(/^PPT Template \d+$/);
    expect(templateDisplayName(ppt[1])).toMatch(/^PPT Template \d+$/);
    expect(templateDisplayName(ppt[0])).not.toBe(templateDisplayName(ppt[1]));
  });

  it('includes kingsoft wps templates in the library', () => {
    const wps = workbenchTemplates.filter((template) => template.source === 'kingsoft-wps');
    expect(wps.length).toBeGreaterThan(24);
    expect(wps.some((template) => template.id.startsWith('peak-wps-'))).toBe(true);
  });
});