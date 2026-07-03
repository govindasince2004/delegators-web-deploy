import { ArrowRight, Cloud, Code2, FileSpreadsheet, PanelRight, Terminal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

// Minimal per-product explanation. One aligned grid, no black blocks, no fake
// mockups. Copy is the existing product one-liners.

type Product = {
  icon: typeof Code2;
  name: string;
  line: string;
  to?: string;
  soon?: boolean;
};

const PRODUCTS: Product[] = [
  { icon: Code2, name: 'SWE Sessions', line: 'A focused coding window with the model and budget already governed.', to: '/swe' },
  { icon: PanelRight, name: 'Workbench', line: 'A file-building workspace, not another chat transcript.', to: '/workbench' },
  { icon: Cloud, name: 'Cloud Agents', line: 'Async agent with proof video — private beta, not public launch.', to: '/cloud-agents', soon: true },
  { icon: Terminal, name: 'CLI', line: 'Terminal agent — coming after the CLI repo is release-clean.', to: '/cli', soon: true },
  { icon: FileSpreadsheet, name: 'Office Suite', line: 'The Workbench engine inside Word, Excel, and PowerPoint.', soon: true },
];

export function ProductShowcase() {
  return (
    <section id="office" className="w-full px-4 py-24 md:py-32">
      <div className="mx-auto max-w-[1080px]">
        <div className="mx-auto max-w-[640px] text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2f5eff]">The suite</p>
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            One account. The whole suite.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-secondary">
            Two launch doors, one governed account. The rest stays clearly marked until it is ready.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {PRODUCTS.map(({ icon: Icon, name, line, to, soon }, i) => {
            const inner = (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.5, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                className="glass-card group flex h-full flex-col rounded-3xl p-7 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2f5eff]/10 text-[#2f5eff]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">{name}</h3>
                  {soon && (
                    <span className="ml-auto rounded-full bg-black/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-secondary">
                      Soon
                    </span>
                  )}
                </div>
                <p className="mt-4 text-[15px] leading-relaxed text-secondary">{line}</p>
                {to ? (
                  <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#2f5eff]">
                    Learn more
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                  </span>
                ) : (
                  <span className="mt-6 text-sm font-medium text-muted">Private preview later</span>
                )}
              </motion.div>
            );
            return to ? (
              <Link key={name} to={to} className="block h-full">{inner}</Link>
            ) : (
              <div key={name} className="h-full">{inner}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
