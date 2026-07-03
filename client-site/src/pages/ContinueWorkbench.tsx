import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { openSignedInWorkbench } from '../lib/workbench';
import { clerkEnabled } from '../lib/clerk';
import { signInHref } from '../lib/authRedirect';

// Post-sign-in handoff: opens Workbench with the signed-in wallet (autoauth).
export function ContinueWorkbench() {
  if (!clerkEnabled) {
    return <Navigate to="/" replace />;
  }
  return <ContinueWorkbenchInner />;
}

function ContinueWorkbenchInner() {
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    openSignedInWorkbench(undefined, { replace: true });
  }, [isLoaded, isSignedIn]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f5f1] px-4">
        <p className="text-[15px] text-secondary">Preparing your Workbench session…</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to={signInHref('workbench')} replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f5f1] px-4">
      <p className="text-[15px] text-secondary">Opening Workbench with your account…</p>
    </div>
  );
}