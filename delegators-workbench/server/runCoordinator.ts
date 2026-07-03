import {
  type ArtifactDocument,
  type CreateWorkbenchRunRequest,
  type WorkbenchProgressItem,
  type WorkbenchQuestion,
  type WorkbenchRun,
  type WorkbenchRunCheckpoint,
  type WorkbenchRunStage,
  type WorkbenchStreamEvent
} from '../src/lib/shared.js';
import { appendArtifactHistory } from '../src/lib/threadContext.js';
import type { RunRepository } from './runRepository.js';
import { clearRunEventWaiters, notifyRunEvent } from './runEventHub.js';
import { maxActiveWorkbenchRuns, workbenchCapacityError } from './runAdmission.js';
import { incrementCounter, setGauge } from './metrics.js';
import { sanitizeClientError, sanitizeStreamEvent } from './streamSanitizer.js';

export type RunProgressReporter = {
  status: (message: string) => void;
  plan: (title: string, items: WorkbenchProgressItem[]) => void;
  checklist: (items: WorkbenchProgressItem[]) => void;
  message: (text: string) => void;
  question: (question: WorkbenchQuestion) => void;
};

export type RunExecutionContext = {
  reporter: RunProgressReporter;
  signal: AbortSignal;
  drainInstructions: () => string[];
  waitForInstructions: () => Promise<string[]>;
  checkpoint: (phase: WorkbenchRunStage, note?: string) => Promise<void>;
  runId: string;
};

export type RunExecutor = (
  request: CreateWorkbenchRunRequest,
  context: RunExecutionContext
) => Promise<ArtifactDocument>;

type ActiveRun = {
  controller: AbortController;
  instructions: string[];
  instructionWaiters: Array<() => void>;
  cancelled: boolean;
};

export class RunCoordinator {
  private readonly active = new Map<string, ActiveRun>();
  private readonly interrupting = new Map<string, Promise<WorkbenchRun>>();

  activeRunCount(): number {
    return this.active.size;
  }

  constructor(
    readonly repository: RunRepository,
    private readonly executeRun: RunExecutor
  ) {}

  async create(request: CreateWorkbenchRunRequest, ownerSubject?: string): Promise<WorkbenchRun> {
    if (this.active.size >= maxActiveWorkbenchRuns()) {
      throw workbenchCapacityError();
    }

    if (request.threadId) {
      for (const runId of this.active.keys()) {
        const existing = await this.repository.get(runId);
        if (existing?.threadId === request.threadId && !isTerminal(existing.status)) {
          return existing;
        }
      }
      const persisted = await this.repository.findLatestByThreadId(request.threadId);
      if (persisted && !isTerminal(persisted.status) && persisted.status !== 'interrupted') {
        return persisted;
      }
    }

    const now = new Date().toISOString();
    const artifactHistory = request.operation === 'generate'
      ? request.priorArtifacts
      : [request.artifact];
    const run: WorkbenchRun = {
      id: `run_${crypto.randomUUID()}`,
      operation: request.operation,
      status: 'queued',
      stage: 'intake',
      threadId: request.threadId,
      ownerSubject,
      endpoint: request.endpoint,
      model: request.model,
      createdAt: now,
      updatedAt: now,
      artifactHistory: artifactHistory?.length ? artifactHistory : undefined
    };
    await this.repository.create(run);
    await this.repository.appendEvent(run.id, run.stage, {
      type: 'status',
      message: 'Queued artifact run'
    });
    notifyRunEvent(run.id);
    const active: ActiveRun = {
      controller: new AbortController(),
      instructions: [],
      instructionWaiters: [],
      cancelled: false
    };
    this.active.set(run.id, active);
    setGauge('workbench_active_runs', this.active.size);
    incrementCounter('workbench_runs_created_total');
    setImmediate(() => {
      void this.run(run.id, request, active);
    });
    return run;
  }

  async get(runId: string): Promise<WorkbenchRun | null> {
    const run = await this.repository.get(runId);
    if (!run || isTerminal(run.status) || this.active.has(runId)) return run;

    const existing = this.interrupting.get(runId);
    if (existing) return existing;

    const interruption = this.markInterrupted(run).finally(() => {
      this.interrupting.delete(runId);
    });
    this.interrupting.set(runId, interruption);
    return interruption;
  }

  async cancel(runId: string): Promise<WorkbenchRun> {
    const run = await this.requireRun(runId);
    if (isTerminal(run.status)) return run;
    const active = this.active.get(runId);
    const next = await this.repository.update(runId, {
      status: 'cancelling',
      updatedAt: new Date().toISOString()
    });
    await this.repository.appendEvent(runId, next.stage, {
      type: 'status',
      message: 'Stopping artifact run'
    });
    notifyRunEvent(runId);
    if (active) {
      active.cancelled = true;
      active.controller.abort(new DOMException('Run cancelled.', 'AbortError'));
    }
    return next;
  }

  async instruct(runId: string, instruction: string): Promise<WorkbenchRun> {
    const run = await this.requireRun(runId);
    if (run.status === 'interrupted') throw new Error('Interrupted runs must be resumed before instructions can be added.');
    if (isTerminal(run.status)) throw new Error('Completed runs cannot receive live instructions.');
    const active = this.active.get(runId);
    if (!active) throw new Error('This run is not active on the current Workbench worker.');
    active.instructions.push(instruction);
    active.instructionWaiters.splice(0).forEach((resolve) => resolve());
    await this.repository.update(runId, {
      status: 'running',
      updatedAt: new Date().toISOString()
    });
    await this.repository.appendEvent(runId, run.stage, {
      type: 'status',
      message: 'Added your instruction to the active run'
    });
    notifyRunEvent(runId);
    return run;
  }

  private async run(
    runId: string,
    request: CreateWorkbenchRunRequest,
    active: ActiveRun
  ): Promise<void> {
    let stage: WorkbenchRunStage = 'intake';
    let eventQueue: Promise<void> = Promise.resolve();
    const emit = async (event: WorkbenchStreamEvent) => {
      if (event.type === 'status') stage = stageForStatus(event.message, stage);
      if (event.type === 'plan') stage = stageForChecklist(event.items, stage);
      if (event.type === 'checklist') stage = stageForChecklist(event.items, stage);
      await this.repository.update(runId, {
        stage,
        status: event.type === 'question' ? 'waiting_input' : 'running',
        updatedAt: new Date().toISOString()
      });
      await this.repository.appendEvent(runId, stage, event);
      notifyRunEvent(runId);
    };
    const fire = (event: WorkbenchStreamEvent) => {
      const sanitized = sanitizeStreamEvent(event);
      if (sanitized.type === 'message' && !sanitized.text.trim()) return;
      eventQueue = eventQueue.then(() => emit(sanitized));
    };

    try {
      await this.repository.update(runId, {
        status: 'running',
        stage,
        updatedAt: new Date().toISOString()
      });
      const checkpoint = async (phase: WorkbenchRunStage, note?: string): Promise<void> => {
        const payload: WorkbenchRunCheckpoint = {
          phase,
          updatedAt: new Date().toISOString(),
          ...(note?.trim() ? { note: note.trim().slice(0, 240) } : {})
        };
        await this.repository.update(runId, {
          stage: phase,
          checkpoint: payload,
          updatedAt: payload.updatedAt
        });
      };

      const artifact = await this.executeRun(request, {
        runId,
        signal: active.controller.signal,
        drainInstructions: () => active.instructions.splice(0),
        waitForInstructions: () => waitForInstructions(active),
        checkpoint,
        reporter: {
          status: (message) => fire({ type: 'status', message }),
          plan: (title, items) => fire({ type: 'plan', title, items }),
          checklist: (items) => fire({ type: 'checklist', items }),
          message: (text) => fire({ type: 'message', text }),
          question: (question) => fire({ type: 'question', ...question })
        }
      });
      if (active.cancelled || active.controller.signal.aborted) {
        throw new DOMException('Run cancelled.', 'AbortError');
      }
      await eventQueue;
      stage = 'publish';
      await this.repository.appendEvent(runId, stage, { type: 'artifact', artifact });
      notifyRunEvent(runId);
      await this.repository.update(runId, {
        status: 'completed',
        stage,
        artifactHistory: appendArtifactHistory(
          (await this.repository.get(runId))?.artifactHistory ?? [],
          artifact
        ),
        artifact,
        error: undefined,
        updatedAt: new Date().toISOString()
      });
      incrementCounter('workbench_runs_completed_total');
    } catch (error) {
      await eventQueue.catch(() => undefined);
      if (active.cancelled || isAbortError(error)) {
        await this.repository.appendEvent(runId, stage, {
          type: 'status',
          message: 'Artifact run cancelled'
        });
        notifyRunEvent(runId);
        await this.repository.update(runId, {
          status: 'cancelled',
          stage,
          error: undefined,
          updatedAt: new Date().toISOString()
        });
        incrementCounter('workbench_runs_cancelled_total');
      } else {
        const message = sanitizeClientError(error);
        await this.repository.appendEvent(runId, stage, {
          type: 'error',
          message
        });
        notifyRunEvent(runId);
        await this.repository.update(runId, {
          status: 'failed',
          stage,
          error: message,
          updatedAt: new Date().toISOString()
        });
        incrementCounter('workbench_runs_failed_total');
      }
    } finally {
      this.active.delete(runId);
      setGauge('workbench_active_runs', this.active.size);
      clearRunEventWaiters(runId);
    }
  }

  private async requireRun(runId: string): Promise<WorkbenchRun> {
    const run = await this.get(runId);
    if (!run) throw new Error('Workbench run not found.');
    return run;
  }

  private async markInterrupted(run: WorkbenchRun): Promise<WorkbenchRun> {
    const next = await this.repository.update(run.id, {
      status: 'interrupted',
      updatedAt: new Date().toISOString()
    });
    await this.repository.appendEvent(run.id, next.stage, {
      type: 'status',
      message: 'Artifact task paused and is ready to resume'
    });
    notifyRunEvent(run.id);
    return next;
  }
}

async function waitForInstructions(active: ActiveRun): Promise<string[]> {
  if (active.instructions.length > 0) return active.instructions.splice(0);
  return new Promise((resolve, reject) => {
    const signal = active.controller.signal;
    const cleanup = () => {
      const index = active.instructionWaiters.indexOf(onInstruction);
      if (index >= 0) active.instructionWaiters.splice(index, 1);
      signal.removeEventListener('abort', onAbort);
    };
    const onInstruction = () => {
      cleanup();
      resolve(active.instructions.splice(0));
    };
    const onAbort = () => {
      cleanup();
      reject(signal.reason ?? new DOMException('Run cancelled.', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    active.instructionWaiters.push(onInstruction);
  });
}

function stageForStatus(message: string, current: WorkbenchRunStage): WorkbenchRunStage {
  if (/artifact plan|planning/i.test(message)) return 'plan';
  if (/search|source|research|reviewing \d+ source/i.test(message)) return 'research';
  if (/ground|verif|captured/i.test(message)) return 'ground';
  if (/outline|structure/i.test(message)) return 'outline';
  if (/draft|working draft|artifact preparation|analysis/i.test(message)) return 'compose';
  if (/downloadable|export|compile|render/i.test(message)) return 'compile';
  if (/validat|inspect/i.test(message)) return 'inspect';
  if (/repair/i.test(message)) return 'repair';
  if (/ready|publish/i.test(message)) return 'publish';
  return current;
}

function stageForChecklist(
  items: WorkbenchProgressItem[],
  current: WorkbenchRunStage
): WorkbenchRunStage {
  const active = items.find((item) => item.status === 'active');
  if (!active) return current;
  if (active.id === 'shape') return 'plan';
  if (active.id === 'clarify') return 'inspect_inputs';
  if (active.id === 'sources') return 'research';
  if (active.id === 'build' || active.id === 'revise') return 'compose';
  if (active.id === 'finish') return 'inspect';
  return current;
}

function isTerminal(status: WorkbenchRun['status']): boolean {
  return status === 'completed' || status === 'cancelled' || status === 'failed' || status === 'interrupted';
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError';
}
