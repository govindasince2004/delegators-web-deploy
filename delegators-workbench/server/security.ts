// Side-effect-free security helpers for the Workbench server. Kept in their own module so they
// can be unit-tested without importing server/index.ts (which boots an HTTP listener on import).
// All functions read process.env at call time so tests can vary the environment per case.

export interface EnvLike {
  NODE_ENV?: string;
  WORKBENCH_BIND_HOST?: string;
  WORKBENCH_BEHIND_PROXY?: string;
  WORKBENCH_ALLOW_PUBLIC_UNSAFE?: string;
  WORKBENCH_ALLOW_LOCAL_DELEGATORS?: string;
  WORKBENCH_ALLOW_ANY_DELEGATORS_ORIGIN_UNSAFE?: string;
  WORKBENCH_ALLOWED_DELEGATORS_ORIGINS?: string;
  WORKBENCH_ALLOWED_ORIGINS?: string;
}

const officialMimoOrigin = 'https://api.xiaomimimo.com';

function env(overrides?: EnvLike): EnvLike {
  return overrides ?? (process.env as EnvLike);
}

function isLocalHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host === 'host.docker.internal' ||
    (!host.includes('.') && !host.includes(':')) ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  );
}

// isLinkLocalOrMetadata matches addresses that must NEVER be a valid Delegators
// gateway in any environment — cloud-instance metadata (169.254.169.254), the
// rest of the IPv4/IPv6 link-local ranges, and the unspecified address. These are
// the classic SSRF pivot targets, so resolveDelegatorsBaseURL rejects them
// regardless of NODE_ENV (the rest of the host policy is dev-relaxed; this is not).
function isLinkLocalOrMetadata(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, ''); // strip IPv6 brackets
  return (
    h === '0.0.0.0' ||
    h === '::' ||
    h.startsWith('169.254.') ||
    h.startsWith('fe80:') ||
    h.endsWith('a9fe:a9fe') // IPv4-mapped 169.254.169.254
  );
}

// resolveBindHost picks the listen address and fails closed in production when asked to bind to a
// public interface without WORKBENCH_ALLOW_PUBLIC_UNSAFE=true. The Workbench forwards a bearer
// session key server-side, so it must sit behind an authenticated proxy — never bind public.
export function resolveBindHost(overrides?: EnvLike): string {
  const e = env(overrides);
  const isProduction = e.NODE_ENV === 'production';
  const requested = (e.WORKBENCH_BIND_HOST ?? '').trim();
  const host = requested || (isProduction ? '127.0.0.1' : '0.0.0.0');
  if (!isProduction) return host;

  const loopbackOrPrivate = isLocalHost(host);
  const allowPublic = e.WORKBENCH_ALLOW_PUBLIC_UNSAFE === 'true' || e.WORKBENCH_BEHIND_PROXY === 'true';
  if (!loopbackOrPrivate && !allowPublic) {
    throw new Error(
      `Refusing to bind the Workbench to public interface "${host}" in production. ` +
        'The Workbench forwards session keys server-side and must sit behind an authenticated ' +
        'proxy. Bind to loopback/private, or set WORKBENCH_ALLOW_PUBLIC_UNSAFE=true to override.'
    );
  }
  return host;
}

export function parseEndpointAllowlist(overrides?: EnvLike): string[] {
  return parseOriginList(env(overrides).WORKBENCH_ALLOWED_DELEGATORS_ORIGINS);
}

export function parseWorkbenchAllowedOrigins(overrides?: EnvLike): string[] {
  return parseOriginList(env(overrides).WORKBENCH_ALLOWED_ORIGINS);
}

export type RequestOriginParts = {
  protocol?: string;
  host?: string;
  forwardedProto?: string;
  forwardedHost?: string;
};

export function requestOriginCandidates(parts: RequestOriginParts): string[] {
  const protocols = splitForwardedHeader(parts.forwardedProto);
  if (parts.protocol) protocols.push(parts.protocol);
  const hosts = splitForwardedHeader(parts.forwardedHost);
  if (parts.host) hosts.push(parts.host);

  const candidates = new Set<string>();
  for (const protocol of protocols) {
    const normalizedProtocol = protocol.replace(/:$/, '').toLowerCase();
    if (normalizedProtocol !== 'http' && normalizedProtocol !== 'https') continue;
    for (const host of hosts) {
      const origin = normalizeOrigin(`${normalizedProtocol}://${host}`);
      if (origin) candidates.add(origin);
    }
  }
  return [...candidates];
}

export function isAllowedBrowserOrigin(
  origin: string,
  allowedOrigins: Iterable<string>,
  sameOriginCandidates: Iterable<string>
): boolean {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  return new Set([...allowedOrigins, ...sameOriginCandidates]).has(normalized);
}

function parseOriginList(raw?: string): string[] {
  return (raw ?? '')
    .split(',')
    .map((value) => value.replace(/\s+#.*$/, '').trim())
    .filter(Boolean)
    .map((value) => new URL(value).origin);
}

function splitForwardedHeader(value?: string): string[] {
  return (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeOrigin(raw: string): string | null {
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

// resolveDelegatorsBaseURL validates a user-supplied endpoint and returns its origin. In
// production the allowlist is fail-closed: an empty allowlist accepts NO arbitrary public origin
// (this is what stops session-key exfiltration to attacker-controlled HTTPS endpoints).
export function resolveDelegatorsBaseURL(raw: string, overrides?: EnvLike): string {
  const e = env(overrides);
  const url = new URL(raw);
  const hasUnsafeParts = Boolean(url.username || url.password || url.search || url.hash);
  const hasPath = url.pathname !== '/' && url.pathname !== '';
  if (hasUnsafeParts || hasPath) {
    throw new Error('Delegators gateway URL must be an origin only, for example http://127.0.0.1:8080.');
  }

  const host = url.hostname.toLowerCase();

  // SSRF guard enforced in ALL environments: a link-local / cloud-metadata host is
  // never a real gateway, only an attacker pivot. The dev path skips auth and can
  // bind 0.0.0.0, so this must not be gated behind NODE_ENV=production.
  if (isLinkLocalOrMetadata(host)) {
    throw new Error('Refusing a link-local or cloud-metadata Delegators endpoint (SSRF guard).');
  }

  const isLocal = isLocalHost(host);

  if (e.NODE_ENV === 'production') {
    const allowLocal = e.WORKBENCH_ALLOW_LOCAL_DELEGATORS === 'true';
    const allowlist = parseEndpointAllowlist(overrides);
    const allowAny = e.WORKBENCH_ALLOW_ANY_DELEGATORS_ORIGIN_UNSAFE === 'true';
    if (allowlist.length === 0 && !allowAny && !(allowLocal && isLocal)) {
      throw new Error(
        'Production Workbench requires WORKBENCH_ALLOWED_DELEGATORS_ORIGINS to be set ' +
          '(it forwards session keys server-side; an empty allowlist is fail-closed).'
      );
    }
    if (allowlist.length > 0 && !allowlist.includes(url.origin)) {
      throw new Error('This Delegators endpoint is not in the production allowlist.');
    }
    if (isLocal && !allowLocal) {
      throw new Error('Production Workbench refuses localhost or private Delegators endpoints by default.');
    }
    if (url.protocol !== 'https:' && !(allowLocal && isLocal)) {
      throw new Error('Production Workbench requires an HTTPS Delegators origin.');
    }
  }

  return url.origin;
}

export function isDirectProviderCredential(value: string): boolean {
  return value.trim().startsWith('sk-');
}

// authValidationStrategy decides which credential the Workbench must VALIDATE and which it must
// derive the owner subject from. The two must ALWAYS be the same credential: validating one while
// trusting another (e.g. validating a session bearer but reading a Clerk token's `sub`) let a caller
// pair their own valid session with a forged Clerk token and be treated as an arbitrary Clerk owner,
// bypassing run-ownership checks. A Clerk token, when present, is the owning identity and wins.
// Returns null when neither credential is present.
export function authValidationStrategy(
  usingClerk: boolean,
  usingSession: boolean
): { validateViaClerk: boolean; subjectKind: 'clerk' | 'session' } | null {
  if (usingClerk) return { validateViaClerk: true, subjectKind: 'clerk' };
  if (usingSession) return { validateViaClerk: false, subjectKind: 'session' };
  return null;
}

export function isOfficialMimoOrigin(origin: string): boolean {
  return origin === officialMimoOrigin;
}

export function assertCredentialAllowedForEndpoint(credential: string, endpointOrigin: string): void {
  if (!isDirectProviderCredential(credential)) return;
  if (!isOfficialMimoOrigin(endpointOrigin)) {
    throw new Error('Direct provider API keys are only allowed with the official MiMo endpoint.');
  }
}

// scrubSecrets removes bearer tokens and API/session keys from any text we might surface in an
// error response or log, so a misbehaving upstream cannot make us echo the caller's credentials.
export function scrubSecrets(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/sess_[A-Za-z0-9]+/g, 'sess_[redacted]')
    .replace(/wb_[A-Za-z0-9]+/g, 'wb_[redacted]')
    .replace(/sk-[A-Za-z0-9]+/g, 'sk-[redacted]');
}

export const endpointValidationMessages = [
  'DELEGATORS_BASE_URL must be an origin only',
  'Delegators endpoint is not in the production allowlist',
  'Production Workbench requires WORKBENCH_ALLOWED_DELEGATORS_ORIGINS to be set',
  'Production Workbench refuses localhost or private Delegators endpoints',
  'Production Workbench requires an HTTPS Delegators origin',
  'Refusing a link-local or cloud-metadata Delegators endpoint',
  'Direct provider API keys are only allowed with the official MiMo endpoint'
];
