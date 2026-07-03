import { getAPIBaseURL } from './api';
import { getClerkToken } from './clerk';

const DEFAULT_WORKBENCH_URL = 'http://localhost:5175';

export function workbenchBaseURL(): string {
  return (import.meta.env.VITE_WORKBENCH_URL || DEFAULT_WORKBENCH_URL).replace(/\/$/, '');
}

type WorkbenchHandoffPayload = {
  session_key: string;
  endpoint: string;
  model: string;
};

function encodeWorkbenchHandoff(payload: WorkbenchHandoffPayload): string {
  const encoded = btoa(JSON.stringify(payload));
  return `${workbenchBaseURL()}/#dw-handoff=${encodeURIComponent(encoded)}`;
}

// Signed-in users get a one-beat wallet handoff so Workbench opens ready
// even when the storefront and workspace run on different origins.
export async function buildSignedInWorkbenchURL(): Promise<string> {
  const token = await getClerkToken();
  if (!token) return workbenchBaseURL();
  try {
    const response = await fetch(`${getAPIBaseURL()}/v1/account/wallet`, {
      headers: { 'X-Clerk-Token': token },
    });
    if (!response.ok) return workbenchBaseURL();
    const data = (await response.json()) as {
      session_key?: string;
      endpoint?: string;
      default_model?: string;
    };
    if (!data.session_key?.trim() || !data.endpoint?.trim() || !data.default_model?.trim()) {
      return workbenchBaseURL();
    }
    return encodeWorkbenchHandoff({
      session_key: data.session_key.trim(),
      endpoint: data.endpoint.trim(),
      model: data.default_model.trim(),
    });
  } catch {
    return workbenchBaseURL();
  }
}

function normalizeHandoffEndpoint(baseURL: string): string {
  const trimmed = baseURL.trim().replace(/\/$/, '');
  if (trimmed.endsWith('/v1')) {
    try {
      const url = new URL(trimmed.slice(0, -3));
      if (url.port === '5174') return (import.meta.env.VITE_DELEGATORS_GATEWAY_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
      return `${url.protocol}//${url.host}`;
    } catch {
      return trimmed.replace(/\/v1\/?$/, '');
    }
  }
  return trimmed;
}

export function openWorkbenchWithHandoff(
  config: { apiKey: string; baseURL: string; model: string },
  view?: 'usage',
  options?: { replace?: boolean },
): void {
  const handoffUrl = encodeWorkbenchHandoff({
    session_key: config.apiKey,
    endpoint: normalizeHandoffEndpoint(config.baseURL),
    model: config.model,
  });
  const hashIndex = handoffUrl.indexOf('#');
  const hash = hashIndex >= 0 ? handoffUrl.slice(hashIndex) : '';
  const target = view
    ? `${workbenchBaseURL()}?view=${encodeURIComponent(view)}${hash}`
    : handoffUrl;
  if (options?.replace) {
    window.location.replace(target);
    return;
  }
  window.open(target, '_blank', 'noopener,noreferrer');
}

export function openSignedInWorkbench(view?: 'usage', options?: { replace?: boolean }): void {
  void buildSignedInWorkbenchURL().then((url) => {
    const hashIndex = url.indexOf('#');
    const hash = hashIndex >= 0 ? url.slice(hashIndex) : '';
    const target = view
      ? `${workbenchBaseURL()}?view=${encodeURIComponent(view)}${hash}`
      : url;
    if (options?.replace) {
      window.location.replace(target);
      return;
    }
    window.open(target, '_blank', 'noopener,noreferrer');
  });
}