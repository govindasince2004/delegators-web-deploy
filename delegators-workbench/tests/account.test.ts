import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  consumeWorkbenchHandoffFromHash,
  fetchWorkbenchPlans,
  isSelectableWorkbenchModel,
  isWorkbenchSessionKey,
  probeWorkbenchSession,
  readResolvedCredentials,
  resolveManualSessionPlan,
  resolveWallet,
  workbenchCreditUsage
} from '../src/lib/account';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Workbench account plans', () => {
  it('calculates usage from exact provider cost instead of token safety budgets', () => {
    const usage = workbenchCreditUsage({
      plan: 'wb_29',
      expires_at: '2099-07-14T00:00:00.000Z',
      remaining_minutes: 40_000,
      fast_output_budget: 2_000_000,
      fast_output_used: 10,
      pro_output_budget: 2_000_000,
      pro_output_used: 20,
      provider_cost_used_micro_paise: 6_500_000,
      provider_cost_limit_micro_paise: 1_300_000_000,
      provider_cost_remaining_micro_paise: 1_293_500_000,
      max_provider_cost_paise: 1_300
    });

    expect(usage.percentUsed).toBeCloseTo(0.5);
    expect(usage.remainingMicroPaise).toBe(1_293_500_000);
  });

  it('exposes thinking aliases when the active plan entitlement includes them', () => {
    expect(isSelectableWorkbenchModel('dlg-light')).toBe(true);
    expect(isSelectableWorkbenchModel('dlg-pro')).toBe(true);
    expect(isSelectableWorkbenchModel('swe-fast-thinking')).toBe(true);
    expect(isSelectableWorkbenchModel('swe-pro-thinking')).toBe(true);
    expect(isSelectableWorkbenchModel('art-vision')).toBe(false);
  });

  it('loads purchasable Workbench packs from the gateway plan endpoint', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe('http://localhost:8080/v1/workbench/plans');
      return new Response(
        JSON.stringify({
          plans: [
            {
              code: 'dlg_lite',
              name: 'Delegators Pro Pass',
              price_inr: 49,
              duration_min: 150,
              provider_credit_paise: 3000,
              max_concurrent_streams: 2
            }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchWorkbenchPlans()).resolves.toMatchObject([
      { code: 'dlg_lite', price_inr: 49 }
    ]);
  });

  it('fails closed when the gateway does not return a plan list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 200 }))
    );

    await expect(fetchWorkbenchPlans()).rejects.toThrow(
      /Could not load Workbench plans/
    );
  });

  it('consumes a client-site wallet handoff from the URL hash and clears it', () => {
    const values = new Map<string, string>();
    const localValues = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key)
    });
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => localValues.get(key) ?? null,
      setItem: (key: string, value: string) => localValues.set(key, value),
      removeItem: (key: string) => localValues.delete(key)
    });
    const replaceState = vi.fn();
    vi.stubGlobal('window', {
      location: {
        hash: `#dw-handoff=${encodeURIComponent(
          btoa(
            JSON.stringify({
              session_key: 'wb_test_handoff_1234567890',
              endpoint: 'http://localhost:8080',
              model: 'swe-fast'
            })
          )
        )}`,
        pathname: '/',
        search: ''
      },
      history: { replaceState },
      dispatchEvent: vi.fn()
    });

    expect(consumeWorkbenchHandoffFromHash()).toBe(true);
    expect(readResolvedCredentials()).toEqual({
      endpoint: 'http://localhost:8080',
      sessionKey: 'wb_test_handoff_1234567890',
      model: 'swe-fast'
    });
    expect(replaceState).toHaveBeenCalledWith(null, '', '/');
  });

  it('normalizes client-site /v1 handoff endpoints to the gateway origin', () => {
    const sessionValues = new Map<string, string>();
    const localValues = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => sessionValues.get(key) ?? null,
      setItem: (key: string, value: string) => sessionValues.set(key, value),
      removeItem: (key: string) => sessionValues.delete(key)
    });
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => localValues.get(key) ?? null,
      setItem: (key: string, value: string) => localValues.set(key, value),
      removeItem: (key: string) => localValues.delete(key)
    });
    const replaceState = vi.fn();
    vi.stubGlobal('window', {
      location: {
        hash: `#dw-handoff=${encodeURIComponent(
          btoa(
            JSON.stringify({
              session_key: 'sess_handoff_normalize',
              endpoint: 'http://127.0.0.1:5174/v1',
              model: 'swe-fast'
            })
          )
        )}`,
        pathname: '/',
        search: ''
      },
      history: { replaceState },
      dispatchEvent: vi.fn()
    });

    expect(consumeWorkbenchHandoffFromHash()).toBe(true);
    expect(readResolvedCredentials().endpoint).toMatch(
      /^http:\/\/(127\.0\.0\.1|localhost):8080$/
    );
  });

  it('keeps the user-selected thinking model when the wallet refreshes', async () => {
    const localValues = new Map([['dw:model', 'dlg-pro']]);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => localValues.get(key) ?? null,
      setItem: (key: string, value: string) => localValues.set(key, value),
      removeItem: (key: string) => localValues.delete(key)
    });
    vi.stubGlobal('sessionStorage', {
      getItem: () => null,
      setItem: vi.fn(),
      removeItem: vi.fn()
    });
    vi.stubGlobal('window', { dispatchEvent: vi.fn() });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              session_key: 'sess_test_wallet_refresh',
              endpoint: 'http://localhost:8080',
              allowed_models: ['dlg-light', 'dlg-pro'],
              default_model: 'dlg-pro',
              session: {
                plan_code: 'dlg_lite',
                status: 'active',
                expires_at: '2099-07-01T00:00:00.000Z',
                remaining_percent: 90
              }
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
      )
    );

    await expect(
      resolveWallet(async () => 'clerk-token')
    ).resolves.toMatchObject({
      state: 'resolved',
      defaultModel: 'dlg-pro'
    });
    expect(localValues.get('dw:model')).toBe('dlg-pro');
    expect(readResolvedCredentials().model).toBe('dlg-pro');
  });

  it('detects live workbench session keys', () => {
    expect(isWorkbenchSessionKey('sess_live_key_1234567890')).toBe(true);
    expect(isWorkbenchSessionKey('wb_live_key_1234567890')).toBe(true);
    expect(isWorkbenchSessionKey('clerk_jwt_token')).toBe(false);
  });

  it('probes session status through the configured gateway', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => 'http://localhost:8080',
      setItem: vi.fn(),
      removeItem: vi.fn()
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        expect(url).toBe('http://localhost:8080/v1/session/status');
        return new Response('{}', { status: 200 });
      })
    );

    await expect(
      probeWorkbenchSession(
        'sess_probe_key_1234567890',
        'http://localhost:8080'
      )
    ).resolves.toBe(true);
  });

  it('resolves manual session entitlements from gateway status and plan catalog', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/v1/session/status')) {
          return new Response(
            JSON.stringify({
              plan: 'dlg_lite',
              workbench_eligible: true,
              provider_cost_used_micro_paise: 100_000_000,
              provider_cost_limit_micro_paise: 1_000_000_000
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.endsWith('/v1/workbench/plans')) {
          return new Response(
            JSON.stringify({
              plans: [
                {
                  code: 'dlg_lite',
                  name: 'Pro',
                  price_inr: 49,
                  duration_min: 150,
                  provider_credit_paise: 3000,
                  max_concurrent_streams: 2,
                  allowed_models: ['dlg-light', 'dlg-pro'],
                  default_model: 'dlg-pro'
                }
              ]
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        throw new Error(`unexpected url ${url}`);
      })
    );

    await expect(
      resolveManualSessionPlan(
        'sess_probe_key_1234567890',
        'http://localhost:8080'
      )
    ).resolves.toMatchObject({
      live: true,
      planCode: 'dlg_lite',
      allowedModels: ['dlg-light', 'dlg-pro'],
      defaultModel: 'dlg-pro',
      remainingPercent: 90
    });
  });

  it('falls back to browse mode when the gateway accounts layer is disabled', async () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => null,
      setItem: vi.fn(),
      removeItem: vi.fn()
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: { message: 'Accounts are not enabled on this deployment' }
            }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          )
      )
    );

    await expect(resolveWallet(async () => 'clerk-token')).resolves.toEqual({
      state: 'no-wallet'
    });
  });

  it('returns a retryable wallet error when the service is temporarily unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: 'wallet_unavailable',
              details: 'The Workbench wallet service is unavailable.'
            }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          )
      )
    );

    await expect(
      resolveWallet(async () => 'clerk-token')
    ).resolves.toMatchObject({
      state: 'error',
      reason: 'The Workbench wallet service is unavailable.',
      retryable: true
    });
  });

  it('clears a stale credential when the account wallet is no longer usable', async () => {
    const values = new Map([['dw:sessionKey', 'sess_stale']]);
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key)
    });
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: vi.fn(),
      removeItem: vi.fn()
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              session_key: 'sess_stale',
              endpoint: 'http://localhost:8080',
              allowed_models: ['swe-fast'],
              default_model: 'swe-fast',
              session: {
                plan_code: 'dlg_lite',
                status: 'revoked',
                expires_at: '2099-07-01T00:00:00.000Z',
                remaining_percent: 90
              }
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
      )
    );

    await expect(resolveWallet(async () => 'clerk-token')).resolves.toEqual({
      state: 'no-wallet'
    });
    expect(values.has('dw:sessionKey')).toBe(false);
  });
});
