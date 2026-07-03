import {
  ArtifactDocumentSchema,
  type ArtifactAsset,
  type ArtifactDocument
} from '../src/lib/shared.js';

export function attachResearchAssets(
  artifact: ArtifactDocument,
  availableAssets: ArtifactAsset[] = []
): ArtifactDocument {
  const available = new Map(availableAssets.map((asset) => [asset.id, asset]));
  const requestedIds = new Set([
    ...artifact.sections.map((section) => section.imageAssetId),
    ...(artifact.slides ?? []).map((slide) => slide.imageAssetId)
  ].filter((id): id is string => Boolean(id && available.has(id))));

  const sections = artifact.sections.map((section) => ({
    ...section,
    imageAssetId: section.imageAssetId && available.has(section.imageAssetId)
      ? section.imageAssetId
      : undefined
  }));
  const slides = artifact.slides?.map((slide) => ({
    ...slide,
    imageAssetId: slide.imageAssetId && available.has(slide.imageAssetId)
      ? slide.imageAssetId
      : undefined
  }));

  if (requestedIds.size === 0 && availableAssets.length > 0) {
    autoPlaceAssets(sections, slides, availableAssets);
  }

  const usedIds = new Set([
    ...sections.map((section) => section.imageAssetId),
    ...(slides ?? []).map((slide) => slide.imageAssetId)
  ].filter((id): id is string => Boolean(id)));

  return ArtifactDocumentSchema.parse({
    ...artifact,
    sections,
    slides,
    assets: availableAssets.filter((asset) => usedIds.has(asset.id)).slice(0, 3)
  });
}

export function artifactForModel(artifact: ArtifactDocument): Omit<ArtifactDocument, 'assets'> & {
  assets: Array<Omit<ArtifactAsset, 'dataUri'>>;
} {
  return {
    ...artifact,
    assets: artifact.assets.map(({ dataUri: _dataUri, ...asset }) => asset)
  };
}

export function mergeArtifactAssets(...groups: ArtifactAsset[][]): ArtifactAsset[] {
  const merged = new Map<string, ArtifactAsset>();
  for (const asset of groups.flat()) {
    if (!merged.has(asset.id)) merged.set(asset.id, asset);
  }
  return [...merged.values()].slice(0, 3);
}

export function artifactAssetSeedFiles(
  assets: ArtifactAsset[],
  directory = 'context/assets'
): Array<{ path: string; binary: Buffer }> {
  return assets.map((asset) => ({
    path: `${directory}/${asset.id}.${asset.mimeType === 'image/png' ? 'png' : 'jpg'}`,
    binary: Buffer.from(asset.dataUri.slice(asset.dataUri.indexOf(',') + 1), 'base64')
  }));
}

function autoPlaceAssets(
  sections: ArtifactDocument['sections'],
  slides: ArtifactDocument['slides'],
  assets: ArtifactAsset[]
): void {
  if (slides?.length) {
    const candidates = slides.filter((slide) => !slide.chart && !slide.table);
    assets.slice(0, candidates.length).forEach((asset, index) => {
      candidates[index].imageAssetId = asset.id;
    });
    return;
  }

  const candidates = sections.filter((section) => !section.chart && !section.table);
  assets.slice(0, candidates.length).forEach((asset, index) => {
    candidates[index].imageAssetId = asset.id;
  });
}
