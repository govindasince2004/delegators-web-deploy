import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SignedIn, useAuth } from '@clerk/clerk-react';
import { clerkEnabled, registerClerkTokenGetter } from '../lib/clerk';
import { fetchConsentStatus, recordConsent } from '../lib/api';

// DPDP consent at first sign-in: unchecked box, server-side auditable record, 18+ confirmation.
export function SignupConsentGate() {
  if (!clerkEnabled) return null;
  return (
    <SignedIn>
      <ConsentCheck />
    </SignedIn>
  );
}

function ConsentCheck() {
  const { getToken } = useAuth();
  const [needs, setNeeds] = useState(false);
  const [policies, setPolicies] = useState(false);
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    registerClerkTokenGetter(() => getToken());
    let cancelled = false;
    fetchConsentStatus()
      .then((s) => { if (!cancelled) setNeeds(s.needs_consent); })
      .catch(() => { /* accounts disabled or offline: don't block */ });
    return () => { cancelled = true; };
  }, [getToken]);

  if (!needs) return null;

  const canAccept = policies && adult;

  const accept = async () => {
    if (!canAccept) return;
    setBusy(true);
    try {
      await recordConsent(true);
      setNeeds(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md border border-zinc-200 bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-zinc-900">Before you start</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Delegators is an AI developer tool for adults. Your inputs are processed by a third-party AI
          provider as described in our Privacy Policy.
        </p>
        <label className="mt-4 flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={adult}
            onChange={(e) => setAdult(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-indigo-600"
          />
          <span className="text-sm text-zinc-700">I confirm I am <strong>18 years or older</strong>.</span>
        </label>
        <label className="mt-3 flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={policies}
            onChange={(e) => setPolicies(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-indigo-600"
          />
          <span className="text-sm text-zinc-700">
            I have read and agree to the{' '}
            <Link to="/terms" target="_blank" className="text-indigo-600 underline">Terms</Link>,{' '}
            <Link to="/privacy" target="_blank" className="text-indigo-600 underline">Privacy Policy</Link>,{' '}
            <Link to="/acceptable-use" target="_blank" className="text-indigo-600 underline">Acceptable Use</Link>, and{' '}
            <Link to="/refund" target="_blank" className="text-indigo-600 underline">Refund Policy</Link>.
          </span>
        </label>
        <button
          onClick={accept}
          disabled={!canAccept || busy}
          className="mt-5 w-full bg-[#050505] px-5 py-2.5 text-sm font-medium text-white transition enabled:hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </div>
  );
}