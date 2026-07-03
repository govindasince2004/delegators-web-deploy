import { useEffect, useState } from 'react';
import { UserButton, useAuth } from '@clerk/clerk-react';
import { Check, ExternalLink, Mic, ShieldCheck } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { APIError, authorizeCLI, type AccountSession } from '../lib/api';
import { clerkEnabled } from '../lib/clerk';
import { signInHref } from '../lib/authRedirect';

type State =
  | { status: 'idle' }
  | { status: 'authorizing' }
  | { status: 'authorized'; session: AccountSession }
  | { status: 'plan-required'; purchaseURL: string }
  | { status: 'error'; message: string };

export function FlowActivate() {
  const [params] = useSearchParams();
  const userCode = (params.get('user_code') || params.get('cli_code') || '').trim().toUpperCase();

  if (!clerkEnabled) {
    return <ActivationFrame title="Flow sign-in unavailable" body="Account sign-in is not configured on this deployment." />;
  }
  if (!userCode) {
    return <ActivationFrame title="Open from the app" body="Launch Delegators Flow on your desktop and tap Sign in — this page opens automatically." />;
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
              <Mic className="h-7 w-7 text-[#7db6ff]" />
              <p className="mt-10 text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Delegators Flow</p>
              <h1 className="mt-3 text-4xl font-[400] leading-tight tracking-tight">Authorize voice dictation.</h1>
              <p className="mt-5 text-sm leading-6 text-white/65">
                The desktop app receives one active Flow pass. Dictate in Hindi, English, or Hinglish — review the
                agent-ready prompt before paste. No provider keys leave the server.
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
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useAuth();
  const signInTarget = signInHref(`/flow/activate?user_code=${encodeURIComponent(userCode)}`);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      navigate(signInTarget, { replace: true });
    }
  }, [isLoaded, isSignedIn, navigate, signInTarget]);

  if (!isLoaded || !isSignedIn) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">Account required</p>
        <h2 className="mt-3 text-3xl font-[400] tracking-tight text-foreground">Redirecting to sign in…</h2>
        <p className="mt-4 text-sm leading-6 text-secondary">
          Your browser handles identity. The Flow app never sees your password.
        </p>
        <Link to={signInTarget} className="mt-8 inline-flex h-11 items-center bg-[#050505] px-5 text-sm font-medium text-white hover:bg-black/80">
          Continue to sign in
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
      setState({ status: 'authorized', session: result.session });
    } catch (error) {
      if (error instanceof APIError && error.code === 'flow_plan_required') {
        const purchaseURL = typeof error.data.purchase_url === 'string'
          ? error.data.purchase_url
          : `/flow?user_code=${encodeURIComponent(userCode)}`;
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
        <h2 className="mt-5 text-3xl font-[400] tracking-tight text-foreground">Flow connected.</h2>
        <p className="mt-4 text-sm leading-6 text-secondary">
          Return to the desktop app and start dictating. This tab can be closed.
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
            <p className="text-xs text-secondary">Approve only apps you started.</p>
          </div>
        </div>
        <ShieldCheck className="h-5 w-5 text-emerald-700" />
      </div>

      {state.status === 'plan-required' ? (
        <div className="mt-6">
          <p className="text-sm leading-6 text-secondary">Claim your free Flow pass, then approve this device.</p>
          <a href={state.purchaseURL} className="mt-4 inline-flex h-11 items-center gap-2 bg-[#050505] px-5 text-sm font-medium text-white hover:bg-black/80">
            Get Flow pass <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      ) : (
        <button
          onClick={() => void approve()}
          disabled={state.status === 'authorizing'}
          className="mt-7 inline-flex h-11 items-center bg-[#050505] px-5 text-sm font-medium text-white hover:bg-black/80 disabled:opacity-50"
        >
          {state.status === 'authorizing' ? 'Authorizing…' : 'Authorize Delegators Flow'}
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
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">Delegators Flow</p>
        <h1 className="mt-4 text-3xl font-[400] tracking-tight text-foreground">{title}</h1>
        <p className="mt-4 text-sm leading-6 text-secondary">{body}</p>
        <Link to="/flow" className="mt-7 inline-flex text-sm font-medium text-foreground underline">About Flow</Link>
      </section>
    </main>
  );
}