export type NativeSourceLink = {
  label: string;
  url: string;
  provider: 'google_workspace' | 'microsoft_365' | 'web';
};

const GOOGLE_HOSTS = ['docs.google.com', 'drive.google.com', 'sheets.google.com', 'slides.google.com'];
const MICROSOFT_HOSTS = [
  'sharepoint.com',
  'onedrive.live.com',
  'office.com',
  'word.cloud.microsoft',
  'excel.cloud.microsoft',
  'powerpoint.cloud.microsoft'
];

export function detectNativeSourceLink(
  url?: string,
  nativeUrl?: string,
  provider?: 'google_workspace' | 'microsoft_365' | 'web'
): NativeSourceLink | null {
  const candidate = nativeUrl?.trim() || url?.trim();
  if (!candidate) return null;

  if (provider === 'google_workspace' || isGoogleUrl(candidate)) {
    return { label: 'Open in Google', url: candidate, provider: 'google_workspace' };
  }
  if (provider === 'microsoft_365' || isMicrosoftUrl(candidate)) {
    return { label: 'Open in Office', url: candidate, provider: 'microsoft_365' };
  }
  if (url?.trim()) {
    return { label: 'Open source', url: url.trim(), provider: 'web' };
  }
  return null;
}

export function isGoogleUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return GOOGLE_HOSTS.some((pattern) => host === pattern || host.endsWith(`.${pattern}`));
  } catch {
    return false;
  }
}

export function isMicrosoftUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return MICROSOFT_HOSTS.some((pattern) => host === pattern || host.endsWith(`.${pattern}`) || host.includes(pattern));
  } catch {
    return false;
  }
}

export function providerMark(provider: NativeSourceLink['provider']): string {
  if (provider === 'google_workspace') return 'G';
  if (provider === 'microsoft_365') return 'M';
  return '↗';
}