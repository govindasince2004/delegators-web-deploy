import { scaleToolBudgetForDepth, type RunDepthTier } from './agenticDepth.js';
import dns from 'node:dns/promises';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { parseArtifactCandidate, parseArtifactJson } from './artifactRepair.js';
import { buildExport } from './exporters.js';
import type { ArtifactExportFormat, ArtifactKind } from '../src/lib/shared.js';
import { withSandboxCircuit } from './sandboxCircuit.js';
import {
  deleteWorkspacePath,
  enforceWorkspaceLimits,
  listWorkspace,
  readWorkspaceText,
  recordWorkspaceCheckpoint,
  resolveWorkspacePath,
  type WorkbenchWorkspace,
  writeWorkspaceBinary,
  writeWorkspaceText
} from './workspace.js';

type JsonRecord = Record<string, unknown>;

export type ToolCall = {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
};

export type ToolBudget = {
  maxToolCalls: number;
  maxTerminalRuns: number;
  maxWebRequests: number;
  timeoutMs: number;
  maxToolResultBytes: number;
};

export type ToolState = {
  toolCalls: number;
  terminalRuns: number;
  webRequests: number;
};

export type ToolExecutionResult = {
  ok: boolean;
  tool: string;
  summary: string;
  data?: unknown;
};

export type WebSearchResult = {
  title: string;
  snippet: string;
  url?: string;
  publishedDate?: string;
  author?: string;
  highlights?: string[];
  provider?: 'firecrawl' | 'exa' | 'duckduckgo' | 'direct';
};

export type WebFetchResult = {
  url: string;
  contentType: string;
  text: string;
  title?: string;
  highlights?: string[];
  provider?: 'firecrawl' | 'exa' | 'direct';
};

export type WebImageResult = {
  url: string;
  contentType: 'image/png' | 'image/jpeg';
  body: Buffer;
};

export type WebSearchMode = 'auto' | 'fast' | 'deep-lite' | 'deep' | 'deep-reasoning';

export type PlatformSearch = {
  baseURL: string;
  sessionKey: string;
};

export const workbenchToolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'workspace_write',
      description: 'Write a UTF-8 working file inside the isolated Workbench workspace.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', description: 'Relative workspace path, for example drafts/outline.md.' },
          content: { type: 'string', description: 'UTF-8 file content.' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'workspace_read',
      description: 'Read a UTF-8 file from the isolated Workbench workspace.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', description: 'Relative workspace path to read.' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'workspace_list',
      description: 'List files currently available inside the isolated Workbench workspace.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', description: 'Relative directory path. Defaults to workspace root.' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'workspace_delete',
      description: 'Delete a file or directory inside the isolated Workbench workspace. Use only for generated scratch files that are no longer needed.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', description: 'Relative workspace path to delete.' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'workspace_checkpoint',
      description: 'Record a checkpoint manifest of current workspace files, including checksums, before a risky transformation.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string', description: 'Short checkpoint label.' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'terminal_run',
      description: 'Run a short Python, Node, or Bash script in the isolated workspace for calculations, parsing, chart data, or validation.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          runtime: { type: 'string', enum: ['python3', 'node', 'bash'] },
          code: { type: 'string', description: 'Script body to execute.' },
          timeoutMs: { type: 'number', description: 'Optional timeout in milliseconds, capped by the Workbench policy.' }
        },
        required: ['runtime', 'code']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'artifact_validate',
      description: 'Validate a candidate artifact JSON against the Delegators Workbench artifact schema before final response.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          json: { type: 'string', description: 'Candidate artifact JSON string. Omit when validating a workspace file.' },
          path: { type: 'string', description: 'Relative path to a workspace JSON file. Omit when json is provided.' },
          expectedKind: { type: 'string', enum: ['resume', 'deck', 'report', 'assignment', 'email', 'sheet'] }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'artifact_export',
      description: 'Generate a real PDF, DOCX, PPTX, XLSX, or ZIP file from validated Workbench artifact JSON and store it in the workspace.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          json: { type: 'string', description: 'Artifact JSON string. Omit when exporting a workspace file.' },
          path: { type: 'string', description: 'Relative path to a workspace JSON file. Omit when json is provided.' },
          format: { type: 'string', enum: ['pdf', 'docx', 'pptx', 'xlsx', 'zip'] },
          outputPath: { type: 'string', description: 'Optional relative output path. Defaults to exports/<artifact-title>.<format>.' }
        },
        required: ['format']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for current facts or sources. Use when the brief asks for current, latest, market, pricing, legal, or cited facts.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          query: { type: 'string', description: 'Search query.' },
          mode: {
            type: 'string',
            enum: ['auto', 'fast', 'deep-lite', 'deep', 'deep-reasoning'],
            description: 'Search depth. Use deep for researched artifacts when an Exa key is configured.'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'web_fetch',
      description: 'Fetch a public HTTP(S) page for source extraction. Private, local, metadata, and link-local hosts are rejected.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          url: { type: 'string', description: 'Public HTTP(S) URL to fetch.' }
        },
        required: ['url']
      }
    }
  }
] as const;

export const chatWebToolDefinitions = workbenchToolDefinitions.filter(
  (tool) => tool.function.name === 'web_search' || tool.function.name === 'web_fetch'
);

const runtimeExtensions: Record<string, string> = {
  python3: 'py',
  node: 'mjs',
  bash: 'sh'
};

export function policyForChat(model: string): ToolBudget {
  const lower = model.toLowerCase();
  if (lower.includes('ultra') || (lower.includes('pro') && lower.includes('thinking'))) {
    return { maxToolCalls: 4, maxTerminalRuns: 0, maxWebRequests: 3, timeoutMs: 45_000, maxToolResultBytes: 8_000 };
  }
  if (lower.includes('pro') || lower.includes('thinking')) {
    return { maxToolCalls: 3, maxTerminalRuns: 0, maxWebRequests: 2, timeoutMs: 35_000, maxToolResultBytes: 6_000 };
  }
  return { maxToolCalls: 2, maxTerminalRuns: 0, maxWebRequests: 1, timeoutMs: 25_000, maxToolResultBytes: 5_000 };
}

export function policyForModel(model: string): ToolBudget {
  const lower = model.toLowerCase();
  if (lower.includes('ultra')) {
    return { maxToolCalls: 14, maxTerminalRuns: 4, maxWebRequests: 6, timeoutMs: 120_000, maxToolResultBytes: 14_000 };
  }
  if (lower.includes('pro') && lower.includes('thinking')) {
    return { maxToolCalls: 12, maxTerminalRuns: 3, maxWebRequests: 6, timeoutMs: 120_000, maxToolResultBytes: 12_000 };
  }
  if (lower.includes('pro')) {
    return { maxToolCalls: 10, maxTerminalRuns: 2, maxWebRequests: 4, timeoutMs: 90_000, maxToolResultBytes: 10_000 };
  }
  if (lower.includes('thinking')) {
    return { maxToolCalls: 5, maxTerminalRuns: 1, maxWebRequests: 2, timeoutMs: 60_000, maxToolResultBytes: 8_000 };
  }
  return { maxToolCalls: 4, maxTerminalRuns: 1, maxWebRequests: 1, timeoutMs: 45_000, maxToolResultBytes: 6_000 };
}

export function policyForArtifact(
  model: string,
  options: {
    kind?: string;
    hasResearchPack?: boolean;
    briefRequiresComputation?: boolean;
    depthTier?: RunDepthTier;
  } = {}
): ToolBudget {
  const base = policyForModel(model);
  const kind = options.kind ?? '';
  const tier = options.depthTier ?? 'standard';
  const researchedDeckOrReport = options.hasResearchPack && (kind === 'deck' || kind === 'report');
  let budget = base;

  if (researchedDeckOrReport && !options.briefRequiresComputation) {
    // Research already ran in prepareResearchPack — avoid a second web loop, but keep
    // enough tool headroom on deep/marathon runs for validation and computation.
    const postResearchCap = tier === 'marathon' ? 10 : tier === 'deep' ? 8 : 4;
    budget = {
      ...base,
      maxToolCalls: Math.min(base.maxToolCalls, postResearchCap),
      maxWebRequests: 0,
      maxTerminalRuns: Math.max(
        Math.min(base.maxTerminalRuns, tier === 'fast' ? 1 : 2),
        tier === 'marathon' ? 2 : 1
      )
    };
  } else if (kind === 'deck') {
    const deckCap = tier === 'marathon'
      ? base.maxToolCalls
      : tier === 'deep'
        ? Math.min(base.maxToolCalls, 10)
        : Math.min(base.maxToolCalls, 6);
    budget = {
      ...base,
      maxToolCalls: deckCap,
      maxWebRequests: tier === 'fast' ? Math.min(base.maxWebRequests, 2) : base.maxWebRequests
    };
  }

  return scaleToolBudgetForDepth(budget, tier);
}

export function createToolState(): ToolState {
  return { toolCalls: 0, terminalRuns: 0, webRequests: 0 };
}

export async function executeChatWebTool(options: {
  call: ToolCall;
  budget: ToolBudget;
  state: ToolState;
  platformSearch: PlatformSearch;
}): Promise<ToolExecutionResult> {
  const name = options.call.function.name;
  options.state.toolCalls += 1;
  if (options.state.toolCalls > options.budget.maxToolCalls) {
    return toolError(name, 'Web research budget exhausted for this chat turn.');
  }
  if (name !== 'web_search' && name !== 'web_fetch') {
    return toolError(name, 'Only web_search and web_fetch are available in chat.');
  }

  let args: JsonRecord;
  try {
    args = parseToolArgs(options.call.function.arguments);
  } catch (error) {
    return toolError(name, error instanceof Error ? error.message : 'Invalid tool arguments.');
  }

  try {
    if (name === 'web_search') {
      options.state.webRequests += 1;
      if (options.state.webRequests > options.budget.maxWebRequests) {
        return toolError(name, 'Web request budget exhausted for this chat turn.');
      }
      const results = await webSearch(requiredString(args.query, 'query'), {
        platform: options.platformSearch,
        maxResults: 6,
        fresh: true,
        mode: optionalSearchMode(args.mode) ?? 'auto'
      });
      return toolOk(name, `Found ${results.length} search results.`, { results });
    }
    options.state.webRequests += 1;
    if (options.state.webRequests > options.budget.maxWebRequests) {
      return toolError(name, 'Web request budget exhausted for this chat turn.');
    }
    const fetched = await webFetch(requiredString(args.url, 'url'), {
      platform: options.platformSearch,
      maxBytes: options.budget.maxToolResultBytes,
      fresh: true
    });
    return toolOk(name, `Fetched ${fetched.url}.`, fetched);
  } catch (error) {
    return toolError(name, error instanceof Error ? error.message : 'Tool execution failed.');
  }
}

export async function executeWorkbenchTool(options: {
  call: ToolCall;
  workspace: WorkbenchWorkspace;
  budget: ToolBudget;
  state: ToolState;
  platformSearch?: PlatformSearch;
}): Promise<ToolExecutionResult> {
  const name = options.call.function.name;
  options.state.toolCalls += 1;
  if (options.state.toolCalls > options.budget.maxToolCalls) {
    return toolError(name, 'Tool call budget exhausted for this Workbench session.');
  }

  let args: JsonRecord;
  try {
    args = parseToolArgs(options.call.function.arguments);
  } catch (error) {
    return toolError(name, error instanceof Error ? error.message : 'Invalid tool arguments.');
  }

  try {
    if (name === 'workspace_write') {
      await recordWorkspaceCheckpoint(options.workspace, 'before-workspace-write', {
        tool: name,
        path: requiredString(args.path, 'path')
      });
      const file = await writeWorkspaceText(
        options.workspace,
        requiredString(args.path, 'path'),
        requiredString(args.content, 'content')
      );
      return toolOk(name, `Wrote ${file.path} (${file.bytes} bytes).`, file);
    }
    if (name === 'workspace_read') {
      const requestedPath = requiredString(args.path, 'path');
      const content = await readWorkspaceText(options.workspace, requestedPath, options.budget.maxToolResultBytes);
      return toolOk(name, `Read ${requestedPath}.`, { path: requestedPath, content });
    }
    if (name === 'workspace_list') {
      const snapshot = await listWorkspace(options.workspace, optionalString(args.path) ?? '.');
      return toolOk(name, `Workspace has ${snapshot.files.length} files.`, snapshot);
    }
    if (name === 'workspace_delete') {
      await recordWorkspaceCheckpoint(options.workspace, 'before-workspace-delete', {
        tool: name,
        path: requiredString(args.path, 'path')
      });
      const deleted = await deleteWorkspacePath(options.workspace, requiredString(args.path, 'path'));
      return toolOk(name, deleted.deleted ? `Deleted ${deleted.path}.` : `${deleted.path} did not exist.`, deleted);
    }
    if (name === 'workspace_checkpoint') {
      const checkpoint = await recordWorkspaceCheckpoint(options.workspace, optionalString(args.label) ?? 'manual', {
        tool: name
      });
      return toolOk(name, `Checkpoint ${checkpoint.id} recorded.`, checkpoint);
    }
    if (name === 'terminal_run') {
      options.state.terminalRuns += 1;
      if (options.state.terminalRuns > options.budget.maxTerminalRuns) {
        return toolError(name, 'Terminal budget exhausted for this Workbench session.');
      }
      return await runTerminalTool(options.workspace, args, options.budget);
    }
    if (name === 'artifact_validate') {
      return await validateArtifactTool(options.workspace, args);
    }
    if (name === 'artifact_export') {
      return await exportArtifactTool(options.workspace, args);
    }
    if (name === 'web_search') {
      options.state.webRequests += 1;
      if (options.state.webRequests > options.budget.maxWebRequests) {
        return toolError(name, 'Web request budget exhausted for this Workbench session.');
      }
      const results = await webSearch(requiredString(args.query, 'query'), {
        platform: options.platformSearch,
        maxResults: 6,
        fresh: true,
        mode: optionalSearchMode(args.mode) ?? 'deep'
      });
      return toolOk(name, `Found ${results.length} search results.`, { results });
    }
    if (name === 'web_fetch') {
      options.state.webRequests += 1;
      if (options.state.webRequests > options.budget.maxWebRequests) {
        return toolError(name, 'Web request budget exhausted for this Workbench session.');
      }
      const fetched = await webFetch(requiredString(args.url, 'url'), {
        platform: options.platformSearch,
        maxBytes: options.budget.maxToolResultBytes,
        fresh: true
      });
      return toolOk(name, `Fetched ${fetched.url}.`, fetched);
    }
    return toolError(name, 'Unknown Workbench tool.');
  } catch (error) {
    return toolError(name, error instanceof Error ? error.message : 'Tool execution failed.');
  }
}

export function compactToolResult(result: ToolExecutionResult, maxBytes: number): string {
  const json = JSON.stringify(result);
  if (Buffer.byteLength(json, 'utf8') <= maxBytes) return json;
  const suffix = '... [truncated]';
  return Buffer.from(json, 'utf8').subarray(0, Math.max(0, maxBytes - suffix.length)).toString('utf8') + suffix;
}

async function runTerminalTool(
  workspace: WorkbenchWorkspace,
  args: JsonRecord,
  budget: ToolBudget
): Promise<ToolExecutionResult> {
  const runtime = requiredString(args.runtime, 'runtime');
  const code = requiredString(args.code, 'code');
  const extension = runtimeExtensions[runtime];
  if (!extension) {
    throw new Error('Unsupported runtime. Use python3, node, or bash.');
  }
  const mode = process.env.WORKBENCH_TERMINAL_MODE || (process.env.NODE_ENV === 'production' ? 'off' : 'local');
  if (mode === 'off') {
    throw new Error('Workbench terminal is disabled.');
  }
  if (mode !== 'docker' && mode !== 'remote' && process.env.NODE_ENV === 'production' && process.env.WORKBENCH_TERMINAL_LOCAL_UNSAFE !== 'true') {
    throw new Error('Production terminal execution requires WORKBENCH_TERMINAL_MODE=docker or remote.');
  }

  const requestedTimeout = typeof args.timeoutMs === 'number' ? args.timeoutMs : budget.timeoutMs;
  const timeoutMs = Math.max(1000, Math.min(requestedTimeout, budget.timeoutMs));
  await recordWorkspaceCheckpoint(workspace, 'before-terminal-run', {
    tool: 'terminal_run',
    runtime
  });
  const runPath = `.runs/run-${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`;
  await writeWorkspaceText(workspace, runPath, code);

  if (mode === 'remote') {
    const result = await runRemoteSandbox(workspace, runtime, runPath, timeoutMs, budget.maxToolResultBytes);
    await enforceWorkspaceLimits(workspace);
    const snapshot = await listWorkspace(workspace);
    return finalizeTerminalResult(runtime, timeoutMs, result, snapshot.files);
  }

  const command = mode === 'docker'
    ? dockerCommand(workspace, runtime, runPath)
    : localCommand(workspace, runtime, runPath);

  const result = await runProcess(command.file, command.args, {
    cwd: command.cwd,
    timeoutMs,
    maxOutputBytes: budget.maxToolResultBytes,
    env: command.env
  });
  await enforceWorkspaceLimits(workspace);
  const snapshot = await listWorkspace(workspace);
  return finalizeTerminalResult(runtime, timeoutMs, result, snapshot.files);
}

function finalizeTerminalResult(
  runtime: string,
  timeoutMs: number,
  result: { exitCode: number | null; stdout: string; stderr: string; timedOut: boolean },
  files: Awaited<ReturnType<typeof listWorkspace>>['files']
): ToolExecutionResult {
  const payload = {
    runtime,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    stdout: result.stdout,
    stderr: result.stderr,
    files
  };
  if (result.timedOut) {
    return toolError('terminal_run', `Script timed out after ${timeoutMs}ms.`);
  }
  if (result.exitCode !== 0 && result.exitCode !== null) {
    return toolError('terminal_run', `Script exited with code ${result.exitCode}.`);
  }
  return toolOk('terminal_run', `Command exited with code ${result.exitCode ?? 0}.`, payload);
}

async function runRemoteSandbox(
  workspace: WorkbenchWorkspace,
  runtime: string,
  runPath: string,
  timeoutMs: number,
  maxOutputBytes: number
): Promise<{ exitCode: number | null; stdout: string; stderr: string; timedOut: boolean }> {
  const endpoint = process.env.WORKBENCH_SANDBOX_URL?.trim();
  if (!endpoint) throw new Error('WORKBENCH_SANDBOX_URL is required for remote terminal mode.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs + 5000);
  try {
    const response = await withSandboxCircuit(() => fetch(`${endpoint.replace(/\/$/, '')}/v1/run`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.WORKBENCH_SANDBOX_TOKEN
          ? { Authorization: `Bearer ${process.env.WORKBENCH_SANDBOX_TOKEN}` }
          : {})
      },
      body: JSON.stringify({
        workspaceRoot: workspace.root,
        runtime,
        runPath,
        timeoutMs,
        maxOutputBytes
      })
    }));
    const payload = await response.json().catch(() => null) as {
      exitCode?: unknown;
      stdout?: unknown;
      stderr?: unknown;
      timedOut?: unknown;
      error?: unknown;
    } | null;
    if (!response.ok) {
      throw new Error(typeof payload?.error === 'string' ? payload.error : `Sandbox returned HTTP ${response.status}.`);
    }
    return {
      exitCode: typeof payload?.exitCode === 'number' || payload?.exitCode === null ? payload.exitCode : 127,
      stdout: typeof payload?.stdout === 'string' ? payload.stdout : '',
      stderr: typeof payload?.stderr === 'string' ? payload.stderr : '',
      timedOut: payload?.timedOut === true
    };
  } finally {
    clearTimeout(timer);
  }
}

async function validateArtifactTool(
  workspace: WorkbenchWorkspace,
  args: JsonRecord
): Promise<ToolExecutionResult> {
  const parsed = await parseArtifactToolInput(workspace, args);
  if (!parsed.ok) {
    return toolOk('artifact_validate', 'Artifact JSON is invalid.', {
      valid: false,
      issues: [parsed.error]
    });
  }

  const expectedKind = typeof args.expectedKind === 'string' ? args.expectedKind as ArtifactKind : undefined;
  const artifact = parseArtifactCandidate(parsed.value, { expectedKind });
  if (!artifact.success) {
    return toolOk('artifact_validate', 'Artifact schema validation failed.', {
      valid: false,
      issues: artifact.error.issues.map((issue) => ({
        path: issue.path.join('.') || 'root',
        message: issue.message
      }))
    });
  }

  return toolOk('artifact_validate', 'Artifact schema validation passed.', {
    valid: true,
    kind: artifact.data.kind,
    title: artifact.data.title,
    exportFormats: exportFormatsForArtifact(artifact.data)
  });
}

async function exportArtifactTool(
  workspace: WorkbenchWorkspace,
  args: JsonRecord
): Promise<ToolExecutionResult> {
  const parsed = await parseArtifactToolInput(workspace, args);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  const artifact = parseArtifactCandidate(parsed.value);
  if (!artifact.success) {
    return toolOk('artifact_export', 'Artifact schema validation failed; export not created.', {
      exported: false,
      issues: artifact.error.issues.map((issue) => ({
        path: issue.path.join('.') || 'root',
        message: issue.message
      }))
    });
  }

  const format = requiredExportFormat(args.format);
  await recordWorkspaceCheckpoint(workspace, 'before-artifact-export', {
    tool: 'artifact_export',
    format,
    title: artifact.data.title
  });
  const exported = await buildExport(artifact.data, format);
  const outputPath = optionalString(args.outputPath) ?? `exports/${exported.filename}`;
  const file = await writeWorkspaceBinary(workspace, outputPath, exported.body);
  const signature = inspectFileSignature(exported.body);
  return toolOk('artifact_export', `Exported ${file.path} (${file.bytes} bytes).`, {
    exported: true,
    path: file.path,
    bytes: file.bytes,
    sha256: file.sha256,
    contentType: exported.contentType,
    format,
    signature
  });
}

async function parseArtifactToolInput(
  workspace: WorkbenchWorkspace,
  args: JsonRecord
): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  const rawJson = typeof args.json === 'string'
    ? args.json
    : typeof args.path === 'string'
      ? await readWorkspaceText(workspace, args.path)
      : '';
  if (!rawJson.trim()) {
    return { ok: false, error: 'Artifact tool requires json or path.' };
  }
  try {
    return { ok: true, value: parseArtifactJson(rawJson) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Invalid JSON.' };
  }
}

function exportFormatsForArtifact(artifact: { kind: string; slides?: unknown[]; sheet?: unknown; sections: Array<{ table?: unknown }> }): string[] {
  const formats = ['pdf', 'docx', 'zip'];
  if (artifact.kind === 'deck' || (Array.isArray(artifact.slides) && artifact.slides.length > 0)) {
    formats.push('pptx');
  }
  if (artifact.kind === 'sheet' || artifact.sheet || artifact.sections.some((section) => Boolean(section.table))) {
    formats.push('xlsx');
  }
  return formats;
}

function requiredExportFormat(value: unknown): ArtifactExportFormat {
  if (value === 'pdf' || value === 'docx' || value === 'pptx' || value === 'xlsx' || value === 'zip') {
    return value;
  }
  throw new Error('Unsupported export format.');
}

function inspectFileSignature(body: Buffer): { kind: string; valid: boolean } {
  if (body.subarray(0, 5).toString('utf8') === '%PDF-') {
    return { kind: 'pdf', valid: true };
  }
  if (body.subarray(0, 2).toString('hex') === '504b') {
    return { kind: 'zip-container', valid: true };
  }
  return { kind: 'unknown', valid: false };
}

function localCommand(workspace: WorkbenchWorkspace, runtime: string, runPath: string) {
  const scriptPath = resolveWorkspacePath(workspace, runPath);
  const commonEnv = {
    PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
    HOME: workspace.root,
    WORKBENCH_SANDBOX: '1',
    PYTHONUNBUFFERED: '1'
  };
  if (runtime === 'bash') {
    return { file: 'bash', args: ['--noprofile', '--norc', scriptPath], cwd: workspace.root, env: commonEnv };
  }
  return { file: runtime, args: [scriptPath], cwd: workspace.root, env: commonEnv };
}

function dockerCommand(workspace: WorkbenchWorkspace, runtime: string, runPath: string) {
  const image = process.env.WORKBENCH_SANDBOX_IMAGE || 'python:3.11-slim';
  const scriptPath = `/workspace/${runPath}`;
  const runtimeArgs = runtime === 'bash'
    ? ['bash', '--noprofile', '--norc', scriptPath]
    : [runtime, scriptPath];
  return {
    file: process.env.WORKBENCH_SANDBOX_COMMAND || 'docker',
    args: [
      'run', '--rm',
      '--network=none',
      '--cpus=1',
      '--memory=1024m',
      '--memory-swap=1024m',
      '--pids-limit=128',
      '--read-only',
      '--user', sandboxUser(),
      '--cap-drop=ALL',
      '--security-opt=no-new-privileges',
      '--tmpfs=/tmp:rw,noexec,nosuid,size=64m',
      '-e', 'WORKBENCH_SANDBOX=1',
      '-v', `${workspace.root}:/workspace:rw`,
      '-w', '/workspace',
      image,
      ...runtimeArgs
    ],
    cwd: workspace.root,
    env: { PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin' }
  };
}

function sandboxUser(): string {
  const uid = typeof process.getuid === 'function' ? process.getuid() : 1000;
  const gid = typeof process.getgid === 'function' ? process.getgid() : 1000;
  return `${uid}:${gid}`;
}

async function runProcess(
  file: string,
  args: string[],
  options: { cwd: string; timeoutMs: number; maxOutputBytes: number; env: Record<string, string> }
): Promise<{ exitCode: number | null; stdout: string; stderr: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(file, args, {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const append = (current: string, chunk: Buffer) => {
      const next = current + chunk.toString('utf8');
      if (Buffer.byteLength(next, 'utf8') <= options.maxOutputBytes) return next;
      return Buffer.from(next, 'utf8').subarray(0, options.maxOutputBytes).toString('utf8') + '\n[truncated]';
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, options.timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => { stdout = append(stdout, chunk); });
    child.stderr.on('data', (chunk: Buffer) => { stderr = append(stderr, chunk); });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ exitCode: 127, stdout, stderr: append(stderr, Buffer.from(error.message)), timedOut });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code, stdout, stderr, timedOut });
    });
  });
}

export async function webSearch(
  query: string,
  options: {
    maxResults?: number;
    fresh?: boolean;
    mode?: WebSearchMode;
    platform?: PlatformSearch;
  } = {}
): Promise<WebSearchResult[]> {
  const safeQuery = query.trim().slice(0, 200);
  if (!safeQuery) throw new Error('Search query is required.');
  // PRIMARY: the managed Firecrawl key-pool via the Delegators gateway — keys
  // stay server-side and every search is metered against the plan. The gateway
  // itself falls back to free native search when the pool is busy/down, so the
  // Workbench never holds a search key. The local DuckDuckGo path is only a
  // last resort for standalone dev calls that have no plan credentials.
  if (options.platform) {
    return resilientPlatformWebSearch(safeQuery, {
      ...options.platform,
      maxResults: options.maxResults ?? 6,
      mode: options.mode ?? 'deep'
    });
  }
  return duckDuckGoSearch(safeQuery, options.maxResults ?? 6);
}

async function resilientPlatformWebSearch(
  query: string,
  options: PlatformSearch & { maxResults: number; mode: WebSearchMode }
): Promise<WebSearchResult[]> {
  const { getCachedSearch, setCachedSearch } = await import('./searchCache.js');
  const cached = getCachedSearch(query, options.mode, options.maxResults);
  if (cached?.length) return cached;

  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const results = await platformWebSearch(query, options).catch(() => [] as WebSearchResult[]);
    if (results.length > 0) {
      setCachedSearch(query, options.mode, options.maxResults, results);
      return results;
    }
    if (attempt < maxAttempts - 1) {
      await sleep(1200 * (attempt + 1));
    }
  }
  console.warn(`[workbench] web search returned no results after ${maxAttempts} attempts: ${query.slice(0, 120)}`);
  return [];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function platformWebSearch(
  query: string,
  options: PlatformSearch & { maxResults: number; mode: WebSearchMode }
): Promise<WebSearchResult[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.mode.startsWith('deep') ? 35_000 : 15_000);
  try {
    const response = await fetch(`${options.baseURL.replace(/\/$/, '')}/v1/tools/web_search`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${options.sessionKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        num_results: Math.max(1, Math.min(options.maxResults, 10)),
        mode: options.mode
      })
    });
    if (!response.ok) return [];
    const payload = await response.json() as {
      results?: Array<{
        title?: unknown;
        url?: unknown;
        snippet?: unknown;
        published_date?: unknown;
        publishedDate?: unknown;
        author?: unknown;
        highlights?: unknown;
        provider?: unknown;
      }>;
    };
    return (payload.results ?? []).flatMap((result): WebSearchResult[] => {
      const title = typeof result.title === 'string' ? normalizeText(result.title) : '';
      const snippet = typeof result.snippet === 'string' ? normalizeText(result.snippet) : '';
      if (!title || !snippet) return [];
      return [{
        title,
        snippet,
        url: typeof result.url === 'string' ? result.url : undefined,
        publishedDate: typeof result.published_date === 'string'
          ? result.published_date
          : typeof result.publishedDate === 'string'
            ? result.publishedDate
            : undefined,
        author: typeof result.author === 'string' ? result.author : undefined,
        highlights: Array.isArray(result.highlights)
          ? result.highlights.filter((item): item is string => typeof item === 'string').map(normalizeText).filter(Boolean)
          : undefined,
        provider: result.provider === 'direct'
          ? 'direct'
          : result.provider === 'duckduckgo'
            ? 'duckduckgo'
            : result.provider === 'exa'
              ? 'exa'
              : 'firecrawl'
      }];
    });
  } finally {
    clearTimeout(timer);
  }
}

async function duckDuckGoSearch(query: string, maxResults: number): Promise<WebSearchResult[]> {
  const endpoint = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=in-en`;
  // DDG's HTML endpoint serves a results-free form page to obviously non-browser
  // user agents (verified live 2026-06-11: 2.6KB form vs 35KB of results). A
  // browser-shaped UA is required for the fallback search lane to work at all.
  const fetched = await safeWebFetch(endpoint, 160_000, {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    'Accept-Language': 'en-IN,en;q=0.9'
  }, true); // raw HTML — this parser needs the result anchors, not stripped text
  const html = fetched.text;
  const titleRe = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]+?)<\/a>/g;
  const snippetRe = /<a[^>]+class="result__snippet"[^>]*>([\s\S]+?)<\/a>/g;
  const titles: Array<{ title: string; url?: string }> = [];
  const snippets: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = titleRe.exec(html)) !== null) {
    titles.push({ url: decodeHtml(match[1]), title: normalizeText(match[2]) });
  }
  while ((match = snippetRe.exec(html)) !== null) {
    snippets.push(normalizeText(match[1]));
  }
  return titles.slice(0, Math.max(1, Math.min(maxResults, 10))).map((item, index) => ({
    title: item.title,
    snippet: snippets[index] ?? '',
    url: resolveDuckDuckGoUrl(item.url),
    provider: 'duckduckgo' as const
  })).filter((item) => item.title && item.snippet);
}

// DDG's HTML results link through protocol-relative redirects
// (//duckduckgo.com/l/?uddg=<encoded-target>); citations and webFetch need the
// real destination URL.
function resolveDuckDuckGoUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw.startsWith('//') ? `https:${raw}` : raw, 'https://duckduckgo.com');
    const target = url.searchParams.get('uddg');
    if (target && /^https?:\/\//i.test(target)) return target;
    return url.toString();
  } catch {
    return undefined;
  }
}

export async function webFetch(
  rawUrl: string,
  options: { maxBytes?: number; fresh?: boolean; platform?: PlatformSearch } = {}
): Promise<WebFetchResult> {
  const url = new URL(rawUrl);
  await assertPublicHostname(url.hostname);
  // PRIMARY: full-text fetch via the gateway Firecrawl scrape (clean markdown,
  // metered, key server-side). Falls back to a direct fetch only without creds.
  if (options.platform) {
    const scraped = await platformWebFetch(rawUrl, {
      ...options.platform,
      maxBytes: options.maxBytes ?? 100_000
    }).catch(() => null);
    if (scraped) return scraped;
  }
  const direct = await safeWebFetch(rawUrl, options.maxBytes ?? 100_000);
  return { ...direct, provider: 'direct' };
}

// platformWebFetch fetches one URL as clean markdown through the gateway's
// Firecrawl scrape endpoint (POST /v1/tools/web_scrape). The Workbench never
// holds a scrape key — only the plan session key.
async function platformWebFetch(
  rawUrl: string,
  options: PlatformSearch & { maxBytes: number }
): Promise<WebFetchResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35_000);
  try {
    const response = await fetch(`${options.baseURL.replace(/\/$/, '')}/v1/tools/web_scrape`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${options.sessionKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: rawUrl, max_chars: options.maxBytes })
    });
    if (!response.ok) return null;
    const payload = await response.json() as { url?: unknown; title?: unknown; markdown?: unknown };
    const text = typeof payload.markdown === 'string' ? payload.markdown : '';
    if (!text.trim()) return null;
    const finalUrl = typeof payload.url === 'string' && payload.url ? payload.url : rawUrl;
    const parsed = new URL(finalUrl);
    await assertPublicHostname(parsed.hostname);
    return {
      url: finalUrl,
      title: typeof payload.title === 'string' ? payload.title : undefined,
      contentType: 'text/markdown',
      text,
      provider: 'firecrawl'
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function safeWebFetch(
  rawUrl: string,
  maxBytes = 100_000,
  headers?: Record<string, string>,
  // raw=true returns the body as-is (needed by callers that parse markup, e.g.
  // the DDG results scraper); default strips HTML down to readable text.
  raw = false
): Promise<{ url: string; contentType: string; text: string }> {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Only HTTP(S) URLs can be fetched.');
  }
  await assertPublicHostname(url.hostname);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'DelegatorsWorkbench/1.0', ...headers }
    });
    if (!res.ok) {
      throw new Error(`Fetch failed with HTTP ${res.status}.`);
    }
    const finalUrl = new URL(res.url);
    await assertPublicHostname(finalUrl.hostname);
    const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
    if (!/text|json|xml|csv|html|markdown/i.test(contentType)) {
      throw new Error(`Unsupported content type: ${contentType}.`);
    }
    const reader = res.body?.getReader();
    if (!reader) {
      return { url: finalUrl.toString(), contentType, text: '' };
    }
    // maxBytes is the caller's useful excerpt limit, not the transfer size of
    // the source HTML. Real pages routinely need far more markup to yield a
    // short readable excerpt, so read through a separate bounded transport cap
    // and truncate safely instead of rejecting the entire source.
    const transportLimit = raw
      ? maxBytes
      : Math.min(1_000_000, Math.max(250_000, maxBytes * 24));
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = transportLimit - received;
      if (remaining <= 0) {
        await reader.cancel().catch(() => undefined);
        break;
      }
      chunks.push(value.byteLength > remaining ? value.subarray(0, remaining) : value);
      received += Math.min(value.byteLength, remaining);
      if (value.byteLength > remaining || received >= transportLimit) {
        await reader.cancel().catch(() => undefined);
        break;
      }
    }
    const htmlOrText = Buffer.concat(chunks).toString('utf8');
    return {
      url: finalUrl.toString(),
      contentType,
      text: (raw ? htmlOrText : htmlToText(htmlOrText)).slice(0, maxBytes)
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function safeImageFetch(
  rawUrl: string,
  maxBytes = 1_500_000
): Promise<WebImageResult> {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Only HTTP(S) image URLs can be fetched.');
  }
  await assertPublicHostname(url.hostname);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DelegatorsWorkbench/1.0)',
        Accept: 'image/png,image/jpeg;q=0.9'
      }
    });
    if (!response.ok) throw new Error(`Image fetch failed with HTTP ${response.status}.`);
    const finalUrl = new URL(response.url);
    await assertPublicHostname(finalUrl.hostname);
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
    if (contentType !== 'image/png' && contentType !== 'image/jpeg') {
      throw new Error(`Unsupported image content type: ${contentType || 'unknown'}.`);
    }
    const declared = Number.parseInt(response.headers.get('content-length') ?? '', 10);
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new Error(`Image exceeds ${maxBytes} bytes.`);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Image response has no body.');
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) throw new Error(`Image exceeds ${maxBytes} bytes.`);
      chunks.push(value);
    }
    return {
      url: finalUrl.toString(),
      contentType,
      body: Buffer.concat(chunks)
    };
  } finally {
    clearTimeout(timer);
  }
}

async function assertPublicHostname(hostname: string): Promise<void> {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host === 'metadata.google.internal') {
    throw new Error('Refusing to fetch local or metadata host.');
  }
  if (isBlockedIp(host)) {
    throw new Error('Refusing to fetch private, local, link-local, or metadata IP.');
  }
  if (net.isIP(host)) return;
  const records = await dns.lookup(host, { all: true, verbatim: true });
  if (records.length === 0 || records.some((record) => isBlockedIp(record.address))) {
    throw new Error('Refusing to fetch host that resolves to a private or metadata IP.');
  }
}

function isBlockedIp(value: string): boolean {
  const family = net.isIP(value);
  if (family === 4) {
    const parts = value.split('.').map((part) => Number.parseInt(part, 10));
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      value === '169.254.169.254'
    );
  }
  if (family === 6) {
    const lower = value.toLowerCase();
    return lower === '::' || lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:');
  }
  return false;
}

function parseToolArgs(raw: string): JsonRecord {
  const parsed = JSON.parse(raw || '{}') as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Tool arguments must be a JSON object.');
  }
  return parsed as JsonRecord;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Tool argument "${field}" must be a non-empty string.`);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function optionalSearchMode(value: unknown): WebSearchMode | undefined {
  return value === 'auto' || value === 'fast' || value === 'deep-lite' || value === 'deep' || value === 'deep-reasoning'
    ? value
    : undefined;
}

function toolOk(tool: string, summary: string, data?: unknown): ToolExecutionResult {
  return { ok: true, tool, summary, data };
}

function toolError(tool: string, summary: string): ToolExecutionResult {
  return { ok: false, tool, summary };
}

function htmlToText(value: string): string {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value: string): string {
  return htmlToText(value).slice(0, 500);
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
}
