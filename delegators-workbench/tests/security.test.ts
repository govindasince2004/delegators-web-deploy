import { describe, expect, it } from 'vitest';
import {
  assertCredentialAllowedForEndpoint,
  authValidationStrategy,
  isAllowedBrowserOrigin,
  isDirectProviderCredential,
  isOfficialMimoOrigin,
  parseWorkbenchAllowedOrigins,
  requestOriginCandidates,
  resolveBindHost,
  resolveDelegatorsBaseURL,
  scrubSecrets,
  parseEndpointAllowlist
} from '../server/security';

describe('authValidationStrategy (Workbench auth confusion guard)', () => {
  // Regression: a caller sending BOTH a valid session bearer and a forged Clerk token must be
  // validated AND attributed via Clerk — never validated-by-session then attributed-to-forged-clerk.
  it('both credentials present → validate Clerk and derive Clerk subject', () => {
    expect(authValidationStrategy(true, true)).toEqual({ validateViaClerk: true, subjectKind: 'clerk' });
  });
  it('Clerk only → validate and derive Clerk', () => {
    expect(authValidationStrategy(true, false)).toEqual({ validateViaClerk: true, subjectKind: 'clerk' });
  });
  it('session only → validate and derive session', () => {
    expect(authValidationStrategy(false, true)).toEqual({ validateViaClerk: false, subjectKind: 'session' });
  });
  it('neither → null (caller returns 401)', () => {
    expect(authValidationStrategy(false, false)).toBeNull();
  });
});

describe('resolveBindHost', () => {
  it('binds 0.0.0.0 in development for convenience', () => {
    expect(resolveBindHost({ NODE_ENV: 'development' })).toBe('0.0.0.0');
  });

  it('defaults to loopback in production', () => {
    expect(resolveBindHost({ NODE_ENV: 'production' })).toBe('127.0.0.1');
  });

  it('allows an explicit private bind host in production', () => {
    expect(resolveBindHost({ NODE_ENV: 'production', WORKBENCH_BIND_HOST: '10.0.0.5' })).toBe('10.0.0.5');
  });

  it('refuses a public bind host in production without the unsafe override', () => {
    expect(() => resolveBindHost({ NODE_ENV: 'production', WORKBENCH_BIND_HOST: '0.0.0.0' })).toThrow(
      /Refusing to bind/
    );
  });

  it('permits a public bind host only with the explicit unsafe override', () => {
    expect(
      resolveBindHost({ NODE_ENV: 'production', WORKBENCH_BIND_HOST: '0.0.0.0', WORKBENCH_ALLOW_PUBLIC_UNSAFE: 'true' })
    ).toBe('0.0.0.0');
  });

  it('permits a container bind when an authenticated proxy is configured', () => {
    expect(
      resolveBindHost({ NODE_ENV: 'production', WORKBENCH_BIND_HOST: '0.0.0.0', WORKBENCH_BEHIND_PROXY: 'true' })
    ).toBe('0.0.0.0');
  });
});

describe('resolveDelegatorsBaseURL', () => {
  it('accepts the local gateway origin in development', () => {
    expect(resolveDelegatorsBaseURL('http://127.0.0.1:8080', { NODE_ENV: 'development' })).toBe(
      'http://127.0.0.1:8080'
    );
  });

  it('rejects URLs with a path, query, or credentials', () => {
    expect(() => resolveDelegatorsBaseURL('http://127.0.0.1:8080/v1', { NODE_ENV: 'development' })).toThrow(/origin only/);
    expect(() => resolveDelegatorsBaseURL('http://u:p@127.0.0.1:8080', { NODE_ENV: 'development' })).toThrow(/origin only/);
  });

  it('fails closed in production when the allowlist is empty', () => {
    expect(() => resolveDelegatorsBaseURL('https://api.xiaomimimo.com', { NODE_ENV: 'production' })).toThrow(
      /WORKBENCH_ALLOWED_DELEGATORS_ORIGINS to be set/
    );
  });

  it('rejects an arbitrary HTTPS origin not in the production allowlist', () => {
    expect(() =>
      resolveDelegatorsBaseURL('https://api.xiaomimimo.com', {
        NODE_ENV: 'production',
        WORKBENCH_ALLOWED_DELEGATORS_ORIGINS: 'https://api.deepseek.com'
      })
    ).toThrow(/not in the production allowlist/);
  });

  it('accepts an allowlisted HTTPS origin in production', () => {
    expect(
      resolveDelegatorsBaseURL('https://api.xiaomimimo.com', {
        NODE_ENV: 'production',
        WORKBENCH_ALLOWED_DELEGATORS_ORIGINS: 'https://api.xiaomimimo.com'
      })
    ).toBe('https://api.xiaomimimo.com');
  });

  it('accepts the local compose gateway in production only with the local override', () => {
    expect(
      resolveDelegatorsBaseURL('http://gateway:8080', {
        NODE_ENV: 'production',
        WORKBENCH_ALLOW_LOCAL_DELEGATORS: 'true'
      })
    ).toBe('http://gateway:8080');
  });

  it('rejects a localhost endpoint in production by default', () => {
    expect(() =>
      resolveDelegatorsBaseURL('http://127.0.0.1:8080', {
        NODE_ENV: 'production',
        WORKBENCH_ALLOW_ANY_DELEGATORS_ORIGIN_UNSAFE: 'true'
      })
    ).toThrow(/refuses localhost or private/);
  });

  it('rejects a non-HTTPS public origin in production', () => {
    expect(() =>
      resolveDelegatorsBaseURL('http://api.xiaomimimo.com', {
        NODE_ENV: 'production',
        WORKBENCH_ALLOWED_DELEGATORS_ORIGINS: 'http://api.xiaomimimo.com'
      })
    ).toThrow(/requires an HTTPS/);
  });

  it('rejects cloud-metadata / link-local endpoints in ALL environments (SSRF guard)', () => {
    // The dev path skips auth and can bind 0.0.0.0, so the metadata block must NOT
    // be gated behind production — it would otherwise be an SSRF + key-exfil pivot.
    expect(() => resolveDelegatorsBaseURL('http://169.254.169.254', { NODE_ENV: 'development' })).toThrow(
      /link-local or cloud-metadata/
    );
    expect(() => resolveDelegatorsBaseURL('http://169.254.169.254', { NODE_ENV: 'production' })).toThrow(
      /link-local or cloud-metadata/
    );
    // Even an explicit "allow any" override cannot re-enable the metadata pivot.
    expect(() =>
      resolveDelegatorsBaseURL('http://169.254.169.254', {
        NODE_ENV: 'development',
        WORKBENCH_ALLOW_ANY_DELEGATORS_ORIGIN_UNSAFE: 'true'
      })
    ).toThrow(/link-local or cloud-metadata/);
  });
});

describe('parseEndpointAllowlist', () => {
  it('parses and normalises a comma-separated origin list', () => {
    expect(
      parseEndpointAllowlist({ WORKBENCH_ALLOWED_DELEGATORS_ORIGINS: ' http://127.0.0.1:8080 , http://localhost:8080/ ' })
    ).toEqual(['http://127.0.0.1:8080', 'http://localhost:8080']);
  });

  it('ignores inline comments in origin lists', () => {
    expect(
      parseEndpointAllowlist({ WORKBENCH_ALLOWED_DELEGATORS_ORIGINS: 'http://127.0.0.1:8080 # local gateway' })
    ).toEqual(['http://127.0.0.1:8080']);
  });

  it('returns an empty list when unset', () => {
    expect(parseEndpointAllowlist({})).toEqual([]);
  });
});

describe('Workbench browser origins', () => {
  it('allows configured cross-origin browsers', () => {
    const allowed = parseWorkbenchAllowedOrigins({
      WORKBENCH_ALLOWED_ORIGINS: 'http://127.0.0.1:4175, http://localhost:3000/'
    });

    expect(isAllowedBrowserOrigin('http://localhost:3000', allowed, [])).toBe(true);
  });

  it('allows the production app same-origin even when no allowlist is configured', () => {
    const candidates = requestOriginCandidates({
      protocol: 'http',
      host: '127.0.0.1:4175'
    });

    expect(isAllowedBrowserOrigin('http://127.0.0.1:4175', [], candidates)).toBe(true);
    expect(isAllowedBrowserOrigin('http://127.0.0.1:8080', [], candidates)).toBe(false);
  });
});

describe('scrubSecrets', () => {
  it('redacts bearer tokens and session keys so we never echo credentials', () => {
    const dirty = 'Authorization: Bearer sess_abc123DEF456 failed; wallet wb_abc123DEF456 and key sk-livesecret leaked';
    const clean = scrubSecrets(dirty);
    expect(clean).not.toContain('sess_abc123DEF456');
    expect(clean).not.toContain('wb_abc123DEF456');
    expect(clean).not.toContain('sk-livesecret');
    expect(clean).toContain('Bearer [redacted]');
    expect(clean).toContain('wb_[redacted]');
    expect(clean).toContain('sk-[redacted]');
  });
});

describe('direct provider credential policy', () => {
  it('detects provider credentials without treating session keys as provider keys', () => {
    expect(isDirectProviderCredential('sk-testdirectproviderkey123')).toBe(true);
    expect(isDirectProviderCredential('sess_abc123DEF4567890')).toBe(false);
    expect(isDirectProviderCredential('wb_abc123DEF4567890')).toBe(false);
  });

  it('only permits provider keys against the official MiMo origin', () => {
    expect(isOfficialMimoOrigin('https://api.xiaomimimo.com')).toBe(true);
    expect(() => assertCredentialAllowedForEndpoint('sk-testdirectproviderkey123', 'https://api.xiaomimimo.com')).not.toThrow();
    expect(() => assertCredentialAllowedForEndpoint('sk-testdirectproviderkey123', 'http://127.0.0.1:8080')).toThrow(
      /official MiMo endpoint/
    );
  });

  it('does not restrict Delegators session keys by credential policy', () => {
    expect(() => assertCredentialAllowedForEndpoint('sess_abc123DEF4567890', 'http://127.0.0.1:8080')).not.toThrow();
  });
});
