import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Cloud,
  GitBranch,
  Layers,
  Monitor,
  Shield,
  Smartphone,
  Terminal,
  Video,
  Zap,
} from 'lucide-react';
import { MediaFrame } from '../workbench/MediaFrame';

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

const MEDIA = {
  hero: '/cloud/hero-3pane.png',
  mobile: '/cloud/mobile-thread.png',
  proof: '/cloud/proof-thread.png',
  finished: '/cloud/finished-notification.png',
  vm: '/cloud/vm-sandbox.png',
  automation: '/cloud/automation-flow.png',
  integrations: '/cloud/integrations-grid.png',
} as const;

const CAPABILITY_PILLS = ['Proof video', 'Live computer', 'Git + PR', 'Multi-turn'];

const STATS = [
  { value: '3', label: 'Panes on desktop' },
  { value: 'Real', label: 'Proof video, not logs' },
  { value: '1', label: 'dlg account everywhere' },
  { value: 'β', label: 'Beta — honest badges' },
];

const BENTO = [
  { icon: Layers, title: 'Runs sidebar', note: 'New run · history · surfaces' },
  { icon: Monitor, title: 'Live thread', note: 'SSE events · summary · composer' },
  { icon: Video, title: 'Proof pipeline', note: 'Screenshot + WebM in-thread' },
  { icon: Shield, title: 'Plan-gated models', note: 'Same pass as SWE + Workbench' },
];

const FEATURES = [
  {
    id: 'studio',
    eyebrow: 'Three-pane studio',
    title: 'Chat on the left. Computer on the right.',
    body: 'Runs, thread, and live workspace — collapse any pane. Desktop matches Cursor Agents; mobile collapses to thread-first.',
    chips: ['Runs sidebar', 'Collapsible panes', 'Model picker'],
    media: {
      label: 'dlg cloud · desktop',
      src: MEDIA.hero,
      alt: 'Three-pane cloud agent shell with runs sidebar, thread, and live computer',
      aspect: 'cinema' as const,
      variant: 'dark' as const,
    },
  },
  {
    id: 'proof',
    eyebrow: 'Proof you can trust',
    title: 'Build it. Run it. Record it.',
    body: 'The agent builds, starts the preview, captures screenshot and screencast. The finished card shows +added -removed and file count — review before you merge.',
    chips: ['artifact:// refs', 'Range-capable video', 'Review gate'],
    media: {
      label: 'dlg cloud · proof thread',
      src: MEDIA.proof,
      alt: 'Cloud agent thread with proof video and diff summary',
      aspect: 'tall' as const,
      fit: 'contain' as const,
      variant: 'dark' as const,
    },
    reverse: true,
  },
  {
    id: 'computer',
    eyebrow: 'Live computer',
    title: 'Git. Desktop. Terminal. Files.',
    body: 'Watch edits, terminal output, and artifacts stream in. Native Ubuntu/Windows environments and take-control are coming soon — honestly badged, never faked.',
    chips: ['Git diff', 'Terminal stream', 'Coming soon: take control'],
    media: {
      label: 'dlg cloud · isolated vm',
      src: MEDIA.vm,
      alt: 'Isolated VM sandbox with repos, browser, terminal, and secrets',
      aspect: 'video' as const,
      fit: 'contain' as const,
      variant: 'dark' as const,
    },
  },
  {
    id: 'mobile',
    eyebrow: 'Mobile-first thread',
    title: 'Check progress from your phone.',
    body: 'Single-pane thread with collapsible chrome. Finished notifications with diff stats — the same card you would tap Review on from iOS.',
    chips: ['Responsive shell', 'Push-ready', 'Follow-up composer'],
    media: {
      label: 'dlg cloud · mobile',
      src: MEDIA.mobile,
      alt: 'Mobile cloud agent thread with collapsible sidebar',
      aspect: 'tall' as const,
      fit: 'contain' as const,
      variant: 'dark' as const,
    },
    reverse: true,
  },
];

const FLOW = [
  { step: '01', title: 'Sign in', body: 'Same Delegators account as SWE and Workbench.' },
  { step: '02', title: 'Delegate', body: 'Describe the build; the agent gets an isolated workspace.' },
  { step: '03', title: 'Watch live', body: 'Thread and computer panes stream every SSE event.' },
  { step: '04', title: 'Review proof', body: 'Video, diff, summary — then follow up or open a PR.' },
];

function ComingSoonPill() {
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-white/70 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-secondary">
      Coming soon
    </span>
  );
}

function FadeIn({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return <div className={className}>{children}</div>;
}

function FeatureBlock({
  feature,
  index,
}: {
  feature: (typeof FEATURES)[number];
  index: number;
}) {
  const reverse = feature.reverse;
  const media = feature.media;
  return (
    <section id={feature.id} className="scroll-mt-28 px-5 py-16 md:py-24">
      <div
        className={`mx-auto grid max-w-[1100px] items-center gap-8 lg:gap-12 ${reverse ? 'lg:grid-cols-[1fr_1.08fr]' : 'lg:grid-cols-[1.08fr_1fr]'}`}
      >
        <FadeIn className={reverse ? 'lg:order-2' : ''} delay={index * 0.04}>
          <p className="eyebrow text-secondary">{feature.eyebrow}</p>
          <h2 className="mt-3 text-[1.75rem] font-medium leading-[1.1] text-foreground md:text-[2.35rem]">
            {feature.title}
          </h2>
          <p className="mt-3 max-w-[480px] text-[1rem] leading-7 text-secondary">{feature.body}</p>
          <div className="mt-5 flex flex-wrap gap-2">
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
        <FadeIn className={reverse ? 'lg:order-1' : ''} delay={0.08 + index * 0.04}>
          <MediaFrame
            label={media.label}
            src={media.src}
            alt={media.alt}
            kind="screenshot"
            aspect={media.aspect}
            fit={media.fit}
            variant={media.variant}
          />
        </FadeIn>
      </div>
    </section>
  );
}

export function CloudAgentsProductContent() {
  return (
    <main className="w-full overflow-x-hidden">
      {/* Hero */}
      <section className="relative overflow-hidden px-5 pb-10 pt-32 md:pb-14 md:pt-40">
        <div className="cloud-product-grid pointer-events-none absolute inset-0" aria-hidden="true" />
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
                Cloud
              </motion.span>
              Coming soon · async agent
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: EASE, delay: 0.06 }}
            className="text-[2.4rem] font-medium leading-[1.04] text-foreground md:text-[3.65rem]"
          >
            Delegate the <span className="serif-accent">build</span>.
            <br className="hidden sm:block" />
            {' '}Watch the proof land.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.12 }}
            className="mx-auto mt-5 max-w-[560px] text-[1.02rem] leading-[1.6] text-secondary md:text-lg"
          >
            dlg Cloud is not part of the public launch yet. The shell, sandbox, and proof path stay in
            private beta while we finish the control-plane and release checks.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: EASE, delay: 0.18 }}
            className="mt-7 flex flex-wrap items-center justify-center gap-2"
          >
            {CAPABILITY_PILLS.map((pill, i) => (
              <motion.span
                key={pill}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE, delay: 0.22 + i * 0.06 }}
                whileHover={{ y: -2, transition: { duration: 0.2 } }}
                className="wb-pill inline-flex items-center gap-2 rounded-full border border-line bg-white/75 py-1.5 pl-3 pr-3.5 text-[13px] font-medium text-secondary shadow-[0_1px_2px_rgba(11,11,12,0.04)] backdrop-blur-sm"
              >
                <Cloud className="h-3.5 w-3.5 text-accent" />
                {pill}
              </motion.span>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: EASE, delay: 0.24 }}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link to="/pricing" className="btn btn-primary group">
              Use SWE + Workbench now
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
            <a href="#demo" className="btn btn-secondary group">
              See preview
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </a>
          </motion.div>
        </div>

        <motion.div
          id="demo"
          initial={{ opacity: 0, y: 32, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.32 }}
          className="wb-hero-stack relative z-10 mx-auto mt-12 w-full max-w-[1120px] scroll-mt-28"
        >
          <MediaFrame
            label="dlg cloud · three-pane studio"
            src={MEDIA.hero}
            alt="Cloud agent desktop shell with runs sidebar, thread, and live computer"
            kind="screenshot"
            aspect="cinema"
            variant="dark"
            priority
          />
          <motion.div
            initial={{ opacity: 0, x: 24, y: 16 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.55 }}
            className="wb-hero-float hidden md:block"
          >
            <MediaFrame
              label="dlg cloud · mobile thread"
              src={MEDIA.mobile}
              alt="Mobile cloud agent thread view"
              kind="screenshot"
              aspect="tall"
              fit="contain"
              variant="dark"
            />
          </motion.div>
        </motion.div>
      </section>

      {/* Stats */}
      <section className="px-5 pb-6">
        <div className="mx-auto grid max-w-[1040px] gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat, i) => (
            <FadeIn key={stat.label} delay={i * 0.05}>
              <motion.div whileHover={{ y: -3, transition: { duration: 0.25 } }} className="wb-stat-card rounded-2xl px-5 py-4 text-center">
                <p className="text-[1.65rem] font-medium text-foreground md:text-[2rem]">{stat.value}</p>
                <p className="mt-1 text-[12px] font-medium uppercase tracking-[0.14em] text-secondary">{stat.label}</p>
              </motion.div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Scroll statement */}
      <section className="border-t border-line px-5 py-20 md:py-28">
        <div className="mx-auto max-w-[760px] text-center">
          <p className="eyebrow text-secondary">Delegate · don&apos;t babysit</p>
          <p className="mx-auto mt-5 text-[1.9rem] font-medium leading-[1.12] text-foreground md:text-[2.85rem]">
            From one prompt to a proof video you can actually review.
          </p>
          <p className="mx-auto mt-5 max-w-[520px] text-[1rem] leading-7 text-secondary">
            No fake terminals. No placeholder recordings. Stream events live, review the diff, ship when it&apos;s right.
          </p>
        </div>
      </section>

      {/* Bento */}
      <section className="px-5 pb-4">
        <div className="mx-auto grid max-w-[1040px] gap-3 md:grid-cols-2 lg:grid-cols-12">
          {BENTO.map((card, i) => (
            <FadeIn key={card.title} delay={i * 0.04} className="lg:col-span-3">
              <motion.div
                whileHover={{ y: -4, transition: { duration: 0.3 } }}
                className="wb-bento-card group h-full rounded-2xl p-5"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white transition-colors group-hover:border-accent/25 group-hover:bg-accent/5">
                  <card.icon className="h-5 w-5 text-foreground" />
                </span>
                <p className="mt-3 text-[15px] font-medium text-foreground">{card.title}</p>
                <p className="mt-1 text-[13px] text-secondary">{card.note}</p>
              </motion.div>
            </FadeIn>
          ))}
        </div>
      </section>

      {FEATURES.map((feature, index) => (
        <FeatureBlock key={feature.id} feature={feature} index={index} />
      ))}

      {/* Finished notification */}
      <section className="px-5 py-16 md:py-20">
        <div className="mx-auto grid max-w-[1040px] items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <FadeIn>
            <p className="eyebrow text-secondary">Finished state</p>
            <h2 className="mt-3 text-[1.75rem] font-medium leading-[1.1] text-foreground md:text-[2.35rem]">
              Tap Review when the run is done.
            </h2>
            <p className="mt-3 max-w-[440px] text-[1rem] leading-7 text-secondary">
              The finished card shows diff stats and file count — green for additions, red for removals. Same pattern on
              mobile and desktop.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {['+added -removed', 'File count', 'Review CTA'].map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/75 px-3 py-1.5 text-[12px] font-medium text-foreground"
                >
                  <Smartphone className="h-3 w-3 text-accent" />
                  {chip}
                </span>
              ))}
            </div>
          </FadeIn>
          <FadeIn delay={0.08}>
            <MediaFrame
              label="dlg cloud · finished"
              src={MEDIA.finished}
              alt="Finished notification with diff stats and review button"
              kind="screenshot"
              aspect="tall"
              fit="contain"
            />
          </FadeIn>
        </div>
      </section>

      {/* Automations teaser */}
      <section id="automations" className="scroll-mt-28 px-5 py-16 md:py-20">
        <div className="mx-auto max-w-[920px]">
          <FadeIn className="text-center">
            <div className="flex items-center justify-center gap-2">
              <p className="eyebrow text-secondary">Automations</p>
              <ComingSoonPill />
            </div>
            <h2 className="mx-auto mt-3 max-w-[620px] text-[1.75rem] font-medium leading-[1.1] text-foreground md:text-[2.35rem]">
              Trigger from Slack. Ship a PR.
            </h2>
            <p className="mx-auto mt-3 max-w-[520px] text-[1rem] leading-7 text-secondary">
              Automation trigger → action → result. The intake runner connects post-launch — UI is ready, backend is not
              faked.
            </p>
          </FadeIn>
          <FadeIn delay={0.08} className="mt-10">
            <MediaFrame
              label="dlg cloud · automation flow"
              src={MEDIA.automation}
              alt="Automation flow from Slack trigger to GitHub PR"
              kind="screenshot"
              aspect="video"
              fit="contain"
            />
          </FadeIn>
        </div>
      </section>

      {/* Integrations */}
      <section id="connectors" className="scroll-mt-28 px-5 py-16 md:py-20">
        <div className="mx-auto max-w-[1040px]">
          <FadeIn className="text-center">
            <div className="flex items-center justify-center gap-2">
              <p className="eyebrow text-secondary">Connectors</p>
              <ComingSoonPill />
            </div>
            <h2 className="mx-auto mt-3 max-w-[620px] text-[1.75rem] font-medium leading-[1.1] text-foreground md:text-[2.35rem]">
              Works where your team works.
            </h2>
            <p className="mx-auto mt-3 max-w-[520px] text-[1rem] leading-7 text-secondary">
              Slack, GitHub, Linear, and more — tag @dlg post-launch. OAuth and webhook intake ship after beta.
            </p>
          </FadeIn>
          <FadeIn delay={0.08} className="mt-10">
            <MediaFrame
              label="dlg cloud · integrations"
              src={MEDIA.integrations}
              alt="Integrations grid for Slack, GitHub, Linear, and developer tools"
              kind="screenshot"
              aspect="wide"
              fit="contain"
              variant="dark"
            />
          </FadeIn>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="wb-charcoal-band mx-5 scroll-mt-28 rounded-[2rem] px-5 py-20 md:py-28">
        <div className="mx-auto max-w-[920px]">
          <p className="eyebrow text-white/40">How it works</p>
          <p className="mx-auto mt-5 max-w-[680px] text-center text-[1.9rem] font-medium leading-[1.12] text-white md:text-[2.65rem]">
            Four steps from delegation to proof you can review.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {FLOW.map((item, i) => (
              <FadeIn key={item.step} delay={i * 0.06}>
                <motion.div whileHover={{ y: -3 }} className="glass-dark wb-flow-card h-full rounded-2xl p-5">
                  <span className="font-mono text-sm text-white/35">{item.step}</span>
                  <p className="mt-2 text-lg font-medium text-white">{item.title}</p>
                  <p className="mt-1.5 text-[14px] leading-6 text-white/55">{item.body}</p>
                </motion.div>
              </FadeIn>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-[12px] text-white/55">
              <GitBranch className="h-3.5 w-3.5" />
              Git + PR proof
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-[12px] text-white/55">
              <Terminal className="h-3.5 w-3.5" />
              Live terminal stream
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-[12px] text-white/55">
              <Video className="h-3.5 w-3.5" />
              Screenshot + WebM proof
            </span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden px-5 py-20 md:py-28">
        <div className="cloud-product-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
        <FadeIn className="relative z-10 mx-auto max-w-[680px] text-center">
          <Cloud className="mx-auto h-8 w-8 text-accent" />
          <h2 className="mt-4 text-[1.9rem] font-medium text-foreground md:text-[2.65rem]">
            Cloud stays in <span className="serif-accent">private beta</span>.
          </h2>
          <p className="mx-auto mt-4 max-w-[480px] text-[1rem] leading-7 text-secondary">
            Public launch is SWE sessions plus Workbench. Cloud opens after the build, sandbox, and proof-video
            path are clean on the deploy host.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/pricing" className="btn btn-secondary group">
              View launch pricing
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </FadeIn>
      </section>
    </main>
  );
}
