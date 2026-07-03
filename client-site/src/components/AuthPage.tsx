import type React from 'react';
import { ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';

interface AuthPageProps {
  keyInput: string;
  setKeyInput: (val: string) => void;
  isLoggingIn: boolean;
  onLogin: (key: string) => void;
  onBack: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  keyInput,
  setKeyInput,
  isLoggingIn,
  onLogin,
  onBack,
}) => {
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onLogin(keyInput);
  };

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-[1120px]">
        <button
          onClick={onBack}
          className="mb-8 inline-flex h-10 items-center gap-2 border border-line bg-white px-4 text-sm font-medium text-foreground hover:bg-black/5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <section className="grid border border-line bg-white md:grid-cols-[0.95fr_1.05fr]">
          <div className="border-b border-line p-6 md:border-b-0 md:border-r md:p-10">
            <div className="mb-8 flex items-center gap-3">
              <img src="/delegators_icon_transparent_cropped.png" alt="" className="h-9 w-auto" />
              <span className="text-xs font-bold uppercase tracking-[0.25em] text-foreground">Delegators</span>
            </div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">Session dashboard</p>
            <h1 className="mt-4 text-4xl font-[400] leading-[1.05] tracking-tight text-foreground md:text-6xl">
              Paste your session key.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-secondary">
              View the live endpoint, remaining time, token usage, and ledger for any active
              Delegators `sess_` key.
            </p>
          </div>

          <div className="p-6 md:p-10">
            <form onSubmit={handleSubmit} className="space-y-6">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                  Session key
                </span>
                <input
                  type="password"
                  value={keyInput}
                  onChange={(event) => setKeyInput(event.target.value)}
                  placeholder="sess_xxxxxxxxxxxxxxxx"
                  disabled={isLoggingIn}
                  className="h-12 w-full border border-line bg-[#faf9f6] px-4 font-mono text-sm text-foreground outline-none transition focus:border-indigo-500 disabled:opacity-50"
                />
              </label>

              <button
                type="submit"
                disabled={isLoggingIn || !keyInput}
                className="inline-flex h-11 items-center justify-center gap-2 bg-[#050505] px-5 text-sm font-medium text-white transition enabled:hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <KeyRound className="h-4 w-4" />
                {isLoggingIn ? 'Checking session...' : 'Open dashboard'}
              </button>
            </form>

            <div className="mt-10 grid gap-3 border-t border-line pt-6">
              <p className="flex gap-3 text-sm leading-6 text-secondary">
                <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-indigo-600" />
                Keys are stored locally in this browser so the dashboard can refresh usage.
              </p>
              <p className="flex gap-3 text-sm leading-6 text-secondary">
                <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-indigo-600" />
                Status reads do not start the session timer; model calls do.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};
