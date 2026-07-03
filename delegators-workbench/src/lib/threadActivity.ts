import type { WorkbenchProgressItem, WorkbenchRunStatus } from './shared.js';

export const ACTIVE_RUN_STATUSES: ReadonlySet<WorkbenchRunStatus> = new Set([
  'queued',
  'running',
  'waiting_input',
  'cancelling',
]);

export type ThreadActivityFields = {
  runId?: string;
  runStatus?: WorkbenchRunStatus;
  chatStreaming?: boolean;
};

export function isThreadWorking(thread: ThreadActivityFields | undefined): boolean {
  if (!thread) return false;
  if (thread.chatStreaming) return true;
  if (!thread.runStatus) return false;
  return ACTIVE_RUN_STATUSES.has(thread.runStatus);
}

type HydratedThreadLike = ThreadActivityFields & {
  messages?: Array<{ role: string; text?: string }>;
  pendingRequest?: unknown;
  artifact?: unknown;
  activityLog?: string[];
  planTitle?: string;
  planItems?: WorkbenchProgressItem[];
};

function isOrphanChatTurn(thread: HydratedThreadLike): boolean {
  if (thread.runId || thread.pendingRequest) return false;
  const messages = thread.messages ?? [];
  const last = messages.at(-1);
  return last?.role === 'user' && !messages.some((message) => message.role === 'assistant');
}

/** Drop reload orphans: a chat send that never finished leaves "hi" + a forever Thinking loop. */
export function sanitizeHydratedThread<T extends HydratedThreadLike>(thread: T): T {
  if (!isOrphanChatTurn(thread)) return thread;

  const messages = [...(thread.messages ?? [])];
  if (messages.at(-1)?.role === 'user') {
    messages.pop();
  }

  return {
    ...thread,
    messages,
    runStatus: undefined,
    activityLog: [],
    planTitle: undefined,
    planItems: [],
    chatStreaming: false
  };
}

export function sanitizeHydratedThreads<T extends HydratedThreadLike>(threads: T[]): T[] {
  return threads.map((thread) => sanitizeHydratedThread(thread));
}

export function appendActivityLog(
  current: string[] | undefined,
  message: string,
  max = 48
): string[] {
  const trimmed = message.trim();
  if (!trimmed) return current ?? [];
  const next = [...(current ?? []), trimmed];
  return next.length > max ? next.slice(-max) : next;
}

export function latestActivityMessage(
  activityLog: string[] | undefined,
  planTitle?: string
): string {
  const last = activityLog?.at(-1);
  if (last) return last;
  if (planTitle?.trim()) return planTitle;
  return 'Working';
}

export function mergeProgressItems(
  current: WorkbenchProgressItem[] | undefined,
  incoming: WorkbenchProgressItem[]
): WorkbenchProgressItem[] {
  if (!incoming.length) return current ?? [];
  const byId = new Map((current ?? []).map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()];
}