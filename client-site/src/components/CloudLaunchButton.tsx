import { useAuth } from '@clerk/clerk-react';
import { ArrowUpRight } from 'lucide-react';
import type { MouseEvent } from 'react';
import { cloudBaseURL, openSignedInCloud } from '../lib/cloud';

type CloudLaunchButtonProps = {
  className?: string;
  label?: string;
  demo?: boolean;
};

export function CloudLaunchButton({
  className = 'btn btn-primary group',
  label = 'Open Cloud',
  demo = false,
}: CloudLaunchButtonProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const base = cloudBaseURL();
  const href = demo ? `${base}?demo` : base;

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (demo) return; // demo opens the static preview via href
    event.preventDefault();
    if (isLoaded && isSignedIn) {
      // Signed in → resolve the dlg session and open the real cloud with auto-auth handoff.
      openSignedInCloud();
      return;
    }
    // Not signed in → sign in first, then return to the cloud landing.
    window.location.href = `/sign-in?redirect_url=${encodeURIComponent('/cloud-agents')}`;
  };

  return (
    <a href={href} onClick={handleClick} className={className}>
      {label}
      <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </a>
  );
}
