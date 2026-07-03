import { History } from 'lucide-react';
import type { AccountSession } from '../lib/api';
import { effectiveStatus, planLabel, sweHistorySessions } from '../lib/accountSessions';

// Account-scoped usage history — every SWE/unified pass the signed-in owner has
// held, newest first, with spend against its cap and a truthful status. Sourced
// from /v1/account/sessions (Clerk-authenticated): no session keys are needed or
// exposed client-side, so an expired pass's record stays viewable after it ends.
export function UsageHistory({
  sessions,
  activeId,
}: {
  sessions: AccountSession[];
  activeId?: string | null;
}) {
  const history = sweHistorySessions(sessions);
  if (history.length === 0) return null;
  const now = new Date();

  return (
    <section className="mx-auto mt-4 max-w-[860px] border border-line bg-white p-6">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
        <History className="h-4 w-4 text-indigo-600" />
        Pass history
      </h2>
      <p className="mb-4 text-xs text-secondary">
        Every coding pass on this account. Spend is provider ₹ against each pass's cap — the limit
        that stops a session.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-line text-secondary">
              <th className="py-2 pr-4 font-medium">Purchased</th>
              <th className="py-2 pr-4 font-medium">Pass</th>
              <th className="py-2 pr-4 font-medium">Spent</th>
              <th className="py-2 pr-4 font-medium">Left</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {history.map((s) => {
              const status = effectiveStatus(s, now);
              const spent = (s.provider_cost_used_paise / 100).toFixed(2);
              const cap = (s.max_provider_cost_paise / 100).toFixed(2);
              const isActive = activeId ? idMatches(activeId, s.session_id) : false;
              return (
                <tr key={s.session_id} className="border-b border-line/60">
                  <td className="py-2 pr-4 text-foreground">{formatDate(s.created_at)}</td>
                  <td className="py-2 pr-4 text-foreground">
                    {planLabel(s.plan_code)}
                    {isActive ? (
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
                        live
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-4 text-foreground">
                    ₹{spent} <span className="text-secondary">/ ₹{cap}</span>
                  </td>
                  <td className="py-2 pr-4 text-foreground">{Math.max(0, s.remaining_percent)}%</td>
                  <td className="py-2">
                    <StatusBadge status={status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    inactive: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    expired: 'bg-[#f5f3ee] text-secondary border-line',
    exhausted: 'bg-amber-50 text-amber-700 border-amber-200',
    revoked: 'bg-red-50 text-red-700 border-red-200',
  };
  const label: Record<string, string> = {
    active: 'Active',
    inactive: 'Ready',
    expired: 'Ended',
    exhausted: 'Used up',
    revoked: 'Revoked',
  };
  const cls = styles[status] || 'bg-[#f5f3ee] text-secondary border-line';
  return (
    <span className={`inline-flex items-center border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {label[status] || status}
    </span>
  );
}

function idMatches(a: string, b: string): boolean {
  const compact = (id: string) => id.replace(/-/g, '').toLowerCase();
  const x = compact(a);
  const y = compact(b);
  if (!x || !y) return false;
  return x === y || x.startsWith(y) || y.startsWith(x);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
