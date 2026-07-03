import { ImageIcon, Play } from 'lucide-react';

type MediaFrameProps = {
  label: string;
  caption?: string;
  variant?: 'light' | 'dark';
  aspect?: 'video' | 'tall' | 'wide' | 'cinema';
  kind?: 'video' | 'screenshot';
  src?: string;
  poster?: string;
  alt?: string;
  priority?: boolean;
  fit?: 'cover' | 'contain';
  className?: string;
};

export function MediaFrame({
  label,
  caption,
  variant = 'light',
  aspect = 'video',
  kind = 'screenshot',
  src,
  poster,
  alt,
  priority = false,
  fit = 'cover',
  className = ''
}: MediaFrameProps) {
  const isDark = variant === 'dark';
  const shell = isDark ? 'glass-dark' : 'glass-card';
  const innerBorder = isDark ? 'border-white/[0.08]' : 'border-line/60';
  const innerBg = isDark ? 'bg-black/30' : 'bg-white/80';
  const chromeBorder = isDark ? 'border-white/[0.06]' : 'border-line/50';
  const dotClass = isDark ? 'bg-white/18' : 'bg-black/12';
  const titleColor = isDark ? 'text-white/40' : 'text-muted';
  const canvas = isDark ? 'bg-[#0a0a0b]' : 'bg-[#faf9f5]';
  const aspectClass =
    aspect === 'tall'
      ? 'aspect-[4/5] max-h-[620px]'
      : aspect === 'wide'
        ? 'aspect-[21/9]'
        : aspect === 'cinema'
          ? 'aspect-[16/10] min-h-[280px] md:min-h-[420px]'
          : 'aspect-video';

  const hasMedia = Boolean(src || poster);
  const imageFitClass = fit === 'contain' ? 'object-contain object-center' : 'object-cover object-top';

  return (
    <div
      className={`${shell} group w-full rounded-3xl p-2.5 transition-transform duration-500 hover:-translate-y-0.5 ${className}`}
    >
      <div className={`relative overflow-hidden rounded-[18px] border ${innerBorder} ${innerBg}`}>
        <div className={`flex h-9 items-center gap-2 border-b px-4 ${chromeBorder}`}>
          <span className={`h-2 w-2 rounded-full ${dotClass}`} />
          <span className={`h-2 w-2 rounded-full ${dotClass}`} />
          <span className={`h-2 w-2 rounded-full ${dotClass}`} />
          <span className={`ml-2 font-mono text-[10px] tracking-[0.16em] md:text-[11px] ${titleColor}`}>
            {label}
          </span>
        </div>
        <div className={`relative overflow-hidden ${aspectClass} ${hasMedia ? (isDark ? 'bg-[#0a0a0b]' : 'bg-[#f6f5f1]') : canvas}`}>
          {hasMedia ? (
            <>
              {src ? (
                <img
                  src={src}
                  alt={alt ?? label}
                  loading={priority ? 'eager' : 'lazy'}
                  decoding="async"
                  className={`h-full w-full transition-transform duration-700 ease-out group-hover:scale-[1.008] ${imageFitClass}`}
                />
              ) : poster ? (
                <div className="relative h-full w-full">
                  <img
                    src={poster}
                    alt={alt ?? label}
                    loading={priority ? 'eager' : 'lazy'}
                    decoding="async"
                    className={`h-full w-full ${imageFitClass}`}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors duration-300 group-hover:bg-black/12">
                    <span
                      className={`flex items-center justify-center rounded-full shadow-[0_10px_40px_-8px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:scale-105 ${
                        isDark ? 'bg-white text-[#0b0b0c]' : 'bg-[#0b0b0c] text-white'
                      }`}
                      style={{ height: 56, width: 56 }}
                    >
                      <Play className="h-5 w-5 translate-x-0.5 fill-current" />
                    </span>
                  </div>
                </div>
              ) : null}
              {caption ? (
                <p
                  className={`absolute bottom-3 left-3 right-3 rounded-xl px-3 py-2 text-[12px] leading-5 backdrop-blur-md ${
                    isDark ? 'bg-black/55 text-white/75' : 'bg-white/85 text-secondary'
                  }`}
                >
                  {caption}
                </p>
              ) : null}
            </>
          ) : (
            <div className={`relative flex h-full items-center justify-center ${canvas}`}>
              <div
                className={`absolute inset-0 ${
                  isDark
                    ? 'bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.05),transparent_60%)]'
                    : 'bg-[radial-gradient(circle_at_50%_45%,rgba(11,11,12,0.03),transparent_60%)]'
                }`}
              />
              <div className="relative flex flex-col items-center gap-4 px-6 text-center">
                {kind === 'video' ? (
                  <span
                    className={`flex items-center justify-center rounded-full shadow-[0_10px_40px_-8px_rgba(0,0,0,0.35)] transition-transform duration-300 hover:scale-105 ${
                      isDark ? 'bg-white text-[#0b0b0c]' : 'bg-[#0b0b0c] text-white'
                    }`}
                    style={{ height: 56, width: 56 }}
                  >
                    <Play className="h-5 w-5 translate-x-0.5 fill-current" />
                  </span>
                ) : (
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                      isDark ? 'border-white/10 bg-white/5 text-white/45' : 'border-line bg-white text-muted'
                    }`}
                  >
                    <ImageIcon className="h-5 w-5" />
                  </span>
                )}
                <div>
                  <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${titleColor}`}>
                    {kind === 'video' ? 'Demo video' : 'Screenshot'}
                  </p>
                  {caption ? (
                    <p className={`mt-2 max-w-[280px] text-[13px] leading-5 ${isDark ? 'text-white/45' : 'text-secondary'}`}>
                      {caption}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}