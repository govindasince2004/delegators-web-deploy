import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ScrollRevealText } from './ScrollRevealText';
import { WorkbenchLaunchButton } from '../WorkbenchLaunchButton';

// Real brand SVGs (in /public/office) — PowerPoint, Word, Excel, PDF, Resume.
const ARTIFACTS = [
  { file: 'powerpoint.svg', label: 'Decks' },
  { file: 'word.svg', label: 'Docs' },
  { file: 'excel.svg', label: 'Sheets' },
  { file: 'pdf.svg', label: 'PDF' },
  { file: 'resume.svg', label: 'Profiles' },
];

export function WorkbenchShowSection() {
  return (
    <section id="workbench" className="w-full scroll-mt-24 px-5 py-28 md:py-36">
      <div className="mx-auto max-w-[820px] text-center">
        <p className="eyebrow text-secondary">Workbench</p>

        <ScrollRevealText
          text="Create production-grade, professional artifacts."
          className="mx-auto mt-6 max-w-[720px] text-[2.1rem] font-medium leading-[1.12] tracking-[-0.025em] text-foreground md:text-[3.25rem]"
        />

        <p className="mx-auto mt-6 max-w-[560px] text-[1.05rem] leading-[1.6] text-secondary md:text-lg">
          Decks, proposals, reports, spreadsheets, and client-ready PDFs for working teams.
          Describe the finished file and Workbench plans, researches, creates, validates, and exports it.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
          {ARTIFACTS.map(({ file, label }) => (
            <span key={label} className="inline-flex items-center gap-2 rounded-full border border-line bg-white/70 py-1.5 pl-2 pr-3.5 text-[13px] font-medium text-secondary shadow-[0_1px_2px_rgba(11,11,12,0.04)] backdrop-blur-sm">
              <img src={`/office/${file}`} alt="" className="h-4 w-4 object-contain" />
              {label}
            </span>
          ))}
        </div>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <WorkbenchLaunchButton />
          <Link to="/workbench" className="btn btn-secondary group">
            Learn more
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      <div className="glass-card mx-auto mt-14 w-full max-w-[920px] rounded-3xl p-2.5">
        <div className="relative overflow-hidden rounded-[18px] border border-line/60 bg-white/80">
          <div className="flex h-9 items-center gap-2 border-b border-line/50 px-4">
            <span className="h-2 w-2 rounded-full bg-black/12" />
            <span className="h-2 w-2 rounded-full bg-black/12" />
            <span className="h-2 w-2 rounded-full bg-black/12" />
            <span className="ml-2 font-mono text-[11px] tracking-[0.16em] text-muted">delegators workbench</span>
          </div>
          <div className="relative aspect-[16/10] overflow-hidden bg-[#f6f5f1]">
            <img
              src="/workbench/hero-studio.jpg"
              alt="Workbench studio with live deck preview"
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
