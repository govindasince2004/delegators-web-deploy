import type { Request, Response } from 'express';
import {
  completeGoogleOAuth,
  createGoogleOAuthTicket,
  disconnectGoogleWorkspace,
  googleOAuthConfigured,
  readGoogleIntegrationStatus
} from './googleOAuth.js';
import { oauthCallbackHtml } from './integrationOAuth.js';
import { integrationVaultKey } from './integrationVault.js';
import { isGoogleWorkspaceEnabled } from './googleWorkspace.js';
import {
  completeMicrosoftOAuth,
  createMicrosoftOAuthTicket,
  disconnectMicrosoft365,
  microsoftOAuthConfigured,
  readMicrosoftIntegrationStatus
} from './microsoftOAuth.js';
import { isMicrosoft365Enabled } from './microsoftGraph.js';
import { providerHasExportScope } from './cloudExport.js';

export type IntegrationsAuthContext = {
  kind?: string;
  subject?: string;
};

export function integrationSubjectFromAuth(auth: IntegrationsAuthContext | undefined): string | undefined {
  if (!auth) return undefined;
  if (auth.subject) return auth.subject;
  if (auth.kind === 'dev') return 'dev:integrations-local';
  return undefined;
}

export function integrationsAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
  return isGoogleWorkspaceEnabled(env) && googleOAuthConfigured(env) && integrationVaultKey(env) !== null;
}

export async function handleIntegrationsStatus(req: Request, res: Response): Promise<void> {
  const auth = res.locals.workbenchAuth as IntegrationsAuthContext | undefined;
  const subject = integrationSubjectFromAuth(auth);
  const [google, microsoft] = await Promise.all([
    readGoogleIntegrationStatus(subject),
    readMicrosoftIntegrationStatus(subject)
  ]);
  res.json({
    google_workspace: {
      ...google,
      export_capable: Boolean(google.connected && providerHasExportScope('google_workspace', google.scopes ?? []))
    },
    microsoft_365: {
      ...microsoft,
      export_capable: Boolean(microsoft.connected && providerHasExportScope('microsoft_365', microsoft.scopes ?? []))
    }
  });
}

export async function handleGoogleConnect(req: Request, res: Response): Promise<void> {
  if (!integrationsAvailable()) {
    res.status(503).json({
      error: 'integration_unavailable',
      details: 'Google Workspace connect is not configured on this server.'
    });
    return;
  }
  const subject = integrationSubjectFromAuth(res.locals.workbenchAuth as IntegrationsAuthContext | undefined);
  if (!subject) {
    res.status(401).json({ error: 'unauthorized', details: 'Sign in before connecting Google Workspace.' });
    return;
  }
  try {
    const { authorize_url } = createGoogleOAuthTicket(subject);
    res.json({ authorize_url });
  } catch (error) {
    res.status(503).json({
      error: 'integration_unavailable',
      details: error instanceof Error ? error.message : 'Google connect is unavailable.'
    });
  }
}

export async function handleGoogleCallback(req: Request, res: Response): Promise<void> {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const ticket = typeof req.query.state === 'string' ? req.query.state : '';
  const oauthError = typeof req.query.error === 'string' ? req.query.error : '';
  if (oauthError) {
    res.status(400).type('html').send(oauthCallbackHtml('google_workspace', false, 'Google authorization was cancelled.'));
    return;
  }
  if (!code || !ticket) {
    res.status(400).type('html').send(oauthCallbackHtml('google_workspace', false, 'Missing Google OAuth response.'));
    return;
  }
  try {
    const result = await completeGoogleOAuth(code, ticket);
    res.status(200).type('html').send(
      oauthCallbackHtml('google_workspace', true, `Connected ${result.email_masked}.`)
    );
  } catch (error) {
    res.status(400).type('html').send(
      oauthCallbackHtml('google_workspace', false, error instanceof Error ? error.message : 'Google connect failed.')
    );
  }
}

export async function handleMicrosoftConnect(req: Request, res: Response): Promise<void> {
  if (!isMicrosoft365Enabled() || !microsoftOAuthConfigured() || !integrationVaultKey()) {
    res.status(503).json({
      error: 'integration_unavailable',
      details: 'Microsoft 365 connect is not configured on this server.'
    });
    return;
  }
  const subject = integrationSubjectFromAuth(res.locals.workbenchAuth as IntegrationsAuthContext | undefined);
  if (!subject) {
    res.status(401).json({ error: 'unauthorized', details: 'Sign in before connecting Microsoft 365.' });
    return;
  }
  try {
    const { authorize_url } = createMicrosoftOAuthTicket(subject);
    res.json({ authorize_url });
  } catch (error) {
    res.status(503).json({
      error: 'integration_unavailable',
      details: error instanceof Error ? error.message : 'Microsoft connect is unavailable.'
    });
  }
}

export async function handleMicrosoftCallback(req: Request, res: Response): Promise<void> {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const ticket = typeof req.query.state === 'string' ? req.query.state : '';
  const oauthError = typeof req.query.error === 'string' ? req.query.error : '';
  if (oauthError) {
    res.status(400).type('html').send(oauthCallbackHtml('microsoft_365', false, 'Microsoft authorization was cancelled.'));
    return;
  }
  if (!code || !ticket) {
    res.status(400).type('html').send(oauthCallbackHtml('microsoft_365', false, 'Missing Microsoft OAuth response.'));
    return;
  }
  try {
    const result = await completeMicrosoftOAuth(code, ticket);
    res.status(200).type('html').send(
      oauthCallbackHtml('microsoft_365', true, `Connected ${result.email_masked}.`)
    );
  } catch (error) {
    res.status(400).type('html').send(
      oauthCallbackHtml('microsoft_365', false, error instanceof Error ? error.message : 'Microsoft connect failed.')
    );
  }
}

export async function handleMicrosoftDisconnect(req: Request, res: Response): Promise<void> {
  const subject = integrationSubjectFromAuth(res.locals.workbenchAuth as IntegrationsAuthContext | undefined);
  if (!subject) {
    res.status(401).json({ error: 'unauthorized', details: 'Sign in before disconnecting Microsoft 365.' });
    return;
  }
  await disconnectMicrosoft365(subject);
  res.json({ ok: true });
}

export async function handleGoogleDisconnect(req: Request, res: Response): Promise<void> {
  const subject = integrationSubjectFromAuth(res.locals.workbenchAuth as IntegrationsAuthContext | undefined);
  if (!subject) {
    res.status(401).json({ error: 'unauthorized', details: 'Sign in before disconnecting Google Workspace.' });
    return;
  }
  await disconnectGoogleWorkspace(subject);
  res.json({ ok: true });
}