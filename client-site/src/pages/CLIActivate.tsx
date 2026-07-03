import { useState } from 'react';
import { UserButton, useAuth } from '@clerk/clerk-react';
import { Check, ExternalLink, ShieldCheck, TerminalSquare } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { APIError, authorizeCLI, type AccountSession } from '../lib/api';
import { clerkEnabled } from '../lib/clerk';
import { signInHref } from '../lib/authRedirect';

type State =
  | { status: 'idle' }
  | { status: 'authorizing' }
  | { status: 'authorized'; session: AccountSession }
  | { status: 'plan-required'; purchaseURL: string }
  | { status: 'error'; message: string };

export function CLIActivate() {
  const [params] = useSearchParams();
  const userCode = (params.get('user_code') || params.get('cli_code') || '').trim().toUpperCase();

  if (!clerkEnabled) {
    return <ActivationFrame title="CLI sign-in is unavailable" body="Account sign-in is not configured on this deployment." />;
  }
  if (!userCode) {
    return <ActivationFrame title="Enter from the CLI" body="Run `delegators login` and open the authorization link it prints." />;
  }

  return (
    <main className="min-h-screen px-4 py-8 md:py-14">
      <div className="mx-auto max-w-[880px]">
        <Link to="/" className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.22em] text-foreground">
          <img src="/delegators_icon_transparent_cropped.png" alt="" className="h-9 w-auto" />
          Delegators
        </Link>

        <section className="mt-10 overflow-hidden border border-line bg-white">
          <div className="grid lg:grid-cols-[0.88fr_1.12fr]">
            <div className="border-b border-line bg-[#11110f] p-7 text-white md:p-10 lg:border-b-0 lg:border-r">
              <TerminalSquare className="h-7 w-7 text-[#7db6ff]" />
              <p className="mt-10 text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Delegators CLI</p>
              <h1 className="mt-3 text-4xl font-[400] leading-tight tracking-tight">Authorize this terminal.</h1>
              <p className="mt-5 text-sm leading-6 text-white/65">
                The CLI receives one active SWE session owned by your account. It cannot access provider keys,
                administration APIs, or the private execution harness.
              </p>
              <div className="mt-8 border border-white/15 bg-white/5 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">Verification code</p>
                <p className="mt-2 font-mono text-2xl tracking-[0.12em]">{userCode}</p>
              </div>
            </div>

            <div className="p-7 md:p-10">
              <AuthorizationPanel userCode={userCode} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function AuthorizationPanel({ userCode }: { userCode: string }) {
  const { isLoaded, isSignedIn } = useAuth();
  const signInTarget = signInHref(`/cli/activate?user_code=${encodeURIComponent(userCode)}`);

  if (!isLoaded) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">Loading account</p>
        <h2 className="mt-3 text-3xl font-[400] tracking-tight text-foreground">Preparing browser sign-in.</h2>
        <p className="mt-4 text-sm leading-6 text-secondary">
          The local client is loading the configured Clerk development instance. Keep this tab open.
        </p>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">Account required</p>
        <h2 className="mt-3 text-3xl font-[400] tracking-tight text-foreground">Sign in on Delegators.</h2>
        <p className="mt-4 text-sm leading-6 text-secondary">
          Your browser handles identity. The terminal never receives your Clerk session or account password.
        </p>
        <Link
          to={signInTarget}
          className="mt-8 inline-flex h-11 items-center bg-[#050505] px-5 text-sm font-medium text-white hover:bg-black/80"
        >
          Sign in to continue
        </Link>
      </div>
    );
  }

  return <SignedInAuthorization userCode={userCode} />;
}

function SignedInAuthorization({ userCode }: { userCode: string }) {
  const { getToken } = useAuth();
  const [state, setState] = useState<State>({ status: 'idle' });

  async function approve() {
    setState({ status: 'authorizing' });
    try {
      const token = await getToken();
      if (!token) throw new Error('Your sign-in session is unavailable. Sign in again.');
      const result = await authorizeCLI(userCode, token);
      const pending = sessionStorage.getItem('delegators:pending-cli-code');
      if (pending?.toUpperCase() === userCode) {
        sessionStorage.removeItem('delegators:pending-cli-code');
      }
      setState({ status: 'authorized', session: result.session });
    } catch (error) {
      if (error instanceof APIError && error.code === 'swe_plan_required') {
        const purchaseURL = typeof error.data.purchase_url === 'string'
          ? error.data.purchase_url
          : `/swe?cli_code=${encodeURIComponent(userCode)}`;
        sessionStorage.setItem('delegators:pending-cli-code', userCode);
        setState({ status: 'plan-required', purchaseURL });
        return;
      }
      setState({ status: 'error', message: error instanceof Error ? error.message : 'Authorization failed.' });
    }
  }

  if (state.status === 'authorized') {
    return (
      <div>
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          <Check className="h-5 w-5" />
        </div>
        <h2 className="mt-5 text-3xl font-[400] tracking-tight text-foreground">Terminal connected.</h2>
        <p className="mt-4 text-sm leading-6 text-secondary">
          The CLI can now use <span className="font-medium text-foreground">{state.session.plan_code}</span>. Return to your terminal;
          this browser page can be closed.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <UserButton />
          <div>
            <p className="text-sm font-semibold text-foreground">Signed in</p>
            <p className="text-xs text-secondary">Approve only terminals you started.</p>
          </div>
        </div>
        <ShieldCheck className="h-5 w-5 text-emerald-700" />
      </div>

      <div className="mt-7 border-y border-line py-5 text-sm leading-6 text-secondary">
        <p className="font-medium text-foreground">This grants:</p>
        <p>Use of one active SWE session, its allowed model aliases, and account-scoped usage status.</p>
        <p className="mt-3 font-medium text-foreground">This never grants:</p>
        <p>Provider credentials, payment controls, admin access, private prompts, or harness endpoints.</p>
      </div>

      {state.status === 'plan-required' ? (
        <div className="mt-6">
          <p className="text-sm leading-6 text-secondary">This account has no active SWE session. Choose a plan, then this request will be ready to approve.</p>
          <a href={state.purchaseURL} className="mt-4 inline-flex h-11 items-center gap-2 bg-[#050505] px-5 text-sm font-medium text-white hover:bg-black/80">
            Choose an SWE plan <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      ) : (
        <button
          onClick={() => void approve()}
          disabled={state.status === 'authorizing'}
          className="mt-7 inline-flex h-11 items-center bg-[#050505] px-5 text-sm font-medium text-white hover:bg-black/80 disabled:opacity-50"
        >
          {state.status === 'authorizing' ? 'Authorizing…' : 'Authorize Delegators CLI'}
        </button>
      )}
      {state.status === 'error' ? <p className="mt-4 text-sm text-red-700">{state.message}</p> : null}
    </div>
  );
}

function ActivationFrame({ title, body }: { title: string; body: string }) {
  return (
    <main className="min-h-screen px-4 py-12">
      <section className="mx-auto max-w-xl border border-line bg-white p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">Delegators CLI</p>
        <h1 className="mt-4 text-3xl font-[400] tracking-tight text-foreground">{title}</h1>
        <p className="mt-4 text-sm leading-6 text-secondary">{body}</p>
        <Link to="/" className="mt-7 inline-flex text-sm font-medium text-foreground underline">Return home</Link>
      </section>
    </main>
  );
}
