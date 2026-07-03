import type { AccountSession } from './api';

export function isAccountSessionUsable(session: AccountSession, now = new Date()): boolean {
  return (
    (session.status === 'active' || session.status === 'inactive') &&
    new Date(session.expires_at).getTime() > now.getTime() &&
    session.remaining_percent > 0 &&
    session.provider_cost_used_paise < session.max_provider_cost_paise
  );
}

function byNewestFirst(a: AccountSession, b: AccountSession): number {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

// Gateway /v1/session/status returns id as the first 8 hex chars of the UUID.
export function sessionIdsMatch(statusId: string, sessionId: string): boolean {
  const compact = (id: string) => id.replace(/-/g, '').toLowerCase();
  const status = compact(statusId);
  const session = compact(sessionId);
  if (!status || !session) return false;
  if (status === session) return true;
  return session.startsWith(status) || status.startsWith(session);
}

export function usableAccountSessions(
  sessions: AccountSession[],
  now = new Date()
): AccountSession[] {
  return [...sessions]
    .sort(byNewestFirst)
    .filter((session) => isAccountSessionUsable(session, now));
}

export function newestUsableSession(
  sessions: AccountSession[],
  matches: (session: AccountSession) => boolean,
  now = new Date()
): AccountSession | undefined {
  return usableAccountSessions(sessions, now).find(matches);
}

export function activeSessionForProduct(
  sessions: AccountSession[],
  kind: AccountSession['kind'],
  now = new Date()
): AccountSession | undefined {
  return newestUsableSession(sessions, (session) => session.kind === kind, now);
}

// Newest usable SWE or unified pass — the surface the usage dashboard meters.
export function activeSweSession(
  sessions: AccountSession[],
  now = new Date()
): AccountSession | undefined {
  return newestUsableSession(
    sessions,
    (session) => session.kind === 'swe' || session.kind === 'unified',
    now
  );
}

export function sweAccountSessions(
  sessions: AccountSession[],
  now = new Date()
): AccountSession[] {
  return usableAccountSessions(sessions, now).filter(
    (session) => session.kind === 'swe' || session.kind === 'unified'
  );
}

// Human-friendly plan label, shared by the active-pass strip and the history list.
const PLAN_LABELS: Record<string, string> = {
  dlg_lite: 'Pro pass',
  dlg_pro: 'Retired ₹99 Pro pass',
  dlg_pro_t: 'Retired ₹119 Pro Thinking pass',
  dlg_ultra: 'UltraSpeed beta pass',
  lite_39: 'SWE Lite',
  lite_44: 'SWE Lite + Thinking',
  pro_59: 'SWE Pro',
  pro_64: 'SWE Pro + Thinking',
  ultra_99: 'SWE Ultra',
};

export function planLabel(code: string): string {
  return PLAN_LABELS[code] || code;
}

// The EFFECTIVE status for display: a pass past its window reads 'expired' even
// if the row still says active/inactive (the backend now reports this too, but
// the UI stays correct against any cache). 'exhausted' when the ₹ cap is spent.
export function effectiveStatus(session: AccountSession, now = new Date()): string {
  if (session.status === 'revoked' || session.status === 'expired') return session.status;
  if (new Date(session.expires_at).getTime() <= now.getTime()) return 'expired';
  if (
    session.max_provider_cost_paise > 0 &&
    session.provider_cost_used_paise >= session.max_provider_cost_paise
  ) {
    return 'exhausted';
  }
  return session.status;
}

// All SWE/unified passes the account has ever held, newest first — the source
// for the usage History list (includes expired/exhausted/revoked, unlike the
// usable-only views above).
export function sweHistorySessions(sessions: AccountSession[]): AccountSession[] {
  return [...sessions]
    .filter((session) => session.kind === 'swe' || session.kind === 'unified')
    .sort(byNewestFirst);
}
