import { CloudUpload, ExternalLink, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { exportFormatsForArtifact, primaryExportFormat } from '../lib/downloads';
import type { ArtifactDocument, ArtifactExportFormat } from '../lib/shared';
import { saveArtifactToCloud, type CloudExportResult } from '../lib/cloudExport';
import {
  fetchIntegrationsStatus,
  type IntegrationProvider,
  type IntegrationsStatus
} from '../lib/integrations';

type CloudSaveActionsProps = {
  artifact: ArtifactDocument;
  disabled?: boolean;
};

export function CloudSaveActions({ artifact, disabled = false }: CloudSaveActionsProps) {
  const formats = useMemo(() => exportFormatsForArtifact(artifact), [artifact]);
  const [format, setFormat] = useState<ArtifactExportFormat>(() => primaryExportFormat(artifact));
  const [status, setStatus] = useState<IntegrationsStatus | null>(null);
  const [busyProvider, setBusyProvider] = useState<IntegrationProvider | null>(null);
  const [lastSave, setLastSave] = useState<CloudExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFormat(primaryExportFormat(artifact));
  }, [artifact]);

  const refresh = useCallback(async () => {
    try {
      setStatus(await fetchIntegrationsStatus());
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleSave(provider: IntegrationProvider) {
    setBusyProvider(provider);
    setError(null);
    setLastSave(null);
    try {
      const result = await saveArtifactToCloud(provider, artifact, format);
      setLastSave(result);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Cloud save failed.');
    } finally {
      setBusyProvider(null);
    }
  }

  const google = status?.google_workspace;
  const microsoft = status?.microsoft_365;
  const showGoogle = Boolean(google?.enabled && google?.connected);
  const showMicrosoft = Boolean(microsoft?.enabled && microsoft?.connected);
  if (!showGoogle && !showMicrosoft) return null;

  const saveLabel = lastSave
    ? `${lastSave.filename} saved to ${lastSave.provider === 'microsoft_365' ? 'OneDrive' : 'Google Drive'}`
    : null;

  return (
    <div className="cloud-save-actions">
      <div className="cloud-save-head">
        <CloudUpload size={14} aria-hidden="true" />
        <span>Save to cloud</span>
        {formats.length > 1 ? (
          <select
            className="cloud-save-format"
            value={format}
            onChange={(event) => setFormat(event.target.value as ArtifactExportFormat)}
            disabled={busyProvider !== null || disabled}
            aria-label="Cloud save format"
          >
            {formats.map((entry) => (
              <option key={entry} value={entry}>{entry.toUpperCase()}</option>
            ))}
          </select>
        ) : (
          <small>{format.toUpperCase()}</small>
        )}
      </div>
      <div className="cloud-save-buttons">
        {showGoogle ? (
          <button
            type="button"
            className="cloud-save-btn google"
            disabled={disabled || busyProvider !== null}
            onClick={() => void handleSave('google_workspace')}
            title={google?.export_capable ? 'Upload to Google Drive' : 'Reconnect Google to enable Drive save'}
          >
            {busyProvider === 'google_workspace' ? <Loader2 size={13} className="animate-spin" /> : <span className="cloud-save-mark">G</span>}
            Drive
            {!google?.export_capable ? <small>reconnect</small> : null}
          </button>
        ) : null}
        {showMicrosoft ? (
          <button
            type="button"
            className="cloud-save-btn microsoft"
            disabled={disabled || busyProvider !== null}
            onClick={() => void handleSave('microsoft_365')}
            title={microsoft?.export_capable ? 'Upload to OneDrive' : 'Reconnect Microsoft to enable OneDrive save'}
          >
            {busyProvider === 'microsoft_365' ? <Loader2 size={13} className="animate-spin" /> : <span className="cloud-save-mark">M</span>}
            OneDrive
            {!microsoft?.export_capable ? <small>reconnect</small> : null}
          </button>
        ) : null}
      </div>
      {saveLabel && lastSave ? (
        <p className="cloud-save-notice">
          {saveLabel}
          {lastSave.nativeUrl ? (
            <a href={lastSave.nativeUrl} target="_blank" rel="noreferrer" className="cloud-save-open">
              <ExternalLink size={12} aria-hidden="true" />
              Open in native app
            </a>
          ) : null}
        </p>
      ) : null}
      {error ? <p className="integration-card-error" role="alert">{error}</p> : null}
    </div>
  );
}