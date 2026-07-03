import type React from 'react';
import { useEffect, useState } from 'react';
import { Check, Copy, Eye, EyeOff, KeyRound, RefreshCw, TimerReset } from 'lucide-react';
import { getAPIBaseURL, type SessionStatus, type UsageEvent } from '../lib/api';

interface DashboardProps {
  sessionStatus: SessionStatus | null;
  usageEvents: UsageEvent[];
  onRefresh: () => void;
  sessionKey: string | null;
}

// Deliberately minimal: one paragraph of live facts (prompts used, runtime,
// model) and a 2-hour countdown. No charts — the gateway ledger is the source
// of truth and the admin panel owns deep analytics.
export const Dashboard: React.FC<DashboardProps> = ({
  sessionStatus,
  usageEvents,
  onRefresh,
  sessionKey,
}) => {
  const [copied, setCopied] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [now, setNow] = useState(Date.now());
  const apiBaseURL = `${getAPIBaseURL().replace(/\/$/, '')}/v1`;

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const copy = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(''), 1600);
  };

  if (!sessionStatus) {
    return (
      <main className="min-h-screen px-4 py-10">
        <section className="mx-auto max-w-[860px] border border-line bg-white p-8">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">Gateway disconnected</p>
          <h1 className="mt-4 text-4xl font-[400] tracking-tight text-foreground">Session status is unavailable.</h1>
          <p className="mt-4 max-w-2xl text-secondary">
            Enter a valid session key to see your endpoint, prompts used, and time remaining.
          </p>
        </section>
      </main>
    );
  }

  const promptCount = usageEvents.length;
  const startedAtMs = new Date(sessionStatus.created_at).getTime();
  const expiresAtMs = new Date(sessionStatus.expires_at).getTime();
  const runtime = formatDuration(Math.max(0, now - startedAtMs));
  const remainingMs = Math.max(0, expiresAtMs - now);
  const countdown = formatCountdown(remainingMs);
  const expired = remainingMs <= 0;
  // The real window length for this pass (unified passes are 250 min),
  // derived from the session itself — never a hardcoded "2-hour" assumption.
  const windowLabel = formatDuration(Math.max(0, expiresAtMs - startedAtMs));

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-[860px]">
        <header className="mb-6 flex flex-col gap-5 border border-line bg-white p-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">Live session</p>
            <h1 className="mt-3 text-4xl font-[400] tracking-tight text-foreground">Your session.</h1>
          </div>
          <button
            onClick={onRefresh}
            className="inline-flex h-10 items-center justify-center gap-2 border border-line px-4 text-sm font-medium text-foreground hover:bg-black/5"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </header>

        <section className="border border-line bg-white p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <TimerReset className="h-4 w-4 text-indigo-600" />
              Session timer · {windowLabel} window
            </span>
            <span
              className={`font-mono text-3xl tracking-tight ${expired ? 'text-secondary' : 'text-foreground'}`}
            >
              {expired ? 'ended' : countdown}
            </span>
          </div>
          <p className="text-base leading-7 text-secondary">
            This <span className="font-medium text-foreground">{sessionStatus.plan}</span> session has
            served <span className="font-medium text-foreground">{promptCount} prompt{promptCount === 1 ? '' : 's'}</span> and
            has been running for <span className="font-medium text-foreground">{runtime}</span>. Status:{' '}
            <span className="font-medium text-foreground">{sessionStatus.status}</span>. It expires
            automatically when the timer above reaches zero — unused time is not refundable, so keep
            your coding tool pointed at the endpoint below until you are done.
          </p>
        </section>

        <UsageGraphs events={usageEvents} status={sessionStatus} />

        <section className="mt-4 border border-line bg-white p-6">
          <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold text-foreground">
            <KeyRound className="h-4 w-4 text-indigo-600" />
            Configuration
          </h2>
          <div className="space-y-3">
            <ConfigRow
              label="API endpoint"
              value={apiBaseURL}
              onCopy={() => copy('base', apiBaseURL)}
              copied={copied === 'base'}
            />
            {sessionKey && (
              <div className="border border-line bg-[#faf9f6] p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary">
                    Session key
                  </span>
                  <span className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowKey((v) => !v)}
                      className="text-secondary hover:text-foreground"
                      aria-label="Toggle key visibility"
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => copy('key', sessionKey)}
                      className="text-secondary hover:text-foreground"
                      aria-label="Copy session key"
                    >
                      {copied === 'key' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </span>
                </div>
                <p className="break-all font-mono text-sm text-foreground">
                  {showKey ? sessionKey : `${sessionKey.slice(0, 10)}••••••••••••••••`}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
};

// Real-time usage from the gateway ledger (provider-reported tokens), polled
// every 5 seconds. The PRIMARY meter is provider-₹ spend against the cap that
// actually hard-stops the session — the output-token budget is NOT the binding
// limit, so showing it made usage look like it had headroom while real money
// burned. Cache hit/miss and a per-model breakdown make the numbers self-
// explanatory (cache reads are ~free, so two similar calls can cost very
// differently). Everything here is real; nothing is synthesized.
function UsageGraphs({
  events,
  status,
}: {
  events: UsageEvent[];
  status: SessionStatus;
}) {
  const totalTokensIn = events.reduce((sum, e) => sum + e.prompt_tokens, 0);
  const totalTokensOut = events.reduce((sum, e) => sum + e.completion_tokens, 0);
  const totalCacheHit = events.reduce((sum, e) => sum + (e.cache_hit_tokens || 0), 0);
  const totalCacheMiss = events.reduce((sum, e) => sum + (e.cache_miss_tokens || 0), 0);
  const cacheDenom = totalCacheHit + totalCacheMiss;
  const cacheHitPct = cacheDenom > 0 ? Math.round((totalCacheHit / cacheDenom) * 100) : 0;
  const avgLatency = events.length
    ? Math.round(events.reduce((sum, e) => sum + e.latency_ms, 0) / events.length)
    : 0;

  // The binding constraint: provider cost vs the cap that stops the session.
  const costUsedMicro = status.provider_cost_used_micro_paise || 0;
  const costLimitMicro =
    status.provider_cost_limit_micro_paise || (status.max_provider_cost_paise || 0) * 1_000_000;
  const costUsedRupees = costUsedMicro / 100_000_000;
  const costLimitRupees = costLimitMicro / 100_000_000;
  const costPct = costLimitMicro > 0 ? Math.min(100, (costUsedMicro / costLimitMicro) * 100) : 0;
  const costColor = costPct >= 90 ? 'bg-red-500' : costPct >= 70 ? 'bg-amber-500' : 'bg-indigo-600';

  // Per-model breakdown — an Ultra plan ships Ultra/Pro/Lite lanes.
  type ModelAgg = { calls: number; tin: number; tout: number; hit: number; miss: number; costMicro: number };
  const byModel = new Map<string, ModelAgg>();
  for (const e of events) {
    const m = byModel.get(e.model) || { calls: 0, tin: 0, tout: 0, hit: 0, miss: 0, costMicro: 0 };
    m.calls += 1;
    m.tin += e.prompt_tokens;
    m.tout += e.completion_tokens;
    m.hit += e.cache_hit_tokens || 0;
    m.miss += e.cache_miss_tokens || 0;
    m.costMicro += e.cost_micro_paise || e.cost_paise * 1_000_000;
    byModel.set(e.model, m);
  }
  const models = [...byModel.entries()].sort((a, b) => b[1].costMicro - a[1].costMicro);

  // Cumulative provider ₹ over the session — monotonic, meaningful even at one
  // or two calls, plotted against the cap (top of the chart = cap). Events
  // arrive newest-first; reverse to chronological order.
  const W = 720;
  const H = 120;
  const capMicro = costLimitMicro > 0 ? costLimitMicro : 1;
  const chrono = [...events].reverse();
  let cum = 0;
  const pts = chrono.map((e, i) => {
    cum += e.cost_micro_paise || e.cost_paise * 1_000_000;
    const x = chrono.length <= 1 ? W : (i / (chrono.length - 1)) * W;
    const y = H - 18 - Math.min(1, cum / capMicro) * (H - 26);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const linePath = pts.length ? `M ${pts.join(' L ')}` : '';
  const areaPath = pts.length >= 2 ? `${linePath} L ${W},${H - 18} L 0,${H - 18} Z` : '';

  const latest = events.slice(0, 8);

  return (
    <section className="mt-4 border border-line bg-white p-6">
      <div className="mb-1 flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-foreground">Provider spend — live</h2>
        <span className="text-xs text-secondary">refreshes every 5s</span>
      </div>
      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-secondary">
        <span><span className="font-medium text-foreground">{events.length}</span> calls</span>
        <span><span className="font-medium text-foreground">{compactNum(totalTokensIn)}</span> in</span>
        <span><span className="font-medium text-foreground">{compactNum(totalTokensOut)}</span> out</span>
        <span><span className="font-medium text-foreground">{cacheHitPct}%</span> cache hit</span>
        <span><span className="font-medium text-foreground">{avgLatency}</span> ms avg</span>
      </div>

      <div className="mt-1">
        <div className="mb-1 flex items-center justify-between text-xs text-secondary">
          <span>Provider cost — the limit that stops the session</span>
          <span>
            <span className="font-medium text-foreground">₹{costUsedRupees.toFixed(2)}</span> / ₹{costLimitRupees.toFixed(2)} ({Math.round(costPct)}%)
          </span>
        </div>
        <div className="h-2.5 w-full bg-[#ECEAE4]">
          <div className={`h-2.5 ${costColor}`} style={{ width: `${costPct}%` }} />
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" preserveAspectRatio="none" aria-label="Cumulative provider spend vs cap">
        <line x1="0" y1={H - 18} x2={W} y2={H - 18} stroke="#e7e5e0" strokeWidth="1" />
        <line x1="0" y1="8" x2={W} y2="8" stroke="#e7b7b7" strokeWidth="1" strokeDasharray="4 4" />
        <text x="2" y="6" fontSize="10" fill="#b66b6b">cap ₹{costLimitRupees.toFixed(2)}</text>
        {areaPath && <path d={areaPath} fill="#4F46E5" fillOpacity="0.12" />}
        {linePath && <path d={linePath} fill="none" stroke="#4F46E5" strokeWidth="2" />}
        <text x="2" y={H - 4} fontSize="10" fill="#8a8678">session start</text>
        <text x={W - 24} y={H - 4} fontSize="10" fill="#8a8678">now</text>
      </svg>

      {models.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-xs font-semibold text-foreground">Per-model usage</div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line text-secondary">
                  <th className="py-2 pr-4 font-medium">Model</th>
                  <th className="py-2 pr-4 font-medium">Calls</th>
                  <th className="py-2 pr-4 font-medium">In / out</th>
                  <th className="py-2 pr-4 font-medium">Cache hit</th>
                  <th className="py-2 font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {models.map(([model, m]) => {
                  const denom = m.hit + m.miss;
                  const hitPct = denom > 0 ? Math.round((m.hit / denom) * 100) : 0;
                  return (
                    <tr key={model} className="border-b border-line/60">
                      <td className="py-2 pr-4 text-foreground">{model}</td>
                      <td className="py-2 pr-4 text-foreground">{m.calls}</td>
                      <td className="py-2 pr-4 text-foreground">{compactNum(m.tin)} / {compactNum(m.tout)}</td>
                      <td className="py-2 pr-4 text-foreground">{hitPct}%</td>
                      <td className="py-2 text-foreground">₹{(m.costMicro / 100_000_000).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {latest.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-secondary">
                <th className="py-2 pr-4 font-medium">Time</th>
                <th className="py-2 pr-4 font-medium">Model</th>
                <th className="py-2 pr-4 font-medium">In / out</th>
                <th className="py-2 pr-4 font-medium">Cache hit</th>
                <th className="py-2 pr-4 font-medium">Cost</th>
                <th className="py-2 font-medium">Latency</th>
              </tr>
            </thead>
            <tbody>
              {latest.map((event, index) => {
                const denom = (event.cache_hit_tokens || 0) + (event.cache_miss_tokens || 0);
                const hitPct = denom > 0 ? Math.round(((event.cache_hit_tokens || 0) / denom) * 100) : 0;
                return (
                  <tr key={`${event.timestamp}-${index}`} className="border-b border-line/60">
                    <td className="py-2 pr-4 font-mono text-foreground">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2 pr-4 text-foreground">{event.model}</td>
                    <td className="py-2 pr-4 text-foreground">
                      {compactNum(event.prompt_tokens)} / {compactNum(event.completion_tokens)}
                    </td>
                    <td className="py-2 pr-4 text-foreground">{hitPct}%</td>
                    <td className="py-2 pr-4 text-foreground">₹{(event.cost_paise / 100).toFixed(2)}</td>
                    <td className="py-2 text-foreground">{event.latency_ms} ms</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function compactNum(value: number): string {
  if (value >= 10_000_000) return `${(value / 10_000_000).toFixed(1).replace(/\.0$/, '')}Cr`;
  if (value >= 100_000) return `${(value / 100_000).toFixed(1).replace(/\.0$/, '')}L`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(value);
}

function ConfigRow({
  label,
  value,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="border border-line bg-[#faf9f6] p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary">{label}</span>
        <button type="button" onClick={onCopy} className="text-secondary hover:text-foreground" aria-label={`Copy ${label}`}>
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <p className="break-all font-mono text-sm text-foreground">{value}</p>
    </div>
  );
}

function formatDuration(ms: number): string {
  const totalMins = Math.floor(ms / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h <= 0) return `${m} minute${m === 1 ? '' : 's'}`;
  return `${h}h ${m}m`;
}

function formatCountdown(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
