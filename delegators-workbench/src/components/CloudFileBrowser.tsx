import { ExternalLink, FileText, FolderOpen, Loader2, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  browseCloudFiles,
  importCloudFile,
  type CloudBrowseItem
} from '../lib/knowledge';
import type { IntegrationProvider } from '../lib/integrations';

type CloudFileBrowserProps = {
  provider: IntegrationProvider;
  connected: boolean;
  onImported?: (nodeTitle: string) => void;
};

export function CloudFileBrowser({ provider, connected, onImported }: CloudFileBrowserProps) {
  const [items, setItems] = useState<CloudBrowseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!connected) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setItems(await browseCloudFiles(provider));
    } catch (browseError) {
      setError(browseError instanceof Error ? browseError.message : 'Could not load files.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [connected, provider]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleImport(item: CloudBrowseItem) {
    setBusyId(item.id);
    setError(null);
    setNotice(null);
    try {
      const node = await importCloudFile(item);
      setNotice(`Imported “${node.title}” into personal knowledge.`);
      onImported?.(node.title);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Import failed.');
    } finally {
      setBusyId(null);
    }
  }

  if (!connected) return null;

  const providerLabel = provider === 'microsoft_365' ? 'OneDrive' : 'Google Drive';

  return (
    <div className="cloud-file-browser">
      <div className="cloud-file-browser-head">
        <FolderOpen size={15} aria-hidden="true" />
        <div>
          <strong>{providerLabel} browser</strong>
          <span>Import live files into your encrypted personal knowledge graph.</span>
        </div>
        <button type="button" className="integration-btn ghost compact" onClick={() => void refresh()} disabled={loading}>
          {loading ? <Loader2 size={13} className="animate-spin" /> : 'Refresh'}
        </button>
      </div>

      {notice ? <p className="integration-card-notice">{notice}</p> : null}
      {error ? <p className="integration-card-error" role="alert">{error}</p> : null}

      {loading ? (
        <div className="cloud-file-browser-empty">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          <span>Loading recent files…</span>
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="cloud-file-browser-empty">
          <FileText size={16} aria-hidden="true" />
          <span>No recent files found in {providerLabel}.</span>
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <ul className="cloud-file-list">
          {items.map((item) => {
            const busy = busyId === item.id;
            return (
              <li key={item.id}>
                <div className="cloud-file-meta">
                  <strong>{item.name}</strong>
                  <span>{item.mimeType?.split('/').pop() ?? 'file'}{item.modifiedAt ? ` · ${formatRelative(item.modifiedAt)}` : ''}</span>
                </div>
                <div className="cloud-file-actions">
                  {item.nativeUrl ? (
                    <a href={item.nativeUrl} target="_blank" rel="noreferrer" className="integration-btn ghost compact" title="Continue in native app">
                      <ExternalLink size={13} aria-hidden="true" />
                      Native
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="integration-btn primary compact"
                    onClick={() => void handleImport(item)}
                    disabled={busy}
                    title="Import into personal knowledge for future runs"
                  >
                    {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} aria-hidden="true" />}
                    Import
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const delta = Date.now() - date.getTime();
  const days = Math.floor(delta / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}