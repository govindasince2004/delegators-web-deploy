import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { PixelGrid } from './PixelGrid';

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];
const container = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.09, delayChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.75, ease: EASE } } };

export function Hero() {
  return (
    <section className="relative w-full overflow-hidden px-5 pb-24 pt-32 md:pb-28 md:pt-40">
      {/* Living pixel grid — illuminates under the cursor */}
      <PixelGrid className="pointer-events-none absolute inset-0 z-0" />

      <motion.div variants={container} initial="hidden" animate="visible" className="relative z-10 mx-auto max-w-[840px] text-center">
        {/* Brand mark, between the notch and the capsule */}
        <motion.img variants={item} src="/delegators-mark-black.png" alt="Delegators" className="mx-auto mb-6 h-8 w-auto object-contain md:h-9" />

        <motion.div variants={item} className="mb-7 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white/70 py-1.5 pl-2 pr-3.5 text-[12px] font-medium text-secondary shadow-[0_1px_2px_rgba(11,11,12,0.04)] backdrop-blur-sm">
            <span className="rounded-full bg-[#0b0b0c] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">New</span>
            One pass — SWE &amp; Workbench
          </span>
        </motion.div>

        <motion.h1 variants={item} className="text-[2.7rem] leading-[1.04] tracking-[-0.03em] text-foreground md:text-[3.9rem]">
          Hit the limit?<br />
          We&rsquo;ve got <span className="serif-accent">you</span>.
        </motion.h1>

        <motion.p variants={item} className="mx-auto mt-6 max-w-[600px] text-[1.05rem] leading-[1.6] text-secondary md:text-lg">
          Maxed out your coding agent mid-task? Run a short, SWE-optimized session right inside the
          tools you already use. Need a report or deck for your boss, teacher, or client by tonight?
          Build it in the Workbench. <span className="text-foreground">One pass powers both.</span>
        </motion.p>

        <motion.div variants={item} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/swe" className="btn btn-primary group">
            Start with SWE sessions
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
          <Link to="/pricing" className="btn btn-secondary">View pricing</Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
