import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const KEY = 'dlg:cookie-notice:v1';

// Essential-cookies-only notice (Clerk session + local product storage). No ad trackers.
export function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(KEY) !== '1') setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(KEY, '1');
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-[90] mx-auto max-w-[760px] rounded-xl border border-zinc-200 bg-white/95 px-4 py-3 shadow-[0_18px_55px_-24px_rgba(11,11,12,0.45)] backdrop-blur-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-5 text-zinc-600">
          We use essential cookies and local storage to keep you signed in and run your session. No ad
          trackers.{' '}
          <Link to="/privacy" className="text-indigo-600 underline hover:text-indigo-500">
            Privacy Policy
          </Link>
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg bg-[#050505] px-4 py-2 text-sm font-medium text-white hover:bg-black/80"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
