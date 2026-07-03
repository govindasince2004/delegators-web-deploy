import {
  compactToolResult,
  createToolState,
  executeChatWebTool,
  executeWorkbenchTool,
  type ToolBudget,
  type ToolCall
} from './workbenchTools.js';
import type { PlatformSearch } from './workbenchTools.js';
import { buildWorkbenchClockContext } from './clockContext.js';
import { harnessDepthGuidance, type RunDepthTier } from './agenticDepth.js';
import { coalesceCompletionTurn } from './embeddedToolCalls.js';
import { listWorkspace, type WorkbenchWorkspace } from './workspace.js';

export type DelegatorsMessage = {
  role: string;
  content?: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

export type CompletionTurn = {
  content: string;
  toolCalls: ToolCall[];
};

export type CompleteTurn = (request: {
  messages: DelegatorsMessage[];
  temperature: number;
  toolsEnabled: boolean;
}) => Promise<CompletionTurn>;

export async function runWorkbenchHarness(options: {
  messages: DelegatorsMessage[];
  workspace: WorkbenchWorkspace;
  budget: ToolBudget;
  platformSearch?: PlatformSearch;
  onProgress?: (message: string) => void;
  signal?: AbortSignal;
  drainInstructions?: () => string[];
  completeTurn: CompleteTurn;
  initialTemperature: number;
  depthTier?: RunDepthTier;
  toolResultKeepCount?: number;
}): Promise<string> {
  const toolResultKeep = Math.max(2, options.toolResultKeepCount ?? 4);
  const state = createToolState();
  const snapshot = await listWorkspace(options.workspace);
  const workingMessages: DelegatorsMessage[] = [
    {
      role: 'system',
      content: buildHarnessSystemPrompt(
        options.workspace,
        options.budget,
        snapshot.files.map((file) => file.path),
        options.depthTier
      )
    },
    ...options.messages
  ];

  while (state.toolCalls < options.budget.maxToolCalls) {
    throwIfAborted(options.signal);
    const instructions = options.drainInstructions?.() ?? [];
    if (instructions.length > 0) {
      workingMessages.push({
        role: 'user',
        content: [
          'The user added these instructions while the run was active:',
          ...instructions.map((instruction) => `- ${instruction}`),
          'Apply them to the remaining work without restarting completed source checks unless necessary.'
        ].join('\n')
      });
    }
    options.onProgress?.('Choosing the next artifact step');
    const turn = coalesceCompletionTurn(await options.completeTurn({
      messages: compactOldToolResults(workingMessages, options.budget.maxToolResultBytes, toolResultKeep),
      temperature: options.initialTemperature,
      toolsEnabled: true
    }));
    if (turn.toolCalls.length === 0) {
      if (turn.content.trim().length > 0) return turn.content;
      throw new Error('Delegators endpoint returned an empty assistant message.');
    }

    workingMessages.push({
      role: 'assistant',
      content: turn.content || null,
      tool_calls: turn.toolCalls
    });

    const toolResults: Array<{ call: ToolCall; result: Awaited<ReturnType<typeof executeWorkbenchTool>> }> = [];
    for (const call of turn.toolCalls) {
      throwIfAborted(options.signal);
      options.onProgress?.(toolProgressMessage(call.function.name, 'start'));
      const result = await executeWorkbenchTool({
        call,
        workspace: options.workspace,
        budget: options.budget,
        state,
        platformSearch: options.platformSearch
      });
      options.onProgress?.(toolProgressMessage(
        call.function.name,
        result.ok ? 'done' : 'blocked',
        result.ok ? undefined : result.summary
      ));
      toolResults.push({ call, result });
    }
    for (const { call, result } of toolResults) {
      workingMessages.push({
        role: 'tool',
        tool_call_id: call.id,
        name: call.function.name,
        content: compactToolResult(result, options.budget.maxToolResultBytes)
      });
      if (state.toolCalls >= options.budget.maxToolCalls) break;
    }
  }

  throwIfAborted(options.signal);
  workingMessages.push({
    role: 'user',
    content: [
      'The Workbench tool budget is finished.',
      'Return the final artifact JSON now.',
      'Do not request more tools. Do not include Markdown.'
    ].join('\n')
  });

  const finalTurn = await options.completeTurn({
    messages: compactOldToolResults(workingMessages, options.budget.maxToolResultBytes, toolResultKeep),
    temperature: 0.05,
    toolsEnabled: false
  });
  if (finalTurn.content.trim().length === 0) {
    throw new Error('Delegators endpoint returned an empty assistant message after tool execution.');
  }
  return finalTurn.content;
}

export async function runChatHarness(options: {
  messages: DelegatorsMessage[];
  budget: ToolBudget;
  platformSearch: PlatformSearch;
  completeTurn: CompleteTurn;
  initialTemperature: number;
  signal?: AbortSignal;
}): Promise<string> {
  const state = createToolState();
  const workingMessages: DelegatorsMessage[] = [...options.messages];

  while (state.toolCalls < options.budget.maxToolCalls) {
    throwIfAborted(options.signal);
    const turn = coalesceCompletionTurn(await options.completeTurn({
      messages: compactOldToolResults(workingMessages, options.budget.maxToolResultBytes),
      temperature: options.initialTemperature,
      toolsEnabled: true
    }));
    if (turn.toolCalls.length === 0) {
      if (turn.content.trim().length > 0) return turn.content;
      throw new Error('Delegators endpoint returned an empty assistant message.');
    }

    workingMessages.push({
      role: 'assistant',
      content: turn.content || null,
      tool_calls: turn.toolCalls
    });

    const toolResults = await Promise.all(turn.toolCalls.map(async (call) => {
      throwIfAborted(options.signal);
      const result = await executeChatWebTool({
        call,
        budget: options.budget,
        state,
        platformSearch: options.platformSearch
      });
      return { call, result };
    }));
    for (const { call, result } of toolResults) {
      workingMessages.push({
        role: 'tool',
        tool_call_id: call.id,
        name: call.function.name,
        content: compactToolResult(result, options.budget.maxToolResultBytes)
      });
      if (state.toolCalls >= options.budget.maxToolCalls) break;
    }
  }

  throwIfAborted(options.signal);
  workingMessages.push({
    role: 'user',
    content: [
      'The chat web-research budget is finished.',
      'Answer the user now in plain prose or short Markdown.',
      'Do not request more tools. Do not expose tool names, raw tool logs, or implementation details.'
    ].join('\n')
  });

  const finalTurn = await options.completeTurn({
    messages: compactOldToolResults(workingMessages, options.budget.maxToolResultBytes),
    temperature: 0.3,
    toolsEnabled: false
  });
  if (finalTurn.content.trim().length === 0) {
    throw new Error('Delegators endpoint returned an empty assistant message after web research.');
  }
  return finalTurn.content;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  throw new DOMException('Run cancelled.', 'AbortError');
}

export function buildHarnessSystemPrompt(
  workspace: WorkbenchWorkspace,
  budget: ToolBudget,
  seededFiles: string[],
  depthTier: RunDepthTier = 'standard'
): string {
  return [
    buildWorkbenchClockContext(),
    'Delegators Workbench has a private execution harness for this turn.',
    ...harnessDepthGuidance(depthTier),
    `Workspace id: ${workspace.id}. Files are isolated to this workspace only.`,
    seededFiles.length ? `Seeded files: ${seededFiles.join(', ')}` : 'No files are seeded yet.',
    seededFiles.includes('skills/active/SKILL.md')
      ? 'Read skills/active/SKILL.md and skills/active/quality-checklist.md before drafting or validating the artifact.'
      : '',
    'If research/source-pack.md exists, treat it as the primary source for current public facts and citations.',
    'When research/source-pack.md exists, do not call web_search or web_fetch unless verifying one specific missing fact the pack explicitly could not cover.',
    'Use Workbench tools only when they materially improve the artifact: source research, data extraction, calculations, table shaping, file drafting, or validation.',
    'When the brief contains numeric facts, percentages, tables, spreadsheet data, or chart-ready values, use terminal_run or workspace files to compute and organize them instead of estimating mentally.',
    'For current facts, prices, laws, schedules, or citations, use web_search or web_fetch before making claims.',
    'For computation or file transformations, use terminal_run and write/read workspace files instead of guessing.',
    'Before risky file transformations, call workspace_checkpoint unless the host already created one for the current tool.',
    'Before final response, call artifact_validate when you created or transformed artifact JSON in the workspace.',
    'Never expose raw tool logs, workspace paths, credentials, or implementation details in the final artifact.',
    'Final response must be only the artifact JSON that matches the existing Workbench schema.',
    `Tool budget: max ${budget.maxToolCalls} tool calls, ${budget.maxTerminalRuns} terminal runs, ${budget.maxWebRequests} web requests, ${Math.round(budget.timeoutMs / 1000)}s wall policy.`
  ].filter(Boolean).join('\n');
}

function compactOldToolResults(
  messages: DelegatorsMessage[],
  maxToolResultBytes: number,
  keepCount = 4
): DelegatorsMessage[] {
  const toolIndexes = messages
    .map((message, index) => message.role === 'tool' ? index : -1)
    .filter((index) => index >= 0);
  const keep = new Set(toolIndexes.slice(-keepCount));
  return messages.map((message, index) => {
    if (message.role !== 'tool' || keep.has(index)) return message;
    const content = typeof message.content === 'string' ? message.content : '';
    if (content.includes('Older tool result compacted')) return message;
    return {
      ...message,
      content: compactToolResult({
        ok: true,
        tool: message.name ?? 'tool',
        summary: 'Older tool result compacted; use current workspace files or latest tool results for details.'
      }, maxToolResultBytes)
    };
  });
}

function toolProgressMessage(
  toolName: string,
  state: 'start' | 'done' | 'blocked',
  detail?: string
): string {
  const verb = state === 'start' ? 'Working on' : state === 'done' ? 'Completed' : 'Blocked on';
  let label = 'artifact preparation';
  if (toolName === 'web_search' || toolName === 'web_fetch') {
    label = 'source research';
  } else if (toolName === 'terminal_run') {
    label = 'source analysis';
  } else if (toolName === 'artifact_validate') {
    label = 'artifact validation';
  } else if (toolName === 'artifact_export') {
    label = 'export preparation';
  } else if (toolName.startsWith('workspace_')) {
    label = 'working draft files';
  }
  if (state === 'blocked' && detail?.trim()) {
    return `${verb} ${label}: ${detail.trim().slice(0, 120)}`;
  }
  return `${verb} ${label}`;
}
