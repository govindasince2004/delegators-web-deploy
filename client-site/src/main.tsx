import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import App from './App';
import { CLERK_PUBLISHABLE_KEY, clerkEnabled, registerClerkTokenGetter } from './lib/clerk';
import './index.css';

const container = document.getElementById('app');
if (container) {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <BrowserRouter>
        {clerkEnabled ? (
          <ClerkProvider
            publishableKey={CLERK_PUBLISHABLE_KEY}
            afterSignOutUrl="/"
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
            signInFallbackRedirectUrl="/"
            signUpFallbackRedirectUrl="/"
          >
            <ClerkApp />
          </ClerkProvider>
        ) : (
          <App />
        )}
      </BrowserRouter>
    </StrictMode>
  );
}

function ClerkApp() {
  const { getToken } = useAuth();
  useEffect(() => {
    registerClerkTokenGetter(() => getToken());
    return () => registerClerkTokenGetter(null);
  }, [getToken]);
  return <App />;
}
