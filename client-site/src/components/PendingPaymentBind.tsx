import { useEffect } from 'react';
import { SignedIn, useAuth } from '@clerk/clerk-react';
import { bindPaymentRef } from '../lib/api';
import { clearPendingPaymentRef, getPendingPaymentKey, getPendingPaymentRef } from '../lib/auth';
import { clerkEnabled } from '../lib/clerk';

// On first sign-in after an anonymous purchase, bind the stored payment ref so the
// pass appears on the account and auto-resolves for CLI/Workbench.
export function PendingPaymentBind() {
  if (!clerkEnabled) return null;
  return (
    <SignedIn>
      <BindPendingPurchase />
    </SignedIn>
  );
}

function BindPendingPurchase() {
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const ref = getPendingPaymentRef();
    const sessionKey = getPendingPaymentKey();
    if (!ref) return;

    let cancelled = false;
    void bindPaymentRef(ref, sessionKey ?? undefined)
      .then(() => {
        if (!cancelled) clearPendingPaymentRef();
      })
      .catch(() => {
        // Keep the ref for a later retry (e.g. webhook still processing).
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  return null;
}