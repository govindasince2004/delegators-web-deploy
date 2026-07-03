import { describe, expect, it } from 'vitest';
import { accountSessionToSessionStatus } from './api';
import type { AccountSession } from './api';

describe('accountSessionToSessionStatus', () => {
  it('maps account session budgets into session status fields', () => {
    const session: AccountSession = {
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      plan_code: 'dlg_pro',
      kind: 'unified',
      status: 'active',
      created_at: '2026-06-01T00:00:00.000Z',
      expires_at: '2026-07-16T12:00:00.000Z',
      max_provider_cost_paise: 1000,
      provider_cost_used_paise: 250,
      remaining_percent: 75,
    };

    const status = accountSessionToSessionStatus(session);
    expect(status.id).toBe('550e8400');
    expect(status.plan).toBe('dlg_pro');
    expect(status.provider_cost_limit_micro_paise).toBe(1_000_000_000);
    expect(status.provider_cost_used_micro_paise).toBe(250_000_000);
    expect(status.provider_cost_remaining_micro_paise).toBe(750_000_000);
    expect(status.remaining_minutes).toBeGreaterThan(0);
  });
});