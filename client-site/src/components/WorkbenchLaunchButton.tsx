import { ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { clerkEnabled } from '../lib/clerk';
import { openSignedInWorkbench } from '../lib/workbench';
import { signInHref } from '../lib/authRedirect';

type WorkbenchLaunchButtonProps = {
  className?: string;
  label?: string;
};

const FALLBACK_URL = (import.meta.env.VITE_WORKBENCH_URL || 'http://localhost:5175').replace(/\/$/, '');

// Workbench autoauth requires a signed-in client-site session.
export function WorkbenchLaunchButton({ className = 'btn btn-primary group', label = 'Open Workbench' }: WorkbenchLaunchButtonProps) {
  if (!clerkEnabled) {
    return (
      <a href={FALLBACK_URL} className={className}>
        {label}
        <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </a>
    );
  }
  return <WorkbenchLaunchButtonInner className={className} label={label} />;
}

function WorkbenchLaunchButtonInner({ className, label }: WorkbenchLaunchButtonProps) {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useAuth();

  const handleClick = () => {
    if (!isLoaded) return;
    if (isSignedIn) {
      openSignedInWorkbench();
      return;
    }
    navigate(signInHref('workbench'));
  };

  return (
    <button type="button" onClick={handleClick} className={className} disabled={!isLoaded}>
      {label}
      <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </button>
  );
}