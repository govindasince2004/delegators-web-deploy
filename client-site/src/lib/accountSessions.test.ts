import { describe, expect, it } from 'vitest';
import {
  activeSessionForProduct,
  activeSweSession,
  effectiveStatus,
  planLabel,
  sessionIdsMatch,
  sweHistorySessions,
  usableAccountSessions,
} from './accountSessions';
import type { AccountSession } from './api';

describe('active account product plans', () => {
  it('finds a usable Workbench wallet and ignores expired or exhausted wallets', () => {
    const sessions: AccountSession[] = [
      session({ session_id: 'expired', expires_at: '2026-06-14T00:00:00.000Z' }),
      session({ session_id: 'exhausted', remaining_percent: 0 }),
      session({ session_id: 'active', plan_code: 'wb_99', remaining_percent: 72 })
    ];

    expect(activeSessionForProduct(sessions, 'workbench', new Date('2026-06-15T00:00:00.000Z')))
      .toMatchObject({ session_id: 'active', plan_code: 'wb_99' });
  });

  it('finds an active unified dlg_* pass', () => {
    const sessions = [session({ kind: 'unified', plan_code: 'dlg_pro', session_id: 'dlg-active' })];
    expect(activeSessionForProduct(sessions, 'unified', new Date('2026-06-15T00:00:00.000Z')))
      .toMatchObject({ session_id: 'dlg-active', plan_code: 'dlg_pro' });
  });

  it('does not treat an active SWE plan as an active Workbench wallet', () => {
    const sessions = [session({ kind: 'swe', plan_code: 'pro_59' })];
    expect(activeSessionForProduct(sessions, 'workbench', new Date('2026-06-15T00:00:00.000Z')))
      .toBeUndefined();
  });

  it('picks the newest usable pass when several are still active', () => {
    const sessions: AccountSession[] = [
      session({ session_id: 'older', kind: 'swe', plan_code: 'pro_59', created_at: '2026-06-01T00:00:00.000Z' }),
      session({ session_id: 'newer', kind: 'swe', plan_code: 'pro_64', created_at: '2026-06-10T00:00:00.000Z' }),
    ];
    expect(activeSessionForProduct(sessions, 'swe', new Date('2026-06-15T00:00:00.000Z')))
      .toMatchObject({ session_id: 'newer', plan_code: 'pro_64' });
  });

  it('resolves the newest usable SWE or unified pass for the usage dashboard', () => {
    const sessions: AccountSession[] = [
      session({ session_id: 'wb', kind: 'workbench', plan_code: 'wb_99', created_at: '2026-06-12T00:00:00.000Z' }),
      session({ session_id: 'swe-old', kind: 'swe', plan_code: 'pro_59', created_at: '2026-06-01T00:00:00.000Z' }),
      session({ session_id: 'dlg-new', kind: 'unified', plan_code: 'dlg_pro', created_at: '2026-06-14T00:00:00.000Z' }),
    ];
    expect(activeSweSession(sessions, new Date('2026-06-15T00:00:00.000Z')))
      .toMatchObject({ session_id: 'dlg-new', plan_code: 'dlg_pro' });
  });

  it('matches gateway status ids to full session ids', () => {
    expect(sessionIdsMatch('550e8400', '550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(sessionIdsMatch('550e8400-e29b-41d4-a716-446655440000', '550e8400')).toBe(true);
    expect(sessionIdsMatch('deadbeef', '550e8400-e29b-41d4-a716-446655440000')).toBe(false);
  });

  it('removes revoked, expired, and exhausted purchases from the account landing view', () => {
    const sessions: AccountSession[] = [
      session({ session_id: 'revoked', status: 'revoked' }),
      session({ session_id: 'expired', expires_at: '2026-06-14T00:00:00.000Z' }),
      session({ session_id: 'empty', remaining_percent: 0 }),
      session({ session_id: 'active-workbench' }),
      session({ session_id: 'active-swe', kind: 'swe', plan_code: 'pro_59' })
    ];

    expect(usableAccountSessions(sessions, new Date('2026-06-15T00:00:00.000Z')))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ session_id: 'active-workbench' }),
        expect.objectContaining({ session_id: 'active-swe' })
      ]));
    expect(usableAccountSessions(sessions, new Date('2026-06-15T00:00:00.000Z')))
      .toHaveLength(2);
  });
});

describe('usage history', () => {
  const now = new Date('2026-06-15T00:00:00.000Z');

  it('lists every SWE/unified pass newest-first, including expired and exhausted', () => {
    const sessions: AccountSession[] = [
      session({ session_id: 'old', kind: 'swe', plan_code: 'pro_59', created_at: '2026-06-01T00:00:00.000Z' }),
      session({ session_id: 'wb', kind: 'workbench', plan_code: 'wb_99', created_at: '2026-06-12T00:00:00.000Z' }),
      session({ session_id: 'spent', kind: 'unified', plan_code: 'dlg_pro', created_at: '2026-06-10T00:00:00.000Z', remaining_percent: 0 }),
      session({ session_id: 'gone', kind: 'unified', plan_code: 'dlg_lite', created_at: '2026-06-14T00:00:00.000Z', expires_at: '2026-06-14T01:00:00.000Z' }),
    ];
    const history = sweHistorySessions(sessions);
    expect(history.map((s) => s.session_id)).toEqual(['gone', 'spent', 'old']);
  });

  it('reports the effective status (time-expired and cap-exhausted) for display', () => {
    expect(effectiveStatus(session({ expires_at: '2026-06-14T00:00:00.000Z' }), now)).toBe('expired');
    expect(effectiveStatus(session({ max_provider_cost_paise: 1000, provider_cost_used_paise: 1000 }), now)).toBe('exhausted');
    expect(effectiveStatus(session({ status: 'revoked' }), now)).toBe('revoked');
    expect(effectiveStatus(session({ status: 'active' }), now)).toBe('active');
  });

  it('maps plan codes to friendly labels and falls back to the code', () => {
    expect(planLabel('dlg_lite')).toBe('Pro pass');
    expect(planLabel('dlg_pro_t')).toBe('Retired ₹119 Pro Thinking pass');
    expect(planLabel('pro_59')).toBe('SWE Pro');
    expect(planLabel('mystery_plan')).toBe('mystery_plan');
  });
});

function session(overrides: Partial<AccountSession>): AccountSession {
  return {
    session_id: 'session',
    plan_code: 'wb_49',
    kind: 'workbench',
    status: 'active',
    created_at: '2026-06-01T00:00:00.000Z',
    expires_at: '2026-07-01T00:00:00.000Z',
    max_provider_cost_paise: 1000,
    provider_cost_used_paise: 100,
    remaining_percent: 90,
    ...overrides
  };
}
