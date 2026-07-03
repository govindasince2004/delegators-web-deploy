import fs from 'node:fs/promises';
import path from 'node:path';
import { Redis } from 'ioredis';
import {
  WorkbenchRunEventSchema,
  WorkbenchRunSchema,
  type WorkbenchRun,
  type WorkbenchRunEvent,
  type WorkbenchRunStage,
  type WorkbenchStreamEvent
} from '../src/lib/shared.js';
import { defaultWorkspaceRoot } from './workspace.js';

export interface RunRepository {
  create(run: WorkbenchRun): Promise<void>;
  get(runId: string): Promise<WorkbenchRun | null>;
  findLatestByThreadId(threadId: string): Promise<WorkbenchRun | null>;
  update(runId: string, patch: Partial<Omit<WorkbenchRun, 'id' | 'createdAt'>>): Promise<WorkbenchRun>;
  appendEvent(runId: string, stage: WorkbenchRunStage, event: WorkbenchStreamEvent): Promise<WorkbenchRunEvent>;
  listEvents(runId: string, afterId?: string): Promise<WorkbenchRunEvent[]>;
  close?(): Promise<void>;
}

const runTtlSeconds = 30 * 24 * 60 * 60;
const maxEvents = 2000;

export function createRunRepository(): RunRepository {
  const redisUrl = process.env.WORKBENCH_REDIS_URL?.trim();
  return redisUrl
    ? new RedisRunRepository(redisUrl)
    : new FileRunRepository(path.join(defaultWorkspaceRoot(), '.runs'));
}

export class FileRunRepository implements RunRepository {
  private readonly writes = new Map<string, Promise<unknown>>();

  constructor(private readonly root: string) {}

  async create(run: WorkbenchRun): Promise<void> {
    const parsed = WorkbenchRunSchema.parse(run);
    await this.withWrite(run.id, async () => {
      await fs.mkdir(this.runDir(run.id), { recursive: true, mode: 0o700 });
      await this.writeJson(this.runPath(run.id), parsed);
      await fs.writeFile(this.eventsPath(run.id), '', { encoding: 'utf8', mode: 0o600 });
      if (parsed.threadId) {
        await this.indexThreadRun(parsed.threadId, parsed.id, parsed.updatedAt);
      }
    });
  }

  async get(runId: string): Promise<WorkbenchRun | null> {
    const raw = await fs.readFile(this.runPath(runId), 'utf8').catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    return raw ? WorkbenchRunSchema.parse(JSON.parse(raw)) : null;
  }

  async findLatestByThreadId(threadId: string): Promise<WorkbenchRun | null> {
    const indexed = await this.readThreadIndex(threadId);
    if (indexed) {
      const run = await this.get(indexed.runId).catch(() => null);
      if (run?.threadId === threadId) return run;
    }
    const entries = await fs.readdir(this.root).catch(() => [] as string[]);
    let latest: WorkbenchRun | null = null;
    for (const entry of entries) {
      if (!entry.startsWith('run_')) continue;
      const run = await this.get(entry).catch(() => null);
      if (!run || run.threadId !== threadId) continue;
      if (!latest || run.updatedAt > latest.updatedAt) latest = run;
    }
    return latest;
  }

  async update(
    runId: string,
    patch: Partial<Omit<WorkbenchRun, 'id' | 'createdAt'>>
  ): Promise<WorkbenchRun> {
    return this.withWrite(runId, async () => {
      const current = await this.get(runId);
      if (!current) throw new Error('Workbench run not found.');
      const next = WorkbenchRunSchema.parse({ ...current, ...patch, id: current.id, createdAt: current.createdAt });
      await this.writeJson(this.runPath(runId), next);
      if (next.threadId) {
        await this.indexThreadRun(next.threadId, next.id, next.updatedAt);
      }
      return next;
    });
  }

  async appendEvent(
    runId: string,
    stage: WorkbenchRunStage,
    event: WorkbenchStreamEvent
  ): Promise<WorkbenchRunEvent> {
    return this.withWrite(runId, async () => {
      const run = await this.get(runId);
      if (!run) throw new Error('Workbench run not found.');
      const envelope = WorkbenchRunEventSchema.parse({
        id: `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        runId,
        createdAt: new Date().toISOString(),
        stage,
        event
      });
      await fs.appendFile(this.eventsPath(runId), `${JSON.stringify(envelope)}\n`, { encoding: 'utf8' });
      await rotateEventLog(this.eventsPath(runId), maxEvents);
      return envelope;
    });
  }

  async listEvents(runId: string, afterId?: string): Promise<WorkbenchRunEvent[]> {
    const raw = await fs.readFile(this.eventsPath(runId), 'utf8').catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return '';
      throw error;
    });
    const events = raw
      .split('\n')
      .filter(Boolean)
      .map((line) => WorkbenchRunEventSchema.parse(JSON.parse(line)));
    if (!afterId) return events.slice(-maxEvents);
    const index = events.findIndex((event) => event.id === afterId);
    return index >= 0 ? events.slice(index + 1) : events.slice(-maxEvents);
  }

  private runDir(runId: string): string {
    return path.join(this.root, safeRunId(runId));
  }

  private runPath(runId: string): string {
    return path.join(this.runDir(runId), 'run.json');
  }

  private eventsPath(runId: string): string {
    return path.join(this.runDir(runId), 'events.ndjson');
  }

  private threadIndexDir(): string {
    return path.join(this.root, '_threads');
  }

  private threadIndexPath(threadId: string): string {
    const safe = threadId.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    return path.join(this.threadIndexDir(), `${safe}.json`);
  }

  private async readThreadIndex(threadId: string): Promise<{ runId: string; updatedAt: string } | null> {
    const raw = await fs.readFile(this.threadIndexPath(threadId), 'utf8').catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { runId?: unknown; updatedAt?: unknown };
    if (typeof parsed.runId !== 'string' || typeof parsed.updatedAt !== 'string') return null;
    return { runId: parsed.runId, updatedAt: parsed.updatedAt };
  }

  private async indexThreadRun(threadId: string, runId: string, updatedAt: string): Promise<void> {
    await fs.mkdir(this.threadIndexDir(), { recursive: true, mode: 0o700 });
    const current = await this.readThreadIndex(threadId);
    if (current && current.updatedAt > updatedAt && current.runId !== runId) return;
    await this.writeJson(this.threadIndexPath(threadId), { runId, updatedAt });
  }

  private async writeJson(target: string, value: unknown): Promise<void> {
    const temporary = `${target}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 });
    await fs.rename(temporary, target);
  }

  private async withWrite<T>(runId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.writes.get(runId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(operation);
    this.writes.set(runId, next);
    try {
      return await next;
    } finally {
      if (this.writes.get(runId) === next) this.writes.delete(runId);
    }
  }
}

export class RedisRunRepository implements RunRepository {
  private readonly redis: Redis;

  constructor(url: string) {
    this.redis = new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1
    });
  }

  async create(run: WorkbenchRun): Promise<void> {
    const parsed = WorkbenchRunSchema.parse(run);
    await this.ensureConnected();
    const pipeline = this.redis
      .multi()
      .set(this.runKey(run.id), JSON.stringify(parsed), 'EX', runTtlSeconds, 'NX')
      .del(this.eventsKey(run.id));
    if (parsed.threadId) {
      pipeline.set(this.threadKey(parsed.threadId), parsed.id, 'EX', runTtlSeconds);
    }
    await pipeline.exec();
  }

  async get(runId: string): Promise<WorkbenchRun | null> {
    await this.ensureConnected();
    const value = await this.redis.get(this.runKey(runId));
    return value ? WorkbenchRunSchema.parse(JSON.parse(value)) : null;
  }

  async findLatestByThreadId(threadId: string): Promise<WorkbenchRun | null> {
    await this.ensureConnected();
    const indexedRunId = await this.redis.get(this.threadKey(threadId));
    if (indexedRunId) {
      const indexed = await this.get(indexedRunId);
      if (indexed?.threadId === threadId) return indexed;
    }
    let cursor = '0';
    let latest: WorkbenchRun | null = null;
    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', 'wb:run:run_*', 'COUNT', 100);
      cursor = nextCursor;
      for (const key of keys) {
        const value = await this.redis.get(key);
        if (!value) continue;
        const run = WorkbenchRunSchema.parse(JSON.parse(value));
        if (run.threadId !== threadId) continue;
        if (!latest || run.updatedAt > latest.updatedAt) latest = run;
      }
    } while (cursor !== '0');
    return latest;
  }

  async update(
    runId: string,
    patch: Partial<Omit<WorkbenchRun, 'id' | 'createdAt'>>
  ): Promise<WorkbenchRun> {
    const current = await this.get(runId);
    if (!current) throw new Error('Workbench run not found.');
    const next = WorkbenchRunSchema.parse({ ...current, ...patch, id: current.id, createdAt: current.createdAt });
    const pipeline = this.redis
      .multi()
      .set(this.runKey(runId), JSON.stringify(next), 'EX', runTtlSeconds);
    if (next.threadId) {
      pipeline.set(this.threadKey(next.threadId), next.id, 'EX', runTtlSeconds);
    }
    await pipeline.exec();
    return next;
  }

  async appendEvent(
    runId: string,
    stage: WorkbenchRunStage,
    event: WorkbenchStreamEvent
  ): Promise<WorkbenchRunEvent> {
    await this.ensureConnected();
    const createdAt = new Date().toISOString();
    const payload = JSON.stringify({ runId, createdAt, stage, event });
    const id = await this.redis.xadd(this.eventsKey(runId), 'MAXLEN', '~', maxEvents, '*', 'payload', payload);
    if (!id) throw new Error('Redis did not create a Workbench event.');
    await this.redis.expire(this.eventsKey(runId), runTtlSeconds);
    return WorkbenchRunEventSchema.parse({ id, runId, createdAt, stage, event });
  }

  async listEvents(runId: string, afterId?: string): Promise<WorkbenchRunEvent[]> {
    await this.ensureConnected();
    const start = afterId ? `(${afterId}` : '-';
    const entries: Array<[string, string[]]> = await this.redis.xrange(
      this.eventsKey(runId),
      start,
      '+',
      'COUNT',
      maxEvents
    );
    return entries.flatMap(([id, fields]: [string, string[]]) => {
      const payloadIndex = fields.findIndex((field: string) => field === 'payload');
      if (payloadIndex < 0 || !fields[payloadIndex + 1]) return [];
      return [WorkbenchRunEventSchema.parse({ id, ...JSON.parse(fields[payloadIndex + 1]) })];
    });
  }

  async close(): Promise<void> {
    if (this.redis.status !== 'end') await this.redis.quit();
  }

  private async ensureConnected(): Promise<void> {
    if (this.redis.status === 'wait') await this.redis.connect();
  }

  private runKey(runId: string): string {
    return `wb:run:${safeRunId(runId)}`;
  }

  private eventsKey(runId: string): string {
    return `wb:events:${safeRunId(runId)}`;
  }

  private threadKey(threadId: string): string {
    const safe = threadId.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    return `wb:thread:${safe}`;
  }
}

function safeRunId(runId: string): string {
  if (!/^run_[a-zA-Z0-9-]{8,90}$/.test(runId)) {
    throw new Error('Invalid Workbench run id.');
  }
  return runId;
}

async function rotateEventLog(eventsPath: string, keep: number): Promise<void> {
  const raw = await fs.readFile(eventsPath, 'utf8').catch(() => '');
  const lines = raw.split('\n').filter(Boolean);
  if (lines.length <= keep) return;
  await fs.writeFile(eventsPath, `${lines.slice(-keep).join('\n')}\n`, { encoding: 'utf8', mode: 0o600 });
}
