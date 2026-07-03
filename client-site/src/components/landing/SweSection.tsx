import { Link } from 'react-router-dom';
import { ArrowRight, Play } from 'lucide-react';
import { ScrollRevealText } from './ScrollRevealText';

// Deep-charcoal section under the hero — rounded top so it rises out of the
// off-white. Scroll-animated text explains SWE Sessions; the glass placeholder
// holds the SWE demo video. Connects seamlessly into the ToolStrip.
export function SweSection() {
  return (
    <section className="w-full rounded-[2.5rem] bg-[#0b0b0c] px-5 pb-28 pt-28 text-white md:pb-32 md:pt-36">
      <div className="mx-auto max-w-[820px] text-center">
        <p className="eyebrow text-white/40">SWE Sessions</p>

        <ScrollRevealText
          text="A focused coding window with the model and budget already governed."
          className="mx-auto mt-6 max-w-[720px] text-[2.1rem] font-medium leading-[1.12] tracking-[-0.025em] text-white md:text-[3.25rem]"
        />

        <p className="mx-auto mt-6 max-w-[560px] text-[1.05rem] leading-[1.6] text-white/55 md:text-lg">
          Use it from Cline, Roo Code, Cursor, Trae, Kilo Code, or any OpenAI-compatible client.
          Provider credentials stay behind the gateway, the budget is fixed, and the window expires on time.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/swe" className="btn btn-sm btn-light group">
              Set up SWE sessions
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          <Link to="/pricing" className="btn btn-sm btn-ghost-dark">See launch plans</Link>
        </div>
      </div>

      {/* Glass placeholder for the SWE session demo video */}
      <div className="glass-dark mx-auto mt-14 w-full max-w-[920px] rounded-3xl p-2.5">
        <div className="relative overflow-hidden rounded-[18px] border border-white/10 bg-black/40">
          <div className="flex h-10 items-center gap-2 border-b border-white/10 px-4">
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="ml-3 font-mono text-[11px] tracking-[0.18em] text-white/35">delegators swe session</span>
          </div>
          <div className="relative flex aspect-video items-center justify-center">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.06),transparent_60%)]" />
            <div className="relative flex flex-col items-center gap-4">
              <span className="flex h-15 w-15 items-center justify-center rounded-full bg-white text-[#0b0b0c] shadow-[0_10px_40px_-8px_rgba(0,0,0,0.7)] transition-transform duration-300 hover:scale-105" style={{ height: 60, width: 60 }}>
                <Play className="h-5 w-5 translate-x-0.5 fill-current" />
              </span>
              <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/45">SWE demo</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
