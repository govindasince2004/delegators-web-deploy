import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Code2, Copy, ExternalLink, KeyRound, PanelRight, ShieldCheck, Sparkles } from 'lucide-react';
import { setPendingPaymentBind, setSessionKey } from '../lib/auth';
import { openSignedInWorkbench, openWorkbenchWithHandoff } from '../lib/workbench';

type IssuedConfig = {
  baseURL: string;
  apiKey: string;
  plan: string;
  model: string;
  thinkingModel?: string;
};

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; config: IssuedConfig }
  | { status: 'error'; message: string };

const pendingLoads = new Map<string, Promise<IssuedConfig>>();

export function PaymentSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const ref = params.get('ref') ?? '';
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [copied, setCopied] = useState('');
  // Unified dlg_* pass page: the coding-client config block is hidden until the
  // user asks for it, so the page leads with a clean choice.
  const [revealClientConfig, setRevealClientConfig] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!ref) {
        setState({ status: 'error', message: 'Missing payment reference.' });
        return;
      }

      try {
        const config = await loadIssuedConfig(ref);
        if (!cancelled) setState({ status: 'ready', config });
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Could not load your session configuration.',
          });
        }
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [ref]);

  useEffect(() => {
    if (state.status !== 'ready' || !ref) return;
    setPendingPaymentBind(ref, state.config.apiKey);
  }, [ref, state]);

  useEffect(() => {
    if (state.status !== 'ready' || !state.config.plan.startsWith('wb_')) return;
    const timer = window.setTimeout(() => {
      openSignedInWorkbench(undefined, { replace: true });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [state]);

  const configText = useMemo(() => {
    if (state.status !== 'ready') return '';
    const lines = [
      `Base URL: ${state.config.baseURL}`,
      `API Key: ${state.config.apiKey}`,
      `Plan: ${state.config.plan}`,
      `Model: ${state.config.model}`,
    ];
    if (state.config.thinkingModel) lines.push(`Thinking model: ${state.config.thinkingModel}`);
    return lines.join('\n');
  }, [state]);

  const copy = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(''), 1600);
  };

  const openDashboard = () => {
    if (state.status !== 'ready') return;
    setSessionKey(state.config.apiKey);
    navigate('/dashboard');
  };

  const openWorkbench = (view?: 'usage') => {
    if (state.status === 'ready') {
      openWorkbenchWithHandoff(
        { apiKey: state.config.apiKey, baseURL: state.config.baseURL, model: state.config.model },
        view,
      );
      return;
    }
    openSignedInWorkbench(view);
  };

  if (state.status === 'loading') {
    return (
      <main className="min-h-screen px-4 py-10">
        <div className="mx-auto max-w-[1040px] border border-line bg-white p-8">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">Preparing session</p>
          <h1 className="mt-4 text-4xl font-[400] tracking-tight text-foreground">Fetching your configuration.</h1>
        </div>
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <main className="min-h-screen px-4 py-10">
        <div className="mx-auto max-w-[1040px] border border-line bg-white p-8">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-red-600">Configuration unavailable</p>
          <h1 className="mt-4 text-4xl font-[400] tracking-tight text-foreground">Your payment page could not load.</h1>
          <p className="mt-4 max-w-2xl text-secondary">{state.message}</p>
          <Link className="mt-8 inline-flex h-10 items-center border border-line px-4 text-sm font-medium hover:bg-black/5" to="/">
            Back to Delegators
          </Link>
        </div>
      </main>
    );
  }

  const { config } = state;

  if (config.plan.startsWith('wb_')) {
    return (
      <main className="min-h-screen px-4 py-8 md:py-12">
        <section className="mx-auto max-w-[900px] border border-line bg-white p-7 md:p-12">
          <div className="mb-10 flex items-center gap-3">
            <img src="/delegators_icon_transparent_cropped.png" alt="" className="h-9 w-auto" />
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-foreground">Delegators Workbench</span>
          </div>
          <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
            Workbench plan active
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-[400] leading-[1.05] text-foreground md:text-6xl">
            Your workspace is ready.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-secondary">
            Your account now owns {config.plan}. Workbench will load the wallet, internal endpoint, session, and included models automatically when it opens.
          </p>
          <p className="mt-3 text-sm text-secondary">Opening your signed-in workspace automatically…</p>
          <div className="mt-9 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => openWorkbench('usage')} className="inline-flex h-11 items-center justify-center gap-2 border border-line px-4 text-sm font-medium text-foreground hover:bg-black/5">
              <PanelRight className="h-4 w-4" /> Usage dashboard
            </button>
            <button type="button" onClick={() => openWorkbench()} className="inline-flex h-11 items-center justify-center gap-2 bg-[#050505] px-4 text-sm font-medium text-white hover:bg-black/80">
              <ExternalLink className="h-4 w-4" /> Open Workbench
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (config.plan.startsWith('dlg_')) {
    return (
      <main className="min-h-screen px-4 py-8 md:py-12">
        <section className="mx-auto max-w-[1040px] border border-line bg-white p-7 md:p-12">
          <div className="mb-8 flex items-center gap-3">
            <img src="/delegators_icon_transparent_cropped.png" alt="" className="h-9 w-auto" />
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-foreground">Delegators</span>
          </div>
          <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
            Pass active
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-[400] leading-[1.05] tracking-tight text-foreground md:text-6xl">
            Pass active <span aria-hidden>🎉</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-secondary">
            Your <code className="bg-black/5 px-1">{config.plan}</code> pass is live for the next 250 minutes.
            One pass — use it in SWE clients or the Workbench, on the same budget. Pick where to start.
          </p>

          <div className="mt-9 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setRevealClientConfig(true)}
              className="inline-flex h-12 items-center justify-center gap-2 bg-[#050505] px-4 text-sm font-medium text-white hover:bg-black/80"
            >
              <Code2 className="h-4 w-4" /> Use in coding clients
            </button>
            <button
              type="button"
              onClick={() => openWorkbench()}
              className="inline-flex h-12 items-center justify-center gap-2 border border-foreground px-4 text-sm font-medium text-foreground hover:bg-black/5"
            >
              <PanelRight className="h-4 w-4" /> Use in Workbench
            </button>
          </div>

          {revealClientConfig ? (
            <div className="mt-8 border border-line bg-[#faf9f6] p-5 md:p-7">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-600" />
                <h2 className="text-sm font-semibold text-foreground">Use this pass in coding clients</h2>
              </div>
              <p className="mb-4 text-sm leading-6 text-secondary">
                Paste the endpoint and key below into Cline, Roo Code, Cursor, Trae, Kilo Code, or another
                OpenAI-compatible client. The key is revealed once.
              </p>

              <div className="space-y-4">
                <ConfigRow label="API endpoint" value={config.baseURL} onCopy={() => copy('base', config.baseURL)} copied={copied === 'base'} />
                <ConfigRow label="API key" value={config.apiKey} secret onCopy={() => copy('key', config.apiKey)} copied={copied === 'key'} />
                <ConfigRow label="Plan" value={config.plan} />
                <ConfigRow label="Default model" value={config.model} />
                {config.thinkingModel ? <ConfigRow label="Thinking model" value={config.thinkingModel} /> : null}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => copy('all', configText)}
                  className="inline-flex h-10 items-center justify-center gap-2 bg-[#050505] px-4 text-sm font-medium text-white hover:bg-black/80"
                >
                  {copied === 'all' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  Copy configuration
                </button>
                <button
                  type="button"
                  onClick={openDashboard}
                  className="inline-flex h-10 items-center justify-center gap-2 border border-line px-4 text-sm font-medium text-foreground hover:bg-black/5"
                >
                  <PanelRight className="h-4 w-4" /> Open usage dashboard
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <UsageCard
              title="One budget, both surfaces"
              body="The same 250-minute budget is shared by SWE clients and the Workbench. Track what's left any time in your usage dashboard."
              action="Open usage dashboard"
              href="/dashboard"
            />
            <UsageCard
              title="When it runs out"
              body="When the budget or window is spent, both surfaces prompt you to buy another pass. Grab one from Pricing."
              action="See passes"
              href="/pricing"
            />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 md:py-12">
      <section className="mx-auto max-w-[1120px] border border-line bg-white">
        <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="border-b border-line p-6 md:p-10 lg:border-b-0 lg:border-r">
            <div className="mb-8 flex items-center gap-3">
              <img src="/delegators_icon_transparent_cropped.png" alt="" className="h-9 w-auto" />
              <span className="text-xs font-bold uppercase tracking-[0.25em] text-foreground">Delegators</span>
            </div>
            <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
              <ShieldCheck className="h-4 w-4" />
              Session issued
            </p>
            <h1 className="mt-4 max-w-2xl text-4xl font-[400] leading-[1.05] tracking-tight text-foreground md:text-6xl">
              Your configuration is ready.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-secondary">
              Save this now. The key is revealed once by the gateway, then used from your coding
              tools or the Workbench according to your plan budget.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => copy('all', configText)}
                className="inline-flex h-11 items-center justify-center gap-2 bg-[#050505] px-4 text-sm font-medium text-white hover:bg-black/80"
              >
                {copied === 'all' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                Copy configuration
              </button>
              <button
                type="button"
                onClick={openDashboard}
                className="inline-flex h-11 items-center justify-center gap-2 border border-line px-4 text-sm font-medium text-foreground hover:bg-black/5"
              >
                <PanelRight className="h-4 w-4" />
                Open usage dashboard
            </button>
          </div>
        </div>

          <div className="p-6 md:p-10">
            <div className="space-y-4">
              <ConfigRow label="API endpoint" value={config.baseURL} onCopy={() => copy('base', config.baseURL)} copied={copied === 'base'} />
              <ConfigRow label="API key" value={config.apiKey} secret onCopy={() => copy('key', config.apiKey)} copied={copied === 'key'} />
              <ConfigRow label="Plan" value={config.plan} />
              <ConfigRow label="Default model" value={config.model} />
              {config.thinkingModel ? <ConfigRow label="Thinking model" value={config.thinkingModel} /> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-6 grid max-w-[1120px] gap-4 md:grid-cols-2">
          <UsageCard
            title="API tools"
            body="Use the endpoint and bearer key in Cline, Roo Code, Cursor, Trae, Kilo Code, or any OpenAI-compatible client."
            action="Read API docs"
            href="/docs"
        />
        <UsageCard
          title="Workbench"
          body="Workbench credits build decks, reports, sheets, and profiles as real downloadable files."
          action="Back to suite"
          href="/#suite"
        />
      </section>
    </main>
  );
}

async function loadIssuedConfig(ref: string): Promise<IssuedConfig> {
  const storageKey = `delegators:issued-config:${ref}`;
  const cached = sessionStorage.getItem(storageKey);
  if (cached) return JSON.parse(cached) as IssuedConfig;

  const existing = pendingLoads.get(ref);
  if (existing) return existing;

  const pending = fetch(`/gateway-payment/success?ref=${encodeURIComponent(ref)}`, {
    cache: 'no-store',
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Gateway returned ${response.status}`);
      const html = await response.text();
      const config = parseIssuedConfig(html);
      if (!config.apiKey.startsWith('sess_')) {
        throw new Error('The session key is not ready. Contact support with this payment reference.');
      }
      sessionStorage.setItem(storageKey, JSON.stringify(config));
      return config;
    })
    .finally(() => pendingLoads.delete(ref));

  pendingLoads.set(ref, pending);
  return pending;
}

function ConfigRow({
  label,
  value,
  secret = false,
  copied = false,
  onCopy,
}: {
  label: string;
  value: string;
  secret?: boolean;
  copied?: boolean;
  onCopy?: () => void;
}) {
  return (
    <div className="border border-line bg-[#faf9f6] p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary">{label}</span>
        {onCopy ? (
          <button type="button" onClick={onCopy} className="text-secondary hover:text-foreground" aria-label={`Copy ${label}`}>
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
      <p className="break-all font-mono text-sm text-foreground">
        {secret ? value : value}
      </p>
    </div>
  );
}

function UsageCard({ title, body, action, href }: { title: string; body: string; action: string; href: string }) {
  return (
    <div className="border border-line bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-indigo-600" />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <p className="min-h-[72px] text-sm leading-6 text-secondary">{body}</p>
      <Link to={href} className="mt-4 inline-flex h-9 items-center gap-2 text-xs font-medium text-foreground hover:text-indigo-600">
        {action}
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function parseIssuedConfig(html: string): IssuedConfig {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const copyButton = doc.getElementById('copy-btn');
  if (!copyButton) throw new Error('Gateway success payload did not include configuration.');
  return {
    baseURL: copyButton.getAttribute('data-copy-baseurl') ?? '',
    apiKey: copyButton.getAttribute('data-copy-apikey') ?? '',
    plan: copyButton.getAttribute('data-copy-plan') ?? '',
    model: copyButton.getAttribute('data-copy-model') ?? '',
    thinkingModel: copyButton.getAttribute('data-copy-thinking') ?? undefined,
  };
}
