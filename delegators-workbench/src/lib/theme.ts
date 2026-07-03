export type WorkbenchTheme = 'dark' | 'light';

const STORAGE_KEY = 'dw:theme';

function themeStorage(): Storage | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  return localStorage;
}

export function readStoredTheme(): WorkbenchTheme {
  const stored = themeStorage()?.getItem(STORAGE_KEY);
  return stored === 'light' ? 'light' : 'dark';
}

export function persistTheme(theme: WorkbenchTheme): void {
  themeStorage()?.setItem(STORAGE_KEY, theme);
}

export function applyWorkbenchTheme(theme: WorkbenchTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function toggleWorkbenchTheme(theme: WorkbenchTheme): WorkbenchTheme {
  const next: WorkbenchTheme = theme === 'dark' ? 'light' : 'dark';
  persistTheme(next);
  applyWorkbenchTheme(next);
  return next;
}

export function bootstrapWorkbenchTheme(): WorkbenchTheme {
  const theme = readStoredTheme();
  applyWorkbenchTheme(theme);
  return theme;
}