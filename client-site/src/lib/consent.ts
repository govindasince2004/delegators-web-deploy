// Purchase consent gate (DPDP Act / Consumer Protection): the user must give
// EXPLICIT, non-pre-ticked consent to the Terms, Privacy, and Refund policies
// before any checkout. Enforced once at the single checkout chokepoint.
import { recordConsent } from './api';
import { clerkEnabled } from './clerk';

const KEY = 'dlg:consent:v1';

export function hasConsent(): boolean {
  return localStorage.getItem(KEY) === '1';
}

let resolver: (() => void) | null = null;
let rejecter: ((e: unknown) => void) | null = null;

// Resolves immediately if consent was already given; otherwise opens the modal
// and resolves when the user agrees (rejects if they cancel).
export function requireConsent(): Promise<void> {
  if (hasConsent()) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    resolver = resolve;
    rejecter = reject;
    window.dispatchEvent(new CustomEvent('dlg:need-consent'));
  });
}

export function grantConsent(): void {
  localStorage.setItem(KEY, '1');
  if (clerkEnabled) {
    void recordConsent(true).catch(() => {
      // Gateway enforces consent on checkout; a failed sync will surface there.
    });
  }
  resolver?.();
  resolver = null;
  rejecter = null;
}

export function declineConsent(): void {
  rejecter?.(new Error('consent_declined'));
  resolver = null;
  rejecter = null;
}
