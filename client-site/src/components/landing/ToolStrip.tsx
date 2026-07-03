// White strip of the SWE-compatible coding clients — icons only (no boxes),
// original colors, moving with their names. Kilo Code is white, so it is
// darkened to stay visible on white.
type ToolLogo = {
  name: string;
  file: string;
  invert: boolean;
};

const TOOLS: ToolLogo[] = [
  { name: 'Cursor', file: 'cursor.svg', invert: false },
  { name: 'Cline', file: 'cline-mono.svg', invert: false },
  { name: 'Roo Code', file: 'roocode-mono.svg', invert: false },
  { name: 'Trae', file: 'trae.svg', invert: false },
  { name: 'Kilo Code', file: 'kilo-code.svg', invert: true },
];

export const CONFIGURATION_TOOLS: ToolLogo[] = TOOLS;

export function ToolStrip({
  label = 'Works in the coding clients you already use',
  tools = TOOLS,
}: {
  label?: string;
  tools?: ToolLogo[];
}) {
  return (
    <section className="w-full px-5 py-14">
      <div className="mx-auto max-w-[1080px]">
        <p className="mb-8 text-center text-[12px] font-medium uppercase tracking-[0.2em] text-secondary">{label}</p>
        <div className="relative flex w-full overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-28 bg-gradient-to-r from-[#f6f5f1] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-28 bg-gradient-to-l from-[#f6f5f1] to-transparent" />
          <div className="flex shrink-0 animate-marquee items-center">
            {[...tools, ...tools].map((tool, idx) => (
              <div key={idx} className="mx-8 flex shrink-0 items-center gap-2.5">
                <img
                  src={`/tools/${tool.file}`}
                  alt={tool.name}
                  className={`h-6 w-auto object-contain ${tool.invert ? 'brightness-0' : ''}`}
                />
                <span className="text-[14px] font-medium text-secondary">{tool.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
