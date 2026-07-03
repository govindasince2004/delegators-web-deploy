import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { WorkbenchReferenceInput } from '../src/lib/shared.js';
import {
  decryptJson,
  encryptJson,
  integrationVaultKey,
  readGoogleWorkspaceRecord,
  readMicrosoft365Record,
  type IntegrationProvider
} from './integrationVault.js';
import { runGoogleWorkspaceCommand } from './googleWorkspace.js';
import { isGoogleWorkspaceEnabled } from './googleWorkspace.js';
import { resolveMicrosoftAccessToken } from './microsoftOAuth.js';
import { isMicrosoft365Enabled } from './microsoftGraph.js';


export type KnowledgeNodeKind = 'cloud_file' | 'memory' | 'thread' | 'artifact';

export type KnowledgeNode = {
  id: string;
  kind: KnowledgeNodeKind;
  title: string;
  provider?: IntegrationProvider;
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

export type PersonalKnowledgeStore = {
  version: 1;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  memories: KnowledgeMemory[];
  updatedAt: string;
};

export type KnowledgeGraphResponse = {
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
  provider: IntegrationProvider;
};

export type KnowledgeSearchHit = {
  node: KnowledgeNode;
  score: number;
  reason: string;
};

const MAX_NODES = 200;
const MAX_MEMORIES = 100;
const MAX_EDGES = 400;
const MAX_SNIPPET_CHARS = 12_000;

function knowledgeRoot(env: NodeJS.ProcessEnv = process.env): string {
  return env.WORKBENCH_PERSONAL_KNOWLEDGE_ROOT?.trim()
    || path.join(env.WORKBENCH_INTEGRATION_VAULT_ROOT?.trim() || path.join(process.cwd(), '.data', 'integration-vault'), 'personal-knowledge');
}

function knowledgeBlobPath(subject: string, env: NodeJS.ProcessEnv = process.env): string {
  const digest = createHash('sha256').update(subject).digest('hex');
  return path.join(knowledgeRoot(env), `${digest}.enc`);
}

export function personalKnowledgeAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
  return integrationVaultKey(env) !== null;
}

function emptyStore(): PersonalKnowledgeStore {
  const now = new Date().toISOString();
  return { version: 1, nodes: [], edges: [], memories: [], updatedAt: now };
}

export async function readPersonalKnowledgeStore(
  subject: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<PersonalKnowledgeStore> {
  if (!subject.trim() || !personalKnowledgeAvailable(env)) return emptyStore();
  const filePath = knowledgeBlobPath(subject, env);
  try {
    const raw = await readFile(filePath, 'utf8');
    const trimmed = raw.trim();
    if (!trimmed) return emptyStore();
    const store = await decryptJson<PersonalKnowledgeStore>(trimmed, env);
    if (store?.version !== 1 || !Array.isArray(store.nodes)) return emptyStore();
    return {
      version: 1,
      nodes: store.nodes.slice(0, MAX_NODES),
      edges: (store.edges ?? []).slice(0, MAX_EDGES),
      memories: (store.memories ?? []).slice(0, MAX_MEMORIES),
      updatedAt: store.updatedAt || new Date().toISOString()
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyStore();
    throw error;
  }
}

export async function writePersonalKnowledgeStore(
  subject: string,
  store: PersonalKnowledgeStore,
  env: NodeJS.ProcessEnv = process.env
): Promise<void> {
  if (!subject.trim() || !personalKnowledgeAvailable(env)) {
    throw new Error('Personal knowledge vault is not configured.');
  }
  const filePath = knowledgeBlobPath(subject, env);
  await mkdir(path.dirname(filePath), { recursive: true });
  const payload: PersonalKnowledgeStore = {
    version: 1,
    nodes: store.nodes.slice(0, MAX_NODES),
    edges: store.edges.slice(0, MAX_EDGES),
    memories: store.memories.slice(0, MAX_MEMORIES),
    updatedAt: new Date().toISOString()
  };
  const encrypted = await encryptJson(payload, env);
  await writeFile(filePath, `${encrypted}\n`, { encoding: 'utf8', mode: 0o600 });
}

export function knowledgeGraphResponse(store: PersonalKnowledgeStore): KnowledgeGraphResponse {
  return {
    nodes: store.nodes,
    edges: store.edges,
    memories: store.memories,
    stats: {
      cloudFiles: store.nodes.filter((node) => node.kind === 'cloud_file').length,
      memories: store.memories.length,
      threads: store.nodes.filter((node) => node.kind === 'thread').length,
      artifacts: store.nodes.filter((node) => node.kind === 'artifact').length
    }
  };
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function googleNativeUrl(fileId: string, mimeType?: string): string {
  const mime = (mimeType ?? '').toLowerCase();
  if (mime.includes('document')) return `https://docs.google.com/document/d/${fileId}/edit`;
  if (mime.includes('spreadsheet')) return `https://docs.google.com/spreadsheets/d/${fileId}/edit`;
  if (mime.includes('presentation')) return `https://docs.google.com/presentation/d/${fileId}/edit`;
  return `https://drive.google.com/file/d/${fileId}/view`;
}

export function microsoftNativeUrl(webUrl?: string, itemId?: string): string | undefined {
  if (webUrl?.trim()) return webUrl.trim();
  if (itemId?.trim()) return `https://onedrive.live.com/?id=${encodeURIComponent(itemId.trim())}`;
  return undefined;
}

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3)
    .slice(0, 24);
}

export function searchKnowledgeStore(
  store: PersonalKnowledgeStore,
  query: string,
  limit = 8
): KnowledgeSearchHit[] {
  const tokens = tokenizeQuery(query);
  if (!tokens.length) return [];

  const hits: KnowledgeSearchHit[] = [];
  for (const node of store.nodes) {
    const haystack = [node.title, node.snippet ?? '', ...(node.tags ?? [])].join(' ').toLowerCase();
    let score = 0;
    const matched: string[] = [];
    for (const token of tokens) {
      if (haystack.includes(token)) {
        score += token.length >= 6 ? 3 : 2;
        matched.push(token);
      }
    }
    if (score > 0) {
      hits.push({
        node,
        score,
        reason: matched.length ? `Matched: ${matched.slice(0, 4).join(', ')}` : 'Related'
      });
    }
  }

  for (const memory of store.memories) {
    const haystack = [memory.text, ...(memory.tags ?? [])].join(' ').toLowerCase();
    let score = 0;
    const matched: string[] = [];
    for (const token of tokens) {
      if (haystack.includes(token)) {
        score += 2;
        matched.push(token);
      }
    }
    if (score > 0) {
      const linked = memory.sourceNodeId
        ? store.nodes.find((node) => node.id === memory.sourceNodeId)
        : undefined;
      hits.push({
        node: linked ?? {
          id: memory.id,
          kind: 'memory',
          title: memory.text.slice(0, 80),
          snippet: memory.text,
          createdAt: memory.createdAt,
          updatedAt: memory.createdAt
        },
        score: score + 1,
        reason: `Memory · ${matched.slice(0, 3).join(', ')}`
      });
    }
  }

  return hits
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

function parseGwsJson(stdout: string): Record<string, unknown> | null {
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

function compactSnippet(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_SNIPPET_CHARS);
}

export async function browseCloudFiles(
  subject: string,
  provider: IntegrationProvider,
  env: NodeJS.ProcessEnv = process.env
): Promise<CloudBrowseItem[]> {
  if (provider === 'google_workspace') {
    if (!isGoogleWorkspaceEnabled(env)) return [];
    const record = await readGoogleWorkspaceRecord(subject, env);
    if (!record) return [];
    const result = await runGoogleWorkspaceCommand({
      request: {
        command: ['drive', 'files', 'list'],
        params: {
          pageSize: 24,
          orderBy: 'modifiedTime desc',
          fields: 'files(id,name,mimeType,webViewLink,modifiedTime,size)'
        }
      },
      ownerSubject: subject,
      env
    });
    if (!result.ok) return [];
    const payload = parseGwsJson(result.stdout);
    const files = Array.isArray(payload?.files) ? payload.files : [];
    return files
      .filter((file): file is Record<string, unknown> => Boolean(file && typeof file === 'object'))
      .map((file) => {
        const id = typeof file.id === 'string' ? file.id : '';
        const name = typeof file.name === 'string' ? file.name : 'Untitled';
        const mimeType = typeof file.mimeType === 'string' ? file.mimeType : undefined;
        const webViewLink = typeof file.webViewLink === 'string' ? file.webViewLink : undefined;
        return {
          id,
          name,
          mimeType,
          modifiedAt: typeof file.modifiedTime === 'string' ? file.modifiedTime : undefined,
          size: typeof file.size === 'string' ? Number.parseInt(file.size, 10) : undefined,
          nativeUrl: id ? googleNativeUrl(id, mimeType) : undefined,
          webUrl: webViewLink,
          provider
        };
      })
      .filter((item) => item.id);
  }

  if (!isMicrosoft365Enabled(env)) return [];
  const record = await readMicrosoft365Record(subject, env);
  if (!record) return [];
  const token = await resolveMicrosoftAccessToken(subject, env);
  if (!token) return [];
  const url = new URL('https://graph.microsoft.com/v1.0/me/drive/root/children');
  url.searchParams.set('$top', '24');
  url.searchParams.set('$select', 'id,name,file,size,webUrl,lastModifiedDateTime');
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) return [];
  const payload = (await response.json()) as { value?: Array<Record<string, unknown>> };
  return (payload.value ?? [])
    .map((item) => {
      const id = typeof item.id === 'string' ? item.id : '';
      const name = typeof item.name === 'string' ? item.name : 'Untitled';
      const webUrl = typeof item.webUrl === 'string' ? item.webUrl : undefined;
      const fileMeta = item.file && typeof item.file === 'object'
        ? item.file as Record<string, unknown>
        : undefined;
      const mimeType = typeof fileMeta?.mimeType === 'string' ? fileMeta.mimeType : undefined;
      return {
        id,
        name,
        mimeType,
        modifiedAt: typeof item.lastModifiedDateTime === 'string' ? item.lastModifiedDateTime : undefined,
        size: typeof item.size === 'number' ? item.size : undefined,
        nativeUrl: microsoftNativeUrl(webUrl, id),
        webUrl,
        provider
      };
    })
    .filter((item) => item.id);
}

async function extractGoogleFileText(
  subject: string,
  fileId: string,
  mimeType: string | undefined,
  env: NodeJS.ProcessEnv
): Promise<string> {
  const mime = (mimeType ?? '').toLowerCase();
  if (mime.includes('document')) {
    const result = await runGoogleWorkspaceCommand({
      request: { command: ['docs', 'documents', 'get'], params: { documentId: fileId } },
      ownerSubject: subject,
      env
    });
    if (!result.ok) return '';
    const doc = parseGwsJson(result.stdout);
    const body = doc?.body as Record<string, unknown> | undefined;
    const content = Array.isArray(body?.content) ? body.content : [];
    return compactSnippet(extractGoogleDocsPlainText(content));
  }
  if (mime.includes('spreadsheet')) {
    const result = await runGoogleWorkspaceCommand({
      request: {
        command: ['sheets', 'spreadsheets', 'values', 'get'],
        params: { spreadsheetId: fileId, range: 'A1:Z200' }
      },
      ownerSubject: subject,
      env
    });
    if (!result.ok) return '';
    const sheet = parseGwsJson(result.stdout);
    const values = Array.isArray(sheet?.values) ? sheet.values : [];
    return compactSnippet(
      values
        .filter((row): row is unknown[] => Array.isArray(row))
        .map((row) => row.map((cell) => String(cell ?? '')).join('\t'))
        .join('\n')
    );
  }
  const meta = await runGoogleWorkspaceCommand({
    request: { command: ['drive', 'files', 'get'], params: { fileId, fields: 'name,description,webViewLink' } },
    ownerSubject: subject,
    env
  });
  if (!meta.ok) return '';
  const file = parseGwsJson(meta.stdout);
  const description = typeof file?.description === 'string' ? file.description : '';
  const name = typeof file?.name === 'string' ? file.name : '';
  return compactSnippet([name, description].filter(Boolean).join('\n'));
}

function extractGoogleDocsPlainText(content: unknown[]): string {
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== 'object') continue;
    const paragraph = (block as Record<string, unknown>).paragraph as Record<string, unknown> | undefined;
    const elements = Array.isArray(paragraph?.elements) ? paragraph.elements : [];
    for (const element of elements) {
      if (!element || typeof element !== 'object') continue;
      const textRun = (element as Record<string, unknown>).textRun as Record<string, unknown> | undefined;
      const content = typeof textRun?.content === 'string' ? textRun.content : '';
      if (content.trim()) parts.push(content);
    }
  }
  return parts.join('');
}

async function extractMicrosoftFileText(
  subject: string,
  itemId: string,
  mimeType: string | undefined,
  env: NodeJS.ProcessEnv
): Promise<string> {
  const token = await resolveMicrosoftAccessToken(subject, env);
  if (!token) return '';
  const metaUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(itemId)}?$select=id,name,file,webUrl`;
  const metaResponse = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000)
  });
  if (!metaResponse.ok) return '';
  const meta = (await metaResponse.json()) as Record<string, unknown>;
  const name = typeof meta.name === 'string' ? meta.name : '';
  const mime = mimeType
    || (meta.file && typeof meta.file === 'object'
      ? (meta.file as Record<string, unknown>).mimeType
      : undefined);
  const normalizedMime = typeof mime === 'string' ? mime.toLowerCase() : '';
  if (!normalizedMime.startsWith('text/') && !normalizedMime.includes('json') && !normalizedMime.includes('csv')) {
    return compactSnippet(name);
  }
  const contentUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(itemId)}/content`;
  const contentResponse = await fetch(contentUrl, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000)
  });
  if (!contentResponse.ok) return compactSnippet(name);
  const text = await contentResponse.text();
  return compactSnippet([name, text].filter(Boolean).join('\n\n'));
}

export async function importCloudFileToKnowledge(options: {
  subject: string;
  provider: IntegrationProvider;
  externalId: string;
  name?: string;
  mimeType?: string;
  nativeUrl?: string;
  webUrl?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<{ node: KnowledgeNode; reference: WorkbenchReferenceInput; store: PersonalKnowledgeStore }> {
  const env = options.env ?? process.env;
  const store = await readPersonalKnowledgeStore(options.subject, env);
  const existing = store.nodes.find(
    (node) => node.kind === 'cloud_file'
      && node.provider === options.provider
      && node.externalId === options.externalId
  );
  if (existing?.snippet) {
    return {
      node: existing,
      reference: cloudNodeToReference(existing),
      store
    };
  }

  const text = options.provider === 'google_workspace'
    ? await extractGoogleFileText(options.subject, options.externalId, options.mimeType, env)
    : await extractMicrosoftFileText(options.subject, options.externalId, options.mimeType, env);

  const now = new Date().toISOString();
  const node: KnowledgeNode = existing ?? {
    id: newId('kn'),
    kind: 'cloud_file',
    title: options.name?.trim() || 'Cloud file',
    provider: options.provider,
    nativeUrl: options.nativeUrl
      || (options.provider === 'google_workspace'
        ? googleNativeUrl(options.externalId, options.mimeType)
        : microsoftNativeUrl(options.webUrl, options.externalId)),
    webUrl: options.webUrl,
    mimeType: options.mimeType,
    externalId: options.externalId,
    createdAt: now,
    updatedAt: now
  };
  node.snippet = text || node.title;
  node.updatedAt = now;
  node.lastUsedAt = now;

  if (existing) {
    store.nodes = store.nodes.map((entry) => (entry.id === existing.id ? node : entry));
  } else {
    store.nodes = [node, ...store.nodes].slice(0, MAX_NODES);
  }

  await writePersonalKnowledgeStore(options.subject, store, env);
  return { node, reference: cloudNodeToReference(node), store };
}

export function cloudNodeToReference(node: KnowledgeNode): WorkbenchReferenceInput {
  return {
    id: node.id,
    kind: 'text',
    name: node.title,
    mimeType: node.mimeType || 'text/plain',
    text: [
      `# ${node.title}`,
      node.provider ? `Source: ${node.provider === 'google_workspace' ? 'Google Workspace' : 'Microsoft 365'}` : '',
      node.nativeUrl ? `Open in native app: ${node.nativeUrl}` : '',
      '',
      node.snippet ?? ''
    ].filter((line, index, lines) => index > 0 || line.length > 0).join('\n')
  };
}

export async function addKnowledgeMemory(
  subject: string,
  text: string,
  tags?: string[],
  sourceNodeId?: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<{ memory: KnowledgeMemory; store: PersonalKnowledgeStore }> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Memory text is required.');
  const store = await readPersonalKnowledgeStore(subject, env);
  const memory: KnowledgeMemory = {
    id: newId('mem'),
    text: trimmed.slice(0, 2000),
    sourceNodeId,
    createdAt: new Date().toISOString(),
    tags: tags?.slice(0, 8)
  };
  store.memories = [memory, ...store.memories].slice(0, MAX_MEMORIES);
  await writePersonalKnowledgeStore(subject, store, env);
  return { memory, store };
}

export async function deleteKnowledgeMemory(
  subject: string,
  memoryId: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<PersonalKnowledgeStore> {
  const store = await readPersonalKnowledgeStore(subject, env);
  store.memories = store.memories.filter((memory) => memory.id !== memoryId);
  await writePersonalKnowledgeStore(subject, store, env);
  return store;
}

export async function enrichReferencesFromKnowledge(options: {
  subject?: string;
  brief: string;
  references?: WorkbenchReferenceInput[];
  knowledgeNodeIds?: string[];
  onStatus?: (message: string) => void;
  env?: NodeJS.ProcessEnv;
}): Promise<WorkbenchReferenceInput[]> {
  const subject = options.subject?.trim();
  const base = [...(options.references ?? [])];
  if (!subject || !personalKnowledgeAvailable(options.env)) return base;

  const store = await readPersonalKnowledgeStore(subject, options.env);
  const selectedIds = new Set(options.knowledgeNodeIds ?? []);
  const hits = options.knowledgeNodeIds?.length
    ? store.nodes.filter((node) => selectedIds.has(node.id))
    : searchKnowledgeStore(store, options.brief, 4).map((hit) => hit.node);

  const extra: WorkbenchReferenceInput[] = [];
  for (const node of hits) {
    if (base.length + extra.length >= 8) break;
    if (node.kind === 'cloud_file' && node.externalId && node.provider) {
      options.onStatus?.(`Importing ${node.title} from ${node.provider === 'google_workspace' ? 'Google' : 'Microsoft'}`);
      const imported = await importCloudFileToKnowledge({
        subject,
        provider: node.provider,
        externalId: node.externalId,
        name: node.title,
        mimeType: node.mimeType,
        nativeUrl: node.nativeUrl,
        webUrl: node.webUrl,
        env: options.env
      });
      extra.push(imported.reference);
      continue;
    }
    if (node.snippet?.trim()) {
      extra.push({
        id: node.id,
        kind: 'text',
        name: node.title,
        text: node.snippet
      });
    }
  }

  const memoryHits = searchKnowledgeStore(store, options.brief, 2)
    .filter((hit) => hit.node.kind === 'memory' && hit.node.snippet?.trim());
  for (const hit of memoryHits) {
    if (base.length + extra.length >= 8) break;
    if (extra.some((ref) => ref.id === hit.node.id)) continue;
    extra.push({
      id: hit.node.id,
      kind: 'text',
      name: `Memory: ${hit.node.title}`,
      text: hit.node.snippet
    });
  }

  if (!extra.length) return base;
  const merged = [...base];
  for (const reference of extra) {
    if (merged.length >= 8) break;
    if (merged.some((existing) => existing.id && existing.id === reference.id)) continue;
    merged.push(reference);
  }
  return merged;
}

export const personalKnowledgeSearchToolDefinition = {
  type: 'function',
  function: {
    name: 'personal_knowledge_search',
    description:
      'Search the signed-in user encrypted personal knowledge graph (imported Google/Microsoft files, saved memories, prior artifacts). Use before claiming user-specific facts or when the brief references their cloud docs.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: { type: 'string', description: 'Short search query, e.g. "Q3 forecast" or "client brand voice".' },
        limit: { type: 'number', description: 'Max hits to return (1-8).' }
      },
      required: ['query']
    }
  }
} as const;

export async function searchPersonalKnowledgeForHarness(
  subject: string,
  query: string,
  limit = 6,
  env: NodeJS.ProcessEnv = process.env
): Promise<{ hits: KnowledgeSearchHit[]; markdown: string }> {
  const store = await readPersonalKnowledgeStore(subject, env);
  const hits = searchKnowledgeStore(store, query, Math.min(8, Math.max(1, limit)));
  if (!hits.length) {
    return { hits: [], markdown: 'No personal knowledge hits for that query.' };
  }
  const markdown = hits.map((hit, index) => [
    `### K${index + 1}: ${hit.node.title}`,
    `Kind: ${hit.node.kind}`,
    hit.node.provider ? `Provider: ${hit.node.provider}` : '',
    hit.node.nativeUrl ? `Native URL: ${hit.node.nativeUrl}` : '',
    hit.node.webUrl ? `Web URL: ${hit.node.webUrl}` : '',
    `Match: ${hit.reason}`,
    hit.node.snippet ? `Snippet:\n${hit.node.snippet.slice(0, 1200)}` : ''
  ].filter(Boolean).join('\n')).join('\n\n');
  return { hits, markdown };
}

export function integrationHarnessGuidance(env: NodeJS.ProcessEnv = process.env): string[] {
  const lines: string[] = [];
  if (personalKnowledgeAvailable(env)) {
    lines.push(
      'Personal knowledge is enabled for this user. Call personal_knowledge_search when the brief references their files, prior work, saved memories, or connected cloud docs.',
      'Imported cloud references may already appear in references/ or context/personal-knowledge.md — prefer those before re-fetching.'
    );
  }
  if (isGoogleWorkspaceEnabled(env)) {
    lines.push(
      'Google Workspace is available. Use google_workspace_run (read-only) to list or read Drive files, Docs, or Sheets when live cloud truth is needed.',
      'For Google-sourced citations, set citation.provider to "google_workspace" and citation.nativeUrl to the Docs/Sheets/Drive edit link when known.',
      'Users can also save finished exports to Google Drive from the artifact panel; uploaded files land in their Drive and enter personal knowledge automatically.'
    );
  }
  if (isMicrosoft365Enabled(env)) {
    lines.push(
      'Microsoft 365 is available. Use microsoft_graph_run (read-only) to list or read OneDrive files when live cloud truth is needed.',
      'For Microsoft-sourced citations, set citation.provider to "microsoft_365" and citation.nativeUrl to the Office/SharePoint webUrl when known.',
      'Users can save finished exports to OneDrive/Delegators from the artifact panel; saved files are indexed in personal knowledge for later runs.'
    );
  }
  return lines;
}

export function integrationCitationPromptLines(): string[] {
  return [
    'When citing connected cloud files, include citations[].nativeUrl and citations[].provider ("google_workspace" or "microsoft_365") so the user can continue in Docs or Office Online.',
    'Prefer personal knowledge and connected cloud imports over inventing filenames, doc titles, or workspace facts the user did not supply.'
  ];
}

export async function buildPersonalKnowledgeContext(
  subject: string | undefined,
  brief: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<{ promptLines: string[]; seedMarkdown: string | null }> {
  if (!subject?.trim() || !personalKnowledgeAvailable(env)) {
    return { promptLines: [], seedMarkdown: null };
  }
  const { hits, markdown } = await searchPersonalKnowledgeForHarness(subject, brief, 6, env);
  if (!hits.length) {
    return { promptLines: integrationCitationPromptLines(), seedMarkdown: null };
  }
  return {
    promptLines: [
      ...integrationCitationPromptLines(),
      `Personal knowledge matches (${hits.length}) are seeded in context/personal-knowledge.md — treat them as authoritative user context.`
    ],
    seedMarkdown: `# Personal knowledge context\n\n${markdown}`
  };
}

export async function recordArtifactKnowledge(options: {
  subject: string;
  threadId?: string;
  artifactTitle: string;
  citations: Array<{ id?: string; label: string; url?: string; nativeUrl?: string; provider?: IntegrationProvider | 'web' }>;
  env?: NodeJS.ProcessEnv;
}): Promise<void> {
  if (!options.subject.trim() || !personalKnowledgeAvailable(options.env)) return;
  const store = await readPersonalKnowledgeStore(options.subject, options.env);
  const now = new Date().toISOString();
  const artifactNode: KnowledgeNode = {
    id: newId('art'),
    kind: 'artifact',
    title: options.artifactTitle,
    threadId: options.threadId,
    createdAt: now,
    updatedAt: now
  };
  store.nodes = [artifactNode, ...store.nodes].slice(0, MAX_NODES);

  for (const citation of options.citations.slice(0, 12)) {
    const sourceNode = store.nodes.find(
      (node) => node.webUrl === citation.url || node.nativeUrl === citation.nativeUrl
    );
    const edge: KnowledgeEdge = {
      id: newId('edge'),
      from: artifactNode.id,
      to: sourceNode?.id ?? newId('kn'),
      relation: 'cited_in',
      createdAt: now
    };
    if (!sourceNode && (citation.url || citation.nativeUrl)) {
      store.nodes.push({
        id: edge.to,
        kind: 'cloud_file',
        title: citation.label,
        provider: citation.provider === 'web' ? undefined : citation.provider,
        nativeUrl: citation.nativeUrl,
        webUrl: citation.url,
        snippet: citation.label,
        createdAt: now,
        updatedAt: now
      });
    }
    store.edges = [edge, ...store.edges].slice(0, MAX_EDGES);
  }

  if (options.threadId) {
    let threadNode = store.nodes.find((node) => node.kind === 'thread' && node.threadId === options.threadId);
    if (!threadNode) {
      threadNode = {
        id: newId('thr'),
        kind: 'thread',
        title: `Thread ${options.threadId.slice(0, 8)}`,
        threadId: options.threadId,
        createdAt: now,
        updatedAt: now
      };
      store.nodes = [threadNode, ...store.nodes].slice(0, MAX_NODES);
    }
    const threadEdge: KnowledgeEdge = {
      id: newId('edge'),
      from: threadNode.id,
      to: artifactNode.id,
      relation: 'thread_of',
      createdAt: now
    };
    store.edges = [threadEdge, ...store.edges].slice(0, MAX_EDGES);
  }

  await writePersonalKnowledgeStore(options.subject, store, options.env);
}