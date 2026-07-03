import { motion } from 'motion/react';
import { Brain, GitBranch, Loader2, Search, Sparkles, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  addKnowledgeMemory,
  deleteKnowledgeMemory,
  fetchKnowledgeGraph,
  searchKnowledge,
  type KnowledgeGraph,
  type KnowledgeSearchHit
} from '../lib/knowledge';

type PersonalKnowledgePanelProps = {
  accountEnabled: boolean;
};

export function PersonalKnowledgePanel({ accountEnabled }: PersonalKnowledgePanelProps) {
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memoryDraft, setMemoryDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHits, setSearchHits] = useState<KnowledgeSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setGraph(await fetchKnowledgeGraph());
    } catch (refreshError) {
      setGraph(null);
      setError(refreshError instanceof Error ? refreshError.message : 'Personal knowledge unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleAddMemory() {
    const text = memoryDraft.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      await addKnowledgeMemory(text);
      setMemoryDraft('');
      await refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save memory.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteMemory(memoryId: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteKnowledgeMemory(memoryId);
      await refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete memory.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSearch() {
    const query = searchQuery.trim();
    if (!query) {
      setSearchHits([]);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      setSearchHits(await searchKnowledge(query, 8));
    } catch (searchError) {
      setSearchHits([]);
      setError(searchError instanceof Error ? searchError.message : 'Search failed.');
    } finally {
      setSearching(false);
    }
  }

  const cloudNodes = graph?.nodes.filter((node) => node.kind === 'cloud_file').slice(0, 8) ?? [];
  const memories = graph?.memories.slice(0, 8) ?? [];

  return (
    <section className="knowledge-panel" aria-label="Personal knowledge">
      <div className="knowledge-panel-head">
        <div className="knowledge-panel-title">
          <Brain size={18} aria-hidden="true" />
          <div>
            <strong>Personal knowledge</strong>
            <p>Encrypted graph of cloud files, memories, and thread links — reused automatically in future runs.</p>
          </div>
        </div>
        <span className="knowledge-pill">
          <GitBranch size={12} aria-hidden="true" />
          Subject-scoped vault
        </span>
      </div>

      {!accountEnabled ? (
        <p className="knowledge-hint">Sign in with Clerk to unlock personal knowledge and cross-thread memories.</p>
      ) : null}

      {error ? <p className="integration-card-error" role="alert">{error}</p> : null}

      {loading ? (
        <div className="knowledge-empty">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          <span>Loading knowledge graph…</span>
        </div>
      ) : null}

      {!loading && graph ? (
        <div className="knowledge-stats">
          <div><span>Cloud files</span><strong>{graph.stats.cloudFiles}</strong></div>
          <div><span>Memories</span><strong>{graph.stats.memories}</strong></div>
          <div><span>Threads</span><strong>{graph.stats.threads}</strong></div>
          <div><span>Artifacts</span><strong>{graph.stats.artifacts}</strong></div>
        </div>
      ) : null}

      <div className="knowledge-search">
        <Search size={15} aria-hidden="true" />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && void handleSearch()}
          placeholder="Deep search your knowledge graph…"
          aria-label="Search personal knowledge"
        />
        <button type="button" className="integration-btn ghost compact" onClick={() => void handleSearch()} disabled={searching}>
          {searching ? <Loader2 size={13} className="animate-spin" /> : 'Search'}
        </button>
      </div>

      {searchHits.length > 0 ? (
        <ul className="knowledge-hit-list">
          {searchHits.map((hit) => (
            <li key={`${hit.node.id}-${hit.score}`}>
              <div>
                <strong>{hit.node.title}</strong>
                <span>{hit.reason}</span>
              </div>
              {hit.node.nativeUrl ? (
                <a href={hit.node.nativeUrl} target="_blank" rel="noreferrer" className="knowledge-native-link">
                  Open native
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="knowledge-memory-compose">
        <Sparkles size={15} aria-hidden="true" />
        <textarea
          value={memoryDraft}
          onChange={(event) => setMemoryDraft(event.target.value)}
          placeholder="Save a durable memory — brand voice, client facts, recurring preferences…"
          rows={3}
          aria-label="New memory"
        />
        <button type="button" className="integration-btn primary compact" onClick={() => void handleAddMemory()} disabled={busy || !memoryDraft.trim()}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : 'Save memory'}
        </button>
      </div>

      {memories.length > 0 ? (
        <motion.div className="knowledge-section" layout>
          <h4>Memories</h4>
          <ul className="knowledge-memory-list">
            {memories.map((memory) => (
              <li key={memory.id}>
                <p>{memory.text}</p>
                <button type="button" className="quiet-icon" onClick={() => void handleDeleteMemory(memory.id)} disabled={busy} aria-label="Delete memory">
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </motion.div>
      ) : null}

      {cloudNodes.length > 0 ? (
        <motion.div className="knowledge-section" layout>
          <h4>Imported cloud files</h4>
          <ul className="knowledge-node-list">
            {cloudNodes.map((node) => (
              <li key={node.id}>
                <div>
                  <strong>{node.title}</strong>
                  <span>{node.provider === 'microsoft_365' ? 'Microsoft 365' : 'Google Workspace'}</span>
                </div>
                {node.nativeUrl ? (
                  <a href={node.nativeUrl} target="_blank" rel="noreferrer" className="knowledge-native-link">
                    Continue in native app
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </motion.div>
      ) : null}
    </section>
  );
}