import { createHash, randomBytes } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  deleteGoogleWorkspaceRecord,
  integrationVaultKey,
  maskEmail,
  readGoogleWorkspaceRecord,
  signOpaqueTicket,
  verifyOpaqueTicket,
  writeGoogleWorkspaceRecord,
  type GoogleWorkspaceVaultRecord
} from './integrationVault.js';
import { oauthCallbackHtml } from './integrationOAuth.js';

export const GOOGLE_WORKSPACE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/documents.readonly',
  'openid',
  'email'
] as const;

type OAuthTicket = {
  kind: 'google_oauth';
  subject: string;
  code_verifier: string;
  exp: number;
  nonce: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  email?: string;
};

function positiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function googleOAuthConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    env.WORKBENCH_GOOGLE_OAUTH_CLIENT_ID?.trim() &&
      env.WORKBENCH_GOOGLE_OAUTH_CLIENT_SECRET?.trim() &&
      env.WORKBENCH_PUBLIC_URL?.trim()
  );
}

export function googleOAuthRedirectUri(env: NodeJS.ProcessEnv = process.env): string {
  const base = env.WORKBENCH_PUBLIC_URL?.trim().replace(/\/$/, '') || 'http://127.0.0.1:4175';
  return `${base}/api/integrations/google/callback`;
}

function oauthClientId(env: NodeJS.ProcessEnv = process.env): string {
  const value = env.WORKBENCH_GOOGLE_OAUTH_CLIENT_ID?.trim();
  if (!value) throw new Error('WORKBENCH_GOOGLE_OAUTH_CLIENT_ID is not configured.');
  return value;
}

function oauthClientSecret(env: NodeJS.ProcessEnv = process.env): string {
  const value = env.WORKBENCH_GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!value) throw new Error('WORKBENCH_GOOGLE_OAUTH_CLIENT_SECRET is not configured.');
  return value;
}

function ticketTtlMs(env: NodeJS.ProcessEnv = process.env): number {
  return positiveInt(env.WORKBENCH_GOOGLE_OAUTH_TICKET_TTL_MS, 10 * 60_000);
}

function credentialsCacheRoot(env: NodeJS.ProcessEnv = process.env): string {
  return env.WORKBENCH_GOOGLE_WORKSPACE_VAULT_ROOT?.trim() || path.join(process.cwd(), '.data', 'google-workspace', 'sessions');
}

function subjectCacheDir(subject: string, env: NodeJS.ProcessEnv = process.env): string {
  const digest = createHash('sha256').update(subject).digest('hex');
  return path.join(credentialsCacheRoot(env), digest);
}

export function createGoogleOAuthTicket(subject: string, env: NodeJS.ProcessEnv = process.env): {
  ticket: string;
  authorize_url: string;
} {
  if (!googleOAuthConfigured(env)) {
    throw new Error('Google Workspace OAuth is not configured on the server.');
  }
  const codeVerifier = randomBytes(32).toString('base64url');
  const payload: OAuthTicket = {
    kind: 'google_oauth',
    subject,
    code_verifier: codeVerifier,
    exp: Date.now() + ticketTtlMs(env),
    nonce: randomBytes(16).toString('hex')
  };
  const ticket = signOpaqueTicket(payload, env);
  const params = new URLSearchParams({
    client_id: oauthClientId(env),
    redirect_uri: googleOAuthRedirectUri(env),
    response_type: 'code',
    scope: GOOGLE_WORKSPACE_OAUTH_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    code_challenge: createHash('sha256').update(codeVerifier).digest('base64url'),
    code_challenge_method: 'S256',
    state: ticket
  });
  return {
    ticket,
    authorize_url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  };
}

export function readGoogleOAuthTicket(ticket: string, env: NodeJS.ProcessEnv = process.env): OAuthTicket | null {
  const payload = verifyOpaqueTicket<OAuthTicket>(ticket, env);
  if (!payload || payload.kind !== 'google_oauth') return null;
  if (!payload.subject || !payload.code_verifier || !payload.exp || !payload.nonce) return null;
  if (Date.now() > payload.exp) return null;
  return payload;
}

async function exchangeGoogleCode(code: string, codeVerifier: string, env: NodeJS.ProcessEnv = process.env): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: oauthClientId(env),
    client_secret: oauthClientSecret(env),
    redirect_uri: googleOAuthRedirectUri(env),
    grant_type: 'authorization_code',
    code_verifier: codeVerifier
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const payload = await response.json().catch(() => ({})) as GoogleTokenResponse;
  if (!response.ok || payload.error) {
    throw new Error(payload.error_description || payload.error || 'Google token exchange failed.');
  }
  return payload;
}

async function fetchGoogleEmail(accessToken: string): Promise<string> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error('Could not verify the connected Google account.');
  const payload = await response.json() as GoogleUserInfo;
  if (!payload.email?.trim()) throw new Error('Google account email was not returned.');
  return payload.email.trim();
}

export async function completeGoogleOAuth(
  code: string,
  ticket: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<{ email_masked: string }> {
  const parsed = readGoogleOAuthTicket(ticket, env);
  if (!parsed) throw new Error('OAuth session expired. Start connect again from Workbench settings.');
  const tokens = await exchangeGoogleCode(code, parsed.code_verifier, env);
  if (!tokens.refresh_token?.trim()) {
    throw new Error('Google did not return a refresh token. Revoke prior access and connect again.');
  }
  const accessToken = tokens.access_token?.trim();
  if (!accessToken) throw new Error('Google did not return an access token.');
  const email = await fetchGoogleEmail(accessToken);
  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : undefined;
  const record: GoogleWorkspaceVaultRecord = {
    provider: 'google_workspace',
    email,
    scopes: (tokens.scope ?? GOOGLE_WORKSPACE_OAUTH_SCOPES.join(' ')).split(/\s+/).filter(Boolean),
    refresh_token: tokens.refresh_token.trim(),
    access_token: accessToken,
    access_token_expires_at: expiresAt,
    connected_at: new Date().toISOString()
  };
  await writeGoogleWorkspaceRecord(parsed.subject, record, env);
  await materializeGoogleCredentialsFile(parsed.subject, env);
  return { email_masked: maskEmail(email) };
}

export async function refreshGoogleAccessToken(
  record: GoogleWorkspaceVaultRecord,
  env: NodeJS.ProcessEnv = process.env
): Promise<GoogleWorkspaceVaultRecord> {
  const body = new URLSearchParams({
    client_id: oauthClientId(env),
    client_secret: oauthClientSecret(env),
    refresh_token: record.refresh_token,
    grant_type: 'refresh_token'
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const payload = await response.json().catch(() => ({})) as GoogleTokenResponse;
  if (!response.ok || !payload.access_token?.trim()) {
    throw new Error(payload.error_description || payload.error || 'Google token refresh failed.');
  }
  const next: GoogleWorkspaceVaultRecord = {
    ...record,
    access_token: payload.access_token.trim(),
    access_token_expires_at: payload.expires_in
      ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
      : record.access_token_expires_at
  };
  return next;
}

function gwsCredentialsPayload(record: GoogleWorkspaceVaultRecord, env: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
  return {
    type: 'authorized_user',
    client_id: oauthClientId(env),
    client_secret: oauthClientSecret(env),
    refresh_token: record.refresh_token,
    access_token: record.access_token,
    expiry: record.access_token_expires_at
  };
}

export async function materializeGoogleCredentialsFile(
  subject: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<string | null> {
  let record = await readGoogleWorkspaceRecord(subject, env);
  if (!record) return null;
  const expiresAt = record.access_token_expires_at ? Date.parse(record.access_token_expires_at) : 0;
  if (!record.access_token || !Number.isFinite(expiresAt) || expiresAt <= Date.now() + 60_000) {
    record = await refreshGoogleAccessToken(record, env);
    await writeGoogleWorkspaceRecord(subject, record, env);
  }
  const dir = subjectCacheDir(subject, env);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const filePath = path.join(dir, 'credentials.json');
  await writeFile(filePath, `${JSON.stringify(gwsCredentialsPayload(record, env))}\n`, {
    encoding: 'utf8',
    mode: 0o600
  });
  return filePath;
}

export async function resolveGoogleCredentialsPathForSubject(
  subject: string | undefined,
  env: NodeJS.ProcessEnv = process.env
): Promise<string | null> {
  if (!subject) return null;
  return materializeGoogleCredentialsFile(subject, env);
}

export async function resolveGoogleAccessToken(
  subject: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<string | null> {
  let record = await readGoogleWorkspaceRecord(subject, env);
  if (!record) return null;
  const expiresAt = record.access_token_expires_at ? Date.parse(record.access_token_expires_at) : 0;
  if (!record.access_token || !Number.isFinite(expiresAt) || expiresAt <= Date.now() + 60_000) {
    record = await refreshGoogleAccessToken(record, env);
    await writeGoogleWorkspaceRecord(subject, record, env);
    await materializeGoogleCredentialsFile(subject, env);
  }
  return record.access_token?.trim() ?? null;
}

export async function disconnectGoogleWorkspace(subject: string, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  await deleteGoogleWorkspaceRecord(subject, env);
  await rm(subjectCacheDir(subject, env), { recursive: true, force: true });
}

export async function readGoogleIntegrationStatus(subject: string | undefined, env: NodeJS.ProcessEnv = process.env): Promise<{
  enabled: boolean;
  configured: boolean;
  connected: boolean;
  email_masked?: string;
  scopes?: string[];
  connected_at?: string;
}> {
  const enabled = env.WORKBENCH_GOOGLE_WORKSPACE_ENABLED === 'true';
  const configured = googleOAuthConfigured(env) && Boolean(integrationVaultKeyPresent(env));
  if (!subject) {
    return { enabled, configured, connected: false };
  }
  const record = await readGoogleWorkspaceRecord(subject, env);
  if (!record) {
    return { enabled, configured, connected: false };
  }
  return {
    enabled,
    configured,
    connected: true,
    email_masked: maskEmail(record.email),
    scopes: record.scopes,
    connected_at: record.connected_at
  };
}

function integrationVaultKeyPresent(env: NodeJS.ProcessEnv = process.env): boolean {
  return integrationVaultKey(env) !== null;
}

export { oauthCallbackHtml };