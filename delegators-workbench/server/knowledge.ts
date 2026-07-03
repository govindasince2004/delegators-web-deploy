import type { Request, Response } from 'express';
import { z } from 'zod';
import { ExportArtifactRequestSchema } from '../src/lib/shared.js';
import type { IntegrationProvider } from './integrationVault.js';
import { exportArtifactToCloud } from './cloudExport.js';
import { integrationSubjectFromAuth, type IntegrationsAuthContext } from './integrations.js';
import {
  addKnowledgeMemory,
  browseCloudFiles,
  deleteKnowledgeMemory,
  importCloudFileToKnowledge,
  knowledgeGraphResponse,
  personalKnowledgeAvailable,
  readPersonalKnowledgeStore,
  searchKnowledgeStore
} from './personalKnowledge.js';

function knowledgeSubject(res: Response): string | undefined {
  return integrationSubjectFromAuth(res.locals.workbenchAuth as IntegrationsAuthContext | undefined);
}

export async function handleKnowledgeGraph(_req: Request, res: Response): Promise<void> {
  if (!personalKnowledgeAvailable()) {
    res.status(503).json({
      error: 'knowledge_unavailable',
      details: 'Personal knowledge requires WORKBENCH_INTEGRATION_VAULT_KEY on the server.'
    });
    return;
  }
  const subject = knowledgeSubject(res);
  if (!subject) {
    res.status(401).json({ error: 'unauthorized', details: 'Sign in before opening personal knowledge.' });
    return;
  }
  const store = await readPersonalKnowledgeStore(subject);
  res.json(knowledgeGraphResponse(store));
}

export async function handleKnowledgeSearch(req: Request, res: Response): Promise<void> {
  if (!personalKnowledgeAvailable()) {
    res.status(503).json({ error: 'knowledge_unavailable', details: 'Personal knowledge is not configured.' });
    return;
  }
  const subject = knowledgeSubject(res);
  if (!subject) {
    res.status(401).json({ error: 'unauthorized', details: 'Sign in before searching personal knowledge.' });
    return;
  }
  const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
  if (!query) {
    res.status(400).json({ error: 'invalid_request', details: 'Search query is required.' });
    return;
  }
  const limit = typeof req.body?.limit === 'number' ? Math.min(12, Math.max(1, req.body.limit)) : 8;
  const store = await readPersonalKnowledgeStore(subject);
  const hits = searchKnowledgeStore(store, query, limit);
  res.json({ query, hits });
}

export async function handleKnowledgeBrowse(req: Request, res: Response): Promise<void> {
  const subject = knowledgeSubject(res);
  if (!subject) {
    res.status(401).json({ error: 'unauthorized', details: 'Sign in before browsing cloud files.' });
    return;
  }
  const provider = req.query.provider;
  if (provider !== 'google_workspace' && provider !== 'microsoft_365') {
    res.status(400).json({ error: 'invalid_request', details: 'provider must be google_workspace or microsoft_365.' });
    return;
  }
  try {
    const items = await browseCloudFiles(subject, provider);
    res.json({ provider, items });
  } catch (error) {
    res.status(503).json({
      error: 'browse_failed',
      details: error instanceof Error ? error.message : 'Could not browse cloud files.'
    });
  }
}

export async function handleKnowledgeImport(req: Request, res: Response): Promise<void> {
  if (!personalKnowledgeAvailable()) {
    res.status(503).json({ error: 'knowledge_unavailable', details: 'Personal knowledge is not configured.' });
    return;
  }
  const subject = knowledgeSubject(res);
  if (!subject) {
    res.status(401).json({ error: 'unauthorized', details: 'Sign in before importing cloud files.' });
    return;
  }
  const provider = req.body?.provider;
  const externalId = typeof req.body?.externalId === 'string' ? req.body.externalId.trim() : '';
  if ((provider !== 'google_workspace' && provider !== 'microsoft_365') || !externalId) {
    res.status(400).json({ error: 'invalid_request', details: 'provider and externalId are required.' });
    return;
  }
  try {
    const imported = await importCloudFileToKnowledge({
      subject,
      provider: provider as IntegrationProvider,
      externalId,
      name: typeof req.body?.name === 'string' ? req.body.name : undefined,
      mimeType: typeof req.body?.mimeType === 'string' ? req.body.mimeType : undefined,
      nativeUrl: typeof req.body?.nativeUrl === 'string' ? req.body.nativeUrl : undefined,
      webUrl: typeof req.body?.webUrl === 'string' ? req.body.webUrl : undefined
    });
    res.json({
      node: imported.node,
      reference: imported.reference,
      graph: knowledgeGraphResponse(imported.store)
    });
  } catch (error) {
    res.status(503).json({
      error: 'import_failed',
      details: error instanceof Error ? error.message : 'Could not import cloud file.'
    });
  }
}

export async function handleKnowledgeAddMemory(req: Request, res: Response): Promise<void> {
  if (!personalKnowledgeAvailable()) {
    res.status(503).json({ error: 'knowledge_unavailable', details: 'Personal knowledge is not configured.' });
    return;
  }
  const subject = knowledgeSubject(res);
  if (!subject) {
    res.status(401).json({ error: 'unauthorized', details: 'Sign in before saving memories.' });
    return;
  }
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text) {
    res.status(400).json({ error: 'invalid_request', details: 'Memory text is required.' });
    return;
  }
  const tags = Array.isArray(req.body?.tags)
    ? req.body.tags.filter((tag: unknown): tag is string => typeof tag === 'string').slice(0, 8)
    : undefined;
  const sourceNodeId = typeof req.body?.sourceNodeId === 'string' ? req.body.sourceNodeId : undefined;
  const result = await addKnowledgeMemory(subject, text, tags, sourceNodeId);
  res.json({
    memory: result.memory,
    graph: knowledgeGraphResponse(result.store)
  });
}

export async function handleKnowledgeDeleteMemory(req: Request, res: Response): Promise<void> {
  if (!personalKnowledgeAvailable()) {
    res.status(503).json({ error: 'knowledge_unavailable', details: 'Personal knowledge is not configured.' });
    return;
  }
  const subject = knowledgeSubject(res);
  if (!subject) {
    res.status(401).json({ error: 'unauthorized', details: 'Sign in before deleting memories.' });
    return;
  }
  const memoryId = typeof req.params.memoryId === 'string' ? req.params.memoryId.trim() : '';
  if (!memoryId) {
    res.status(400).json({ error: 'invalid_request', details: 'Memory id is required.' });
    return;
  }
  const store = await deleteKnowledgeMemory(subject, memoryId);
  res.json({ graph: knowledgeGraphResponse(store) });
}

const CloudExportRequestSchema = ExportArtifactRequestSchema.extend({
  provider: z.enum(['google_workspace', 'microsoft_365']),
  filename: z.string().trim().max(180).optional()
});

export async function handleCloudExport(req: Request, res: Response): Promise<void> {
  const parsed = CloudExportRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_request', details: 'provider, artifact, and format are required.' });
    return;
  }
  const subject = knowledgeSubject(res);
  if (!subject) {
    res.status(401).json({ error: 'unauthorized', details: 'Sign in before saving to cloud storage.' });
    return;
  }
  try {
    const result = await exportArtifactToCloud({
      subject,
      provider: parsed.data.provider as IntegrationProvider,
      artifact: parsed.data.artifact,
      format: parsed.data.format,
      filename: parsed.data.filename
    });
    res.json(result);
  } catch (error) {
    res.status(503).json({
      error: 'cloud_export_failed',
      details: error instanceof Error ? error.message : 'Cloud save failed.'
    });
  }
}