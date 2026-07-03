import { Redis } from 'ioredis';

type RateLimitResult = {
  allowed: boolean;
  retryAfter?: number;
};

const memoryBuckets = new Map<string, { count: number; resetAt: number }>();
let redisClient: Redis | null | undefined;

function redisUrl(): string | null {
  const url = process.env.WORKBENCH_REDIS_URL?.trim();
  return url || null;
}

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const url = redisUrl();
  if (!url) {
    redisClient = null;
    return redisClient;
  }
  redisClient = new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1
  });
  return redisClient;
}

export function rateLimitWindowMs(): number {
  return Number.parseInt(process.env.WORKBENCH_RATE_WINDOW_MS ?? '60000', 10);
}

export function rateLimitMax(): number {
  return Number.parseInt(process.env.WORKBENCH_RATE_MAX ?? '30', 10);
}

export async function consumeRateLimit(
  scope: string,
  max = rateLimitMax(),
  windowMs = rateLimitWindowMs()
): Promise<RateLimitResult> {
  const key = `wb:ratelimit:${scope}`;
  const redis = getRedis();
  if (!redis) return consumeMemoryRateLimit(key, max, windowMs);

  try {
    if (redis.status === 'wait') await redis.connect();
    const count = await redis.incr(key);
    if (count === 1) await redis.pexpire(key, windowMs);
    if (count <= max) return { allowed: true };
    const retryAfterMs = await redis.pttl(key);
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((retryAfterMs > 0 ? retryAfterMs : windowMs) / 1000))
    };
  } catch {
    return consumeMemoryRateLimit(key, max, windowMs);
  }
}

function consumeMemoryRateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = memoryBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (bucket.count >= max) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    };
  }
  bucket.count += 1;
  return { allowed: true };
}

export function sweepMemoryRateBuckets(now = Date.now()): void {
  for (const [key, bucket] of memoryBuckets) {
    if (now >= bucket.resetAt) memoryBuckets.delete(key);
  }
}