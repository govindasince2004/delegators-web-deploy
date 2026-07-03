import { workbenchFetch } from './account';

export type KnowledgeNodeKind = 'cloud_file' | 'memory' | 'thread' | 'artifact';

export type KnowledgeNode = {
  id: string;
  kind: KnowledgeNodeKind;
  title: string;
  provider?: 'google_workspace' | 'microsoft_365';
  nativeUrl?: string;
  webUrl?: string;
  mimeType?: string;
  snippet?: string;
  externalId?: string;
  threadId?: string;
  artifactTitle?: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  tags?: string[];
};

export type KnowledgeEdge = {
  id: string;
  from: string;
  to: string;
  relation: 'imported_from' | 'cited_in' | 'related_to' | 'thread_of';
  createdAt: string;
};

export type KnowledgeMemory = {
  id: string;
  text: string;
  sourceNodeId?: string;
  createdAt: string;
  tags?: string[];
};

export type KnowledgeGraph = {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  memories: KnowledgeMemory[];
  stats: {
    cloudFiles: number;
    memories: number;
    threads: number;
    artifacts: number;
  };
};

export type CloudBrowseItem = {
  id: string;
  name: string;
  mimeType?: string;
  modifiedAt?: string;
  size?: number;
  nativeUrl?: string;
  webUrl?: string;
  provider: 'google_workspace' | 'microsoft_365';
};

export type KnowledgeSearchHit = {
  node: KnowledgeNode;
  score: number;
  reason: string;
};

export async function fetchKnowledgeGraph(): Promise<KnowledgeGraph> {
  const response = await workbenchFetch('/api/knowledge/graph');
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { details?: string };
    throw new Error(payload.details || 'Could not load personal knowledge.');
  }
  return response.json() as Promise<KnowledgeGraph>;
}

export async function searchKnowledge(query: string, limit = 8): Promise<KnowledgeSearchHit[]> {
  const response = await workbenchFetch('/api/knowledge/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit })
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { details?: string };
    throw new Error(payload.details || 'Knowledge search failed.');
  }
  const payload = await response.json() as { hits?: KnowledgeSearchHit[] };
  return payload.hits ?? [];
}

export async function browseCloudFiles(
  provider: 'google_workspace' | 'microsoft_365'
): Promise<CloudBrowseItem[]> {
  const response = await workbenchFetch(`/api/knowledge/browse?provider=${provider}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { details?: string };
    throw new Error(payload.details || 'Could not browse cloud files.');
  }
  const payload = await response.json() as { items?: CloudBrowseItem[] };
  return payload.items ?? [];
}

export async function importCloudFile(item: CloudBrowseItem): Promise<KnowledgeNode> {
  const response = await workbenchFetch('/api/knowledge/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: item.provider,
      externalId: item.id,
      name: item.name,
      mimeType: item.mimeType,
      nativeUrl: item.nativeUrl,
      webUrl: item.webUrl
    })
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { details?: string };
    throw new Error(payload.details || 'Import failed.');
  }
  const payload = await response.json() as { node?: KnowledgeNode };
  if (!payload.node) throw new Error('Import returned no node.');
  return payload.node;
}

export async function addKnowledgeMemory(text: string, tags?: string[]): Promise<KnowledgeMemory> {
  const response = await workbenchFetch('/api/knowledge/memories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, tags })
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { details?: string };
    throw new Error(payload.details || 'Could not save memory.');
  }
  const payload = await response.json() as { memory?: KnowledgeMemory };
  if (!payload.memory) throw new Error('Memory save returned no memory.');
  return payload.memory;
}

export async function deleteKnowledgeMemory(memoryId: string): Promise<void> {
  const response = await workbenchFetch(`/api/knowledge/memories/${encodeURIComponent(memoryId)}`, {
    method: 'DELETE'
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { details?: string };
    throw new Error(payload.details || 'Could not delete memory.');
  }
}