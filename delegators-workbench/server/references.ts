import path from 'node:path';
import { PDFParse } from 'pdf-parse';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import type { ArtifactAsset, WorkbenchReferenceInput } from '../src/lib/shared.js';
import { analyzeImageWithoutPaid } from './imageAnalysis.js';
import { webFetch, type PlatformSearch } from './workbenchTools.js';

export type ReferenceSeedFile = {
  path: string;
  content?: string;
  binary?: Buffer;
};

export type PreparedReference = {
  id: string;
  kind: WorkbenchReferenceInput['kind'];
  name: string;
  mimeType?: string;
  url?: string;
  bytes?: number;
  extractor: string;
  text: string;
  warnings: string[];
  assetId?: string;
  designProfile?: PresentationDesignProfile;
};

export type PresentationDesignProfile = {
  sourceName: string;
  slideCount: number;
  slideAspect: 'wide' | 'standard' | 'custom';
  widthEmu?: number;
  heightEmu?: number;
  themeName?: string;
  headingFontFamily?: string;
  bodyFontFamily?: string;
  themeColors: string[];
  usedColors: string[];
  layoutRhythm: Array<{
    slide: number;
    family: 'statement' | 'image' | 'data' | 'grid' | 'split' | 'content';
    textBoxes: number;
    images: number;
    graphicFrames: number;
    shapes: number;
  }>;
};

export type ReferencePack = {
  capturedAt: string;
  references: PreparedReference[];
  assets: ArtifactAsset[];
  markdown: string;
  seedFiles: ReferenceSeedFile[];
  analysis?: string;
};

const maxReferenceTextChars = 80_000;
const maxPackChars = 120_000;

export type ImageAnalyzer = (binary: Buffer, name: string, mime: string) => Promise<string | null>;

// MarkItDown sidecar (Microsoft's converter, pinned Python service on the private
// network). It produces compact Markdown for pdf/docx/pptx/xlsx/html/csv/zip/epub —
// far more token-efficient for the model than raw extracted text. Optional: when
// the env is unset or the service is down we silently use the built-in extractors.
function markItDownConfig(): { url: string; timeoutMs: number } {
  const url = process.env.WORKBENCH_MARKITDOWN_URL?.trim().replace(/\/$/, '') ?? '';
  const timeoutMs = Number.parseInt(process.env.WORKBENCH_MARKITDOWN_TIMEOUT_MS ?? '20000', 10);
  return { url, timeoutMs };
}

async function convertWithMarkItDown(binary: Buffer, name: string): Promise<string | null> {
  const { url: markItDownURL, timeoutMs: markItDownTimeoutMs } = markItDownConfig();
  if (!markItDownURL) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), markItDownTimeoutMs);
  try {
    const response = await fetch(`${markItDownURL}/convert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Filename': encodeURIComponent(name)
      },
      body: new Uint8Array(binary),
      signal: controller.signal
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { ok?: boolean; markdown?: string };
    const markdown = payload.ok ? (payload.markdown ?? '').trim() : '';
    return markdown.length > 0 ? markdown : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function prepareReferencePack(options: {
  brief: string;
  references?: WorkbenchReferenceInput[];
  platform?: PlatformSearch;
  onStatus?: (message: string) => void;
  analyzeImage?: ImageAnalyzer;
  analyzeImageFallback?: ImageAnalyzer;
}): Promise<ReferencePack | null> {
  const explicit = options.references ?? [];
  const promptUrls = extractPromptUrls(options.brief)
    .filter((url) => !explicit.some((reference) => reference.kind === 'url' && reference.url === url))
    .map((url): WorkbenchReferenceInput => ({ kind: 'url', url, name: new URL(url).hostname }));
  const inputs = [...explicit, ...promptUrls].slice(0, 8);
  if (inputs.length === 0) return null;

  options.onStatus?.(inputs.length === 1 ? 'Reading 1 reference' : `Reading ${inputs.length} references`);
  const prepared: PreparedReference[] = [];
  const assets: ArtifactAsset[] = [];
  const seedFiles: ReferenceSeedFile[] = [];

  const results = await mapLimitedOrdered([...inputs.entries()], 2, async ([index, reference]) => {
    const id = `R${index + 1}`;
    return prepareOneReference(
      reference,
      id,
      options.platform,
      options.analyzeImage,
      options.analyzeImageFallback
    );
  });

  for (const result of results) {
    prepared.push(result.reference);
    if (result.asset) assets.push(result.asset);
    seedFiles.push(...result.seedFiles);
  }

  const markdown = renderReferencePackMarkdown(prepared);
  seedFiles.push(
    { path: 'references/reference-pack.md', content: markdown },
    { path: 'references/reference-pack.json', content: JSON.stringify({ capturedAt: new Date().toISOString(), references: prepared }, null, 2) }
  );

  return {
    capturedAt: new Date().toISOString(),
    references: prepared,
    assets,
    markdown,
    seedFiles
  };
}

async function mapLimitedOrdered<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;
  async function run(): Promise<void> {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

export function renderReferencePackMarkdown(references: PreparedReference[]): string {
  const lines = [
    '# Reference Pack',
    '',
    'Rule: Treat these as user-supplied reference material. Use extracted text only for claims; if an image has no visual analysis, do not infer visual details.',
    ''
  ];

  for (const reference of references) {
    lines.push(`## ${reference.id}: ${reference.name}`);
    lines.push(`Kind: ${reference.kind}`);
    if (reference.mimeType) lines.push(`MIME: ${reference.mimeType}`);
    if (reference.url) lines.push(`URL: ${reference.url}`);
    if (typeof reference.bytes === 'number') lines.push(`Bytes: ${reference.bytes}`);
    lines.push(`Extractor: ${reference.extractor}`);
    if (reference.assetId) lines.push(`Reusable image asset: ${reference.assetId}`);
    if (reference.designProfile) {
      lines.push('Presentation design profile:');
      lines.push(renderPresentationDesignProfile(reference.designProfile));
    }
    if (reference.warnings.length) {
      lines.push('Warnings:');
      reference.warnings.forEach((warning) => lines.push(`- ${warning}`));
    }
    lines.push('Extracted content:');
    lines.push(reference.text || '(No extractable text.)');
    lines.push('');
  }

  const markdown = lines.join('\n').trim() + '\n';
  return markdown.length > maxPackChars
    ? markdown.slice(0, maxPackChars) + '\n[reference pack truncated]\n'
    : markdown;
}

export function extractPromptUrls(value: string): string[] {
  const urls = new Set<string>();
  const matches = value.match(/https?:\/\/[^\s<>)\]}"']+/gi) ?? [];
  for (const match of matches) {
    try {
      const url = new URL(match.replace(/[.,;:!?]+$/, ''));
      if (url.protocol === 'http:' || url.protocol === 'https:') urls.add(url.toString());
    } catch {
      // Ignore malformed pasted URLs.
    }
  }
  return [...urls].slice(0, 8);
}

async function prepareOneReference(
  reference: WorkbenchReferenceInput,
  id: string,
  platform?: PlatformSearch,
  analyzeImage?: ImageAnalyzer,
  analyzeImageFallback?: ImageAnalyzer
): Promise<{ reference: PreparedReference; seedFiles: ReferenceSeedFile[]; asset?: ArtifactAsset }> {
  if (reference.kind === 'url') {
    const fetched = await webFetch(reference.url!, {
      platform,
      fresh: true,
      maxBytes: maxReferenceTextChars
    });
    const name = reference.name || fetched.title || sourceNameFromUrl(fetched.url);
    return {
      reference: {
        id,
        kind: 'url',
        name,
        url: fetched.url,
        mimeType: fetched.contentType,
        extractor: fetched.provider === 'exa' ? 'exa-contents' : 'direct-fetch',
        text: compactText(fetched.text || fetched.highlights?.join('\n') || ''),
        warnings: []
      },
      seedFiles: [{ path: `references/${id}-url.md`, content: fetched.text }]
    };
  }

  if (reference.kind === 'text') {
    const name = reference.name || `${id} text reference`;
    const text = compactText(reference.text ?? '');
    return {
      reference: {
        id,
        kind: 'text',
        name,
        mimeType: reference.mimeType || 'text/plain',
        bytes: Buffer.byteLength(reference.text ?? '', 'utf8'),
        extractor: 'plain-text',
        text,
        warnings: []
      },
      seedFiles: [{ path: `references/${id}-text.txt`, content: reference.text ?? '' }]
    };
  }

  const name = sanitizeFilename(reference.name || `${id}-upload.bin`);
  const binary = decodeBase64(reference.dataBase64 ?? '');
  const mimeType = reference.mimeType || mimeFromName(name);
  const extracted = await extractFileText({
    name,
    mimeType,
    binary,
    analyzeImage,
    analyzeImageFallback
  });
  const asset = uploadedImageAsset(id, name, mimeType, binary);
  return {
    reference: {
      id,
      kind: 'file',
      name,
      mimeType,
      bytes: binary.byteLength,
      extractor: extracted.extractor,
      text: compactText(extracted.text),
      warnings: extracted.warnings,
      assetId: asset?.id,
      designProfile: extracted.designProfile
    },
    seedFiles: [
      { path: `references/uploads/${id}-${name}`, binary },
      {
        path: `references/extracted/${id}-${name}${extracted.extractor === 'markitdown' ? '.md' : '.txt'}`,
        content: extracted.text
      }
    ],
    asset
  };
}

async function extractFileText(options: {
  name: string;
  mimeType?: string;
  binary: Buffer;
  analyzeImage?: ImageAnalyzer;
  analyzeImageFallback?: ImageAnalyzer;
}): Promise<{
  extractor: string;
  text: string;
  warnings: string[];
  designProfile?: PresentationDesignProfile;
}> {
  const ext = path.extname(options.name).toLowerCase();
  const mime = (options.mimeType ?? '').toLowerCase();
  try {
    if (isPlainText(ext, mime)) {
      return { extractor: 'plain-text', text: options.binary.toString('utf8'), warnings: [] };
    }
    if (ext === '.pptx' || mime.includes('presentationml')) {
      const [markdown, designProfile, rawText] = await Promise.all([
        convertWithMarkItDown(options.binary, options.name),
        extractPptxDesignProfile(options.binary, options.name),
        extractPptxText(options.binary)
      ]);
      const designMarkdown = renderPresentationDesignProfile(designProfile);
      return {
        extractor: markdown ? 'markitdown+pptx-design' : 'pptx-zip-xml+design',
        text: [markdown || rawText, '# Deterministic Presentation Design Profile', designMarkdown]
          .filter(Boolean)
          .join('\n\n'),
        warnings: [],
        designProfile
      };
    }
    // Documents go through MarkItDown first: structured Markdown costs fewer
    // tokens and preserves headings/tables far better than raw text dumps.
    // Images skip it — the vision lane below gives real visual analysis.
    if (!isImage(ext, mime)) {
      const markdown = await convertWithMarkItDown(options.binary, options.name);
      if (markdown) {
        return { extractor: 'markitdown', text: markdown, warnings: [] };
      }
    }
    if (ext === '.pdf' || mime.includes('pdf')) {
      const parser = new PDFParse({ data: new Uint8Array(options.binary) });
      try {
        const result = await parser.getText();
        return { extractor: 'pdf-parse', text: normalizeWhitespace(String(result.text ?? '')), warnings: [] };
      } finally {
        await parser.destroy();
      }
    }
    if (ext === '.docx' || mime.includes('wordprocessingml')) {
      return { extractor: 'docx-zip-xml', text: await extractDocxText(options.binary), warnings: [] };
    }
    if (ext === '.xlsx' || mime.includes('spreadsheetml')) {
      return { extractor: 'exceljs', text: await extractXlsxText(options.binary), warnings: [] };
    }
    if (isImage(ext, mime)) {
      const dimensions = imageDimensions(options.binary);
      const meta = [
        `Image reference: ${options.name}`,
        dimensions ? `Dimensions: ${dimensions.width}x${dimensions.height}` : ''
      ].filter(Boolean).join('\n');
      const imageMime = mime || `image/${ext.replace('.', '')}`;
      // Semantic vision must run before OCR. OCR can transcribe labels, but it
      // cannot reliably describe hierarchy, charts, layout, or visual evidence.
      if (options.analyzeImage) {
        try {
          const analysis = await options.analyzeImage(options.binary, options.name, imageMime);
          if (analysis && analysis.trim()) {
            return { extractor: 'gateway-vision', text: `${meta}\nVisual analysis:\n${analysis.trim()}`, warnings: [] };
          }
        } catch {
          // Fall through to self-hosted vision or OCR.
        }
      }
      const freeText = options.analyzeImageFallback
        ? await options.analyzeImageFallback(options.binary, options.name, imageMime)
        : null;
      if (freeText?.trim()) {
        return {
          extractor: 'local-ocr',
          text: `${meta}\nVisual analysis:\n${freeText.trim()}`,
          warnings: ['Fallback analysis may contain OCR text without complete semantic visual interpretation.']
        };
      }
      const freeAnalysis = await analyzeImageWithoutPaid(options.binary, options.name, imageMime);
      if (freeAnalysis) {
        return {
          extractor: freeAnalysis.extractor,
          text: `${meta}\nVisual analysis:\n${freeAnalysis.text}`,
          warnings: freeAnalysis.warnings
        };
      }
      return {
        extractor: 'image-metadata',
        text: `${meta}\nVisual analyzer unavailable; use as a named reference only; do not infer visual content from it.`,
        warnings: ['No vision analysis available for this image.']
      };
    }
  } catch (error) {
    return {
      extractor: 'failed',
      text: '',
      warnings: [error instanceof Error ? error.message : 'Reference extraction failed.']
    };
  }

  return {
    extractor: 'metadata-only',
    text: `Uploaded file: ${options.name}\nNo text extractor is available for this file type.`,
    warnings: ['Unsupported reference file type for text extraction.']
  };
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const paths = Object.keys(zip.files)
    .filter((name) => /^word\/(document|header\d+|footer\d+)\.xml$/.test(name))
    .sort();
  const chunks: string[] = [];
  for (const name of paths) {
    chunks.push(xmlToText(await zip.files[name].async('text')));
  }
  return normalizeWhitespace(chunks.join('\n\n'));
}

async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const paths = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((left, right) => slideNumber(left) - slideNumber(right));
  const chunks: string[] = [];
  for (const name of paths) {
    const text = xmlToText(await zip.files[name].async('text'));
    if (text) chunks.push(`Slide ${slideNumber(name)}: ${text}`);
  }
  return normalizeWhitespace(chunks.join('\n\n'));
}

export async function extractPptxDesignProfile(
  buffer: Buffer,
  sourceName = 'presentation.pptx'
): Promise<PresentationDesignProfile> {
  const zip = await JSZip.loadAsync(buffer);
  const presentationXml = await zip.file('ppt/presentation.xml')?.async('text') ?? '';
  const themePath = Object.keys(zip.files)
    .filter((name) => /^ppt\/theme\/theme\d+\.xml$/.test(name))
    .sort()[0];
  const themeXml = themePath ? await zip.file(themePath)?.async('text') ?? '' : '';
  const slidePaths = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((left, right) => slideNumber(left) - slideNumber(right));
  const size = presentationXml.match(/<p:sldSz\b[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/i);
  const widthEmu = size ? Number.parseInt(size[1], 10) : undefined;
  const heightEmu = size ? Number.parseInt(size[2], 10) : undefined;
  const layoutRhythm: PresentationDesignProfile['layoutRhythm'] = [];
  const visualXml: string[] = [];

  for (const slidePath of slidePaths) {
    const xml = await zip.file(slidePath)?.async('text') ?? '';
    visualXml.push(xml);
    const textBoxes = countMatches(xml, /<p:sp\b/g);
    const images = countMatches(xml, /<p:pic\b/g);
    const graphicFrames = countMatches(xml, /<p:graphicFrame\b/g);
    const shapes = textBoxes + images + graphicFrames + countMatches(xml, /<p:cxnSp\b/g);
    const textLength = [...xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/gi)]
      .reduce((total, match) => total + decodeXml(match[1]).trim().length, 0);
    layoutRhythm.push({
      slide: slideNumber(slidePath),
      family: classifyPptxLayout({ textBoxes, images, graphicFrames, shapes, textLength }),
      textBoxes,
      images,
      graphicFrames,
      shapes
    });
  }
  const supportingVisualPaths = Object.keys(zip.files)
    .filter((name) => /^ppt\/(?:slideMasters|slideLayouts)\/[^/]+\.xml$/.test(name))
    .sort();
  for (const visualPath of supportingVisualPaths) {
    visualXml.push(await zip.file(visualPath)?.async('text') ?? '');
  }

  return {
    sourceName,
    slideCount: slidePaths.length,
    slideAspect: pptxAspect(widthEmu, heightEmu),
    widthEmu,
    heightEmu,
    themeName: themeXml.match(/<a:theme\b[^>]*\bname="([^"]+)"/i)?.[1],
    headingFontFamily: themeXml.match(/<a:majorFont>[\s\S]*?<a:latin\b[^>]*\btypeface="([^"]*)"/i)?.[1] || undefined,
    bodyFontFamily: themeXml.match(/<a:minorFont>[\s\S]*?<a:latin\b[^>]*\btypeface="([^"]*)"/i)?.[1] || undefined,
    themeColors: extractThemeColors(themeXml),
    usedColors: extractUsedColors(visualXml),
    layoutRhythm
  };
}

export function renderPresentationDesignProfile(profile: PresentationDesignProfile): string {
  const layoutCounts = new Map<string, number>();
  profile.layoutRhythm.forEach((slide) => {
    layoutCounts.set(slide.family, (layoutCounts.get(slide.family) ?? 0) + 1);
  });
  return [
    `- Source: ${profile.sourceName}`,
    `- Slides: ${profile.slideCount}`,
    `- Aspect: ${profile.slideAspect}${profile.widthEmu && profile.heightEmu ? ` (${profile.widthEmu} x ${profile.heightEmu} EMU)` : ''}`,
    profile.themeName ? `- Theme name: ${profile.themeName}` : '',
    profile.headingFontFamily ? `- Exact heading font from theme: ${profile.headingFontFamily}` : '',
    profile.bodyFontFamily ? `- Exact body font from theme: ${profile.bodyFontFamily}` : '',
    profile.themeColors.length ? `- Exact theme colors: ${profile.themeColors.map((color) => `#${color}`).join(', ')}` : '',
    profile.usedColors.length ? `- Most-used rendered colors: ${profile.usedColors.map((color) => `#${color}`).join(', ')}` : '',
    layoutCounts.size
      ? `- Layout rhythm: ${[...layoutCounts.entries()].map(([family, count]) => `${count} ${family}`).join(', ')}`
      : '',
    profile.layoutRhythm.length
      ? `- Per-slide composition: ${profile.layoutRhythm.map((slide) =>
          `${slide.slide}:${slide.family}(text=${slide.textBoxes}, images=${slide.images}, frames=${slide.graphicFrames}, shapes=${slide.shapes})`
        ).join('; ')}`
      : ''
  ].filter(Boolean).join('\n');
}

function extractThemeColors(themeXml: string): string[] {
  const scheme = themeXml.match(/<a:clrScheme\b[\s\S]*?<\/a:clrScheme>/i)?.[0] ?? themeXml;
  const colors = [
    ...[...scheme.matchAll(/<a:srgbClr\b[^>]*\bval="([0-9a-f]{6})"/gi)].map((match) => match[1]),
    ...[...scheme.matchAll(/<a:sysClr\b[^>]*\blastClr="([0-9a-f]{6})"/gi)].map((match) => match[1])
  ].map((color) => color.toUpperCase());
  return [...new Set(colors)].slice(0, 12);
}

function extractUsedColors(xmlDocuments: string[]): string[] {
  const counts = new Map<string, number>();
  for (const xml of xmlDocuments) {
    for (const match of xml.matchAll(/<a:srgbClr\b[^>]*\bval="([0-9a-f]{6})"/gi)) {
      const color = match[1].toUpperCase();
      counts.set(color, (counts.get(color) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([color]) => color)
    .slice(0, 12);
}

function classifyPptxLayout(input: {
  textBoxes: number;
  images: number;
  graphicFrames: number;
  shapes: number;
  textLength: number;
}): PresentationDesignProfile['layoutRhythm'][number]['family'] {
  if (input.images > 0 && input.textBoxes <= 4) return 'image';
  if (input.graphicFrames > 0) return 'data';
  if (input.textBoxes <= 2 && input.textLength < 320) return 'statement';
  if (input.shapes >= 7 || input.textBoxes >= 6) return 'grid';
  if (input.textBoxes >= 3 && input.textBoxes <= 5) return 'split';
  return 'content';
}

function pptxAspect(width?: number, height?: number): PresentationDesignProfile['slideAspect'] {
  if (!width || !height) return 'custom';
  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.08) return 'wide';
  if (Math.abs(ratio - 4 / 3) < 0.08) return 'standard';
  return 'custom';
}

function countMatches(value: string, pattern: RegExp): number {
  return [...value.matchAll(pattern)].length;
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function extractXlsxText(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  await workbook.xlsx.load(arrayBuffer);
  const chunks: string[] = [];
  workbook.worksheets.forEach((sheet) => {
    chunks.push(`# Sheet: ${sheet.name}`);
    sheet.eachRow((row) => {
      const values = row.values;
      if (!Array.isArray(values)) return;
      const line = values.slice(1).map((value) => cellText(value)).join('\t').trim();
      if (line) chunks.push(line);
    });
    chunks.push('');
  });
  return normalizeWhitespace(chunks.join('\n'));
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.text === 'string') return record.text;
    if (typeof record.result === 'string' || typeof record.result === 'number') return String(record.result);
    if (typeof record.formula === 'string') return `=${record.formula}`;
    if (Array.isArray(record.richText)) return record.richText.map((part) => cellText(part)).join('');
  }
  return String(value);
}

function xmlToText(xml: string): string {
  return normalizeWhitespace(
    xml
      .replace(/<[^>]+>/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
  );
}

function slideNumber(value: string): number {
  return Number(value.match(/slide(\d+)\.xml$/)?.[1] ?? '0');
}

function isPlainText(ext: string, mime: string): boolean {
  return ['.txt', '.md', '.markdown', '.csv', '.tsv', '.json', '.jsonl', '.log'].includes(ext)
    || /^text\//.test(mime)
    || mime.includes('json')
    || mime.includes('csv');
}

function isImage(ext: string, mime: string): boolean {
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext) || mime.startsWith('image/');
}

function imageDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length >= 24 && buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length >= 10 && buffer.subarray(0, 3).toString('ascii') === 'GIF') {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xc3) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }
  return null;
}

function uploadedImageAsset(
  referenceId: string,
  name: string,
  mimeType: string | undefined,
  binary: Buffer
): ArtifactAsset | undefined {
  const normalizedMime = mimeType?.toLowerCase().split(';')[0];
  if (normalizedMime !== 'image/png' && normalizedMime !== 'image/jpeg') return undefined;
  if (binary.byteLength > 1_500_000) return undefined;
  const dimensions = imageDimensions(binary);
  if (!dimensions) return undefined;
  return {
    id: `REF${referenceId.replace(/\D/g, '') || '1'}`,
    mimeType: normalizedMime,
    dataUri: `data:${normalizedMime};base64,${binary.toString('base64')}`,
    alt: name,
    attribution: `User upload: ${name}`,
    width: dimensions.width,
    height: dimensions.height
  };
}

function decodeBase64(value: string): Buffer {
  const clean = value.includes(',') ? value.slice(value.indexOf(',') + 1) : value;
  return Buffer.from(clean, 'base64');
}

function sanitizeFilename(value: string): string {
  return value
    .replace(/[/\\?%*:|"<>\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140) || 'reference.bin';
}

function mimeFromName(value: string): string | undefined {
  const ext = path.extname(value).toLowerCase();
  const types: Record<string, string> = {
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  };
  return types[ext];
}

function sourceNameFromUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.hostname;
  } catch {
    return value;
  }
}

function compactText(value: string): string {
  const clean = normalizeWhitespace(value);
  return clean.length > maxReferenceTextChars
    ? clean.slice(0, maxReferenceTextChars) + '\n[reference truncated]'
    : clean;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\r/g, '').replace(/ {2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
