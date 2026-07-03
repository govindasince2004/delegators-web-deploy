import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import {
  ArrowRight,
  FileSpreadsheet,
  FileText,
  Layers,
  LayoutTemplate,
  Palette,
  Presentation,
  Search,
  Wand2,
  Zap
} from 'lucide-react';
import { ScrollRevealText } from '../landing/ScrollRevealText';
import { WorkbenchLaunchButton } from '../WorkbenchLaunchButton';
import { MediaFrame } from './MediaFrame';

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

const MEDIA = {
  studio: '/workbench/hero-studio.jpg',
  deck: '/workbench/deck-preview.png',
  report: '/workbench/report-preview.jpg',
  sheet: '/workbench/sheet-preview.jpg'
} as const;

const ARTIFACTS = [
  { icon: Presentation, label: 'PPT decks', file: 'powerpoint.svg' },
  { icon: FileText, label: 'PDF reports', file: 'pdf.svg' },
  { icon: FileSpreadsheet, label: 'XLS sheets', file: 'excel.svg' },
  { icon: FileText, label: 'Profiles', file: 'resume.svg' }
];

const STATS = [
  { value: '1,000+', label: 'Templates' },
  { value: '4', label: 'Export formats' },
  { value: '0', label: 'API keys on your machine', suffix: '' },
  { value: '1', label: 'Pass for SWE + Workbench' }
];

const FEATURES = [
  {
    id: 'studio',
    eyebrow: 'Live studio',
    title: 'Chat on the left. Artifact on the right.',
    body: 'Describe the deliverable, attach references, watch the harness plan and build — connection-ready, revision-friendly, zero API keys on your machine.',
    chips: ['Split-pane studio', 'Plan-gated send', 'Live preview'],
    media: {
      label: 'delegators workbench',
      src: MEDIA.studio,
      alt: 'Workbench studio with composer and live deck preview',
      aspect: 'cinema' as const
    }
  },
  {
    id: 'deck',
    eyebrow: 'Deck output',
    title: 'Fourteen slides. Board-ready on first export.',
    body: 'Slide arcs with metrics, speaker notes, sourced claims, and a cobalt visual system — preview every slide before you download PPTX.',
    chips: ['14-slide narratives', 'Live slide grid', 'PPTX export'],
    media: {
      label: 'workbench · deck preview',
      src: MEDIA.deck,
      alt: 'Northstar Ops deck preview with slide thumbnails',
      aspect: 'tall' as const,
      fit: 'contain' as const
    },
    reverse: true
  },
  {
    id: 'report',
    eyebrow: 'PDF reports',
    title: 'Executive summaries that read like memos.',
    body: 'Six-page operating reviews with KPI scorecards, risk matrices, and decision-ready callouts — cited where it matters, honest where it does not.',
    chips: ['Cited sections', 'Headless PDF', 'Editorial layout'],
    media: {
      label: 'workbench · report preview',
      src: MEDIA.report,
      alt: 'Executive operating review PDF preview',
      aspect: 'video' as const,
      fit: 'contain' as const
    }
  },
  {
    id: 'sheet',
    eyebrow: 'Spreadsheets',
    title: 'Formulas, scenarios, and a board-ready dashboard.',
    body: 'Four-sheet operating models with live INR assumptions, monthly forecast tabs, department budgets, and KPI dashboards — not hard-coded fluff.',
    chips: ['Live formulas', 'Scenario tabs', 'XLSX export'],
    media: {
      label: 'workbench · sheet preview',
      src: MEDIA.sheet,
      alt: 'Twelve-month SaaS operating model spreadsheet preview',
      aspect: 'video' as const,
      fit: 'contain' as const
    },
    reverse: true
  }
];

const FLOW = [
  { step: '01', title: 'Template or blank', body: 'Gallery → filter → preview → load into workspace.' },
  { step: '02', title: 'Describe + attach', body: 'Who it’s for, what to include, PDFs and screenshots as references.' },
  { step: '03', title: 'Plan → generate', body: 'Approve structure, let research run, watch the artifact build.' },
  { step: '04', title: 'Refine → export', body: 'Iterate in chat, swap theme, download the finished file.' }
];

function FadeIn({
  children,
  className = '',
  delay = 0
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
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

function FeatureBlock({
  feature,
  index
}: {
  feature: (typeof FEATURES)[number];
  index: number;
}) {
  const reverse = feature.reverse;
  const media = feature.media;
  return (
    <section id={feature.id} className="scroll-mt-28 px-5 py-16 md:py-24">
      <div className={`mx-auto grid max-w-[1100px] items-center gap-8 lg:gap-12 ${reverse ? 'lg:grid-cols-[1fr_1.08fr]' : 'lg:grid-cols-[1.08fr_1fr]'}`}>
        <FadeIn className={reverse ? 'lg:order-2' : ''} delay={index * 0.04}>
          <p className="eyebrow text-secondary">{feature.eyebrow}</p>
          <h2 className="mt-3 text-[1.75rem] font-medium leading-[1.1] tracking-[-0.025em] text-foreground md:text-[2.35rem]">
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
          />
        </FadeIn>
      </div>
    </section>
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

export function WorkbenchProductContent() {
  return (
    <main className="w-full overflow-x-hidden">
      {/* Hero */}
      <section className="relative overflow-hidden px-5 pb-10 pt-32 md:pb-14 md:pt-40">
        <ParallaxOrbs />
        <div className="relative z-10 mx-auto max-w-[900px] text-center">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: EASE }}
            className="mb-6 flex justify-center"
          >
            <span className="wb-pill inline-flex items-center gap-2 rounded-full border border-line bg-white/75 py-1.5 pl-2 pr-3.5 text-[12px] font-medium text-secondary shadow-[0_1px_2px_rgba(11,11,12,0.04)] backdrop-blur-sm">
              <span className="rounded-full bg-[#0b0b0c] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">Workbench</span>
              Artifacts · not chat logs
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: EASE, delay: 0.06 }}
            className="text-[2.4rem] font-medium leading-[1.04] tracking-[-0.03em] text-foreground md:text-[3.65rem]"
          >
            Build the <span className="serif-accent">file</span> they asked for tonight.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.12 }}
            className="mx-auto mt-5 max-w-[540px] text-[1.02rem] leading-[1.6] text-secondary md:text-lg"
          >
            Decks, PDFs, spreadsheets, profiles — planned, researched, previewed live, exported as real Office files.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: EASE, delay: 0.18 }}
            className="mt-7 flex flex-wrap items-center justify-center gap-2"
          >
            {ARTIFACTS.map(({ label, file }) => (
              <span
                key={label}
                className="wb-pill inline-flex items-center gap-2 rounded-full border border-line bg-white/75 py-1.5 pl-2 pr-3.5 text-[13px] font-medium text-secondary shadow-[0_1px_2px_rgba(11,11,12,0.04)] backdrop-blur-sm"
              >
                <img src={`/office/${file}`} alt="" className="h-4 w-4 object-contain" />
                {label}
              </span>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: EASE, delay: 0.24 }}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <WorkbenchLaunchButton label="Open Workbench" />
            <a href="#demo" className="btn btn-secondary group">
              See it in action
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
            label="delegators workbench"
            src={MEDIA.studio}
            alt="Workbench studio with live Northstar Ops deck generation"
            kind="screenshot"
            aspect="cinema"
            priority
          />
          <motion.div
            initial={{ opacity: 0, x: 24, y: 16 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.55 }}
            className="wb-hero-float hidden md:block"
          >
            <MediaFrame
              label="deck · live preview"
              src={MEDIA.deck}
              alt="Slide preview grid inside Workbench"
              kind="screenshot"
              aspect="tall"
              fit="contain"
            />
          </motion.div>
        </motion.div>
      </section>

      {/* Stats strip */}
      <section className="px-5 pb-6">
        <div className="mx-auto grid max-w-[1040px] gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat, i) => (
            <FadeIn key={stat.label} delay={i * 0.05}>
              <div className="wb-stat-card rounded-2xl px-5 py-4 text-center">
                <p className="text-[1.65rem] font-medium tracking-[-0.03em] text-foreground md:text-[2rem]">{stat.value}</p>
                <p className="mt-1 text-[12px] font-medium uppercase tracking-[0.14em] text-secondary">{stat.label}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Scroll statement */}
      <section className="border-t border-line px-5 py-20 md:py-28">
        <div className="mx-auto max-w-[760px] text-center">
          <p className="eyebrow text-secondary">Human + AI artifacts</p>
          <ScrollRevealText
            text="From template to export in one governed workspace."
            className="mx-auto mt-5 text-[1.9rem] font-medium leading-[1.12] tracking-[-0.025em] text-foreground md:text-[2.85rem]"
          />
          <p className="mx-auto mt-5 max-w-[520px] text-[1rem] leading-7 text-secondary">
            Pick a layout, describe the outcome, download a file your boss can open — not a markdown blob in chat.
          </p>
        </div>
      </section>

      {/* Capability bento */}
      <section className="px-5 pb-4">
        <div className="mx-auto grid max-w-[1040px] gap-3 md:grid-cols-2 lg:grid-cols-12">
          {[
            { icon: LayoutTemplate, title: 'Template gallery', note: 'Microsoft & WPS', span: 'lg:col-span-3' },
            { icon: Wand2, title: 'Agent harness', note: 'Fill, don’t rebuild', span: 'lg:col-span-3' },
            { icon: Search, title: 'Live research', note: 'Cited sources', span: 'lg:col-span-3' },
            { icon: Layers, title: 'Peak artifacts', note: '900+ fingerprints', span: 'lg:col-span-3' }
          ].map((card, i) => (
            <FadeIn key={card.title} delay={i * 0.04} className={card.span}>
              <div className="wb-bento-card group h-full rounded-2xl p-5 transition-transform duration-300 hover:-translate-y-1">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white transition-colors group-hover:border-accent/25 group-hover:bg-accent/5">
                  <card.icon className="h-5 w-5 text-foreground" />
                </span>
                <p className="mt-3 text-[15px] font-medium text-foreground">{card.title}</p>
                <p className="mt-1 text-[13px] text-secondary">{card.note}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {FEATURES.map((feature, index) => (
        <FeatureBlock key={feature.id} feature={feature} index={index} />
      ))}

      {/* Output gallery */}
      <section className="px-5 py-16 md:py-24">
        <div className="mx-auto max-w-[1040px]">
          <FadeIn>
            <p className="eyebrow text-secondary">Real output</p>
            <h2 className="mt-3 max-w-[620px] text-[1.75rem] font-medium leading-[1.1] tracking-[-0.025em] text-foreground md:text-[2.35rem]">
              Deck, PDF, and XLS — captured from live Workbench runs.
            </h2>
          </FadeIn>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <FadeIn delay={0.05}>
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Presentation className="h-4 w-4 text-secondary" />
                  <span className="text-sm font-medium text-foreground">Deck</span>
                </div>
                <MediaFrame
                  label="pptx · preview"
                  src={MEDIA.deck}
                  alt="Deck slide preview"
                  kind="screenshot"
                  aspect="tall"
                  fit="contain"
                />
              </div>
            </FadeIn>
            <FadeIn delay={0.08}>
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-secondary" />
                  <span className="text-sm font-medium text-foreground">Report</span>
                </div>
                <MediaFrame
                  label="pdf · preview"
                  src={MEDIA.report}
                  alt="PDF report preview"
                  kind="screenshot"
                  aspect="tall"
                  fit="contain"
                />
              </div>
            </FadeIn>
            <FadeIn delay={0.11}>
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-secondary" />
                  <span className="text-sm font-medium text-foreground">Sheet</span>
                </div>
                <MediaFrame
                  label="xlsx · preview"
                  src={MEDIA.sheet}
                  alt="Spreadsheet model preview"
                  kind="screenshot"
                  aspect="tall"
                  fit="contain"
                />
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="wb-charcoal-band mx-5 rounded-[2rem] px-5 py-20 md:py-28">
        <div className="mx-auto max-w-[920px]">
          <p className="eyebrow text-white/40">How it works</p>
          <ScrollRevealText
            text="Four steps from idea to downloadable file."
            className="mx-auto mt-5 max-w-[680px] text-center text-[1.9rem] font-medium leading-[1.12] tracking-[-0.025em] text-white md:text-[2.65rem]"
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {FLOW.map((item, i) => (
              <FadeIn key={item.step} delay={i * 0.06}>
                <div className="glass-dark wb-flow-card rounded-2xl p-5">
                  <span className="font-mono text-sm text-white/35">{item.step}</span>
                  <p className="mt-2 text-lg font-medium text-white">{item.title}</p>
                  <p className="mt-1.5 text-[14px] leading-6 text-white/55">{item.body}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden px-5 py-20 md:py-28">
        <span className="wb-blob wb-blob--pink absolute -bottom-24 left-1/4 h-72 w-72 opacity-35" aria-hidden="true" />
        <span className="wb-blob wb-blob--blue absolute -right-12 top-8 h-64 w-64 opacity-30" aria-hidden="true" />
        <FadeIn className="relative z-10 mx-auto max-w-[680px] text-center">
          <Palette className="mx-auto h-8 w-8 text-accent" />
          <h2 className="mt-4 text-[1.9rem] font-medium tracking-[-0.025em] text-foreground md:text-[2.65rem]">
            Ready to ship the <span className="serif-accent">deck</span>?
          </h2>
          <p className="mx-auto mt-4 max-w-[480px] text-[1rem] leading-7 text-secondary">
            One Delegators pass unlocks SWE clients and Workbench. Grab a plan, sign in once, open the studio.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <WorkbenchLaunchButton label="Open Workbench" />
            <Link to="/pricing" className="btn btn-secondary group">
              View pricing
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </FadeIn>
      </section>
    </main>
  );
}
