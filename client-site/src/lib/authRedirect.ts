/** Safe post-auth redirect — only same-origin relative paths. */
export function resolveAuthRedirect(raw: string | null | undefined, fallback = '/'): string {
  if (!raw?.trim()) return fallback;
  const value = raw.trim();
  if (value === 'workbench') return '/continue/workbench';
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}

export function signInHref(redirectUrl?: string): string {
  if (!redirectUrl) return '/sign-in';
  return `/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`;
}

export function signUpHref(redirectUrl?: string): string {
  if (!redirectUrl) return '/sign-up';
  return `/sign-up?redirect_url=${encodeURIComponent(redirectUrl)}`;
}