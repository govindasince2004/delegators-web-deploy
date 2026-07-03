import { useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  ArrowRight,
  Check,
  Download,
  Languages,
  Mic,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { APIError, claimFlowPass } from '../lib/api';
import { clerkEnabled } from '../lib/clerk';
import { signInHref } from '../lib/authRedirect';
import { ProductHeader } from '../components/ProductHeader';
import { Footer } from '../components/landing/Footer';
import { ScrollRevealText } from '../components/landing/ScrollRevealText';
import { FLOW_PLANS, type FlowPlan } from '../lib/plans';

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

const LANGS = ['Hindi', 'Hinglish', 'English', '+ 3 more'];

const STATS = [
  { value: '6', label: 'Languages spoken' },
  { value: '~3s', label: 'Speech to prompt' },
  { value: '10 min', label: 'Free, every day' },
  { value: '0', label: 'Keys on your machine' },
];

const BENTO = [
  { title: 'System-wide pill', note: 'Ctrl+Alt+D, anywhere' },
  { title: 'Understand-first', note: 'Reads intent, not words' },
  { title: '@file tagging', note: 'Knows your open files' },
  { title: 'Review-gated', note: 'Confirm before paste' },
];

const FEATURES = [
  {
    id: 'languages',
    eyebrow: 'Languages',
    title: 'Speak the way you actually think.',
    body: 'Hindi, Hinglish, English — mix them mid-sentence. Flow reads intent directly, so “login function ko refactor karo” becomes a clean English instruction.',
    chips: ['Hindi · Hinglish · English', 'Understand-first brain', 'Self-correction aware'],
  },
  {
    id: 'codebase',
    eyebrow: 'Codebase-aware',
    title: 'It tags the files you mean.',
    body: 'Flow sees your open editor files and auto-@tags them — “the auth file” becomes @auth.ts. Misheard symbol names are corrected against your real code, not guessed.',
    chips: ['Deterministic @file tags', 'Open-files hint', 'Symbol correction'],
  },
  {
    id: 'output',
    eyebrow: 'Output',
    title: 'XML, JSON, or HTML — your call.',
    body: 'Pick the wrapper your agent likes best. Flow emits perfectly structured prompts every time — deterministic, never malformed, ready to paste into Cursor, VS Code, or any editor.',
    chips: ['XML · JSON · HTML', 'Deterministic wrap', 'Any editor'],
  },
  {
    id: 'review',
    eyebrow: 'Safety',
    title: 'Review before it touches your editor.',
    body: 'Hindi and Hinglish prompts are review-gated — you see the polished prompt and confirm before it pastes. No surprise text ever lands in your code.',
    chips: ['Mandatory Hindi review', 'Confidence scoring', 'Paste on confirm'],
  },
];

const STEPS = [
  { step: '01', title: 'Speak', body: 'Press Ctrl+Alt+D and talk — Hindi, Hinglish, or English.' },
  { step: '02', title: 'Understand', body: 'The MiMo brain reads your intent, not just the words.' },
  { step: '03', title: 'Polish + tag', body: 'Clean English, @file tags, and your chosen format.' },
  { step: '04', title: 'Review + paste', body: 'Confirm the prompt — it lands in your editor.' },
];

function FadeIn({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-8% 0px' }}
      transition={{ duration: 0.7, ease: EASE, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function ParallaxOrbs() {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -90]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, 70]);
  const y3 = useTransform(scrollYProgress, [0, 1], [20, -40]);

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.span style={{ y: y1 }} className="wb-blob wb-blob--pink absolute -left-28 top-16 h-80 w-80" />
      <motion.span style={{ y: y2 }} className="wb-blob wb-blob--blue absolute -right-20 top-32 h-96 w-96" />
      <motion.span style={{ y: y3 }} className="wb-blob wb-blob--violet absolute left-1/3 top-[55%] h-64 w-64 opacity-60" />
    </div>
  );
}

function FeatureBlock({ feature, index }: { feature: (typeof FEATURES)[number]; index: number }) {
  const centered = index % 2 === 0;
  return (
    <section id={feature.id} className="scroll-mt-28 px-5 py-14 md:py-20">
      <FadeIn
        delay={index * 0.04}
        className={`mx-auto max-w-[680px]${centered ? ' text-center' : ''}`}
      >
        <p className="eyebrow text-secondary">{feature.eyebrow}</p>
        <h2 className="mt-3 text-[1.75rem] font-medium leading-[1.1] tracking-[-0.025em] text-foreground md:text-[2.35rem]">
          {feature.title}
        </h2>
        <p className={`mt-3 max-w-[520px] text-[1rem] leading-7 text-secondary${centered ? ' mx-auto' : ''}`}>
          {feature.body}
        </p>
        <div className={`mt-5 flex flex-wrap gap-2 ${centered ? 'justify-center' : ''}`}>
          {feature.chips.map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/75 px-3 py-1.5 text-[12px] font-medium text-foreground shadow-[0_1px_2px_rgba(11,11,12,0.04)]"
            >
              <Zap className="h-3 w-3 text-accent" />
              {chip}
            </span>
          ))}
        </div>
      </FadeIn>
    </section>
  );
}

// useOptionalAuth returns Clerk auth when sign-in is configured, otherwise safe
// defaults — so this public marketing page never white-screens on a deployment
// without Clerk (the render already has a !clerkEnabled branch below). clerkEnabled
// is a build-time constant, so the hook order is stable across renders.
function useOptionalAuth() {
  if (!clerkEnabled) {
    return { isSignedIn: false, getToken: async (): Promise<string | null> => null };
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useAuth();
}

export function FlowProduct() {
  const [params] = useSearchParams();
  const userCode = (params.get('user_code') || '').trim();
  const { isSignedIn, getToken } = useOptionalAuth();
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClaim(plan: FlowPlan) {
    setClaiming(plan.code);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Sign in again.');
      await claimFlowPass(token, plan.code);
      setClaimed(plan.code);
    } catch (e) {
      if (e instanceof APIError && e.code === 'active_plan_conflict') {
        setClaimed(plan.code);
      } else {
        setError(e instanceof Error ? e.message : 'Claim failed');
      }
    } finally {
      setClaiming(null);
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden">
      <ProductHeader />
      <main className="w-full overflow-x-hidden">
        <section className="relative overflow-hidden px-5 pb-16 pt-32 md:pb-24 md:pt-40">
          <ParallaxOrbs />
          <div className="relative z-10 mx-auto max-w-[900px] text-center">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: EASE }}
              className="mb-6 flex justify-center"
            >
              <span className="wb-pill inline-flex items-center gap-2 rounded-full border border-line bg-white/75 py-1.5 pl-2 pr-3.5 text-[12px] font-medium text-secondary shadow-[0_1px_2px_rgba(11,11,12,0.04)] backdrop-blur-sm">
                <motion.span
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                  className="rounded-full bg-[#0b0b0c] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white"
                >
                  Flow
                </motion.span>
                Voice → coding prompts
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, ease: EASE, delay: 0.06 }}
              className="text-[2.4rem] font-medium leading-[1.08] tracking-[-0.03em] text-foreground md:text-[3.65rem]"
            >
              Talk in Hindi.
              <br className="hidden sm:block" />
              {' '}Ship the <span className="serif-accent">prompt</span>.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.12 }}
              className="mx-auto mt-5 max-w-[560px] text-[1.02rem] leading-[1.6] text-secondary md:text-lg"
            >
              A system-wide voice pill for developers. Talk in Hindi, Hinglish, or English — Flow reads your
              intent, tags your files, and pastes a clean prompt into Cursor, VS Code, or any editor.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: EASE, delay: 0.18 }}
              className="mt-7 flex flex-wrap items-center justify-center gap-2"
            >
              {LANGS.map((lang, i) => (
                <motion.span
                  key={lang}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: EASE, delay: 0.22 + i * 0.06 }}
                  whileHover={{ y: -2, transition: { duration: 0.2 } }}
                  className="wb-pill inline-flex items-center gap-2 rounded-full border border-line bg-white/75 py-1.5 pl-3 pr-3.5 text-[13px] font-medium text-secondary shadow-[0_1px_2px_rgba(11,11,12,0.04)] backdrop-blur-sm"
                >
                  <Languages className="h-3.5 w-3.5 text-accent" />
                  {lang}
                </motion.span>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.55, ease: EASE, delay: 0.42 }}
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-line bg-white/70 px-4 py-2 text-[12px] font-medium text-secondary shadow-[0_1px_2px_rgba(11,11,12,0.04)] backdrop-blur-sm"
            >
              <span className="font-mono text-[11px] tracking-wide text-foreground">Ctrl+Alt+D</span>
              <span className="text-muted">· anywhere on your machine</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: EASE, delay: 0.48 }}
              className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              <a href="#plans" className="btn btn-primary group">
                Get the free pass
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </a>
              <a href="#how" className="btn btn-secondary">
                How it works
              </a>
            </motion.div>
          </div>
        </section>

        <section className="px-5 pb-6">
          <div className="mx-auto grid max-w-[1040px] gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((stat, i) => (
              <FadeIn key={stat.label} delay={i * 0.05}>
                <motion.div
                  whileHover={{ y: -3, transition: { duration: 0.25 } }}
                  className="wb-stat-card rounded-2xl px-5 py-4 text-center"
                >
                  <p className="text-[1.65rem] font-medium tracking-[-0.03em] text-foreground md:text-[2rem]">{stat.value}</p>
                  <p className="mt-1 text-[12px] font-medium uppercase tracking-[0.14em] text-secondary">{stat.label}</p>
                </motion.div>
              </FadeIn>
            ))}
          </div>
        </section>

        <section className="border-t border-line px-5 py-20 md:py-28">
          <div className="mx-auto max-w-[760px] text-center">
            <p className="eyebrow text-secondary">Talk · don&apos;t type</p>
            <ScrollRevealText
              text="From a spoken sentence to an agent-ready prompt — in one keystroke."
              className="mx-auto mt-5 text-[1.9rem] font-medium leading-[1.12] tracking-[-0.025em] text-foreground md:text-[2.85rem]"
            />
            <p className="mx-auto mt-5 max-w-[520px] text-[1rem] leading-7 text-secondary">
              No streaming lag, no half-sentences. You finish speaking, Flow hands you a clean prompt — review it,
              paste it, ship it.
            </p>
          </div>
        </section>

        <section className="px-5 pb-4">
          <div className="mx-auto grid max-w-[1040px] gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {BENTO.map((card, i) => (
              <FadeIn key={card.title} delay={i * 0.04}>
                <motion.div
                  whileHover={{ y: -4, transition: { duration: 0.3 } }}
                  className="wb-bento-card h-full rounded-2xl p-5"
                >
                  <p className="text-[15px] font-medium text-foreground">{card.title}</p>
                  <p className="mt-1.5 text-[13px] leading-6 text-secondary">{card.note}</p>
                </motion.div>
              </FadeIn>
            ))}
          </div>
        </section>

        {FEATURES.map((feature, index) => (
          <FeatureBlock key={feature.id} feature={feature} index={index} />
        ))}

        <section id="how" className="wb-charcoal-band mx-5 scroll-mt-28 rounded-[2rem] px-5 py-20 md:py-28">
          <div className="mx-auto max-w-[920px]">
            <p className="eyebrow text-white/40">How it works</p>
            <ScrollRevealText
              text="Four steps from a spoken thought to a pasted prompt."
              className="mx-auto mt-5 max-w-[680px] text-center text-[1.9rem] font-medium leading-[1.12] tracking-[-0.025em] text-white md:text-[2.65rem]"
            />
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((item, i) => (
                <FadeIn key={item.step} delay={i * 0.06}>
                  <motion.div whileHover={{ y: -3 }} className="glass-dark wb-flow-card h-full rounded-2xl p-5">
                    <span className="font-mono text-sm text-white/35">{item.step}</span>
                    <p className="mt-2 text-lg font-medium text-white">{item.title}</p>
                    <p className="mt-1.5 text-[14px] leading-6 text-white/55">{item.body}</p>
                  </motion.div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        <section id="plans" className="scroll-mt-28 px-5 py-20 md:py-28">
          <div className="mx-auto max-w-[880px] text-center">
            <p className="eyebrow text-secondary">Plans</p>
            <h2 className="mt-3 text-[2rem] font-medium leading-[1.1] tracking-[-0.025em] text-foreground md:text-[2.75rem]">
              Free while we&apos;re in beta.
            </h2>
            <p className="mx-auto mt-4 max-w-[520px] text-[1rem] leading-7 text-secondary">
              Sign in, claim a pass, and it binds to your account. Pro+ is invite-only while we measure production
              accuracy and cost.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-[880px] gap-4 md:grid-cols-2">
            {FLOW_PLANS.map((plan, i) => (
              <FadeIn key={plan.code} delay={i * 0.08}>
                <motion.div whileHover={{ y: -4 }} className="glass-card overflow-hidden rounded-3xl p-8">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0b0b0c] text-white">
                      <Mic className="h-4 w-4" />
                    </span>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                      <p className="text-xs text-secondary">
                        {plan.price} · {plan.durationMin} min window
                      </p>
                    </div>
                  </div>
                  <p className="mt-6 text-left text-sm leading-6 text-secondary">{plan.copy}</p>

                  <ul className="mt-6 space-y-2 text-left text-sm text-secondary">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8">
                    {!clerkEnabled ? (
                      <p className="text-sm text-secondary">Sign-in is not configured on this deployment.</p>
                    ) : !isSignedIn ? (
                      <Link
                        to={signInHref(userCode ? `/flow?user_code=${encodeURIComponent(userCode)}` : '/flow')}
                        className="btn btn-primary inline-flex h-11 w-full items-center justify-center"
                      >
                        Sign in to claim
                      </Link>
                    ) : claimed === plan.code ? (
                      <div className="space-y-3">
                        <p className="flex items-center justify-center gap-2 text-sm text-foreground">
                          <Check className="h-4 w-4 text-accent" /> Flow pass ready on your account.
                        </p>
                        {userCode ? (
                          <Link
                            to={`/flow/activate?user_code=${encodeURIComponent(userCode)}`}
                            className="btn btn-primary inline-flex h-11 w-full items-center justify-center"
                          >
                            Authorize desktop app
                          </Link>
                        ) : (
                          <p className="text-xs text-secondary">Open Delegators Flow on your machine and tap Sign in.</p>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleClaim(plan)}
                        disabled={claiming !== null}
                        className="btn btn-primary inline-flex h-11 w-full items-center justify-center disabled:opacity-50"
                      >
                        {claiming === plan.code ? 'Claiming…' : plan.inviteOnly ? 'Claim invited access' : 'Claim free pass'}
                      </button>
                    )}
                    {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
                  </div>
                </motion.div>
              </FadeIn>
            ))}
          </div>

          <p className="mx-auto mt-10 flex max-w-md items-center justify-center gap-2 text-sm text-secondary">
            <Download className="h-4 w-4" />
            Linux desktop app — build from{' '}
            <code className="rounded bg-black/5 px-1.5 py-0.5 text-xs">delegators-flow-desktop</code>
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}