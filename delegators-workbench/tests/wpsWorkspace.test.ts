import { describe, expect, it } from 'vitest';
import {
  buildWpsWorkspaceSeed,
  isWpsTemplateId,
  resolveWpsWorkspaceProfile,
  wpsExportCompatLines,
  wpsHarnessGuidanceLines
} from '../server/wpsWorkspace';

describe('wpsWorkspace', () => {
  it('detects kingsoft-wps gallery templates', () => {
    expect(isWpsTemplateId('peak-wps-business-report-hr')).toBe(true);
    expect(isWpsTemplateId('peak-ms-business-presentation-hr')).toBe(false);
  });

  it('resolves WPS workspace profile with gallery anchor', () => {
    const profile = resolveWpsWorkspaceProfile('peak-wps-business-report-hr');
    expect(profile).not.toBeNull();
    expect(profile?.product).toBe('powerpoint');
    expect(profile?.galleryUrl).toMatch(/template\.wps\.com/);
    expect(wpsHarnessGuidanceLines(profile!).join(' ')).toMatch(/WPS WORKSPACE/);
  });

  it('builds export-safe workspace seed for sheets', () => {
    const profile = resolveWpsWorkspaceProfile('peak-wps-sheet-charts');
    expect(profile?.product).toBe('excel');
    const seed = buildWpsWorkspaceSeed(profile!, 'sheet', 'xlsx');
    expect(seed).toMatch(/WPS Office workspace profile/);
    expect(wpsExportCompatLines('sheet', 'xlsx').join(' ')).toMatch(/sheet\.sheets/);
    expect(seed).toMatch(/sheet\.sheets/);
  });
});