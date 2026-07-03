import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { Docs } from './pages/Docs';
import { Pricing } from './pages/Pricing';
import { Usage } from './pages/Usage';
import { LegalPage } from './pages/Legal';
import { PaymentSuccess } from './pages/PaymentSuccess';
import { ConsentModal } from './components/ConsentModal';
import { CookieNotice } from './components/CookieNotice';
import { PendingPaymentBind } from './components/PendingPaymentBind';
import { SignupConsentGate } from './components/SignupConsentGate';
import { CLIActivate } from './pages/CLIActivate';
import { SWEProduct } from './pages/SWEProduct';
import { CLIProduct } from './pages/CLIProduct';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { SSOCallback } from './pages/SSOCallback';
import { ContinueWorkbench } from './pages/ContinueWorkbench';
import { WorkbenchProduct } from './pages/WorkbenchProduct';
import { FlowActivate } from './pages/FlowActivate';
import { FlowProduct } from './pages/FlowProduct';
import { CloudAgentsProduct } from './pages/CloudAgentsProduct';

// Smoothly scroll to a #hash target after navigation (e.g. /#workbench from the
// navbar), retrying until the section has mounted.
function ScrollToHash() {
  const { hash, pathname } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const id = hash.slice(1);
    let tries = 0;
    const tryScroll = () => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else if (tries++ < 12) setTimeout(tryScroll, 60);
    };
    tryScroll();
  }, [hash, pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ConsentModal />
      <CookieNotice />
      <SignupConsentGate />
      <PendingPaymentBind />
      <ScrollToHash />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/dashboard" element={<Usage />} />
        <Route path="/payment/success" element={<PaymentSuccess />} />
        <Route path="/cli/activate" element={<CLIActivate />} />
        <Route path="/flow/activate" element={<FlowActivate />} />
        <Route path="/flow" element={<FlowProduct />} />
        <Route path="/swe" element={<SWEProduct />} />
        <Route path="/workbench" element={<WorkbenchProduct />} />
        <Route path="/cli" element={<CLIProduct />} />
        <Route path="/cloud-agents" element={<CloudAgentsProduct />} />
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />
        <Route path="/sso-callback" element={<SSOCallback />} />
        <Route path="/continue/workbench" element={<ContinueWorkbench />} />
        <Route path="/terms" element={<LegalPage doc="terms" />} />
        <Route path="/privacy" element={<LegalPage doc="privacy" />} />
        <Route path="/acceptable-use" element={<LegalPage doc="acceptable-use" />} />
        <Route path="/refund" element={<LegalPage doc="refund" />} />
        <Route path="/delivery" element={<LegalPage doc="delivery" />} />
        <Route path="/shipping" element={<Navigate to="/delivery" replace />} />
        <Route path="/contact" element={<LegalPage doc="contact" />} />
        <Route path="/grievance" element={<Navigate to="/contact" replace />} />
      </Routes>
    </>
  );
}
