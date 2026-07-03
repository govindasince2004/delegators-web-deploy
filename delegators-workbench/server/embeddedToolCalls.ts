import type { CompletionTurn } from './harnessOrchestrator.js';
import type { ToolCall } from './workbenchTools.js';

const TOOL_CALL_BLOCK_RE = /<tool_call\b[^>]*>[\s\S]*?<\/tool_call>/gi;
const FUNCTION_BLOCK_RE = /<function(?:=([^\s>/]+)|\s+name=["']([^"']+)["'])[^>]*>([\s\S]*?)<\/function>/gi;
const PARAMETER_RE = /<parameter(?:=([^\s>/]+)|\s+name=["']([^"']+)["'])[^>]*>([\s\S]*?)<\/parameter>/gi;

const EMBEDDED_TOOL_MARKERS_RE = /<tool_call\b|<\/?function(?:=|\s+name=)|<parameter(?:=|\s+name=)/i;

const RUNTIME_ALIASES: Record<string, 'python3' | 'node' | 'bash'> = {
  bash: 'bash',
  shell: 'bash',
  sh: 'bash',
  python: 'python3',
  python3: 'python3',
  py: 'python3',
  node: 'node',
  javascript: 'node',
  js: 'node'
};

const WORKBENCH_TOOL_NAMES = new Set([
  'workspace_write',
  'workspace_read',
  'workspace_list',
  'workspace_delete',
  'workspace_checkpoint',
  'terminal_run',
  'artifact_validate',
  'artifact_export',
  'web_search',
  'web_fetch'
]);

export function looksLikeEmbeddedToolPayload(text: string): boolean {
  return EMBEDDED_TOOL_MARKERS_RE.test(text.trim());
}

export function stripEmbeddedToolPayload(text: string): string {
  let cleaned = text.replace(TOOL_CALL_BLOCK_RE, '');
  cleaned = cleaned.replace(FUNCTION_BLOCK_RE, '');
  return cleaned.replace(/\n{3,}/g, '\n\n').trim();
}

export function coalesceCompletionTurn(turn: CompletionTurn): CompletionTurn {
  const embedded = parseEmbeddedToolCalls(turn.content);
  if (embedded.toolCalls.length === 0) return turn;
  return {
    content: embedded.cleanedContent,
    toolCalls: [...turn.toolCalls, ...embedded.toolCalls]
  };
}

export function parseEmbeddedToolCalls(content: string): { cleanedContent: string; toolCalls: ToolCall[] } {
  if (!looksLikeEmbeddedToolPayload(content)) {
    return { cleanedContent: content, toolCalls: [] };
  }

  const toolCalls: ToolCall[] = [];
  const blocks = [...content.matchAll(TOOL_CALL_BLOCK_RE)];
  if (blocks.length > 0) {
    for (const block of blocks) {
      toolCalls.push(...parseFunctionBlocks(block[0]));
    }
  } else {
    toolCalls.push(...parseFunctionBlocks(content));
  }

  return {
    cleanedContent: stripEmbeddedToolPayload(content),
    toolCalls
  };
}

function parseFunctionBlocks(fragment: string): ToolCall[] {
  const calls: ToolCall[] = [];
  for (const match of fragment.matchAll(FUNCTION_BLOCK_RE)) {
    const rawName = (match[1] ?? match[2] ?? '').trim();
    const body = match[3] ?? '';
    if (!rawName) continue;
    const parameters = parseParameters(body);
    const normalized = normalizeEmbeddedToolCall(rawName, parameters);
    if (normalized) calls.push(normalized);
  }
  return calls;
}

function parseParameters(body: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const match of body.matchAll(PARAMETER_RE)) {
    const key = (match[1] ?? match[2] ?? '').trim();
    if (!key) continue;
    params[key] = (match[3] ?? '').trim();
  }
  return params;
}

function normalizeEmbeddedToolCall(
  rawName: string,
  parameters: Record<string, string>
): ToolCall | null {
  const name = rawName.trim();
  if (!name) return null;

  if (WORKBENCH_TOOL_NAMES.has(name)) {
    return makeToolCall(name, parameters);
  }

  const runtime = RUNTIME_ALIASES[name];
  if (runtime) {
    const code = parameters.code ?? parameters.command ?? parameters.script ?? '';
    if (!code.trim()) return null;
    const args: Record<string, unknown> = { runtime, code };
    const timeout = parameters.timeout ?? parameters.timeoutMs;
    if (timeout && Number.isFinite(Number(timeout))) {
      args.timeoutMs = Number(timeout);
    }
    return makeToolCall('terminal_run', args);
  }

  return null;
}

function makeToolCall(name: string, args: Record<string, unknown>): ToolCall {
  return {
    id: `embedded_${Math.random().toString(16).slice(2, 10)}`,
    function: {
      name,
      arguments: JSON.stringify(args)
    }
  };
}