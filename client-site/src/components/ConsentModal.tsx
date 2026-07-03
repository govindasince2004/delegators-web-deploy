import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { declineConsent, grantConsent } from '../lib/consent';

// Purchase consent: unchecked policies + 18+ confirmation before Razorpay redirect.
export function ConsentModal() {
  const [open, setOpen] = useState(false);
  const [policies, setPolicies] = useState(false);
  const [adult, setAdult] = useState(false);

  useEffect(() => {
    const onNeed = () => { setPolicies(false); setAdult(false); setOpen(true); };
    window.addEventListener('dlg:need-consent', onNeed);
    return () => window.removeEventListener('dlg:need-consent', onNeed);
  }, []);

  if (!open) return null;

  const canAccept = policies && adult;
  const accept = () => { if (!canAccept) return; grantConsent(); setOpen(false); };
  const cancel = () => { declineConsent(); setOpen(false); };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md border border-zinc-200 bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-zinc-900">Before you pay</h2>
        <p className="mt-2 text-sm text-zinc-600">
          You are buying prepaid, time-limited AI access. Please review and accept our policies to
          continue.
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
            I agree to the{' '}
            <Link to="/terms" target="_blank" className="text-indigo-600 underline">Terms</Link>,{' '}
            <Link to="/privacy" target="_blank" className="text-indigo-600 underline">Privacy Policy</Link>,{' '}
            <Link to="/acceptable-use" target="_blank" className="text-indigo-600 underline">Acceptable Use</Link>, and{' '}
            <Link to="/refund" target="_blank" className="text-indigo-600 underline">Refund Policy</Link>.
          </span>
        </label>
        <div className="mt-5 flex items-center justify-end gap-3">
          <button onClick={cancel} className="border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-black/5">
            Cancel
          </button>
          <button
            onClick={accept}
            disabled={!canAccept}
            className="bg-[#050505] px-5 py-2 text-sm font-medium text-white transition enabled:hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue to payment
          </button>
        </div>
      </div>
    </div>
  );
}