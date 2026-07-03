// Account-owned wallet bootstrap (P1 identity). Optional: with no Clerk key the
// Workbench behaves exactly as before (manual endpoint + session key in settings).
export const CLERK_PUBLISHABLE_KEY: string =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';
export const clerkEnabled = CLERK_PUBLISHABLE_KEY.length > 0;

// Where to resolve wallets from (the Delegators gateway, not the workbench server).
export const GATEWAY_BASE: string = (
  import.meta.env.VITE_DELEGATORS_GATEWAY_URL || 'http://localhost:8080'
).replace(/\/$/, '');

// Where to send people who need credits.
export const STORE_URL: string =
  import.meta.env.VITE_DELEGATORS_STORE_URL || 'http://localhost:5174';
export const WORKBENCH_API_BASE: string = (
  import.meta.env.VITE_WORKBENCH_API_URL || ''
).replace(/\/$/, '');
export const WORKBENCH_WALLET_INVALID_EVENT =
  'delegators:workbench-wallet-invalid';
export const WORKBENCH_WALLET_RESOLVED_EVENT =
  'delegators:workbench-wallet-resolved';
const WORKBENCH_HANDOFF_HASH_PREFIX = 'dw-handoff=';

type ClerkTokenProvider = () => Promise<string | null>;
let clerkTokenProvider: ClerkTokenProvider | null = null;

export function setWorkbenchTokenProvider(
  provider: ClerkTokenProvider | null
): void {
  clerkTokenProvider = provider;
}

export async function workbenchFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  const sessionKey = sessionStorage.getItem('dw:sessionKey')?.trim();
  if (sessionKey) headers.set('Authorization', `Bearer ${sessionKey}`);
  if (clerkEnabled && clerkTokenProvider) {
    const token = await clerkTokenProvider();
    if (token) headers.set('X-Clerk-Token', token);
  }
  const response = await fetch(`${WORKBENCH_API_BASE}${path}`, {
    ...init,
    headers
  });
  if (
    (response.status === 401 || response.status === 402) &&
    typeof window !== 'undefined'
  ) {
    sessionStorage.removeItem('dw:sessionKey');
    window.dispatchEvent(new Event(WORKBENCH_WALLET_INVALID_EVENT));
  }
  return response;
}

export type WalletResolution =
  | {
      state: 'resolved';
      planCode: string;
      remainingPercent: number;
      allowedModels: string[];
      defaultModel: string;
    }
  | { state: 'no-wallet' }
  | { state: 'error'; reason?: string; retryable?: boolean };

function walletErrorMessage(payload: unknown, status: number): string {
  if (!payload || typeof payload !== 'object')
    return `Wallet request failed with HTTP ${status}.`;
  const body = payload as {
    details?: string;
    error?: string | { message?: string };
  };
  if (typeof body.details === 'string' && body.details.trim())
    return body.details.trim();
  if (typeof body.error === 'string' && body.error.trim())
    return body.error.trim();
  if (
    body.error &&
    typeof body.error === 'object' &&
    typeof body.error.message === 'string'
  ) {
    return body.error.message.trim();
  }
  return `Wallet request failed with HTTP ${status}.`;
}

function accountsLayerDisabled(message: string, status: number): boolean {
  return status === 503 && /accounts are not enabled/i.test(message);
}

export type WorkbenchPlan = {
  code: string;
  name: string;
  price_inr: number;
  duration_min: number;
  provider_credit_paise: number;
  max_concurrent_streams: number;
  allowed_models: string[];
  default_model: string;
};

function clearResolvedWallet(): void {
  sessionStorage.removeItem('dw:sessionKey');
}

export type ResolvedWorkbenchCredentials = {
  endpoint: string;
  sessionKey: string;
  model: string;
};

export function readResolvedCredentials(): ResolvedWorkbenchCredentials {
  return {
    endpoint: localStorage.getItem('dw:endpoint')?.trim() ?? '',
    sessionKey: sessionStorage.getItem('dw:sessionKey')?.trim() ?? '',
    model: localStorage.getItem('dw:model')?.trim() ?? ''
  };
}

export function isWorkbenchSessionKey(sessionKey: string): boolean {
  return /^(sess_|wb_)/.test(sessionKey.trim());
}

function gatewayBaseForSession(endpoint?: string): string {
  return (
    endpoint ||
    readResolvedCredentials().endpoint ||
    GATEWAY_BASE
  ).replace(/\/$/, '');
}

/** True when a pasted or handoff session key is still live on the gateway. */
export async function probeWorkbenchSession(
  sessionKey: string,
  endpoint?: string
): Promise<boolean> {
  const key = sessionKey.trim();
  if (!isWorkbenchSessionKey(key)) return false;
  try {
    const response = await fetch(
      `${gatewayBaseForSession(endpoint)}/v1/session/status`,
      {
        headers: { Authorization: `Bearer ${key}` }
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

export type ManualSessionPlan = {
  live: boolean;
  workbenchEligible: boolean;
  planCode: string;
  allowedModels: string[];
  defaultModel: string;
  remainingPercent: number;
};

/** Resolve plan entitlements for manual endpoint + session key mode (no Clerk). */
export async function resolveManualSessionPlan(
  sessionKey: string,
  endpoint?: string
): Promise<ManualSessionPlan | null> {
  const key = sessionKey.trim();
  if (!isWorkbenchSessionKey(key)) return null;
  const base = gatewayBaseForSession(endpoint);
  try {
    const statusResponse = await fetch(`${base}/v1/session/status`, {
      headers: { Authorization: `Bearer ${key}` }
    });
    if (!statusResponse.ok) {
      return {
        live: false,
        workbenchEligible: false,
        planCode: '',
        allowedModels: [],
        defaultModel: '',
        remainingPercent: 0
      };
    }
    const status = (await statusResponse.json()) as {
      plan?: string;
      workbench_eligible?: boolean;
      provider_cost_used_micro_paise?: number;
      provider_cost_limit_micro_paise?: number;
      max_provider_cost_paise?: number;
    };
    const planCode = typeof status.plan === 'string' ? status.plan : '';
    const limitMicroPaise = Math.max(
      0,
      status.provider_cost_limit_micro_paise ||
        (status.max_provider_cost_paise ?? 0) * 1_000_000
    );
    const usedMicroPaise = Math.max(
      0,
      status.provider_cost_used_micro_paise ?? 0
    );
    const remainingPercent =
      limitMicroPaise > 0
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(
                ((limitMicroPaise - usedMicroPaise) / limitMicroPaise) * 100
              )
            )
          )
        : 0;

    const plansResponse = await fetch(`${base}/v1/workbench/plans`);
    const plansPayload = (await plansResponse.json().catch(() => ({}))) as {
      plans?: WorkbenchPlan[];
    };
    const catalog = Array.isArray(plansPayload.plans) ? plansPayload.plans : [];
    const matched = catalog.find((plan) => plan.code === planCode);
    const allowedModels = (matched?.allowed_models ?? []).filter(
      isSelectableWorkbenchModel
    );
    const defaultModel =
      matched?.default_model &&
      isSelectableWorkbenchModel(matched.default_model)
        ? matched.default_model
        : (allowedModels[0] ?? '');

    return {
      live: true,
      workbenchEligible: status.workbench_eligible !== false,
      planCode,
      allowedModels,
      defaultModel,
      remainingPercent
    };
  } catch {
    return null;
  }
}

export function openWorkbenchPlans(): void {
  if (typeof window === 'undefined') return;
  window.location.assign(`${STORE_URL.replace(/\/$/, '')}/workbench#plans`);
}

function dispatchWalletResolved(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(WORKBENCH_WALLET_RESOLVED_EVENT));
}

/** Gateway success pages emit OpenAI base URLs (`…/v1`); Workbench needs an origin. */
function normalizeWorkbenchEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/$/, '');
  if (!trimmed) return trimmed;
  try {
    const url = new URL(
      trimmed.endsWith('/v1') ? trimmed.slice(0, -3) : trimmed
    );
    // Client-site dev proxy is browser-only; server-side harness calls the gateway directly.
    if (url.hostname === '127.0.0.1' && url.port === '5174')
      return GATEWAY_BASE;
    if (
      url.hostname === 'localhost' &&
      (url.port === '5174' || url.port === '')
    )
      return GATEWAY_BASE;
    return `${url.protocol}//${url.host}`;
  } catch {
    return trimmed.replace(/\/v1\/?$/, '');
  }
}

function seedResolvedCredentials(
  data: {
    session_key: string;
    endpoint: string;
    default_model: string;
    allowed_models?: string[];
  },
  options?: { overwriteModel?: boolean }
): void {
  const endpoint = normalizeWorkbenchEndpoint(data.endpoint);
  sessionStorage.setItem('dw:sessionKey', data.session_key);
  localStorage.setItem('dw:endpoint', endpoint);
  const existing = localStorage.getItem('dw:model')?.trim() ?? '';
  const allowed = new Set(
    (data.allowed_models ?? []).filter(isSelectableWorkbenchModel)
  );
  const keepExisting =
    !options?.overwriteModel &&
    existing &&
    (allowed.size === 0 || allowed.has(existing));
  if (!keepExisting) {
    localStorage.setItem('dw:model', data.default_model);
  }
  dispatchWalletResolved();
}

// Client-site autoauth lands credentials in the URL hash for one navigation beat.
// The hash is cleared immediately so the session key never lingers in history.
export function consumeWorkbenchHandoffFromHash(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash.startsWith(WORKBENCH_HANDOFF_HASH_PREFIX)) return false;
  try {
    const encoded = decodeURIComponent(
      hash.slice(WORKBENCH_HANDOFF_HASH_PREFIX.length)
    );
    const payload = JSON.parse(atob(encoded)) as {
      session_key?: string;
      endpoint?: string;
      model?: string;
    };
    if (
      !payload.session_key?.trim() ||
      !payload.endpoint?.trim() ||
      !payload.model?.trim()
    ) {
      return false;
    }
    seedResolvedCredentials(
      {
        session_key: payload.session_key.trim(),
        endpoint: payload.endpoint.trim(),
        default_model: payload.model.trim()
      },
      { overwriteModel: true }
    );
    const nextUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, '', nextUrl);
    return true;
  } catch {
    return false;
  }
}

// Resolves the signed-in user's active wb_ wallet and seeds the exact storage keys
// App.tsx reads at mount (dw:endpoint / dw:sessionKey) — the key stays invisible.
export async function resolveWallet(
  getToken: () => Promise<string | null>
): Promise<WalletResolution> {
  try {
    const token = await getToken();
    if (!token) {
      return {
        state: 'error',
        reason: 'Sign-in expired. Sign out and back in, then retry.',
        retryable: true
      };
    }
    const res = await fetch(`${WORKBENCH_API_BASE}/api/account/wallet`, {
      headers: { 'X-Clerk-Token': token }
    });
    if (res.status === 404) {
      clearResolvedWallet();
      return { state: 'no-wallet' };
    }
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      const reason = walletErrorMessage(payload, res.status);
      if (accountsLayerDisabled(reason, res.status)) {
        clearResolvedWallet();
        return { state: 'no-wallet' };
      }
      return {
        state: 'error',
        reason,
        retryable: res.status >= 500 || res.status === 429
      };
    }
    const data = (await res.json()) as {
      session_key: string;
      endpoint: string;
      allowed_models: string[];
      default_model: string;
      session: {
        plan_code: string;
        status: string;
        expires_at: string;
        remaining_percent: number;
      };
    };
    const expiresAt = new Date(data.session.expires_at).getTime();
    const usableStatus =
      data.session.status === 'active' || data.session.status === 'inactive';
    if (
      !usableStatus ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now() ||
      data.session.remaining_percent <= 0
    ) {
      clearResolvedWallet();
      return { state: 'no-wallet' };
    }
    const allowedModels = data.allowed_models.filter(
      isSelectableWorkbenchModel
    );
    seedResolvedCredentials({
      session_key: data.session_key,
      endpoint: data.endpoint,
      default_model: data.default_model,
      allowed_models: allowedModels
    });
    return {
      state: 'resolved',
      planCode: data.session.plan_code,
      remainingPercent: data.session.remaining_percent,
      allowedModels,
      defaultModel: data.default_model
    };
  } catch {
    return {
      state: 'error',
      reason:
        'Could not reach the Workbench wallet service. Check that the gateway is running, then retry.',
      retryable: true
    };
  }
}

export function isSelectableWorkbenchModel(model: string): boolean {
  return (
    model === 'dlg-light' ||
    model === 'dlg-pro' ||
    model === 'swe-fast' ||
    model === 'swe-fast-thinking' ||
    model === 'swe-pro' ||
    model === 'swe-pro-thinking' ||
    model === 'swe-ultra' ||
    model === 'swe-ultra-thinking'
  );
}

export async function createWorkbenchCheckout(
  planCode: string,
  getToken: () => Promise<string | null>
): Promise<string> {
  const token = await getToken();
  if (!token) throw new Error('Sign in again before purchasing credits.');
  const response = await fetch(`${GATEWAY_BASE}/v1/payment/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Clerk-Token': token
    },
    body: JSON.stringify({ plan: planCode })
  });
  const data = (await response.json().catch(() => ({}))) as {
    payment_url?: string;
    error?: { message?: string };
  };
  if (!response.ok || !data.payment_url) {
    throw new Error(data.error?.message || 'Could not start checkout.');
  }
  return data.payment_url;
}

export async function fetchWorkbenchPlans(): Promise<WorkbenchPlan[]> {
  const response = await fetch(`${GATEWAY_BASE}/v1/workbench/plans`);
  const data = (await response.json().catch(() => ({}))) as {
    plans?: WorkbenchPlan[];
    error?: { message?: string };
  };
  if (!response.ok || !Array.isArray(data.plans)) {
    throw new Error(data.error?.message || 'Could not load Workbench plans.');
  }
  return data.plans;
}

export type WorkbenchUsage = {
  status: {
    plan: string;
    expires_at: string;
    remaining_minutes: number;
    fast_output_budget: number;
    fast_output_used: number;
    pro_output_budget: number;
    pro_output_used: number;
    provider_cost_used_micro_paise: number;
    provider_cost_limit_micro_paise: number;
    provider_cost_remaining_micro_paise: number;
    max_provider_cost_paise: number;
  };
  events: Array<{
    timestamp: string;
    model: string;
    prompt_tokens: number;
    completion_tokens: number;
    cost_paise: number;
    cost_micro_paise: number;
    latency_ms: number;
  }>;
};

export function workbenchCreditUsage(status: WorkbenchUsage['status']): {
  usedMicroPaise: number;
  limitMicroPaise: number;
  remainingMicroPaise: number;
  percentUsed: number;
} {
  const limitMicroPaise = Math.max(
    0,
    status.provider_cost_limit_micro_paise ||
      status.max_provider_cost_paise * 1_000_000
  );
  const usedMicroPaise = Math.max(
    0,
    status.provider_cost_used_micro_paise || 0
  );
  const remainingMicroPaise = Math.max(
    0,
    status.provider_cost_remaining_micro_paise ??
      limitMicroPaise - usedMicroPaise
  );
  return {
    usedMicroPaise,
    limitMicroPaise,
    remainingMicroPaise,
    percentUsed:
      limitMicroPaise > 0
        ? Math.min(100, (usedMicroPaise / limitMicroPaise) * 100)
        : 0
  };
}

export async function fetchWorkbenchUsage(): Promise<WorkbenchUsage> {
  const response = await workbenchFetch('/api/account/usage');
  if (!response.ok) throw new Error('Could not load Workbench usage.');
  return response.json() as Promise<WorkbenchUsage>;
}
