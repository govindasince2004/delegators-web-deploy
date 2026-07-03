import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SignedIn, SignedOut, useAuth } from '@clerk/clerk-react';
import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { ActivePlanConflictError, CheckoutAuthRequiredError, checkoutErrorMessage, redirectToCheckout } from '../../lib/razorpay';
import { PUBLIC_PLANS, PASS_TAGLINE, BETA_REQUEST_URL, passCardFeatureBullets } from '../../lib/plans';
import { signInHref } from '../../lib/authRedirect';
import { clerkEnabled } from '../../lib/clerk';
import { fetchAccountSessions } from '../../lib/api';
import { activeSessionForProduct } from '../../lib/accountSessions';

// The launch `dlg_*` passes. Clean monochrome liquid-glass cards; the primary
// Pro pass inverts to charcoal. Shared by the landing PricingSection and the
// /pricing page.

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];
const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const cardVariants = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } } };

export function PassCards() {
  return clerkEnabled ? <AccountAwarePassCards /> : <PassCardGrid />;
}

function AccountAwarePassCards() {
  const { isLoaded, isSignedIn } = useAuth();
  const [activePlanCode, setActivePlanCode] = useState('');
  const [checkingPlan, setCheckingPlan] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setActivePlanCode('');
      setCheckingPlan(false);
      return;
    }
    let cancelled = false;
    setCheckingPlan(true);
    fetchAccountSessions()
      .then((sessions) => {
        if (cancelled) return;
        setActivePlanCode(activeSessionForProduct(sessions, 'unified')?.plan_code ?? '');
      })
      .catch(() => {
        if (!cancelled) setActivePlanCode('');
      })
      .finally(() => {
        if (!cancelled) setCheckingPlan(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  return <PassCardGrid activePlanCode={activePlanCode} checkingPlan={checkingPlan} />;
}

function PassCardGrid({
  activePlanCode = '',
  checkingPlan = false,
}: {
  activePlanCode?: string;
  checkingPlan?: boolean;
}) {
  const activePlan = PUBLIC_PLANS.find((plan) => plan.code === activePlanCode);
  const [checkoutError, setCheckoutError] = useState('');

  async function buy(code: string) {
    if (activePlanCode) return;
    setCheckoutError('');
    try {
      await redirectToCheckout(code);
    } catch (e) {
      if (e instanceof Error && e.message === 'consent_declined') return;
      if (e instanceof CheckoutAuthRequiredError) return;
      if (e instanceof ActivePlanConflictError) {
        window.location.href = e.dashboardUrl || '/dashboard';
        return;
      }
      // In-design inline notice — never a native browser alert.
      setCheckoutError(checkoutErrorMessage(e));
    }
  }

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
      variants={containerVariants}
      className="mx-auto grid max-w-4xl items-stretch gap-4 md:grid-cols-2"
    >
      {activePlan ? (
        <div className="col-span-full mb-1 flex flex-col gap-3 rounded-2xl border border-emerald-300 bg-emerald-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Active pass</p>
            <p className="mt-1 text-sm text-emerald-950">
              {activePlan.name} is active. Use it before purchasing another pass.
            </p>
          </div>
          <a
            href="/dashboard"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
          >
            Open usage dashboard
          </a>
        </div>
      ) : null}

      {checkoutError ? (
        <div
          role="alert"
          className="col-span-full mb-1 flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Checkout</p>
            <p className="mt-1 text-sm text-amber-950">{checkoutError}</p>
          </div>
          <button
            type="button"
            onClick={() => setCheckoutError('')}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-amber-300 px-4 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {PUBLIC_PLANS.map((plan) => {
        const dark = plan.tag === 'Popular';
        const isActive = plan.code === activePlanCode;
        return (
          <motion.article
            variants={cardVariants}
            key={plan.code}
            className={`relative flex flex-col rounded-3xl p-7 transition-all duration-300 hover:-translate-y-1 ${
              dark ? 'bg-[#0c0c0d] text-white shadow-[0_30px_70px_-30px_rgba(10,12,30,0.6)]' : 'glass-card'
            } ${isActive ? 'ring-2 ring-emerald-300' : ''}`}
          >
            {plan.tag && (
              <span
                className={`absolute right-6 top-0 -translate-y-1/2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                  dark ? 'bg-white text-[#0c0c0d]' : 'bg-[#0c0c0d] text-white'
                }`}
              >
                {plan.tag}
              </span>
            )}

            <h3 className="text-2xl font-medium tracking-tight">{plan.name}</h3>
            <p className={`mt-2 min-h-[44px] text-[14px] leading-relaxed ${dark ? 'text-white/55' : 'text-secondary'}`}>
              {plan.copy}
            </p>

            <div className="my-6 flex items-baseline gap-1">
              <span className="text-5xl font-medium tracking-tight tabular-nums">{plan.price}</span>
              <span className={`text-sm font-medium ${dark ? 'text-white/40' : 'text-secondary/70'}`}>/ pass</span>
            </div>

            <div
              className={`mb-6 rounded-xl border px-3.5 py-2.5 text-[12.5px] leading-relaxed ${
                dark ? 'border-white/12 bg-white/[0.04] text-white/65' : 'border-line bg-white/50 text-secondary'
              }`}
            >
              {plan.thinking ? 'Extended thinking included for harder problems.' : 'No extended thinking — instant first tokens.'}
            </div>

            <ul className={`mb-7 flex-1 space-y-3 text-[14px] ${dark ? 'text-white/75' : 'text-secondary'}`}>
              {passCardFeatureBullets(plan).map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <Check className={`mt-0.5 h-4 w-4 shrink-0 ${dark ? 'text-white' : 'text-foreground'}`} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto">
              {plan.beta ? (
                <a
                  href={BETA_REQUEST_URL}
                  className={`group btn mt-auto w-full ${dark ? 'btn-light' : 'btn-secondary'}`}
                >
                  Request beta access
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                </a>
              ) : clerkEnabled ? (
                <>
                  <SignedIn>
                    {activePlanCode ? (
                      isActive ? (
                        <a
                          href="/dashboard"
                          className={`group btn mt-auto w-full ${dark ? 'btn-light' : 'btn-primary'}`}
                        >
                          Active · Open dashboard
                          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className={`btn mt-auto w-full cursor-not-allowed opacity-60 ${dark ? 'btn-light' : 'btn-primary'}`}
                        >
                          Active pass already open
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => buy(plan.code)}
                        disabled={checkingPlan}
                        className={`group btn mt-auto w-full disabled:cursor-wait disabled:opacity-60 ${dark ? 'btn-light' : 'btn-primary'}`}
                      >
                        {checkingPlan ? 'Checking active pass…' : `Get ${plan.name}`}
                        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                      </button>
                    )}
                  </SignedIn>
                  <SignedOut>
                    <Link
                      to={signInHref('/pricing')}
                      className={`group btn mt-auto w-full ${dark ? 'btn-light' : 'btn-primary'}`}
                    >
                      Sign in to get {plan.name}
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </Link>
                  </SignedOut>
                </>
              ) : (
                <button onClick={() => buy(plan.code)} className={`group btn mt-auto w-full ${dark ? 'btn-light' : 'btn-primary'}`}>
                  Get {plan.name}
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                </button>
              )}
            </div>
          </motion.article>
        );
      })}
    </motion.div>
  );
}

export { PASS_TAGLINE };
