import { motion } from 'motion/react';
import { CheckCircle2, ExternalLink, Loader2, Lock, ShieldCheck, Unplug } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { readResolvedCredentials } from '../lib/account';
import {
  disconnectIntegration,
  fetchIntegrationsStatus,
  listenForIntegrationOAuthPopup,
  startIntegrationConnect,
  type IntegrationConnectionStatus,
  type IntegrationProvider,
  type IntegrationsStatus
} from '../lib/integrations';
import { CloudFileBrowser } from './CloudFileBrowser';

type IntegrationsPanelProps = {
  accountEnabled: boolean;
};

type IntegrationCardConfig = {
  provider: IntegrationProvider;
  markClass: string;
  markLabel: string;
  title: string;
  description: string;
  enabledEnv: string;
};

const INTEGRATION_CARDS: IntegrationCardConfig[] = [
  {
    provider: 'google_workspace',
    markClass: 'integration-google-mark',
    markLabel: 'G',
    title: 'Google Workspace',
    description: 'Browse Drive, save exports back, import into personal knowledge, and open in Google Docs/Sheets.',
    enabledEnv: 'WORKBENCH_GOOGLE_WORKSPACE_ENABLED'
  },
  {
    provider: 'microsoft_365',
    markClass: 'integration-microsoft-mark',
    markLabel: 'M',
    title: 'Microsoft 365',
    description: 'Browse OneDrive, save exports to Delegators folder, import into knowledge, open in Office Online.',
    enabledEnv: 'WORKBENCH_MICROSOFT_365_ENABLED'
  }
];

export function IntegrationsPanel({ accountEnabled }: IntegrationsPanelProps) {
  const [status, setStatus] = useState<IntegrationsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyProvider, setBusyProvider] = useState<IntegrationProvider | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStatus(await fetchIntegrationsStatus());
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Could not load integrations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    return listenForIntegrationOAuthPopup((provider, success, message) => {
      setNotice(message);
      setBusyProvider(null);
      void refresh();
      if (!success) setError(message);
      if (success) setError(null);
    });
  }, [refresh]);

  const hasSession = Boolean(readResolvedCredentials().sessionKey);
  const canAuth = accountEnabled || hasSession;

  function readStatus(provider: IntegrationProvider): IntegrationConnectionStatus | undefined {
    return provider === 'microsoft_365' ? status?.microsoft_365 : status?.google_workspace;
  }

  async function handleConnect(provider: IntegrationProvider) {
    setBusyProvider(provider);
    setError(null);
    setNotice(null);
    try {
      const { authorize_url } = await startIntegrationConnect(provider);
      const popupName = provider === 'microsoft_365' ? 'delegators-microsoft-oauth' : 'delegators-google-oauth';
      const popup = window.open(authorize_url, popupName, 'width=520,height=720,noopener');
      if (!popup) throw new Error('Allow pop-ups for Workbench to finish authorization.');
    } catch (connectError) {
      setBusyProvider(null);
      setError(connectError instanceof Error ? connectError.message : 'Connect failed.');
    }
  }

  async function handleDisconnect(provider: IntegrationProvider) {
    setBusyProvider(provider);
    setError(null);
    setNotice(null);
    try {
      await disconnectIntegration(provider);
      setNotice(provider === 'microsoft_365' ? 'Microsoft 365 disconnected.' : 'Google Workspace disconnected.');
      await refresh();
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : 'Disconnect failed.');
    } finally {
      setBusyProvider(null);
    }
  }

  return (
    <section className="integrations-panel" aria-label="Connected services">
      <div className="integrations-panel-head">
        <div className="integrations-panel-title">
          <ShieldCheck size={18} aria-hidden="true" />
          <div>
            <strong>Connected services</strong>
            <p>OAuth tokens stay on the server, encrypted at rest. Nothing sensitive is stored in the browser.</p>
          </div>
        </div>
        <span className="integrations-secure-pill">
          <Lock size={12} aria-hidden="true" />
          AES-256-GCM vault
        </span>
      </div>

      {notice ? <p className="integration-card-notice">{notice}</p> : null}
      {error ? <p className="integration-card-error" role="alert">{error}</p> : null}

      {INTEGRATION_CARDS.map((card, index) => {
        const integration = readStatus(card.provider);
        const busy = busyProvider === card.provider;
        const canConnect = Boolean(canAuth && integration?.enabled && integration?.configured);
        return (
          <motion.article
            key={card.provider}
            className="integration-card"
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: index * 0.05 }}
          >
            <div className="integration-card-brand">
              <div className={card.markClass} aria-hidden="true">{card.markLabel}</div>
              <div>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
              </div>
            </div>

            {loading ? (
              <div className="integration-card-state">
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                <span>Checking connection…</span>
              </div>
            ) : null}

            {!loading && integration?.connected ? (
              <div className="integration-card-connected">
                <CheckCircle2 size={16} aria-hidden="true" />
                <div>
                  <strong>{integration.email_masked ?? 'Connected account'}</strong>
                  <span>
                    {integration.export_capable ? 'Read + save beta' : 'Read-only — reconnect for cloud save'}
                    {' · server-held credentials'}
                  </span>
                </div>
              </div>
            ) : null}

            {!loading && !integration?.enabled ? (
              <p className="integration-card-hint">Enable `{card.enabledEnv}` on the server to offer this connect path.</p>
            ) : null}

            {!loading && integration?.enabled && !integration?.configured ? (
              <p className="integration-card-hint">Server OAuth is not configured yet. Operators add client ID, secret, and vault key in env.</p>
            ) : null}

            <div className="integration-card-actions">
              {integration?.connected ? (
                <button type="button" className="integration-btn ghost" onClick={() => void handleDisconnect(card.provider)} disabled={busy}>
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Unplug size={14} aria-hidden="true" />}
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  className="integration-btn primary"
                  onClick={() => void handleConnect(card.provider)}
                  disabled={busy || !canConnect}
                  title={!canAuth ? 'Sign in or add a session key first' : undefined}
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} aria-hidden="true" />}
                  Connect {card.provider === 'microsoft_365' ? 'Microsoft' : 'Google'}
                </button>
              )}
            </div>

            {integration?.connected ? (
              <CloudFileBrowser provider={card.provider} connected />
            ) : null}
          </motion.article>
        );
      })}
    </section>
  );
}