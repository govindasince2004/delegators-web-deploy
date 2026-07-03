import { motion } from 'framer-motion';
import { Code2, PanelRight, Clock } from 'lucide-react';
import { ProductHeader } from '../components/ProductHeader';
import { Footer } from '../components/landing/Footer';
import { PassCards, PASS_TAGLINE } from '../components/landing/PassCards';
import { AccountSection } from '../components/AccountSection';

// Standalone /pricing page. The launch `dlg_*` passes are rendered with the same
// cream editorial cards as the landing PricingSection so the visual identity is
// preserved. Reachable from the navbar.
export function Pricing() {
  return (
    <div className="flex w-full flex-col items-center bg-[#f7f6f2]">
      <ProductHeader />

      <main className="w-full">
        <section className="w-full px-4 pb-6 pt-32 md:pt-36">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-[1180px] text-center"
          >
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#2f5eff]">Pricing</p>
            <h1 className="mt-4 font-display text-5xl font-semibold tracking-tight text-foreground md:text-7xl">
              One pass. Use it anywhere.
            </h1>
            <p className="mt-5 mx-auto max-w-[640px] text-lg leading-relaxed text-secondary">
              {PASS_TAGLINE} Buy once and get a single 250-minute session with a fixed budget that
              you can spend across both surfaces. It is not a credit wallet — it is a time-boxed pass.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-secondary">
              <span className="inline-flex items-center gap-2"><Clock className="h-4 w-4 text-[#2F5EFF]" /> 250-minute window</span>
              <span className="inline-flex items-center gap-2"><Code2 className="h-4 w-4 text-[#2F5EFF]" /> Use in SWE clients</span>
              <span className="inline-flex items-center gap-2"><PanelRight className="h-4 w-4 text-[#2F5EFF]" /> Use in the Workbench</span>
            </div>
          </motion.div>
        </section>

        <div className="mx-auto w-full max-w-[1180px]">
          <AccountSection />
        </div>

        <section className="w-full px-4 pb-20 pt-10 md:pb-28">
          <div className="mx-auto max-w-[1180px]">
            <PassCards />
            <p className="mt-10 text-center text-sm text-secondary">
              Every pass includes image analysis and works in Cline, Roo Code, Cursor, Trae,
              Kilo Code, OpenAI-compatible clients, and the Delegators Workbench. When the budget
              or window is spent, buy another pass.
            </p>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
