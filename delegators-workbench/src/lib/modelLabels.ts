/** Display labels for gateway model aliases. */

const MODEL_LABELS: Record<string, string> = {
  'dlg-light': 'Light thinking',
  'dlg-pro': 'Pro thinking',
  'swe-fast': 'Pro fast',
  'swe-balanced': 'Pro balanced',
  'swe-fast-thinking': 'Pro fast thinking',
  'swe-pro': 'Pro',
  'swe-pro-thinking': 'Pro thinking',
  'swe-ultra': 'UltraSpeed',
  'swe-ultra-thinking': 'UltraSpeed thinking'
};

const MODEL_HINTS: Record<string, string> = {
  'dlg-light': 'Cheaper thinking lane',
  'dlg-pro': 'Default Pro model',
  'swe-fast': 'Cheaper fallback for quick drafts',
  'swe-balanced': 'Balanced fallback lane',
  'swe-fast-thinking': 'Cheaper reasoning fallback',
  'swe-pro': 'Pro lane without explicit thinking',
  'swe-pro-thinking': 'Default Pro model',
  'swe-ultra': 'UltraSpeed beta lane',
  'swe-ultra-thinking': 'UltraSpeed beta with deliberate reasoning'
};

export function displayModelName(modelId: string): string {
  return (
    MODEL_LABELS[modelId] ??
    modelId.replace(/^(swe|dlg)-/, 'dlg ').replace(/-/g, ' ')
  );
}

export function displayModelHint(modelId: string): string {
  return MODEL_HINTS[modelId] ?? 'Available with your plan';
}
