import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearSessionLimitCaches,
  effectiveLlmConcurrency,
  resolveSessionStreamLimit
} from '../server/sessionLimits';

describe('session stream limits', () => {
  afterEach(() => {
    clearSessionLimitCaches();
    vi.unstubAllGlobals();
  });

  it('caps requested concurrency below the session stream limit', () => {
    expect(effectiveLlmConcurrency(2, 4)).toBe(1);
    expect(effectiveLlmConcurrency(3, 4)).toBe(2);
    expect(effectiveLlmConcurrency(8, 4)).toBe(4);
    expect(effectiveLlmConcurrency(undefined, 4)).toBe(1);
  });

  it('resolves stream limits from session status and workbench plans', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/v1/session/status')) {
        return new Response(JSON.stringify({ plan: 'wb_29' }), { status: 200 });
      }
      if (url.endsWith('/v1/workbench/plans')) {
        return new Response(JSON.stringify({
          plans: [{ code: 'wb_29', max_concurrent_streams: 2 }]
        }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(resolveSessionStreamLimit('sess_test_1234567890', 'http://gateway:8080')).resolves.toBe(2);
  });
});