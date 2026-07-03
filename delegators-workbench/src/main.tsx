import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import { AccountGate } from './components/AccountGate';
import { CLERK_PUBLISHABLE_KEY, clerkEnabled, consumeWorkbenchHandoffFromHash } from './lib/account';

consumeWorkbenchHandoffFromHash();
import { bootstrapWorkbenchTheme } from './lib/theme';

bootstrapWorkbenchTheme();
import './styles/app.css';
import './styles/theme-light.css';

const app = (
  <AccountGate>
    <App />
  </AccountGate>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {clerkEnabled ? (
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
        {app}
      </ClerkProvider>
    ) : (
      app
    )}
  </React.StrictMode>
);
