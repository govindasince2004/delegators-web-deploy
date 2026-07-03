import { useState } from 'react';
import { ArrowRight, Check, Copy, Github, Terminal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProductHeader } from '../components/ProductHeader';
import { Footer } from '../components/landing/Footer';

// /cli — install & quick-start. The CLI is pre-release, so the install command
// is shown as a clearly-labelled preview (no fabricated installer URL). The
// login/run commands are the real product flow.

const CAPABILITIES: [string, string][] = [
  ['Browser account login', '`delegators login` opens the client site and completes a one-time device authorization.'],
  ['Plan-aware models', 'The model picker is populated from your session entitlement, not a hardcoded provider list.'],
  ['Agent foundation', 'Built on Pi: the terminal UI, sessions, tool loop, extensions, and provider adapters.'],
  ['Delegators controls', 'Purchase handoff, session status, and budget visibility are first-party and public-safe.'],
];

function CodeBlock({ code, label, badge }: { code: string; label?: string; badge?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0c] text-white shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)]">
      <div className="flex h-10 items-center justify-between border-b border-white/10 px-4">
        <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-white/40">
          {label || 'bash'}
          {badge ? <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/60">{badge}</span> : null}
        </span>
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

const STEPS = [
  { n: '01', title: 'Install', body: 'Private preview — public install opens after the CLI repo is cleaned and release-tested.', code: 'npm install -g @delegators/cli', badge: 'soon' },
  { n: '02', title: 'Log in', body: 'Opens your browser, authorizes this device, and loads your active plan.', code: 'delegators login' },
  { n: '03', title: 'Pick a lane', body: 'Only the model aliases your pass includes are selectable.', code: 'delegators\n/model dlg-pro' },
];

export function CLIProduct() {
  return (
    <div className="min-h-screen">
      <ProductHeader />
      <main>
        <section className="px-5 pb-16 pt-36 md:pt-44">
          <div className="mx-auto max-w-[760px] text-center">
            <p className="eyebrow text-secondary">Delegators CLI · Coming soon</p>
            <h1 className="mt-5 text-[2.6rem] font-medium leading-[1.05] tracking-[-0.03em] text-foreground md:text-[3.75rem]">
              The terminal agent that knows your <span className="serif-accent">plan</span>.
            </h1>
            <p className="mx-auto mt-6 max-w-[560px] text-[1.05rem] leading-[1.6] text-secondary md:text-lg">
              The CLI is staying in private preview for launch. Use the SWE pass today through
              OpenAI-compatible coding clients; the Delegators CLI opens after release cleanup.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="#start" className="btn btn-primary group">
                Preview setup <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </a>
              <a href="https://github.com/earendil-works/pi" target="_blank" rel="noreferrer" className="btn btn-secondary">
                <Github className="h-4 w-4" /> Upstream (Pi)
              </a>
            </div>
          </div>
        </section>

        {/* Quick start */}
        <section id="start" className="scroll-mt-24 px-5 py-24 md:py-28">
          <div className="mx-auto max-w-[920px]">
            <div className="max-w-[620px]">
              <p className="eyebrow text-secondary">Quick start</p>
              <h2 className="mt-4 text-[2rem] font-medium leading-[1.1] tracking-[-0.025em] text-foreground md:text-[2.75rem]">From zero to building in three steps.</h2>
            </div>
            <div className="mt-10 space-y-5">
              {STEPS.map((s) => (
                <div key={s.n} className="grid items-center gap-5 md:grid-cols-[0.85fr_1.15fr]">
                  <div className="flex gap-4">
                    <span className="font-mono text-sm text-muted">{s.n}</span>
                    <div>
                      <p className="text-lg font-medium text-foreground">{s.title}</p>
                      <p className="mt-1.5 text-[14px] leading-6 text-secondary">{s.body}</p>
                    </div>
                  </div>
                  <CodeBlock code={s.code} label={`step ${s.n}`} badge={s.badge} />
                </div>
              ))}
            </div>
            <p className="mt-8 text-sm text-muted">
              No pass yet? <Link to="/pricing" className="font-medium text-foreground underline">Grab one</Link> — use it now in SWE clients and Workbench while the CLI stays private.
            </p>
          </div>
        </section>

        {/* What you get */}
        <section className="px-5 pb-28">
          <div className="mx-auto max-w-[920px]">
            <h2 className="text-[1.6rem] font-medium tracking-tight text-foreground md:text-[2rem]">Open source, without opening the control plane.</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {CAPABILITIES.map(([title, body]) => (
                <div key={title} className="glass-card flex gap-4 rounded-2xl p-6">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white">
                    <Terminal className="h-5 w-5 text-foreground" />
                  </span>
                  <div>
                    <p className="text-[15px] font-medium text-foreground">{title}</p>
                    <p className="mt-1.5 text-[13.5px] leading-6 text-secondary">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
