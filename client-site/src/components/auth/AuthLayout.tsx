import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { AuthVideoPanel } from './AuthVideoPanel';

const AUTH_HERO_IMAGE = '/auth/hero.jpg';

type AuthLayoutProps = {
  mode: 'sign-in' | 'sign-up';
  children: ReactNode;
  redirectUrl?: string;
};

export function AuthLayout({ mode, children, redirectUrl = '/' }: AuthLayoutProps) {
  const backTo = redirectUrl && redirectUrl !== '/continue/workbench' ? redirectUrl : '/';

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = AUTH_HERO_IMAGE;
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, []);

  return (
    <div className="auth-page grid h-screen w-full grid-cols-1 overflow-hidden bg-[#f6f5f1] lg:grid-cols-2">
      {/* Left 50% — single centered rail so header, form, and footer share one edge */}
      <div className="flex min-h-0 flex-col overflow-y-auto px-6 sm:px-10 lg:px-14 xl:px-16">
        <div className="auth-left-rail mx-auto flex min-h-full w-full flex-col">
          <header className="flex shrink-0 items-center py-5 lg:py-6">
            <Link
              to={backTo}
              className="inline-flex items-center gap-2 text-[13px] font-medium text-secondary transition hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Link>
          </header>

          <div className="flex flex-1 flex-col justify-center py-6 lg:py-10">
            <p className="eyebrow text-secondary">{mode === 'sign-in' ? 'Welcome back' : 'Get started'}</p>
            <h1 className="mt-3 text-[2.35rem] font-medium leading-[1.05] tracking-[-0.03em] text-foreground lg:text-[2.75rem]">
              {mode === 'sign-in' ? (
                <>Sign in to <span className="serif-accent">Delegators</span></>
              ) : (
                <>Create your <span className="serif-accent">account</span></>
              )}
            </h1>
            <p className="mt-4 max-w-[36ch] text-[15px] leading-relaxed text-secondary">
              {mode === 'sign-in'
                ? 'One account powers SWE sessions and the Workbench.'
                : 'Google, Microsoft, GitHub, or email. No subscription.'}
            </p>

            <div className="mt-7 w-full">{children}</div>
          </div>

          <p className="shrink-0 pb-6 text-[12px] leading-relaxed text-muted">
            By continuing you agree to our{' '}
            <Link to="/terms" className="text-secondary hover:text-foreground hover:underline">Terms</Link>
            {' '}and{' '}
            <Link to="/privacy" className="text-secondary hover:text-foreground hover:underline">Privacy Policy</Link>.
          </p>
        </div>
      </div>

      {/* Right 50% — static hero, full bleed */}
      <div className="relative hidden min-h-0 overflow-hidden bg-[#0b0b0c] lg:block">
        <AuthVideoPanel />
      </div>
    </div>
  );
}
