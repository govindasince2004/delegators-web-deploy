import { useAuth, UserButton } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';

const PILL_CLASS =
  'inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full bg-white px-4 text-[14px] font-semibold text-[#0c0c0d] shadow-sm transition-all duration-200 hover:brightness-95 active:scale-[0.98]';

// Navbar auth slot — same pill visuals; plain route link (no Clerk redirect API).
export function NavAuthCta() {
  const { isLoaded, isSignedIn } = useAuth();

  if (isLoaded && isSignedIn) {
    return (
      <div className="px-1.5">
        <UserButton appearance={{ elements: { avatarBox: 'h-8 w-8 ring-2 ring-white/20' } }} />
      </div>
    );
  }

  return (
    <Link to="/sign-in" className={PILL_CLASS}>
      Sign in
    </Link>
  );
}

export function NavAuthCtaFallback() {
  return (
    <Link to="/sign-in" className={PILL_CLASS}>
      Sign in
    </Link>
  );
}