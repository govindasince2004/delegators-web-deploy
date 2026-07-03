import { describe, expect, it } from 'vitest';
import { GOOGLE_WORKSPACE_OAUTH_SCOPES } from '../server/googleOAuth.js';
import { MICROSOFT_365_OAUTH_SCOPES } from '../server/microsoftOAuth.js';
import {
  CLOUD_EXPORT_FOLDER,
  exportFilenameForArtifact,
  providerHasExportScope
} from '../server/cloudExport.js';
import type { ArtifactDocument } from '../src/lib/shared.js';

const sampleArtifact = {
  kind: 'report',
  title: 'Q3 Board Update',
  audience: 'Board',
  tone: 'professional',
  executiveSummary: 'Summary',
  sections: [{ heading: 'Findings', body: 'Body', bullets: [] }],
  citations: [],
  nextQuestions: [],
  assets: [],
  design: {}
} satisfies ArtifactDocument;

describe('cloudExport', () => {
  it('builds safe export filenames', () => {
    expect(exportFilenameForArtifact(sampleArtifact, 'pdf')).toBe('q3-board-update.pdf');
  });

  it('detects write scopes for cloud save', () => {
    expect(providerHasExportScope('google_workspace', [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.file'
    ])).toBe(true);
    expect(providerHasExportScope('google_workspace', [
      'https://www.googleapis.com/auth/drive.readonly'
    ])).toBe(false);
    expect(providerHasExportScope('microsoft_365', ['Files.ReadWrite'])).toBe(true);
    expect(providerHasExportScope('microsoft_365', ['Files.Read'])).toBe(false);
  });

  it('uses a dedicated OneDrive folder name', () => {
    expect(CLOUD_EXPORT_FOLDER).toBe('Delegators');
  });

  it('requests write-capable OAuth scopes at connect time', () => {
    expect(GOOGLE_WORKSPACE_OAUTH_SCOPES.join(' ')).toContain('drive.file');
    expect(MICROSOFT_365_OAUTH_SCOPES.join(' ')).toContain('Files.ReadWrite');
  });
});