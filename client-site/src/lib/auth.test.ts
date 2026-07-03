import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearPendingPaymentRef,
  getPendingPaymentKey,
  getPendingPaymentRef,
  setPendingPaymentBind,
} from './auth';

describe('pending payment ref storage', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => { storage.set(key, value); },
        removeItem: (key: string) => { storage.delete(key); },
      },
      configurable: true,
    });
  });

  afterEach(() => {
    clearPendingPaymentRef();
  });

  it('stores and clears a completed checkout reference and session key', () => {
    setPendingPaymentBind('plan:dlg_pro:abc123', 'sess_test_key_123');
    expect(getPendingPaymentRef()).toBe('plan:dlg_pro:abc123');
    expect(getPendingPaymentKey()).toBe('sess_test_key_123');
    clearPendingPaymentRef();
    expect(getPendingPaymentRef()).toBeNull();
    expect(getPendingPaymentKey()).toBeNull();
  });

  it('ignores blank refs or invalid keys', () => {
    setPendingPaymentBind('   ', 'sess_test_key_123');
    expect(getPendingPaymentRef()).toBeNull();
    setPendingPaymentBind('plan:dlg_pro:abc', 'not-a-session-key');
    expect(getPendingPaymentRef()).toBeNull();
  });
});