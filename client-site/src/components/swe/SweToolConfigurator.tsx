import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronDown, Code2, Copy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SWE_TOOL_GUIDES, type ToolGuide } from '../../lib/sweToolGuides';

function GuideCodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(() => {
    void navigator.clipboard?.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }, [code]);

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-line bg-[#0b0b0c] text-white">
      <div className="flex h-8 items-center justify-between border-b border-white/10 px-3">
        <span className="font-mono text-[10px] tracking-[0.12em] text-white/40">{label || 'config'}</span>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-white/55 hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[11.5px] leading-6 text-white/88">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function ToolAccordionItem({
  guide,
  open,
  onToggle,
}: {
  guide: ToolGuide;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white/70">
      <button
        type="button"
        id={`tool-trigger-${guide.id}`}
        aria-expanded={open}
        aria-controls={`tool-panel-${guide.id}`}
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-black/[0.02]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white">
          {guide.logo ? (
            <img
              src={`/tools/${guide.logo}`}
              alt=""
              className={`h-5 w-5 object-contain ${guide.invertLogo ? 'brightness-0' : ''}`}
            />
          ) : (
            <Code2 className="h-5 w-5 text-foreground" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium text-foreground">{guide.name}</span>
          <span className="mt-0.5 block text-[13px] leading-5 text-secondary">{guide.teaser}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <div
          id={`tool-panel-${guide.id}`}
          role="region"
          aria-labelledby={`tool-trigger-${guide.id}`}
          className="border-t border-line px-5 pb-5 pt-4"
        >
          {guide.warning ? (
            <p className="mb-4 rounded-xl border border-orange-200/80 bg-orange-50/90 px-3 py-2.5 text-[12.5px] leading-6 text-orange-950">
              {guide.warning}
            </p>
          ) : null}

          <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted">Where to configure</p>
          <p className="mt-1 font-mono text-[12.5px] leading-6 text-foreground">{guide.settingsPath}</p>

          <div className="mt-5 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[520px] text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-line bg-black/[0.03]">
                  <th className="px-3 py-2 font-medium text-foreground">Setting</th>
                  <th className="px-3 py-2 font-medium text-foreground">Value</th>
                  <th className="px-3 py-2 font-medium text-muted">Where</th>
                </tr>
              </thead>
              <tbody>
                {guide.configRows.map((row) => (
                  <tr key={row.setting} className="border-b border-line/80 last:border-0">
                    <td className="px-3 py-2.5 font-mono text-[12px] text-foreground">{row.setting}</td>
                    <td className="px-3 py-2.5 break-all font-mono text-[11.5px] text-secondary">{row.value}</td>
                    <td className="px-3 py-2.5 text-secondary">{row.where}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ol className="mt-5 space-y-3">
            {guide.steps.map((step, i) => (
              <li key={step.title} className="flex gap-3 text-[13px] leading-6">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line bg-white font-mono text-[10px] text-foreground">
                  {i + 1}
                </span>
                <span>
                  <span className="font-medium text-foreground">{step.title}. </span>
                  <span className="text-secondary">{step.detail}</span>
                </span>
              </li>
            ))}
          </ol>

          {guide.code ? <GuideCodeBlock code={guide.code.content} label={guide.code.label} /> : null}

          {guide.verify ? (
            <p className="mt-4 text-[12.5px] leading-6 text-muted">
              <span className="font-medium text-foreground">Verify: </span>
              {guide.verify}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function SweToolConfigurator() {
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash.startsWith('tool-')) {
        const id = hash.slice('tool-'.length);
        if (SWE_TOOL_GUIDES.some((g) => g.id === id)) setOpenId(id);
      }
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  const toggle = (id: string) => {
    const next = openId === id ? null : id;
    setOpenId(next);
    if (next) window.history.replaceState(null, '', `#tool-${next}`);
    else window.history.replaceState(null, '', '#config');
  };

  return (
    <div className="mt-14">
      <h3 className="text-xl font-medium tracking-tight text-foreground">Set it up in your client</h3>
      <p className="mt-2 max-w-[640px] text-[14px] leading-7 text-secondary">
        Click a tool — each panel lists the exact settings screen, field names, and values to paste from checkout.
      </p>

      <div className="mt-6 space-y-3">
        {SWE_TOOL_GUIDES.map((guide) => (
          <ToolAccordionItem
            key={guide.id}
            guide={guide}
            open={openId === guide.id}
            onToggle={() => toggle(guide.id)}
          />
        ))}
      </div>

      <p className="mt-6 text-sm text-muted">
        API reference:{' '}
        <Link to="/docs" className="font-medium text-foreground underline">
          /docs
        </Link>
        .
      </p>
    </div>
  );
}
