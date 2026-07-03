import { workbenchFetch } from './account';

export type IntegrationConnectionStatus = {
  enabled: boolean;
  configured: boolean;
  connected: boolean;
  email_masked?: string;
  scopes?: string[];
  connected_at?: string;
  export_capable?: boolean;
};

export type IntegrationsStatus = {
  google_workspace: IntegrationConnectionStatus;
  microsoft_365: IntegrationConnectionStatus;
};

export type IntegrationProvider = 'google_workspace' | 'microsoft_365';

export async function fetchIntegrationsStatus(): Promise<IntegrationsStatus> {
  const response = await workbenchFetch('/api/integrations/status');
  const payload = await response.json().catch(() => ({})) as IntegrationsStatus & { details?: string };
  if (!response.ok) {
    throw new Error(payload.details || 'Could not load integration status.');
  }
  if (!payload.google_workspace || !payload.microsoft_365) {
    throw new Error('Workbench API returned an unexpected response. Check that the API server is running.');
  }
  return payload;
}

export async function startIntegrationConnect(provider: IntegrationProvider): Promise<{ authorize_url: string }> {
  const path = provider === 'microsoft_365'
    ? '/api/integrations/microsoft/connect'
    : '/api/integrations/google/connect';
  const response = await workbenchFetch(path, { method: 'POST' });
  const payload = await response.json().catch(() => ({})) as {
    authorize_url?: string;
    details?: string;
  };
  if (!response.ok || !payload.authorize_url) {
    throw new Error(payload.details || 'Connect is unavailable on this server.');
  }
  return { authorize_url: payload.authorize_url };
}

export async function disconnectIntegration(provider: IntegrationProvider): Promise<void> {
  const path = provider === 'microsoft_365'
    ? '/api/integrations/microsoft'
    : '/api/integrations/google';
  const response = await workbenchFetch(path, { method: 'DELETE' });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { details?: string };
    throw new Error(payload.details || 'Could not disconnect.');
  }
}

export function listenForIntegrationOAuthPopup(
  onComplete: (provider: IntegrationProvider, success: boolean, message: string) => void
): () => void {
  const handler = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    const data = event.data as {
      type?: string;
      provider?: IntegrationProvider;
      success?: boolean;
      message?: string;
    };
    if (data?.type !== 'delegators:integration-oauth') return;
    if (data.provider !== 'google_workspace' && data.provider !== 'microsoft_365') return;
    onComplete(data.provider, Boolean(data.success), typeof data.message === 'string' ? data.message : '');
  };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}

/** @deprecated use startIntegrationConnect('google_workspace') */
export async function startGoogleWorkspaceConnect(): Promise<{ authorize_url: string }> {
  return startIntegrationConnect('google_workspace');
}

/** @deprecated use disconnectIntegration('google_workspace') */
export async function disconnectGoogleWorkspace(): Promise<void> {
  return disconnectIntegration('google_workspace');
}

/** @deprecated use listenForIntegrationOAuthPopup */
export function listenForGoogleOAuthPopup(onComplete: (success: boolean, message: string) => void): () => void {
  return listenForIntegrationOAuthPopup((_provider, success, message) => onComplete(success, message));
}