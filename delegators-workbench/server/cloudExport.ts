import type { ArtifactDocument, ArtifactExportFormat } from '../src/lib/shared.js';
import { buildExport } from './exporters.js';
import { googleNativeUrl, importCloudFileToKnowledge } from './personalKnowledge.js';
import { resolveGoogleAccessToken } from './googleOAuth.js';
import { isGoogleWorkspaceEnabled } from './googleWorkspace.js';
import { resolveMicrosoftAccessToken } from './microsoftOAuth.js';
import { isMicrosoft365Enabled } from './microsoftGraph.js';
import { readGoogleWorkspaceRecord } from './integrationVault.js';
import { readMicrosoft365Record } from './integrationVault.js';
import type { IntegrationProvider } from './integrationVault.js';

export const CLOUD_EXPORT_FOLDER = 'Delegators';
export const MAX_CLOUD_EXPORT_BYTES = 25 * 1024 * 1024;

const EXPORT_MIME: Record<ArtifactExportFormat, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip'
};

export type CloudExportResult = {
  provider: IntegrationProvider;
  filename: string;
  mimeType: string;
  bytes: number;
  externalId: string;
  nativeUrl: string;
  webUrl?: string;
  folder: string;
};

export function exportFilenameForArtifact(artifact: ArtifactDocument, format: ArtifactExportFormat): string {
  const base = artifact.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'delegators-artifact';
  return `${base}.${format}`;
}

export function providerHasExportScope(provider: IntegrationProvider, scopes: string[] = []): boolean {
  const normalized = scopes.map((scope) => scope.toLowerCase());
  if (provider === 'google_workspace') {
    return normalized.some((scope) =>
      scope.includes('drive.file')
      || (scope.includes('/auth/drive') && !scope.includes('readonly'))
    );
  }
  return normalized.some((scope) => scope.includes('files.readwrite'));
}

export async function assertCloudExportReady(
  subject: string,
  provider: IntegrationProvider,
  env: NodeJS.ProcessEnv = process.env
): Promise<void> {
  if (provider === 'google_workspace') {
    if (!isGoogleWorkspaceEnabled(env)) throw new Error('Google Workspace export is disabled on this server.');
    const record = await readGoogleWorkspaceRecord(subject, env);
    if (!record) throw new Error('Connect Google Workspace in Settings before saving to Drive.');
    if (!providerHasExportScope('google_workspace', record.scopes)) {
      throw new Error('Reconnect Google Workspace to grant Drive save permission (drive.file scope).');
    }
    return;
  }
  if (!isMicrosoft365Enabled(env)) throw new Error('Microsoft 365 export is disabled on this server.');
  const record = await readMicrosoft365Record(subject, env);
  if (!record) throw new Error('Connect Microsoft 365 in Settings before saving to OneDrive.');
  if (!providerHasExportScope('microsoft_365', record.scopes)) {
    throw new Error('Reconnect Microsoft 365 to grant OneDrive save permission (Files.ReadWrite).');
  }
}

async function uploadToGoogleDrive(options: {
  subject: string;
  filename: string;
  mimeType: string;
  body: Buffer;
  env?: NodeJS.ProcessEnv;
}): Promise<{ id: string; webViewLink?: string; mimeType?: string }> {
  const token = await resolveGoogleAccessToken(options.subject, options.env);
  if (!token) throw new Error('Google access token is unavailable. Reconnect Google Workspace.');

  const metadata = {
    name: options.filename,
    parents: [] as string[]
  };
  const boundary = `delegators_${Date.now().toString(16)}`;
  const preamble = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${options.mimeType}\r\n\r\n`,
    'utf8'
  );
  const closing = Buffer.from(`\r\n--${boundary}--`, 'utf8');
  const payload = Buffer.concat([preamble, options.body, closing]);

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: payload,
      signal: AbortSignal.timeout(120_000)
    }
  );
  const result = await response.json().catch(() => ({})) as {
    id?: string;
    webViewLink?: string;
    mimeType?: string;
    error?: { message?: string };
  };
  if (!response.ok || !result.id) {
    throw new Error(result.error?.message || 'Google Drive upload failed.');
  }
  return { id: result.id, webViewLink: result.webViewLink, mimeType: result.mimeType };
}

async function uploadToMicrosoftOneDrive(options: {
  subject: string;
  filename: string;
  mimeType: string;
  body: Buffer;
  env?: NodeJS.ProcessEnv;
}): Promise<{ id: string; webUrl?: string }> {
  const token = await resolveMicrosoftAccessToken(options.subject, options.env);
  if (!token) throw new Error('Microsoft access token is unavailable. Reconnect Microsoft 365.');

  const path = `${CLOUD_EXPORT_FOLDER}/${options.filename}`.split('/').map(encodeURIComponent).join('/');
  const url = `https://graph.microsoft.com/v1.0/me/drive/root:/${path}:/content`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': options.mimeType
    },
    body: new Uint8Array(options.body),
    signal: AbortSignal.timeout(120_000)
  });
  const result = await response.json().catch(() => ({})) as {
    id?: string;
    webUrl?: string;
    error?: { message?: string };
  };
  if (!response.ok || !result.id) {
    throw new Error(result.error?.message || 'OneDrive upload failed.');
  }
  return { id: result.id, webUrl: result.webUrl };
}

export async function exportArtifactToCloud(options: {
  subject: string;
  provider: IntegrationProvider;
  artifact: ArtifactDocument;
  format: ArtifactExportFormat;
  filename?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<CloudExportResult> {
  const env = options.env ?? process.env;
  await assertCloudExportReady(options.subject, options.provider, env);

  const exported = await buildExport(options.artifact, options.format);
  if (exported.body.byteLength > MAX_CLOUD_EXPORT_BYTES) {
    throw new Error(`Export is too large for cloud save (${Math.round(exported.body.byteLength / 1024 / 1024)}MB). Try PDF or a smaller format.`);
  }

  const filename = options.filename?.trim() || exported.filename;
  const mimeType = EXPORT_MIME[options.format];

  if (options.provider === 'google_workspace') {
    const uploaded = await uploadToGoogleDrive({
      subject: options.subject,
      filename,
      mimeType,
      body: exported.body,
      env
    });
    const nativeUrl = googleNativeUrl(uploaded.id, uploaded.mimeType ?? mimeType);
    const result: CloudExportResult = {
      provider: 'google_workspace',
      filename,
      mimeType,
      bytes: exported.body.byteLength,
      externalId: uploaded.id,
      nativeUrl,
      webUrl: uploaded.webViewLink,
      folder: 'Drive root'
    };
    await importCloudFileToKnowledge({
      subject: options.subject,
      provider: 'google_workspace',
      externalId: uploaded.id,
      name: options.artifact.title,
      mimeType,
      nativeUrl,
      webUrl: uploaded.webViewLink,
      env
    });
    return result;
  }

  const uploaded = await uploadToMicrosoftOneDrive({
    subject: options.subject,
    filename,
    mimeType,
    body: exported.body,
    env
  });
  const nativeUrl = uploaded.webUrl ?? `https://onedrive.live.com/?id=${encodeURIComponent(uploaded.id)}`;
  const result: CloudExportResult = {
    provider: 'microsoft_365',
    filename,
    mimeType,
    bytes: exported.body.byteLength,
    externalId: uploaded.id,
    nativeUrl,
    webUrl: uploaded.webUrl,
    folder: CLOUD_EXPORT_FOLDER
  };
  await importCloudFileToKnowledge({
    subject: options.subject,
    provider: 'microsoft_365',
    externalId: uploaded.id,
    name: options.artifact.title,
    mimeType,
    nativeUrl,
    webUrl: uploaded.webUrl,
    env
  });
  return result;
}