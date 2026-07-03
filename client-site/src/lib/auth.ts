// Auth helper for the Delegators client.
const AUTH_KEY = 'delegators_session_key';
const PENDING_PAYMENT_REF_KEY = 'delegators:pending-payment-ref';
const PENDING_PAYMENT_KEY = 'delegators:pending-payment-key';

export function getSessionKey(): string | null {
  return localStorage.getItem(AUTH_KEY);
}

export function setSessionKey(key: string): void {
  localStorage.setItem(AUTH_KEY, key.trim());
}

export function clearSessionKey(): void {
  localStorage.removeItem(AUTH_KEY);
}

export function isAuthenticated(): boolean {
  const key = getSessionKey();
  return typeof key === 'string' && key.startsWith('sess_');
}

// Completed checkout refs (and the one-time session key) are queued here so a
// later sign-in can bind the pass to the account. The key is stored because the
// gateway success page consumes the Redis temp key on first load.
export function getPendingPaymentRef(): string | null {
  const ref = localStorage.getItem(PENDING_PAYMENT_REF_KEY);
  return ref && ref.trim() ? ref.trim() : null;
}

export function getPendingPaymentKey(): string | null {
  const key = localStorage.getItem(PENDING_PAYMENT_KEY);
  return key && key.trim() ? key.trim() : null;
}

export function setPendingPaymentBind(ref: string, sessionKey: string): void {
  const trimmedRef = ref.trim();
  const trimmedKey = sessionKey.trim();
  if (!trimmedRef || !trimmedKey.startsWith('sess_')) return;
  localStorage.setItem(PENDING_PAYMENT_REF_KEY, trimmedRef);
  localStorage.setItem(PENDING_PAYMENT_KEY, trimmedKey);
}

export function clearPendingPaymentRef(): void {
  localStorage.removeItem(PENDING_PAYMENT_REF_KEY);
  localStorage.removeItem(PENDING_PAYMENT_KEY);
}
