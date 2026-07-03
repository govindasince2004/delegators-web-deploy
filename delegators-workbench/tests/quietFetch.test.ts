import { afterEach, describe, expect, it, vi } from 'vitest';
import { isTransientHttpStatus, quietWorkbenchFetch } from '../src/lib/quietFetch';
import * as account from '../src/lib/account';

describe('quiet fetch helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('classifies transient HTTP statuses', () => {
    expect(isTransientHttpStatus(429)).toBe(true);
    expect(isTransientHttpStatus(503)).toBe(true);
    expect(isTransientHttpStatus(400)).toBe(false);
  });

  it('retries transient failures and returns the eventual success response', async () => {
    const fetchMock = vi.spyOn(account, 'workbenchFetch');
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ reply: 'hello' }), { status: 200 }));

    const response = await quietWorkbenchFetch('/api/agent/chat', { method: 'POST' }, { maxAttempts: 3 });
    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting transient retries', async () => {
    const fetchMock = vi.spyOn(account, 'workbenchFetch');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429 }));

    await expect(
      quietWorkbenchFetch('/api/agent/chat', { method: 'POST' }, { maxAttempts: 2 })
    ).rejects.toThrow(/busy right now/i);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});