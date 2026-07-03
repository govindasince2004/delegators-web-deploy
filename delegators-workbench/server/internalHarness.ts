import type { WorkbenchRunStage } from '../src/lib/shared.js';

/**
 * Internal specialist workers orchestrated by the parent harness.
 * Roles and labels never surface in the Workbench UI — the main agent owns all status.
 */
export type InternalSpecialistRole =
  | 'research_scout'
  | 'source_analyst'
  | 'outline_critic'
  | 'slide_composer'
  | 'quality_reviewer';

export type InternalSpecialistTask<T> = {
  role: InternalSpecialistRole;
  execute: (signal?: AbortSignal) => Promise<T>;
};

export async function runFatherOrchestrated<T extends readonly unknown[]>(
  tasks: { [K in keyof T]: InternalSpecialistTask<T[K]> },
  options: { concurrency?: number; signal?: AbortSignal } = {}
): Promise<T> {
  const concurrency = Math.max(1, options.concurrency ?? tasks.length);
  const results = new Array<unknown>(tasks.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < tasks.length) {
      if (options.signal?.aborted) {
        throw options.signal.reason ?? new DOMException('Aborted', 'AbortError');
      }
      const index = cursor;
      cursor += 1;
      const task = tasks[index];
      if (!task) return;
      results[index] = await task.execute(options.signal);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return results as unknown as T;
}

export function fatherStatusForPhase(phase: WorkbenchRunStage): string {
  switch (phase) {
    case 'research':
      return 'Searching current sources';
    case 'outline':
      return 'Locking narrative arc and slide roles';
    case 'compose':
      return 'Composing artifact';
    case 'inspect':
      return 'Validating artifact quality';
    case 'repair':
      return 'Repairing artifact structure';
    default:
      return 'Working';
  }
}