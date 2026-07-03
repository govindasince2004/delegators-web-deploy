import { getAPIBaseURL } from './api';
import { getClerkToken } from './clerk';

const DEFAULT_CLOUD_URL = 'http://localhost:5180';

export function cloudBaseURL(): string {
  return (import.meta.env.VITE_CLOUD_APP_URL || DEFAULT_CLOUD_URL).replace(/\/$/, '');
}

// Signed-in users get a one-beat session handoff so the Cloud Agent AUTO-AUTHS on entry:
// we resolve the user's dlg session via the gateway wallet, then open the cloud app with
// ?session=sess_... which the cloud app consumes and strips from the URL. Mirrors the
// Workbench wallet handoff so both surfaces share one sign-in (no second login).
export async function buildSignedInCloudURL(): Promise<string> {
  const token = await getClerkToken();
  if (!token) return cloudBaseURL();
  try {
    const res = await fetch(`${getAPIBaseURL()}/v1/account/wallet`, {
      headers: { 'X-Clerk-Token': token },
    });
    if (!res.ok) return cloudBaseURL();
    const data = (await res.json()) as { session_key?: string };
    const key = data.session_key?.trim();
    if (!key?.startsWith('sess_')) return cloudBaseURL();
    return `${cloudBaseURL()}?session=${encodeURIComponent(key)}`;
  } catch {
    return cloudBaseURL();
  }
}

export function openSignedInCloud(options?: { replace?: boolean }): void {
  void buildSignedInCloudURL().then((url) => {
    if (options?.replace) {
      window.location.replace(url);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  });
}
