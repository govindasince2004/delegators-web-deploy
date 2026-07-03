import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { SignedIn, SignedOut, SignInButton, useAuth } from '@clerk/clerk-react';
import {
  clerkEnabled,
  isWorkbenchSessionKey,
  resolveWallet,
  STORE_URL,
  setWorkbenchTokenProvider,
  WORKBENCH_WALLET_INVALID_EVENT,
  WORKBENCH_WALLET_RESOLVED_EVENT,
  type WalletResolution
} from '../lib/account';

type WorkbenchAccountValue = {
  enabled: boolean;
  needsCredits: boolean;
  planCode?: string;
  remainingPercent?: number;
  allowedModels: string[];
  defaultModel?: string;
  openPlans: () => void;
  refreshWallet: () => Promise<void>;
};

const WorkbenchAccountContext = createContext<WorkbenchAccountValue>({
  enabled: false,
  needsCredits: false,
  allowedModels: [],
  openPlans: () => {},
  refreshWallet: async () => {},
});

export function useWorkbenchAccount(): WorkbenchAccountValue {
  return useContext(WorkbenchAccountContext);
}

// Wraps the Workbench app with the account flow (P1 identity), without touching
// App.tsx: sign-in first; then the active wallet is resolved server-side and seeded
// into the storage keys App reads — the session key stays invisible. Signed-in
// users with no credits can still browse; a dismissible overlay points to the store.
// With no Clerk key configured this renders children untouched (legacy flow).
export function AccountGate({ children }: { children: ReactNode }) {
  const [hasSessionHandoff, setHasSessionHandoff] = useState(hasWorkbenchSession());
  const manualValue = useMemo<WorkbenchAccountValue>(
    () => ({
      enabled: false,
      needsCredits: false,
      allowedModels: [],
      openPlans: () => {
        window.location.assign(`${STORE_URL.replace(/\/$/, '')}/workbench#plans`);
      },
      refreshWallet: async () => {},
    }),
    []
  );

  useEffect(() => {
    const syncSession = () => setHasSessionHandoff(hasWorkbenchSession());
    window.addEventListener(WORKBENCH_WALLET_INVALID_EVENT, syncSession);
    window.addEventListener(WORKBENCH_WALLET_RESOLVED_EVENT, syncSession);
    window.addEventListener('storage', syncSession);
    return () => {
      window.removeEventListener(WORKBENCH_WALLET_INVALID_EVENT, syncSession);
      window.removeEventListener(WORKBENCH_WALLET_RESOLVED_EVENT, syncSession);
      window.removeEventListener('storage', syncSession);
    };
  }, []);

  if (!clerkEnabled || hasSessionHandoff) {
    return (
      <WorkbenchAccountContext.Provider value={manualValue}>
        {children}
      </WorkbenchAccountContext.Provider>
    );
  }
  return (
    <>
      <SignedOut>
        <SignInScreen />
      </SignedOut>
      <SignedIn>
        <WalletBoot>{children}</WalletBoot>
      </SignedIn>
    </>
  );
}

function hasWorkbenchSession(): boolean {
  try {
    return isWorkbenchSessionKey(sessionStorage.getItem('dw:sessionKey') ?? '');
  } catch {
    return false;
  }
}

function SignInScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 px-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Delegators Workbench</h1>
        <p className="mt-2 max-w-sm text-sm text-zinc-400">
          Decks, reports, resumes and sheets — real files, built by AI. Sign in to open your
          workspace; your credits follow your account.
        </p>
      </div>
      <SignInButton mode="modal">
        <button className="rounded-lg bg-indigo-500 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400">
          Sign in to continue
        </button>
      </SignInButton>
    </div>
  );
}

function WalletBoot({ children }: { children: ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [resolution, setResolution] = useState<WalletResolution | null>(null);
  const [retrying, setRetrying] = useState(false);

  const refreshWallet = useCallback(async (background = false) => {
    if (!background) setRetrying(true);
    try {
      const next = await resolveWallet(getToken);
      setResolution(next);
    } finally {
      if (!background) setRetrying(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    setWorkbenchTokenProvider(getToken);
    const refresh = (background: boolean) => {
      if (!background) setRetrying(true);
      void resolveWallet(getToken)
        .then((next) => {
          if (!cancelled) setResolution(next);
        })
        .finally(() => {
          if (!cancelled && !background) setRetrying(false);
        });
    };
    refresh(false);
    const refreshLiveWallet = () => refresh(true);
    const refreshVisibleWallet = () => {
      if (document.visibilityState === 'visible') refresh(true);
    };
    window.addEventListener('focus', refreshLiveWallet);
    window.addEventListener(WORKBENCH_WALLET_INVALID_EVENT, refreshLiveWallet);
    window.addEventListener(WORKBENCH_WALLET_RESOLVED_EVENT, refreshLiveWallet);
    document.addEventListener('visibilitychange', refreshVisibleWallet);
    const interval = window.setInterval(refreshLiveWallet, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshLiveWallet);
      window.removeEventListener(WORKBENCH_WALLET_INVALID_EVENT, refreshLiveWallet);
      window.removeEventListener(WORKBENCH_WALLET_RESOLVED_EVENT, refreshLiveWallet);
      document.removeEventListener('visibilitychange', refreshVisibleWallet);
      setWorkbenchTokenProvider(null);
    };
  }, [getToken, isLoaded, isSignedIn]);

  const openPlans = useCallback(() => {
    window.location.assign(`${STORE_URL.replace(/\/$/, '')}/workbench#plans`);
  }, []);
  const refreshAccountWallet = useCallback(() => refreshWallet(false), [refreshWallet]);
  const accountValue = useMemo<WorkbenchAccountValue>(() => {
    if (!resolution || resolution.state === 'error') {
      return {
        enabled: true,
        needsCredits: true,
        allowedModels: [],
        openPlans,
        refreshWallet: refreshAccountWallet,
      };
    }
    return {
      enabled: true,
      needsCredits: resolution.state === 'no-wallet',
      planCode: resolution.state === 'resolved' ? resolution.planCode : undefined,
      remainingPercent: resolution.state === 'resolved' ? resolution.remainingPercent : undefined,
      allowedModels: resolution.state === 'resolved' ? resolution.allowedModels : [],
      defaultModel: resolution.state === 'resolved' ? resolution.defaultModel : undefined,
      openPlans,
      refreshWallet: refreshAccountWallet,
    };
  }, [openPlans, refreshAccountWallet, resolution]);

  if (!isLoaded || resolution === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="animate-pulse text-sm text-zinc-400">Opening your workspace…</p>
      </div>
    );
  }

  if (resolution.state === 'error') {
    return (
      <WalletErrorScreen
        reason={resolution.reason}
        retryable={resolution.retryable ?? true}
        retrying={retrying}
        onRetry={() => void refreshWallet(false)}
      />
    );
  }

  return (
    <WorkbenchAccountContext.Provider value={accountValue}>
      {children}
    </WorkbenchAccountContext.Provider>
  );
}

function WalletErrorScreen({
  reason,
  retryable = true,
  retrying = false,
  onRetry,
}: {
  reason?: string;
  retryable?: boolean;
  retrying?: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-zinc-950 px-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Could not open your Workbench account</h1>
        <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">
          {reason ?? 'The account wallet service did not respond. Retry before creating anything.'}
        </p>
      </div>
      {retryable ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {retrying ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
          {retrying ? 'Retrying…' : 'Retry'}
        </button>
      ) : null}
    </div>
  );
}
