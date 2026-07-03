import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { SignIn, useAuth } from '@clerk/clerk-react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { AuthClerkLoading } from '../components/auth/AuthClerkLoading';
import { delegatorsAuthAppearance } from '../components/auth/clerkAppearance';
import { clerkEnabled } from '../lib/clerk';
import { resolveAuthRedirect, signUpHref } from '../lib/authRedirect';

export function SignInPage() {
  if (!clerkEnabled) {
    return <Navigate to="/" replace />;
  }
  return <SignInPageInner />;
}

function SignInPageInner() {
  const [params] = useSearchParams();
  const redirectUrl = resolveAuthRedirect(params.get('redirect_url'));
  const { isLoaded, isSignedIn } = useAuth();

  if (isLoaded && isSignedIn) {
    return <Navigate to={redirectUrl} replace />;
  }

  return (
    <AuthLayout mode="sign-in" redirectUrl={redirectUrl}>
      <div className="auth-clerk-shell">
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl={signUpHref(params.get('redirect_url') ?? undefined)}
          forceRedirectUrl={redirectUrl}
          fallbackRedirectUrl="/"
          appearance={delegatorsAuthAppearance}
          fallback={<AuthClerkLoading mode="sign-in" />}
        />
      </div>

      <p className="mt-5 text-[14px] text-secondary">
        New here?{' '}
        <Link to={signUpHref(params.get('redirect_url') ?? undefined)} className="font-semibold text-foreground hover:underline">
          Create an account
        </Link>
      </p>
      <div id="clerk-captcha" />
    </AuthLayout>
  );
}
