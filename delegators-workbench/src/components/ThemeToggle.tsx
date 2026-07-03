import type { WorkbenchTheme } from '../lib/theme';

type ThemeToggleProps = {
  theme: WorkbenchTheme;
  onToggle: () => void;
  className?: string;
};

/** Minimal sun — tap to switch to light theme. */
function MinimalSun() {
  return (
    <svg
      className="theme-toggle-glyph"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.35" />
      <path
        d="M8 1.25v2.1M8 12.65v2.1M1.25 8h2.1M12.65 8h2.1M3.05 3.05l1.49 1.49M11.46 11.46l1.49 1.49M3.05 12.95l1.49-1.49M11.46 4.54l1.49-1.49"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Minimal moon — tap to switch back to dark theme. */
function MinimalMoon() {
  return (
    <svg
      className="theme-toggle-glyph"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M11.2 2.4a5.6 5.6 0 1 0 2.4 9.2 4.4 4.4 0 1 1 0-8.4 5.6 5.6 0 0 1-2.4-.8Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ThemeToggle({ theme, onToggle, className = 'quiet-icon theme-switch' }: ThemeToggleProps) {
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      className={className}
      onClick={onToggle}
      title={isDark ? 'Light theme' : 'Dark theme'}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDark ? <MinimalSun /> : <MinimalMoon />}
    </button>
  );
}