import { resolveMicrosoftAccessToken } from './microsoftOAuth.js';
import { scrubSecrets } from './security.js';

export const MICROSOFT_GRAPH_READ_ONLY_ALLOWLIST = [
  'me/drive/root/children',
  'me/drive/items/{item_id}',
  'me/drive/items/{item_id}/content'
] as const;

export type MicrosoftGraphAllowlistedPath = (typeof MICROSOFT_GRAPH_READ_ONLY_ALLOWLIST)[number];

const ITEM_ID_RE = /^[a-zA-Z0-9!._-]+$/;

export type MicrosoftGraphRunRequest = {
  path: string;
  item_id?: string;
  query?: Record<string, string>;
};

export type MicrosoftGraphRunResult = {
  ok: boolean;
  path: string;
  status: number;
  body: string;
  contentType: string;
};

export const microsoftGraphToolDefinition = {
  type: 'function',
  function: {
    name: 'microsoft_graph_run',
    description:
      'Run a read-only Microsoft Graph call against the user connected Microsoft 365 account. Beta allowlist: list OneDrive root children, read item metadata, download item content.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        path: {
          type: 'string',
          description: 'Allowlisted Graph path, e.g. me/drive/root/children or me/drive/items/{item_id}.'
        },
        item_id: {
          type: 'string',
          description: 'Drive item ID when the path contains {item_id}.'
        },
        query: {
          type: 'object',
          description: 'Optional query string map ($top, $select, etc.).'
        }
      },
      required: ['path']
    }
  }
} as const;

export function isMicrosoft365Enabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.WORKBENCH_MICROSOFT_365_ENABLED === 'true';
}

export function readMicrosoftGraphToolArgs(args: Record<string, unknown>): MicrosoftGraphRunRequest {
  const path = args.path;
  if (typeof path !== 'string' || !path.trim()) {
    throw new Error('Tool argument "path" must be a non-empty string.');
  }
  const itemId = args.item_id;
  if (itemId !== undefined && (typeof itemId !== 'string' || !ITEM_ID_RE.test(itemId.trim()))) {
    throw new Error('Tool argument "item_id" must be a simple drive item ID when provided.');
  }
  let query: Record<string, string> | undefined;
  if (args.query !== undefined) {
    if (!args.query || typeof args.query !== 'object' || Array.isArray(args.query)) {
      throw new Error('Tool argument "query" must be an object when provided.');
    }
    query = {};
    for (const [key, value] of Object.entries(args.query as Record<string, unknown>)) {
      if (!/^\$?[a-zA-Z][a-zA-Z0-9._-]*$/.test(key)) {
        throw new Error(`Query key "${key}" is not allowed.`);
      }
      if (typeof value !== 'string') {
        throw new Error(`Query value for "${key}" must be a string.`);
      }
      query[key] = value;
    }
  }
  return {
    path: path.trim(),
    item_id: typeof itemId === 'string' ? itemId.trim() : undefined,
    query
  };
}

export function resolveAllowlistedGraphUrl(request: MicrosoftGraphRunRequest): string {
  const template = request.path.trim();
  if (!MICROSOFT_GRAPH_READ_ONLY_ALLOWLIST.includes(template as MicrosoftGraphAllowlistedPath)) {
    throw new Error(`Microsoft Graph path "${template}" is not allowlisted.`);
  }
  let resolved = template;
  if (resolved.includes('{item_id}')) {
    const itemId = request.item_id?.trim();
    if (!itemId || !ITEM_ID_RE.test(itemId)) {
      throw new Error('Microsoft Graph path requires a valid item_id.');
    }
    resolved = resolved.replaceAll('{item_id}', encodeURIComponent(itemId));
  }
  const url = new URL(`https://graph.microsoft.com/v1.0/${resolved}`);
  if (request.query) {
    for (const [key, value] of Object.entries(request.query)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

export function maskMicrosoftGraphSecrets(text: string): string {
  return scrubSecrets(text)
    .replace(/eyJ[A-Za-z0-9._-]+/g, 'eyJ[redacted]')
    .replace(/"access_token"\s*:\s*"[^"]+"/gi, '"access_token":"[redacted]"');
}

export async function runMicrosoftGraphCommand(options: {
  request: MicrosoftGraphRunRequest;
  ownerSubject?: string;
  env?: NodeJS.ProcessEnv;
  maxOutputBytes?: number;
  timeoutMs?: number;
}): Promise<MicrosoftGraphRunResult> {
  const env = options.env ?? process.env;
  if (!isMicrosoft365Enabled(env)) {
    throw new Error('Microsoft 365 integration is disabled.');
  }
  if (!options.ownerSubject?.trim()) {
    throw new Error('Connect Microsoft 365 in Settings before using Graph commands.');
  }
  const accessToken = await resolveMicrosoftAccessToken(options.ownerSubject, env);
  if (!accessToken) {
    throw new Error('Connect Microsoft 365 in Settings before using Graph commands.');
  }
  const url = resolveAllowlistedGraphUrl(options.request);
  const timeoutMs = Math.max(1_000, options.timeoutMs ?? 30_000);
  const maxOutputBytes = Math.max(1_024, options.maxOutputBytes ?? 64_000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      signal: controller.signal
    });
    const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
    const raw = await response.arrayBuffer();
    const body = Buffer.from(raw).subarray(0, maxOutputBytes).toString('utf8');
    return {
      ok: response.ok,
      path: options.request.path,
      status: response.status,
      body: maskMicrosoftGraphSecrets(body),
      contentType
    };
  } finally {
    clearTimeout(timer);
  }
}