import { describe, expect, it } from 'vitest';
import { notifyRunEvent, waitForRunEvent } from '../server/runEventHub';

describe('run event hub', () => {
  it('wakes SSE waiters when a run event is published', async () => {
    const started = Date.now();
    const pending = waitForRunEvent('run_test_wake', 5000);
    await new Promise((resolve) => setTimeout(resolve, 40));
    notifyRunEvent('run_test_wake');
    await pending;
    expect(Date.now() - started).toBeLessThan(500);
  });
});