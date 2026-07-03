import type { ArtifactDocument, ArtifactExportFormat } from './shared';
import { workbenchFetch } from './account';
import type { IntegrationProvider } from './integrations';

export type CloudExportResult = {
  provider: IntegrationProvider;
  filename: string;
  mimeType: string;
  bytes: number;
  externalId: string;
  nativeUrl: string;
  webUrl?: string;
  folder: string;
};

export async function saveArtifactToCloud(
  provider: IntegrationProvider,
  artifact: ArtifactDocument,
  format: ArtifactExportFormat
): Promise<CloudExportResult> {
  const response = await workbenchFetch('/api/integrations/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, artifact, format })
  });
  const payload = await response.json().catch(() => ({})) as CloudExportResult & { details?: string };
  if (!response.ok) {
    throw new Error(payload.details || 'Cloud save failed.');
  }
  return payload;
}