import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  SignedIn,
  SignedOut,
  UserButton,
  useUser,
} from '@clerk/clerk-react';
import { Clock, KeyRound, RefreshCw, Wallet } from 'lucide-react';
import { clerkEnabled } from '../lib/clerk';
import { fetchAccountSessions, type AccountSession } from '../lib/api';
import { usableAccountSessions } from '../lib/accountSessions';
import { openSignedInWorkbench } from '../lib/workbench';

// Account home on the landing page: sign-in when signed out; live purchases
// (plan, credits bar, expiry) when signed in. Renders nothing when Clerk is not
// configured so the anonymous storefront keeps working unchanged.
export function AccountSection() {
  if (!clerkEnabled) return null;
  return (
    <section id="account" className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <SignedOut>
        <div className="glass-card flex flex-col items-start justify-between gap-3 rounded-2xl px-5 py-4 sm:flex-row sm:items-center">
          <p className="text-sm text-secondary">
            <span className="font-semibold text-foreground">Track your sessions &amp; credits</span>
            {' — '}sign in free, then every purchase lands in your dashboard.
          </p>
          <Link
            to="/sign-in"
            className="shrink-0 rounded-full bg-[#0A0A0A] px-5 py-2 text-sm font-semibold text-white transition hover:bg-black/85 active:scale-[0.98]"
          >
            Sign in
          </Link>
        </div>
      </SignedOut>
      <SignedIn>
        <AccountDashboard />
      </SignedIn>
    </section>
  );
}

function planLabel(code: string): string {
  const map: Record<string, string> = {
    dlg_lite: 'Pro pass', dlg_pro: 'Retired ₹99 Pro pass',
    dlg_pro_t: 'Retired ₹119 Pro Thinking pass', dlg_ultra: 'UltraSpeed beta pass',
    lite_39: 'SWE Lite', lite_44: 'SWE Lite + Thinking',
    pro_59: 'SWE Pro', pro_64: 'SWE Pro + Thinking',
    wb_29: 'Workbench ₹29', wb_49: 'Workbench ₹49',
    wb_99: 'Workbench ₹99', wb_199: 'Workbench ₹199',
  };
  return map[code] || code;
}

function isUnifiedPass(code: string): boolean {
  return code.startsWith('dlg_');
}

function timeLeft(expiresAt: string, now: number): string {
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return 'expired';
  const mins = Math.floor(ms / 60000);
  if (mins < 120) return `${Math.floor(mins / 60)}h ${mins % 60}m left`;
  const days = Math.floor(mins / 1440);
  if (days >= 1) return `${days}d ${Math.floor((mins % 1440) / 60)}h left`;
  return `${Math.floor(mins / 60)}h left`;
}

function AccountDashboard() {
  const { user } = useUser();
  const [sessions, setSessions] = useState<AccountSession[] | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      setError('');
      setSessions(await fetchAccountSessions());
    } catch {
      setError('Could not load your sessions. Retry in a moment.');
    }
  }, []);

  useEffect(() => {
    load();
    // Refresh when the user returns from Razorpay checkout in another tab.
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(tick);
    };
  }, [load]);

  const activeSessions = sessions === null
    ? null
    : usableAccountSessions(sessions, new Date(now));

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserButton />
          <div>
            <p className="text-sm font-semibold text-zinc-900">
              {user?.firstName ? `Welcome back, ${user.firstName}` : 'Your dashboard'}
            </p>
            <p className="text-xs text-zinc-500">Sessions &amp; Workbench credits on this account</p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 border border-line px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-black/5 hover:text-zinc-900"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {activeSessions !== null && activeSessions.length === 0 && !error && (
        <p className="text-sm text-zinc-500">
          No active plans. Buy a coding pack or Workbench credits and the active plan will appear here.
        </p>
      )}

      {activeSessions !== null && activeSessions.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activeSessions.map((s) => (
              <div
                key={s.session_id}
                className="border border-indigo-200 bg-indigo-50/40 p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
                    {s.kind === 'workbench' ? <Wallet className="h-4 w-4 text-indigo-500" /> : <KeyRound className="h-4 w-4 text-indigo-500" />}
                    {planLabel(s.plan_code)}
                  </span>
                  <span className="bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                    active
                  </span>
                </div>
                <div className="mb-1.5 h-1.5 overflow-hidden bg-zinc-200">
                  <div
                    className="h-full bg-indigo-500 transition-all"
                    style={{ width: `${Math.max(2, s.remaining_percent)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>
                    {s.kind === 'workbench' ? 'credits' : 'budget'} {s.remaining_percent}% left
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {timeLeft(s.expires_at, now)}
                  </span>
                </div>
                {isUnifiedPass(s.plan_code) ? (
                  // Unified pass: one budget, both surfaces. This is the user's
                  // home base — prominent buttons to the usage dashboard and the
                  // Workbench so they always know "how do I go back".
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <a
                      href="/dashboard"
                      className="flex h-9 items-center justify-center rounded-sm bg-[#080808] px-3 text-xs font-medium text-white transition hover:bg-black/80"
                    >
                      Open usage dashboard
                    </a>
                    <button
                      type="button"
                      onClick={() => openSignedInWorkbench()}
                      className="flex h-9 items-center justify-center rounded-sm border border-line bg-white px-3 text-xs font-medium text-foreground transition hover:bg-black/5"
                    >
                      Open Workbench
                    </button>
                  </div>
                ) : s.kind === 'workbench' ? (
                  <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium">
                    <a href="/dashboard" className="text-zinc-600 hover:text-zinc-900">Usage dashboard</a>
                    <button type="button" onClick={() => openSignedInWorkbench()} className="text-indigo-600 hover:text-indigo-500">Open Workbench</button>
                  </div>
                ) : (
                  <a href="/dashboard" className="mt-2 inline-block text-xs font-medium text-indigo-600 hover:text-indigo-500">Live usage dashboard →</a>
                )}
              </div>
          ))}
        </div>
      )}
    </div>
  );
}
