import type { ArtifactDocument, ArtifactExportFormat } from './shared.js';
import { workbenchFetch } from './account.js';

export function canExportSheet(artifact: ArtifactDocument): boolean {
  return Boolean(artifact.sheet) || artifact.sections.some((section) => Boolean(section.table));
}

export function primaryExportFormat(artifact: ArtifactDocument): ArtifactExportFormat {
  if (artifact.primaryFormat) return artifact.primaryFormat;
  if (artifact.kind === 'deck' || artifact.slides?.length) return 'pptx';
  if (artifact.kind === 'sheet' || artifact.sheet) return 'xlsx';
  if (artifact.kind === 'report') return 'pdf';
  return 'docx';
}

export function exportFormatsForArtifact(artifact: ArtifactDocument): ArtifactExportFormat[] {
  const formats: ArtifactExportFormat[] = [primaryExportFormat(artifact), 'pdf', 'docx'];
  if (artifact.kind === 'deck' || (artifact.slides?.length ?? 0) > 0) formats.push('pptx');
  if (canExportSheet(artifact)) formats.push('xlsx');
  formats.push('zip');
  return [...new Set(formats)];
}

export async function downloadArtifact(artifact: ArtifactDocument, format: ArtifactExportFormat): Promise<void> {
  const response = await workbenchFetch('/api/artifacts/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ artifact, format })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
    throw new Error(payload.details || payload.error || `Export failed with HTTP ${response.status}.`);
  }

  const blob = await response.blob();
  const filename = filenameFromDisposition(response.headers.get('content-disposition')) ?? `delegators-artifact.${format}`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function filenameFromDisposition(value: string | null): string | null {
  if (!value) return null;
  const match = /filename="([^"]+)"/.exec(value);
  return match?.[1] ?? null;
}
