import { Github, Terminal } from 'lucide-react';

// Kept as a reusable release rail. The main suite page currently uses the
// dedicated CLI product section instead of advertising unreleased binaries.
export function DownloadSection() {
  return (
    <section id="delegators-cli" className="w-full border-t border-line px-4 py-14 md:py-16">
      <div className="mx-auto grid max-w-[1120px] gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-secondary">Delegators CLI</p>
          <h2 className="mt-3 max-w-3xl text-3xl font-[400] leading-[1.08] tracking-tight text-foreground md:text-5xl">
            A Pi-based terminal agent that loads your Delegators plan after browser login.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-secondary">
            The open-source foundation is in development. Signed release archives and checksums will appear here
            only after the release pipeline is ready.
          </p>
          <p className="mt-5 text-xs text-secondary">
            MIT-licensed Pi foundation. No MiMo-Code source. Product telemetry is disabled.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <span className="inline-flex h-11 items-center gap-2 bg-[#11110f] px-5 text-sm font-medium text-white">
            <Terminal className="h-4 w-4" /> Preview builds soon
          </span>
          <a
            href="https://github.com/earendil-works/pi"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center gap-2 border border-line bg-white px-5 text-sm font-medium text-foreground"
          >
            <Github className="h-4 w-4" /> Upstream foundation
          </a>
        </div>
      </div>
    </section>
  );
}
