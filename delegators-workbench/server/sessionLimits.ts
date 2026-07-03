type PlanLimitCache = {
  fetchedAt: number;
  limits: Map<string, number>;
};

const planCache: PlanLimitCache = {
  fetchedAt: 0,
  limits: new Map()
};

const sessionCache = new Map<string, { fetchedAt: number; streamLimit: number }>();
const cacheTtlMs = Number.parseInt(process.env.WORKBENCH_SESSION_LIMIT_CACHE_MS ?? '60000', 10);

export function effectiveLlmConcurrency(streamLimit: number | undefined, requested: number): number {
  const safeRequested = Math.max(1, requested);
  if (!streamLimit || streamLimit < 2) return 1;
  return Math.min(safeRequested, Math.max(1, streamLimit - 1));
}

async function loadWorkbenchPlanLimits(baseURL: string): Promise<Map<string, number>> {
  const now = Date.now();
  if (now - planCache.fetchedAt < cacheTtlMs && planCache.limits.size > 0) {
    return planCache.limits;
  }
  const response = await fetch(`${baseURL.replace(/\/$/, '')}/v1/workbench/plans`, {
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) return planCache.limits;
  const payload = await response.json().catch(() => null) as {
    plans?: Array<{ code?: unknown; max_concurrent_streams?: unknown }>;
  } | null;
  const limits = new Map<string, number>();
  for (const plan of payload?.plans ?? []) {
    if (typeof plan.code !== 'string') continue;
    const streamLimit = typeof plan.max_concurrent_streams === 'number'
      ? plan.max_concurrent_streams
      : Number.parseInt(String(plan.max_concurrent_streams ?? ''), 10);
    if (Number.isFinite(streamLimit) && streamLimit > 0) {
      limits.set(plan.code, streamLimit);
    }
  }
  if (limits.size > 0) {
    planCache.fetchedAt = now;
    planCache.limits = limits;
  }
  return planCache.limits;
}

export async function resolveSessionStreamLimit(
  sessionKey: string,
  baseURL: string
): Promise<number | undefined> {
  const cacheKey = `${baseURL}:${sessionKey.slice(0, 24)}`;
  const cached = sessionCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < cacheTtlMs) {
    return cached.streamLimit;
  }

  const response = await fetch(`${baseURL.replace(/\/$/, '')}/v1/session/status`, {
    headers: { Authorization: `Bearer ${sessionKey.trim()}` },
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) return cached?.streamLimit;
  const status = await response.json().catch(() => null) as { plan?: unknown } | null;
  const planCode = typeof status?.plan === 'string' ? status.plan : '';
  if (!planCode) return cached?.streamLimit;

  const limits = await loadWorkbenchPlanLimits(baseURL);
  const streamLimit = limits.get(planCode);
  if (!streamLimit) return cached?.streamLimit;

  sessionCache.set(cacheKey, { fetchedAt: now, streamLimit });
  return streamLimit;
}

export function clearSessionLimitCaches(): void {
  planCache.fetchedAt = 0;
  planCache.limits.clear();
  sessionCache.clear();
}