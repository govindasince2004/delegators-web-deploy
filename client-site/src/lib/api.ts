import { activeSweSession, sessionIdsMatch } from './accountSessions';
import { getSessionKey, setSessionKey } from './auth';
import { getClerkToken } from './clerk';

// Default to same-domain proxying or relative path, but allow environment override
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function getAPIBaseURL(): string {
  return API_BASE || window.location.origin;
}

export interface Plan {
  code: string;
  name: string;
  model_alias: string;
  thinking_model_alias?: string;
  thinking_enabled: boolean;
  price_inr: number;
  duration_min: number;
  fast_output_tokens: number;
  pro_output_tokens: number;
  max_concurrent_streams: number;
}

export interface SessionStatus {
  id: string;
  plan: string;
  status: string;
  created_at: string;
  expires_at: string;
  fast_output_budget: number;
  fast_output_used: number;
  pro_output_budget: number;
  pro_output_used: number;
  // Provider-cost budget — the limit that actually hard-stops the session.
  provider_cost_used_micro_paise: number;
  provider_cost_limit_micro_paise: number;
  provider_cost_remaining_micro_paise: number;
  max_provider_cost_paise: number;
  remaining_minutes: number;
}

export interface UsageEvent {
  timestamp: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  cache_hit_tokens: number;
  cache_miss_tokens: number;
  cost_paise: number;
  cost_micro_paise: number;
  latency_ms: number;
}

export class APIError extends Error {
  status: number;
  code: string;
  data: Record<string, unknown>;

  constructor(status: number, code: string, message: string, data: Record<string, unknown> = {}) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers = new Headers(options.headers || {});

  // Inject session authentication if available
  const key = getSessionKey();
  if (key && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${key}`);
  }

  // Bind the signed-in account (P1 identity): the gateway reads the Clerk JWT from
  // X-Clerk-Token so it never collides with the sess_ Authorization header.
  const clerkToken = await getClerkToken();
  if (clerkToken && !headers.has('X-Clerk-Token')) {
    headers.set('X-Clerk-Token', clerkToken);
  }

  // Set default content type
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}`;
    let errorCode = 'http_error';
    let errorData: Record<string, unknown> = {};
    try {
      const responseBody = await response.json() as Record<string, unknown>;
      const nestedError = responseBody.error;
      if (nestedError && typeof nestedError === 'object') {
        if ('message' in nestedError && typeof nestedError.message === 'string') {
          errorMessage = nestedError.message;
        }
        if ('code' in nestedError && typeof nestedError.code === 'string') {
          errorCode = nestedError.code;
        }
        if ('data' in nestedError && nestedError.data && typeof nestedError.data === 'object') {
          errorData = nestedError.data as Record<string, unknown>;
        }
      } else if (typeof responseBody?.error_description === 'string') {
        errorMessage = responseBody.error_description;
      } else if (responseBody?.message) {
        errorMessage = String(responseBody.message);
      }
      if (typeof responseBody?.error === 'string') errorCode = responseBody.error;
      if (typeof responseBody?.purchase_url === 'string') {
        errorData.purchase_url = responseBody.purchase_url;
      }
    } catch {
      // Body is not JSON, ignore
    }
    throw new APIError(response.status, errorCode, errorMessage, errorData);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function fetchPlans(): Promise<Plan[]> {
  const res = await request<{ plans: Plan[] }>('/v1/plans');
  return res.plans || [];
}

export async function fetchSessionStatus(): Promise<SessionStatus> {
  return request<SessionStatus>('/v1/session/status');
}

export async function fetchSessionUsage(): Promise<{ events: UsageEvent[] }> {
  return request<{ events: UsageEvent[] }>('/v1/session/usage');
}

export interface AccountSession {
  session_id: string;
  plan_code: string;
  kind: 'swe' | 'workbench' | 'unified' | 'flow';
  status: string;
  created_at: string;
  expires_at: string;
  max_provider_cost_paise: number;
  provider_cost_used_paise: number;
  remaining_percent: number;
}

// Account-bound purchases for the signed-in user (Clerk JWT attached by request()).
export async function fetchAccountSessions(): Promise<AccountSession[]> {
  const res = await request<{ sessions: AccountSession[] }>('/v1/account/sessions');
  return res.sessions;
}

// The signed-in user's active SWE session credential, so the dashboard loads
// without pasting the key. 404 (APIError) when no usable SWE session exists.
export async function fetchAccountSWECredential(): Promise<{
  session_key: string;
  endpoint: string;
  session: AccountSession;
}> {
  return request('/v1/account/swe/credential');
}

// Build a SessionStatus-shaped view from /v1/account/sessions when the vault
// key is missing but sessions.user_id already owns the pass.
export function accountSessionToSessionStatus(session: AccountSession): SessionStatus {
  const remainingMs = Math.max(0, new Date(session.expires_at).getTime() - Date.now());
  const limitMicro = session.max_provider_cost_paise * 1_000_000;
  const usedMicro = session.provider_cost_used_paise * 1_000_000;
  const remainingMicro = Math.max(0, limitMicro - usedMicro);
  return {
    id: session.session_id.slice(0, 8),
    plan: session.plan_code,
    status: session.status,
    created_at: session.created_at,
    expires_at: session.expires_at,
    fast_output_budget: 0,
    fast_output_used: 0,
    pro_output_budget: 0,
    pro_output_used: 0,
    provider_cost_used_micro_paise: usedMicro,
    provider_cost_limit_micro_paise: limitMicro,
    provider_cost_remaining_micro_paise: remainingMicro,
    max_provider_cost_paise: session.max_provider_cost_paise,
    remaining_minutes: Math.floor(remainingMs / 60_000),
  };
}

export type SweDashboardSnapshot = {
  sessionKey: string | null;
  activePass: AccountSession | null;
  status: SessionStatus | null;
  events: UsageEvent[];
  needsKey: boolean;
};

// Resolve the authoritative SWE pass from sessions.user_id, then load live
// status/usage via the vault key or a matching local key. Wallet-only bindings
// that disagree with the newest user-owned pass are ignored (one-active-plan).
export async function loadSweDashboardForAccount(): Promise<SweDashboardSnapshot> {
  const sessions = await fetchAccountSessions();
  const activePass = activeSweSession(sessions) ?? null;

  let vaultKey: string | null = null;
  let vaultSessionId: string | null = null;
  try {
    const credential = await fetchAccountSWECredential();
    vaultKey = credential.session_key;
    vaultSessionId = credential.session.session_id;
  } catch {
    // No vaulted key for this account surface.
  }

  let sessionKey: string | null = null;
  if (
    activePass &&
    vaultKey &&
    vaultSessionId &&
    sessionIdsMatch(vaultSessionId, activePass.session_id)
  ) {
    sessionKey = vaultKey;
  } else if (!activePass && vaultKey) {
    sessionKey = vaultKey;
  } else if (activePass) {
    const localKey = getSessionKey();
    if (localKey?.startsWith('sess_')) {
      setSessionKey(localKey);
      try {
        const probe = await fetchSessionStatus();
        if (sessionIdsMatch(probe.id, activePass.session_id)) {
          sessionKey = localKey;
        }
      } catch {
        // Local key does not match the account's active pass.
      }
    }
  } else if (vaultKey) {
    sessionKey = vaultKey;
  }

  if (sessionKey) {
    setSessionKey(sessionKey);
    const [status, usage] = await Promise.all([fetchSessionStatus(), fetchSessionUsage()]);
    const meteredPass =
      activePass ??
      sessions.find((session) => sessionIdsMatch(status.id, session.session_id)) ??
      null;
    return {
      sessionKey,
      activePass: meteredPass,
      status,
      events: usage.events || [],
      needsKey: false,
    };
  }

  return {
    sessionKey: null,
    activePass,
    status: activePass ? accountSessionToSessionStatus(activePass) : null,
    events: [],
    needsKey: Boolean(activePass),
  };
}

export interface ConsentStatus {
  granted: boolean;
  policy_version: string;
  current_version: string;
  needs_consent: boolean;
}

// DPDP consent: auditable, server-side. Captured once the user signs in and ticks the box.
export async function fetchConsentStatus(): Promise<ConsentStatus> {
  return request<ConsentStatus>('/v1/account/consent');
}

export async function recordConsent(granted: boolean): Promise<void> {
  await request<void>('/v1/account/consent', {
    method: 'POST',
    body: JSON.stringify({ granted, type: 'signup_terms_privacy' }),
  });
}

export async function createPaymentOrder(planCode: string): Promise<string> {
  const res = await request<{ payment_url: string }>('/v1/payment/create', {
    method: 'POST',
    body: JSON.stringify({ plan: planCode }),
  });
  return res.payment_url;
}

// Link a completed checkout (stored in localStorage) to the signed-in account.
export async function bindPaymentRef(ref: string, sessionKey?: string): Promise<void> {
  await request<void>('/v1/account/payment/bind', {
    method: 'POST',
    body: JSON.stringify({ ref, session_key: sessionKey }),
  });
}

export interface CLIAuthorizationResult {
  authorized: boolean;
  session: AccountSession;
}

export async function authorizeCLI(userCode: string, clerkToken: string): Promise<CLIAuthorizationResult> {
  return request<CLIAuthorizationResult>('/v1/account/cli/authorize', {
    method: 'POST',
    headers: { 'X-Clerk-Token': clerkToken },
    body: JSON.stringify({ user_code: userCode }),
  });
}

export interface FlowClaimResult {
  plan_code: string;
  session_id: string;
  expires_at: string;
  kind: string;
}

export async function claimFlowPass(clerkToken: string, planCode = 'dlg_flow'): Promise<FlowClaimResult> {
  return request<FlowClaimResult>('/v1/flow/claim', {
    method: 'POST',
    headers: { 'X-Clerk-Token': clerkToken },
    body: JSON.stringify({ plan_code: planCode }),
  });
}
