const waiters = new Map<string, Set<() => void>>();

export function notifyRunEvent(runId: string): void {
  const listeners = waiters.get(runId);
  if (!listeners?.size) return;
  for (const wake of listeners) wake();
}

export function waitForRunEvent(runId: string, timeoutMs = 1500): Promise<void> {
  return new Promise((resolve) => {
    let timer: NodeJS.Timeout | undefined;
    const wake = () => {
      cleanup();
      resolve();
    };
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      waiters.get(runId)?.delete(wake);
    };
    timer = setTimeout(() => {
      cleanup();
      resolve();
    }, timeoutMs);
    if (!waiters.has(runId)) waiters.set(runId, new Set());
    waiters.get(runId)!.add(wake);
  });
}

export function clearRunEventWaiters(runId: string): void {
  waiters.delete(runId);
}