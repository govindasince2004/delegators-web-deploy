import { describe, expect, it } from 'vitest';
import { consumeRateLimit } from '../server/rateLimiter';

describe('rate limiter', () => {
  it('enforces a fixed window in memory fallback mode', async () => {
    const scope = `memory-test-${Date.now()}`;
    const first = await consumeRateLimit(scope, 2, 60_000);
    const second = await consumeRateLimit(scope, 2, 60_000);
    const third = await consumeRateLimit(scope, 2, 60_000);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfter).toBeGreaterThan(0);
  });
});