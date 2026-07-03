import { createHash, randomBytes } from 'node:crypto';
import { oauthCallbackHtml } from './integrationOAuth.js';
import {
  deleteMicrosoft365Record,
  integrationVaultKey,
  maskEmail,
  readMicrosoft365Record,
  signOpaqueTicket,
  verifyOpaqueTicket,
  writeMicrosoft365Record,
  type Microsoft365VaultRecord
} from './integrationVault.js';

export { oauthCallbackHtml };

export const MICROSOFT_365_OAUTH_SCOPES = [
  'openid',
  'profile',
  'offline_access',
  'User.Read',
  'Files.ReadWrite'
] as const;

type OAuthTicket = {
  kind: 'microsoft_oauth';
  subject: string;
  code_verifier: string;
  exp: number;
  nonce: string;
};

type MicrosoftTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

function positiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function isMicrosoft365Enabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.WORKBENCH_MICROSOFT_365_ENABLED === 'true';
}

export function microsoftOAuthConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    env.WORKBENCH_MICROSOFT_OAUTH_CLIENT_ID?.trim() &&
      env.WORKBENCH_MICROSOFT_OAUTH_CLIENT_SECRET?.trim() &&
      env.WORKBENCH_PUBLIC_URL?.trim()
  );
}

function oauthTenant(env: NodeJS.ProcessEnv = process.env): string {
  return env.WORKBENCH_MICROSOFT_OAUTH_TENANT?.trim() || 'common';
}

export function microsoftOAuthRedirectUri(env: NodeJS.ProcessEnv = process.env): string {
  const base = env.WORKBENCH_PUBLIC_URL?.trim().replace(/\/$/, '') || 'http://127.0.0.1:4175';
  return `${base}/api/integrations/microsoft/callback`;
}

function oauthClientId(env: NodeJS.ProcessEnv = process.env): string {
  const value = env.WORKBENCH_MICROSOFT_OAUTH_CLIENT_ID?.trim();
  if (!value) throw new Error('WORKBENCH_MICROSOFT_OAUTH_CLIENT_ID is not configured.');
  return value;
}

function oauthClientSecret(env: NodeJS.ProcessEnv = process.env): string {
  const value = env.WORKBENCH_MICROSOFT_OAUTH_CLIENT_SECRET?.trim();
  if (!value) throw new Error('WORKBENCH_MICROSOFT_OAUTH_CLIENT_SECRET is not configured.');
  return value;
}

function ticketTtlMs(env: NodeJS.ProcessEnv = process.env): number {
  return positiveInt(env.WORKBENCH_MICROSOFT_OAUTH_TICKET_TTL_MS, 10 * 60_000);
}

export function createMicrosoftOAuthTicket(subject: string, env: NodeJS.ProcessEnv = process.env): {
  ticket: string;
  authorize_url: string;
} {
  if (!microsoftOAuthConfigured(env)) {
    throw new Error('Microsoft 365 OAuth is not configured on the server.');
  }
  const codeVerifier = randomBytes(32).toString('base64url');
  const payload: OAuthTicket = {
    kind: 'microsoft_oauth',
    subject,
    code_verifier: codeVerifier,
    exp: Date.now() + ticketTtlMs(env),
    nonce: randomBytes(16).toString('hex')
  };
  const ticket = signOpaqueTicket(payload, env);
  const tenant = oauthTenant(env);
  const params = new URLSearchParams({
    client_id: oauthClientId(env),
    redirect_uri: microsoftOAuthRedirectUri(env),
    response_type: 'code',
    scope: MICROSOFT_365_OAUTH_SCOPES.join(' '),
    response_mode: 'query',
    code_challenge: createHash('sha256').update(codeVerifier).digest('base64url'),
    code_challenge_method: 'S256',
    state: ticket
  });
  return {
    ticket,
    authorize_url: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`
  };
}

export function readMicrosoftOAuthTicket(ticket: string, env: NodeJS.ProcessEnv = process.env): OAuthTicket | null {
  const payload = verifyOpaqueTicket<OAuthTicket>(ticket, env);
  if (!payload || payload.kind !== 'microsoft_oauth') return null;
  if (!payload.subject || !payload.code_verifier || !payload.exp || !payload.nonce) return null;
  if (Date.now() > payload.exp) return null;
  return payload;
}

async function exchangeMicrosoftCode(code: string, codeVerifier: string, env: NodeJS.ProcessEnv = process.env): Promise<MicrosoftTokenResponse> {
  const tenant = oauthTenant(env);
  const body = new URLSearchParams({
    code,
    client_id: oauthClientId(env),
    client_secret: oauthClientSecret(env),
    redirect_uri: microsoftOAuthRedirectUri(env),
    grant_type: 'authorization_code',
    code_verifier: codeVerifier
  });
  const response = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const payload = await response.json().catch(() => ({})) as MicrosoftTokenResponse;
  if (!response.ok || payload.error) {
    throw new Error(payload.error_description || payload.error || 'Microsoft token exchange failed.');
  }
  return payload;
}

async function fetchMicrosoftEmail(accessToken: string): Promise<string> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error('Could not verify the connected Microsoft account.');
  const payload = await response.json() as { mail?: string; userPrincipalName?: string };
  const email = payload.mail?.trim() || payload.userPrincipalName?.trim();
  if (!email) throw new Error('Microsoft account email was not returned.');
  return email;
}

export async function refreshMicrosoftAccessToken(
  record: Microsoft365VaultRecord,
  env: NodeJS.ProcessEnv = process.env
): Promise<Microsoft365VaultRecord> {
  const tenant = oauthTenant(env);
  const body = new URLSearchParams({
    client_id: oauthClientId(env),
    client_secret: oauthClientSecret(env),
    refresh_token: record.refresh_token,
    grant_type: 'refresh_token',
    scope: MICROSOFT_365_OAUTH_SCOPES.join(' ')
  });
  const response = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const payload = await response.json().catch(() => ({})) as MicrosoftTokenResponse;
  if (!response.ok || !payload.access_token?.trim()) {
    throw new Error(payload.error_description || payload.error || 'Microsoft token refresh failed.');
  }
  return {
    ...record,
    access_token: payload.access_token.trim(),
    refresh_token: payload.refresh_token?.trim() || record.refresh_token,
    access_token_expires_at: payload.expires_in
      ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
      : record.access_token_expires_at
  };
}

export async function resolveMicrosoftAccessToken(
  subject: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<string | null> {
  let record = await readMicrosoft365Record(subject, env);
  if (!record) return null;
  const expiresAt = record.access_token_expires_at ? Date.parse(record.access_token_expires_at) : 0;
  if (!record.access_token || !Number.isFinite(expiresAt) || expiresAt <= Date.now() + 60_000) {
    record = await refreshMicrosoftAccessToken(record, env);
    await writeMicrosoft365Record(subject, record, env);
  }
  return record.access_token ?? null;
}

export async function completeMicrosoftOAuth(
  code: string,
  ticket: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<{ email_masked: string }> {
  const parsed = readMicrosoftOAuthTicket(ticket, env);
  if (!parsed) throw new Error('OAuth session expired. Start connect again from Workbench settings.');
  const tokens = await exchangeMicrosoftCode(code, parsed.code_verifier, env);
  if (!tokens.refresh_token?.trim()) {
    throw new Error('Microsoft did not return a refresh token. Disconnect and connect again.');
  }
  const accessToken = tokens.access_token?.trim();
  if (!accessToken) throw new Error('Microsoft did not return an access token.');
  const email = await fetchMicrosoftEmail(accessToken);
  const record: Microsoft365VaultRecord = {
    provider: 'microsoft_365',
    email,
    scopes: (tokens.scope ?? MICROSOFT_365_OAUTH_SCOPES.join(' ')).split(/\s+/).filter(Boolean),
    refresh_token: tokens.refresh_token.trim(),
    access_token: accessToken,
    access_token_expires_at: tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : undefined,
    connected_at: new Date().toISOString()
  };
  await writeMicrosoft365Record(parsed.subject, record, env);
  return { email_masked: maskEmail(email) };
}

export async function disconnectMicrosoft365(subject: string, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  await deleteMicrosoft365Record(subject, env);
}

export async function readMicrosoftIntegrationStatus(subject: string | undefined, env: NodeJS.ProcessEnv = process.env): Promise<{
  enabled: boolean;
  configured: boolean;
  connected: boolean;
  email_masked?: string;
  scopes?: string[];
  connected_at?: string;
}> {
  const enabled = isMicrosoft365Enabled(env);
  const configured = microsoftOAuthConfigured(env) && integrationVaultKey(env) !== null;
  if (!subject) return { enabled, configured, connected: false };
  const record = await readMicrosoft365Record(subject, env);
  if (!record) return { enabled, configured, connected: false };
  return {
    enabled,
    configured,
    connected: true,
    email_masked: maskEmail(record.email),
    scopes: record.scopes,
    connected_at: record.connected_at
  };
}