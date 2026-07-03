import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CreateWorkbenchRunRequest, WorkbenchRun } from '../src/lib/shared';
import { RunCoordinator } from '../server/runCoordinator';
import { FileRunRepository } from '../server/runRepository';

let root = '';

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'dw-run-repository-'));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('Workbench durable runs', () => {
  it('persists run snapshots and resumable event history', async () => {
    const repository = new FileRunRepository(root);
    const now = new Date().toISOString();
    const run: WorkbenchRun = {
      id: 'run_12345678',
      operation: 'generate',
      status: 'queued',
      stage: 'intake',
      endpoint: 'https://api.xiaomimimo.com',
      model: 'mimo-v2.5-pro',
      createdAt: now,
      updatedAt: now
    };
    await repository.create(run);
    const first = await repository.appendEvent(run.id, 'plan', {
      type: 'status',
      message: 'Preparing artifact plan'
    });
    const second = await repository.appendEvent(run.id, 'research', {
      type: 'status',
      message: 'Searching current sources'
    });

    await expect(repository.get(run.id)).resolves.toMatchObject({ id: run.id, status: 'queued' });
    await expect(repository.listEvents(run.id)).resolves.toHaveLength(2);
    await expect(repository.listEvents(run.id, first.id)).resolves.toEqual([second]);
  });

  it('never persists provider credentials in the run record', async () => {
    const repository = new FileRunRepository(root);
    const coordinator = new RunCoordinator(repository, async () => artifact());
    const request = generationRequest();
    const run = await coordinator.create(request);
    await waitForRun(repository, run.id, 'completed');

    const disk = await fs.readFile(path.join(root, run.id, 'run.json'), 'utf8');
    expect(disk).not.toContain(request.sessionKey);
  });

  it('persists the run owner subject without persisting credentials', async () => {
    const repository = new FileRunRepository(root);
    const coordinator = new RunCoordinator(repository, async () => artifact());
    const request = generationRequest();
    const run = await coordinator.create(request, 'clerk:owner-subject-hash');
    await waitForRun(repository, run.id, 'completed');

    const saved = await repository.get(run.id);
    const disk = await fs.readFile(path.join(root, run.id, 'run.json'), 'utf8');
    expect(saved?.ownerSubject).toBe('clerk:owner-subject-hash');
    expect(disk).not.toContain(request.sessionKey);
  });

  it('persists prior artifacts and appends a new cross-format output', async () => {
    const repository = new FileRunRepository(root);
    const coordinator = new RunCoordinator(repository, async () => deckArtifact());
    const request = {
      ...generationRequest(),
      skill: 'deck' as const,
      outputFormat: 'pptx' as const,
      priorArtifacts: [artifact()]
    };
    const run = await coordinator.create(request);
    const completed = await waitForRun(repository, run.id, 'completed');

    expect(completed.artifactHistory?.map((item) => item.primaryFormat)).toEqual(['pdf', 'pptx']);
    expect(completed.artifactHistory?.map((item) => item.title)).toEqual([
      'Verified Report',
      'Verified Presentation'
    ]);
  });

  it('cancels an active executor through AbortSignal', async () => {
    const repository = new FileRunRepository(root);
    const coordinator = new RunCoordinator(repository, async (_request, context) => {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 10_000);
        context.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(context.signal.reason);
        }, { once: true });
      });
      return artifact();
    });
    const run = await coordinator.create(generationRequest());
    await waitForRun(repository, run.id, 'running');
    await coordinator.cancel(run.id);
    const cancelled = await waitForRun(repository, run.id, 'cancelled');

    expect(cancelled.status).toBe('cancelled');
    expect((await repository.listEvents(run.id)).at(-1)?.event).toEqual({
      type: 'status',
      message: 'Artifact run cancelled'
    });
  });

  it('pauses for clarification and resumes with live instructions', async () => {
    const repository = new FileRunRepository(root);
    const coordinator = new RunCoordinator(repository, async (_request, context) => {
      context.reporter.question({
        question: 'Who should this artifact be built for?',
        questions: [{
          id: 'audience',
          question: 'Who should this artifact be built for?',
          options: ['Beginners', 'Leadership'],
          allowCustom: true
        }]
      });
      const answers = await context.waitForInstructions();
      return {
        ...artifact(),
        executiveSummary: answers.join('\n')
      };
    });
    const run = await coordinator.create(generationRequest());
    await waitForRun(repository, run.id, 'waiting_input');

    await coordinator.instruct(run.id, 'Clarification answers:\nQ1: Audience\nA1: Beginners');
    const completed = await waitForRun(repository, run.id, 'completed');

    expect(completed.artifact?.executiveSummary).toContain('Beginners');
    expect((await repository.listEvents(run.id)).some((event) => event.event.type === 'question')).toBe(true);
  });

  it('rejects new runs when the active run cap is reached', async () => {
    const repository = new FileRunRepository(root);
    const previous = process.env.WORKBENCH_MAX_ACTIVE_RUNS;
    process.env.WORKBENCH_MAX_ACTIVE_RUNS = '1';
    try {
      const coordinator = new RunCoordinator(repository, async (_request, context) => {
        await new Promise<void>((_resolve, reject) => {
          context.signal.addEventListener('abort', () => {
            reject(context.signal.reason);
          }, { once: true });
        });
        return artifact();
      });
      const first = await coordinator.create(generationRequest());
      await expect(coordinator.create(generationRequest())).rejects.toThrow(/peak capacity/i);
      await coordinator.cancel(first.id);
      await waitForRun(repository, first.id, 'cancelled');
    } finally {
      if (previous === undefined) delete process.env.WORKBENCH_MAX_ACTIVE_RUNS;
      else process.env.WORKBENCH_MAX_ACTIVE_RUNS = previous;
    }
  });

  it('indexes thread lookups without scanning every run directory', async () => {
    const repository = new FileRunRepository(root);
    const now = new Date().toISOString();
    const run: WorkbenchRun = {
      id: 'run_threadidx1',
      operation: 'generate',
      status: 'queued',
      stage: 'intake',
      threadId: 'thread-index-1',
      endpoint: 'https://api.xiaomimimo.com',
      model: 'mimo-v2.5-pro',
      createdAt: now,
      updatedAt: now
    };
    await repository.create(run);
    await expect(repository.findLatestByThreadId('thread-index-1')).resolves.toMatchObject({
      id: 'run_threadidx1',
      threadId: 'thread-index-1'
    });
  });

  it('coalesces duplicate active runs for the same thread id', async () => {
    const repository = new FileRunRepository(root);
    const coordinator = new RunCoordinator(repository, async () => artifact());
    const request = { ...generationRequest(), threadId: 'thread-coalesce-1' };
    const first = await coordinator.create(request);
    const second = await coordinator.create(request);

    expect(second.id).toBe(first.id);
    await waitForRun(repository, first.id, 'completed');
  });

  it('rotates file-backed event logs to a bounded size', async () => {
    const repository = new FileRunRepository(root);
    const now = new Date().toISOString();
    const run: WorkbenchRun = {
      id: 'run_rotate12',
      operation: 'generate',
      status: 'queued',
      stage: 'intake',
      endpoint: 'https://api.xiaomimimo.com',
      model: 'mimo-v2.5-pro',
      createdAt: now,
      updatedAt: now
    };
    await repository.create(run);
    for (let index = 0; index < 2100; index += 1) {
      await repository.appendEvent(run.id, 'plan', {
        type: 'status',
        message: `heartbeat-${index}`
      });
    }
    const events = await repository.listEvents(run.id);
    expect(events.length).toBeLessThanOrEqual(2000);
    expect(events.at(-1)?.event).toEqual({ type: 'status', message: 'heartbeat-2099' });
  });

  it('marks a persisted nonterminal run as interrupted after coordinator restart', async () => {
    const repository = new FileRunRepository(root);
    const now = new Date().toISOString();
    const run: WorkbenchRun = {
      id: 'run_restart123',
      operation: 'generate',
      status: 'waiting_input',
      stage: 'inspect_inputs',
      endpoint: 'https://api.xiaomimimo.com',
      model: 'mimo-v2.5-pro',
      createdAt: now,
      updatedAt: now
    };
    await repository.create(run);

    const restartedCoordinator = new RunCoordinator(repository, async () => artifact());
    const recovered = await restartedCoordinator.get(run.id);

    expect(recovered?.status).toBe('interrupted');
    expect((await repository.listEvents(run.id)).at(-1)?.event).toEqual({
      type: 'status',
      message: 'Artifact task paused and is ready to resume'
    });
    await expect(restartedCoordinator.instruct(run.id, 'Continue')).rejects.toThrow(
      'Interrupted runs must be resumed before instructions can be added.'
    );
  });
});

function generationRequest(): CreateWorkbenchRunRequest {
  return {
    operation: 'generate',
    endpoint: 'https://api.xiaomimimo.com',
    sessionKey: 'sk-test-provider-key-1234567890',
    model: 'mimo-v2.5-pro',
    skill: 'report',
    style: 'professional',
    brief: 'Create a current professional report with verified citations.'
  };
}

function artifact() {
  return {
    kind: 'report' as const,
    title: 'Verified Report',
    audience: 'Leadership',
    tone: 'professional',
    executiveSummary: 'Verified summary.',
    sections: [{ heading: 'Finding', body: 'Verified content.', bullets: [] }],
    citations: [],
    nextQuestions: [],
    assets: [],
    primaryFormat: 'pdf' as const,
    design: {}
  };
}

function deckArtifact() {
  return {
    kind: 'deck' as const,
    title: 'Verified Presentation',
    audience: 'Leadership',
    tone: 'professional',
    executiveSummary: 'Verified presentation summary.',
    sections: [{ heading: 'Finding', body: 'Verified content.', bullets: [] }],
    slides: [{ title: 'Finding', bullets: ['Verified content.'] }],
    citations: [],
    nextQuestions: [],
    assets: [],
    primaryFormat: 'pptx' as const,
    design: {}
  };
}

async function waitForRun(
  repository: FileRunRepository,
  runId: string,
  status: WorkbenchRun['status']
): Promise<WorkbenchRun> {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const run = await repository.get(runId);
    if (run?.status === status) return run;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Run ${runId} did not reach ${status}.`);
}
