import { motion } from 'framer-motion';
import { PassCards, PASS_TAGLINE } from './PassCards';

// The landing pricing section sells the launch `dlg_*` passes. One pass works on
// BOTH SWE clients and the Workbench from a single session. The card grid is
// shared with the standalone /pricing page.
export function PricingSection() {
  return (
    <section id="pricing" className="w-full border-t border-line px-4 py-20 md:py-32">
      <div className="mx-auto max-w-[1180px]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="mb-14 text-center"
        >
          <p className="eyebrow mb-4 text-secondary">Pricing</p>
          <h2 className="text-[2.1rem] font-medium tracking-[-0.025em] text-foreground md:text-[3.25rem]">
            One pass. Use it <span className="serif-accent">anywhere</span>.
          </h2>
          <p className="mt-5 mx-auto max-w-[620px] text-lg leading-relaxed text-secondary">
            {PASS_TAGLINE} Buy once, get a 250-minute session with a fixed budget, and
            spend it across both surfaces. Not credits — a time-boxed pass.
          </p>
        </motion.div>

        <PassCards />
      </div>
    </section>
  );
}
