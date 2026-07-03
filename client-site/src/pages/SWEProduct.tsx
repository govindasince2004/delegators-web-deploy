import { useCallback, useEffect, useState } from 'react';
import { UserButton, useAuth, useUser } from '@clerk/clerk-react';
import { ArrowRight, Check, Copy, RefreshCw } from 'lucide-react';
import { SweToolConfigurator } from '../components/swe/SweToolConfigurator';
import { ProductHeader } from '../components/ProductHeader';
import { Footer } from '../components/landing/Footer';
import { PricingSection } from '../components/landing/PricingSection';
import { CONFIGURATION_TOOLS, ToolStrip } from '../components/landing/ToolStrip';
import { fetchAccountSessions, type AccountSession } from '../lib/api';
import { clerkEnabled } from '../lib/clerk';
import { PUBLIC_PLANS } from '../lib/plans';

// /swe — setup & configuration. Delegators speaks the OpenAI Chat Completions
// API, so any compatible client works once it has the endpoint, the session key,
// and a model. Endpoint + key are shown on the session page after checkout; the
// public production endpoint is also shown here so users do not have to guess.
// The signed-in session panel is kept here so buyers can confirm their pass
// before configuring an OpenAI-compatible coding client.

const BASE_URL = 'https://api.delegators.in/v1';
const SESSION_KEY = 'sess_...';
const DEFAULT_MODEL = 'dlg-pro';
const MODELS = ['dlg-pro', 'dlg-light'];

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0c] text-white shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)]">
      <div className="flex h-10 items-center justify-between border-b border-white/10 px-4">
        <span className="font-mono text-[11px] tracking-[0.16em] text-white/40">{label || 'bash'}</span>
        <button
          onClick={() => { void navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1400); }}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-white/55 transition hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-7 text-white/85"><code>{code}</code></pre>
    </div>
  );
}

function ValueCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <p className="eyebrow text-secondary">{label}</p>
      <p className="mt-3 break-all font-mono text-[13px] text-foreground">{value}</p>
      <p className="mt-2 text-[12.5px] leading-5 text-muted">{note}</p>
    </div>
  );
}

const SDK_TEST = `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${BASE_URL}",
  apiKey: "${SESSION_KEY}",
});

await client.chat.completions.create({
  model: "${DEFAULT_MODEL}",
  messages: [{ role: "user", content: "Refactor this module." }],
});`;

export function SWEProduct() {
  return (
    <div className="min-h-screen">
      <ProductHeader />
      <main>
        <section className="px-5 pb-16 pt-36 md:pt-44">
          <div className="mx-auto max-w-[760px] text-center">
            <p className="eyebrow text-secondary">SWE Sessions · Setup</p>
            <h1 className="mt-5 text-[2.6rem] font-medium leading-[1.05] tracking-[-0.03em] text-foreground md:text-[3.75rem]">
              Use your pass in any <span className="serif-accent">coding</span> client.
            </h1>
            <p className="mx-auto mt-6 max-w-[560px] text-[1.05rem] leading-[1.6] text-secondary md:text-lg">
              Delegators speaks the OpenAI Chat Completions API. Point your client at your session
              endpoint, paste your key, choose a model — the gateway owns budget, concurrency, and
              provider isolation.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="#plans" className="btn btn-primary group">
                Get a pass <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </a>
              <a href="#config" className="btn btn-secondary">Jump to setup</a>
            </div>
          </div>
        </section>

        <SWEAccountStatus />

        <ToolStrip label="Configure OpenAI-compatible clients with your SWE plan" tools={CONFIGURATION_TOOLS} />

        {/* Config docs */}
        <section id="config" className="scroll-mt-24 px-5 py-24 md:py-28">
          <div className="mx-auto max-w-[920px]">
            <div className="max-w-[640px]">
              <p className="eyebrow text-secondary">Configuration</p>
              <h2 className="mt-4 text-[2rem] font-medium leading-[1.1] tracking-[-0.025em] text-foreground md:text-[2.75rem]">Three values, any client.</h2>
              <p className="mt-4 text-[1.02rem] leading-7 text-secondary">
                After checkout, your session page shows the endpoint and key. Drop them into any
                OpenAI-compatible client with one of the model aliases your plan includes.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <ValueCard label="Base URL" value={BASE_URL} note="Use this production endpoint after checkout." />
              <ValueCard label="API key" value={SESSION_KEY} note="The sess_… key bound to your pass." />
              <ValueCard label="Model" value={MODELS.join(' · ')} note="The aliases your plan unlocks." />
            </div>

            <div className="mt-6">
              <CodeBlock code={SDK_TEST} label="quick test · OpenAI SDK" />
            </div>

            <SweToolConfigurator />
          </div>
        </section>

        <div id="plans"><PricingSection /></div>
      </main>
      <Footer />
    </div>
  );
}

function SWEAccountStatus() {
  if (!clerkEnabled) return null;
  return <SWEAccountStatusInner />;
}

function SWEAccountStatusInner() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [sessions, setSessions] = useState<AccountSession[] | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return;
    try {
      setError('');
      setSessions(await fetchAccountSessions());
    } catch {
      setError('Could not load your active sessions. Retry in a moment.');
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    void load();
    const onFocus = () => void load();
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(tick);
    };
  }, [load]);

  if (!isLoaded || !isSignedIn) return null;

  const active = sessions
    ?.filter((session) => session.kind === 'swe' && isUsableSession(session, now))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  return (
    <section className="px-5 py-6">
      <div className="glass-card mx-auto max-w-[920px] rounded-2xl p-5">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="flex items-start gap-3">
            <UserButton />
            <div>
              <p className="eyebrow text-secondary">
                {user?.firstName ? `${user.firstName}'s SWE session` : 'Your SWE session'}
              </p>
              {active ? (
                <>
                  <h2 className="mt-2 text-2xl font-medium tracking-tight text-foreground">
                    {planLabel(active.plan_code)} is active.
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-secondary">
                    {active.remaining_percent}% budget left · expires in {timeLeft(active.expires_at, now)} · session {active.session_id.slice(0, 8)}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="mt-2 text-2xl font-medium tracking-tight text-foreground">No active SWE session on this account.</h2>
                  <p className="mt-2 text-sm leading-6 text-secondary">
                    Get a pass below — it mints a session and binds it to this signed-in account.
                  </p>
                </>
              )}
              {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void load()} className="btn btn-sm btn-secondary">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
            {active ? (
              <a href="/dashboard" className="btn btn-sm btn-secondary">Usage</a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function isUsableSession(session: AccountSession, now: number): boolean {
  return (
    (session.status === 'active' || session.status === 'inactive') &&
    new Date(session.expires_at).getTime() > now &&
    session.remaining_percent > 0
  );
}

function planLabel(code: string): string {
  const plan = PUBLIC_PLANS.find((candidate) => candidate.code === code);
  return plan ? plan.name : code;
}

function timeLeft(expiresAt: string, now: number): string {
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return '0m';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}
