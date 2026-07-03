import { useAuth } from '@clerk/clerk-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthPage } from '../components/AuthPage';
import { Dashboard } from '../components/Dashboard';
import { UsageHistory } from '../components/UsageHistory';
import {
  APIError,
  accountSessionToSessionStatus,
  fetchAccountSessions,
  fetchSessionStatus,
  fetchSessionUsage,
  loadSweDashboardForAccount,
  type AccountSession,
  type SessionStatus,
  type UsageEvent,
} from '../lib/api';
import { activeSweSession, sessionIdsMatch, sweAccountSessions } from '../lib/accountSessions';
import { clearSessionKey, getSessionKey, setSessionKey } from '../lib/auth';
import { clerkEnabled } from '../lib/clerk';

// /dashboard — the live SWE session dashboard (2-hour countdown + usage graph +
// endpoint/key copy). Signed-in owners auto-load their active session via
// sessions.user_id (authoritative) with a vault-key fallback; the paste-key
// prompt is only the fallback for anonymous visitors (or accounts with no usable
// session / missing vault binding).
export function Usage() {
  // Clerk hooks may only run under ClerkProvider, so the account-aware
  // variant is split out (same pattern as SWEProduct).
  if (!clerkEnabled) {
    return <UsageCore accountLoaded accountSignedIn={false} />;
  }
  return <UsageWithAccount />;
}

function UsageWithAccount() {
  const { isLoaded, isSignedIn } = useAuth();

  return <UsageCore accountLoaded={isLoaded} accountSignedIn={!!isSignedIn} />;
}

function UsageCore({
  accountLoaded,
  accountSignedIn,
}: {
  accountLoaded: boolean;
  accountSignedIn: boolean;
}) {
  const navigate = useNavigate();
  const [keyInput, setKeyInput] = useState('');
  const [activeKey, setActiveKey] = useState<string | null>(() =>
    accountSignedIn ? null : getSessionKey()
  );
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [loggingIn, setLoggingIn] = useState(false);
  const [resolvingAccount, setResolvingAccount] = useState(true);
  const [needsKey, setNeedsKey] = useState(false);
  const [accountSessions, setAccountSessions] = useState<AccountSession[]>([]);
  // null = not yet loaded; [] = loaded but the account has no SWE/unified passes.
  const [allSessions, setAllSessions] = useState<AccountSession[] | null>(null);

  const load = useCallback(async () => {
    if (accountSignedIn) {
      // The account session list is the backbone (history + active detection). If
      // even THIS fails it is a transient blip (network / 5xx / Clerk token mid-
      // refresh) — keep the last good view rather than wiping to "no plan active".
      let all: AccountSession[];
      try {
        all = await fetchAccountSessions();
      } catch {
        setResolvingAccount(false);
        return;
      }
      setAllSessions(all);
      setAccountSessions(sweAccountSessions(all));

      try {
        const snapshot = await loadSweDashboardForAccount();
        setStatus(snapshot.status);
        setEvents(snapshot.events);
        setNeedsKey(snapshot.needsKey);
        setActiveKey(snapshot.sessionKey);
        // Only forget the locally cached key when the account genuinely has no
        // usable pass at all — never on a transient hiccup.
        if (!snapshot.sessionKey && !snapshot.activePass) {
          clearSessionKey();
        }
      } catch {
        // We have the authoritative account list but the live status sub-fetch
        // failed transiently. Don't tear down a working dashboard; just make sure
        // the first paint still shows the active pass from account data.
        const active = activeSweSession(all);
        setStatus((prev) => prev ?? (active ? accountSessionToSessionStatus(active) : null));
        setNeedsKey((prev) => prev || Boolean(active));
      } finally {
        setResolvingAccount(false);
      }
      return;
    }

    setResolvingAccount(false);
    if (!getSessionKey()) return;
    try {
      const [s, u] = await Promise.all([fetchSessionStatus(), fetchSessionUsage()]);
      setStatus(s);
      setEvents(u.events || []);
      setNeedsKey(false);
    } catch (e) {
      // Only a DEFINITIVE auth failure means the key is dead — drop to the prompt.
      // A network blip must not nuke a working dashboard (the old flicker bug).
      if (e instanceof APIError && (e.status === 401 || e.status === 403 || e.status === 404)) {
        clearSessionKey();
        setActiveKey(null);
        setStatus(null);
        setEvents([]);
      }
    }
  }, [accountSignedIn]);

  useEffect(() => {
    if (!accountLoaded) return;
    if (!accountSignedIn && !activeKey) return;
    load();
    // 5s cadence: the dashboard advertises a REAL-TIME usage graph; calls made
    // from the IDE should appear within one breath, not half a minute.
    const tick = setInterval(load, 5_000);
    return () => clearInterval(tick);
  }, [activeKey, accountLoaded, accountSignedIn, load]);

  const handleLogin = async (key: string) => {
    setLoggingIn(true);
    setSessionKey(key.trim());
    setActiveKey(key.trim());
    await load();
    setLoggingIn(false);
  };

  // Signed-in owners get the full surface (active pass + history) resolved from
  // their identity, and are NEVER shown the paste-key prompt. The history keeps a
  // record of ended passes visible, so an expiring session degrades into a clean
  // "ended" view instead of vanishing into "no plan active".
  if (accountSignedIn) {
    if (!accountLoaded || (resolvingAccount && allSessions === null)) {
      return <LoadingPane />;
    }
    return (
      <>
        {needsKey ? (
          <NeedsKeyBanner onUseKey={handleLogin} keyInput={keyInput} setKeyInput={setKeyInput} loggingIn={loggingIn} />
        ) : null}
        {accountSessions.length > 0 ? (
          <PassStrip sessions={accountSessions} activeStatus={status} />
        ) : null}
        {status ? (
          <Dashboard sessionStatus={status} usageEvents={events} onRefresh={load} sessionKey={activeKey} />
        ) : (
          <NoActivePass hasHistory={(allSessions?.length ?? 0) > 0} />
        )}
        <UsageHistory sessions={allSessions ?? []} activeId={status?.id} />
      </>
    );
  }

  // Anonymous visitors authenticate with a pasted session key.
  if (!status) {
    if (!accountLoaded) {
      return <LoadingPane />;
    }
    return (
      <AuthPage
        keyInput={keyInput}
        setKeyInput={setKeyInput}
        isLoggingIn={loggingIn}
        onLogin={handleLogin}
        onBack={() => navigate('/')}
      />
    );
  }

  return (
    <Dashboard
      sessionStatus={status}
      usageEvents={events}
      onRefresh={load}
      sessionKey={activeKey}
    />
  );
}

function LoadingPane() {
  return (
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', color: '#8a8a8f' }}>
      Loading your session…
    </div>
  );
}

// Graceful empty state for a signed-in owner with no live pass — shown instead of
// the "gateway disconnected" card when a session has ended or none is active yet.
function NoActivePass({ hasHistory }: { hasHistory: boolean }) {
  return (
    <main className="min-h-[50vh] px-4 py-10">
      <section className="mx-auto max-w-[860px] border border-line bg-white p-8">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">
          {hasHistory ? 'Session ended' : 'No active pass'}
        </p>
        <h1 className="mt-4 text-3xl font-[400] tracking-tight text-foreground">
          {hasHistory ? 'Your last coding pass has wrapped up.' : 'No coding pass is active yet.'}
        </h1>
        <p className="mt-4 max-w-2xl text-secondary">
          {hasHistory
            ? 'Time on a pass is one-time and does not roll over. Your full history is below — grab another pass to start a fresh session.'
            : 'Buy a coding pass to spin up a live session, then point your CLI or coding tool at the endpoint.'}
        </p>
        <Link
          to="/pricing"
          className="mt-6 inline-flex h-10 items-center justify-center border border-[#11110f] bg-[#11110f] px-5 text-sm font-medium text-white hover:opacity-90"
        >
          Buy another pass
        </Link>
      </section>
    </main>
  );
}

function NeedsKeyBanner({
  keyInput,
  setKeyInput,
  loggingIn,
  onUseKey,
}: {
  keyInput: string;
  setKeyInput: (value: string) => void;
  loggingIn: boolean;
  onUseKey: (key: string) => void;
}) {
  return (
    <div style={{ maxWidth: 1180, margin: '24px auto 0', padding: '0 16px' }}>
      <div style={{ border: '1px solid #f59e0b', background: '#fffbeb', borderRadius: 8, padding: '12px 14px' }}>
        <p style={{ margin: '0 0 8px', fontSize: 13, color: '#92400e' }}>
          Your active pass is on this account, but live usage needs the session key. Paste the key from your purchase email to load call history.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (keyInput.trim()) onUseKey(keyInput);
          }}
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
        >
          <input
            value={keyInput}
            onChange={(event) => setKeyInput(event.target.value)}
            placeholder="sess_…"
            style={{ flex: '1 1 220px', border: '1px solid #e7e5e0', padding: '8px 10px', fontSize: 13 }}
          />
          <button
            type="submit"
            disabled={loggingIn || !keyInput.trim()}
            style={{ border: '1px solid #11110f', background: '#11110f', color: '#fff', padding: '8px 14px', fontSize: 13 }}
          >
            {loggingIn ? 'Loading…' : 'Load live usage'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Read-only strip listing SWE/unified passes on the account, with the one the
// dashboard is currently metering highlighted.
function PassStrip({ sessions, activeStatus }: { sessions: AccountSession[]; activeStatus: SessionStatus | null }) {
  const label = (code: string): string => {
    const map: Record<string, string> = {
      dlg_lite: 'Pro pass', dlg_pro: 'Retired ₹99 Pro pass', dlg_pro_t: 'Retired ₹119 Pro Thinking pass', dlg_ultra: 'UltraSpeed beta pass',
      lite_39: 'SWE Lite', lite_44: 'SWE Lite + Thinking', pro_59: 'SWE Pro', pro_64: 'SWE Pro + Thinking',
    };
    return map[code] || code;
  };
  return (
    <div style={{ maxWidth: 1180, margin: '24px auto 0', padding: '0 16px' }}>
      <div style={{ border: '1px solid var(--line, #e7e5e0)', background: '#fff', borderRadius: 8, padding: '12px 14px' }}>
        <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#8a8a8f', margin: '0 0 8px' }}>
          Active SWE pass on this account
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {sessions.map((s) => {
            const isActive = activeStatus ? sessionIdsMatch(activeStatus.id, s.session_id) : false;
            return (
              <div
                key={s.session_id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  border: isActive ? '1px solid #6366f1' : '1px solid var(--line, #e7e5e0)',
                  background: isActive ? '#eef2ff' : '#faf9f6',
                  borderRadius: 6, padding: '6px 10px', fontSize: 12,
                }}
              >
                <strong style={{ color: '#11110f' }}>{label(s.plan_code)}</strong>
                <span style={{ color: '#8a8a8f' }}>{s.remaining_percent}% left</span>
                {isActive ? (
                  <span style={{ color: '#4f46e5', fontWeight: 600 }}>· showing</span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
