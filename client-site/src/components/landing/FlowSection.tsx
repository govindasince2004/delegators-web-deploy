import { ArrowRight, Mic } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ScrollRevealText } from './ScrollRevealText';

// Languages Flow understands and turns into clean, paste-ready English prompts.
const LANGS = ['Hindi', 'Hinglish', 'English'];

export function FlowSection() {
  return (
    <section id="flow" className="w-full scroll-mt-24 px-5 py-28 md:py-36">
      <div className="mx-auto max-w-[820px] text-center">
        <p className="eyebrow text-secondary">Flow</p>

        <ScrollRevealText
          text="Talk in Hindi. Ship the prompt."
          className="mx-auto mt-6 max-w-[720px] text-[2.1rem] font-medium leading-[1.12] tracking-[-0.025em] text-foreground md:text-[3.25rem]"
        />

        <p className="mx-auto mt-6 max-w-[560px] text-[1.05rem] leading-[1.6] text-secondary md:text-lg">
          A voice pill that sits at the top of your screen. Speak in Hindi, Hinglish, or English —
          Flow turns it into a clean, polished prompt and pastes it straight into your editor.
          The free pass unlocks from the desktop app; no provider keys ever leave the server.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
          {LANGS.map((label) => (
            <span key={label} className="inline-flex items-center gap-2 rounded-full border border-line bg-white/70 py-1.5 pl-3 pr-3.5 text-[13px] font-medium text-secondary shadow-[0_1px_2px_rgba(11,11,12,0.04)] backdrop-blur-sm">
              <Mic className="h-3.5 w-3.5 text-accent" />
              {label}
            </span>
          ))}
        </div>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/flow" className="btn btn-primary group">
            Get Flow
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
          <Link to="/flow#how" className="btn btn-secondary">
            How it works
          </Link>
        </div>
      </div>

      <div className="glass-card mx-auto mt-14 w-full max-w-[920px] rounded-3xl p-2.5">
        <div className="relative overflow-hidden rounded-[18px] border border-line/60 bg-white/80">
          <div className="flex h-9 items-center gap-2 border-b border-line/50 px-4">
            <span className="h-2 w-2 rounded-full bg-black/12" />
            <span className="h-2 w-2 rounded-full bg-black/12" />
            <span className="h-2 w-2 rounded-full bg-black/12" />
            <span className="ml-2 font-mono text-[11px] tracking-[0.16em] text-muted">delegators flow</span>
          </div>
          <div className="relative aspect-[16/10] overflow-hidden bg-[#f6f5f1]">
            <img
              src="/flow/app-dictate.png"
              alt="Delegators Flow dictation pill turning speech into a clean prompt"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover object-top"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
