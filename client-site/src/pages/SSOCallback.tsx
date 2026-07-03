import { AuthenticateWithRedirectCallback } from '@clerk/clerk-react';

export function SSOCallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f5f1] px-4">
      <div className="text-center">
        <p className="eyebrow text-secondary">Signing you in</p>
        <p className="mt-3 text-[15px] text-secondary">Finishing your secure login…</p>
      </div>
      <AuthenticateWithRedirectCallback />
    </div>
  );
}