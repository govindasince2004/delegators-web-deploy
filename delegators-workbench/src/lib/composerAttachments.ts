import type { WorkbenchReferenceInput } from './shared.js';

export type MessageAttachment = {
  id: string;
  kind: 'image' | 'file';
  name?: string;
  previewUrl?: string;
};

const IMAGE_TOKEN_RE = /\[Image #(\d+)\]/g;

export function isImageMime(mimeType: string | undefined, name?: string): boolean {
  if (mimeType?.startsWith('image/')) return true;
  const lower = (name ?? '').toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(lower);
}

export function imageAttachmentToken(index: number): string {
  return `[Image #${index}]`;
}

export function fileAttachmentToken(name: string): string {
  return `attached file 📁 ${name}`;
}

export function nextImageIndex(references: readonly WorkbenchReferenceInput[]): number {
  const used = references
    .filter((reference) => isImageMime(reference.mimeType, reference.name))
    .map((reference) => reference.imageIndex ?? 0);
  return (used.length ? Math.max(...used) : 0) + 1;
}

export function reindexImageReferences(
  references: readonly WorkbenchReferenceInput[]
): WorkbenchReferenceInput[] {
  let imageNum = 0;
  return references.map((reference) => {
    if (!isImageMime(reference.mimeType, reference.name)) return reference;
    imageNum += 1;
    return { ...reference, imageIndex: imageNum };
  });
}

export function buildSubmitPrompt(
  userText: string,
  references: readonly WorkbenchReferenceInput[]
): string {
  const indexed = reindexImageReferences(references);
  const tokens = indexed.map((reference) => {
    if (isImageMime(reference.mimeType, reference.name) && reference.imageIndex) {
      return imageAttachmentToken(reference.imageIndex);
    }
    return fileAttachmentToken(reference.name ?? 'file');
  });
  return [userText.trim(), ...tokens].filter(Boolean).join('\n');
}

export function refsReferencedInPrompt(
  references: readonly WorkbenchReferenceInput[],
  prompt: string
): WorkbenchReferenceInput[] {
  const indexed = reindexImageReferences(references);
  return indexed.filter((reference) => {
    if (isImageMime(reference.mimeType, reference.name)) {
      const index = reference.imageIndex;
      return typeof index === 'number' && prompt.includes(imageAttachmentToken(index));
    }
    const name = reference.name?.trim();
    return Boolean(name && prompt.includes(fileAttachmentToken(name)));
  });
}

export function referencePreviewUrl(reference: WorkbenchReferenceInput): string | undefined {
  if (!isImageMime(reference.mimeType, reference.name) || !reference.dataBase64) return undefined;
  return `data:${reference.mimeType || 'image/png'};base64,${reference.dataBase64}`;
}

export function composerPreviewHeight(count: number): number {
  if (count <= 1) return 96;
  if (count === 2) return 84;
  if (count <= 4) return 72;
  return 60;
}

export function messageAttachmentsFromReferences(
  references: readonly WorkbenchReferenceInput[]
): MessageAttachment[] {
  return references.map((reference) => {
    const image = isImageMime(reference.mimeType, reference.name);
    const previewUrl = image && reference.dataBase64
      ? `data:${reference.mimeType || 'image/png'};base64,${reference.dataBase64}`
      : undefined;
    return {
      id: reference.id ?? reference.name ?? crypto.randomUUID(),
      kind: image ? 'image' : 'file',
      name: reference.name,
      previewUrl
    };
  });
}

