import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { SignUp, useAuth } from '@clerk/clerk-react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { AuthClerkLoading } from '../components/auth/AuthClerkLoading';
import { delegatorsAuthAppearance } from '../components/auth/clerkAppearance';
import { clerkEnabled } from '../lib/clerk';
import { resolveAuthRedirect, signInHref } from '../lib/authRedirect';

export function SignUpPage() {
  if (!clerkEnabled) {
    return <Navigate to="/" replace />;
  }
  return <SignUpPageInner />;
}

function SignUpPageInner() {
  const [params] = useSearchParams();
  const redirectUrl = resolveAuthRedirect(params.get('redirect_url'));
  const { isLoaded, isSignedIn } = useAuth();

  if (isLoaded && isSignedIn) {
    return <Navigate to={redirectUrl} replace />;
  }

  return (
    <AuthLayout mode="sign-up" redirectUrl={redirectUrl}>
      <div className="auth-clerk-shell">
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl={signInHref(params.get('redirect_url') ?? undefined)}
          forceRedirectUrl={redirectUrl}
          fallbackRedirectUrl="/"
          appearance={delegatorsAuthAppearance}
          fallback={<AuthClerkLoading mode="sign-up" />}
        />
      </div>

      <p className="mt-5 text-[14px] text-secondary">
        Already have an account?{' '}
        <Link to={signInHref(params.get('redirect_url') ?? undefined)} className="font-semibold text-foreground hover:underline">
          Sign in
        </Link>
      </p>

      <div id="clerk-captcha" />
    </AuthLayout>
  );
}
