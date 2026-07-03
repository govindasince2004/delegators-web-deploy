import { Code2, FileSpreadsheet, MonitorPlay, Presentation, ShieldCheck } from 'lucide-react';

const products = [
  {
    title: 'SWE sessions',
    eyebrow: 'API gateway',
    icon: Code2,
    body: 'Short coding sprints with fixed budgets, OpenAI-compatible calls, usage tracking, and no provider key exposure.',
    detail: 'Use dlg-pro by default from your own tools.',
    href: '#pricing',
    cta: 'See plans',
    comingSoon: false,
  },
  {
    title: 'Workbench',
    eyebrow: 'Artifact studio',
    icon: MonitorPlay,
    body: 'Studio files for decks, reports, spreadsheets, profiles, exports, previews, and recovery.',
    detail: 'Built for finished files, not chat transcripts.',
    href: '/workbench#plans',
    cta: 'Explore Workbench',
    comingSoon: false,
  },
  {
    title: 'Office add-in',
    eyebrow: 'Word · Excel · PowerPoint',
    icon: Presentation,
    body: 'One task pane across Office hosts with document capture, artifact generation, and PPTX slide insertion.',
    detail: 'Launching soon after the web studio is stable.',
    href: '',
    cta: '',
    comingSoon: true,
  },
];

export function SuiteSection() {
  return (
    <section id="suite" className="w-full border-t border-line px-4 py-14 md:py-16">
      <div className="mx-auto max-w-[1120px]">
        <div className="mb-10 grid gap-6 md:grid-cols-[0.8fr_1.2fr] md:items-end">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-secondary">The suite</p>
            <h2 className="mt-3 text-3xl font-[400] tracking-tight text-foreground md:text-5xl">
              Two products. One governed session.
            </h2>
          </div>
          <p className="text-base leading-7 text-secondary">
            Coding sessions for your own tools, and a Workbench that builds finished files.
            The Office add-in joins the same wallet soon.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {products.map((product) => {
            const Icon = product.icon;
            return (
              <article
                key={product.title}
                className={`border border-line bg-white p-5 ${product.comingSoon ? 'opacity-80' : ''}`}
              >
                <div className="mb-5 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary">
                    {product.eyebrow}
                  </span>
                  <Icon className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-[400] tracking-tight text-foreground">{product.title}</h3>
                  {product.comingSoon && (
                    <span className="bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                      Coming soon
                    </span>
                  )}
                </div>
                <p className="mt-4 min-h-[96px] text-sm leading-6 text-secondary">{product.body}</p>
                <p className="border-t border-line pt-4 text-xs leading-5 text-foreground">{product.detail}</p>
                {!product.comingSoon && product.href && (
                  <a
                    href={product.href}
                    className="mt-4 inline-flex h-9 items-center border border-line px-3 text-xs font-medium text-foreground transition hover:bg-black/5"
                  >
                    {product.cta} →
                  </a>
                )}
              </article>
            );
          })}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="border border-line bg-[#050505] p-5 text-white md:col-span-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="h-4 w-4 text-indigo-300" />
              Gateway first
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
              Every surface uses the Delegators gateway for auth, plan budgets, prompt harnesses,
              stream locks, usage accounting, and provider isolation.
            </p>
          </div>
          <div className="border border-line bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
              File-native outputs
            </div>
            <p className="mt-3 text-sm leading-6 text-secondary">
              Decks, docs, sheets, and profiles come out as real downloadable files, not chat
              transcripts.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
