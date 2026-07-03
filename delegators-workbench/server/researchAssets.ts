import type { ArtifactAsset } from '../src/lib/shared.js';
import { safeImageFetch, safeWebFetch } from './workbenchTools.js';

type SourcePage = {
  title: string;
  url?: string;
};

const maxAssets = 3;
const maxImageBytes = 1_500_000;
const minImageWidth = 480;
const minImageHeight = 240;

export async function collectResearchAssets(
  sources: SourcePage[],
  onStatus?: (message: string) => void,
  imageQuery?: string
): Promise<ArtifactAsset[]> {
  const assets: ArtifactAsset[] = [];
  const seen = new Set<string>();
  const candidates = sources.filter((source) => source.url).slice(0, 5);
  if (candidates.length === 0 && !imageQuery?.trim()) return assets;

  onStatus?.('Finding source images');
  for (const source of candidates) {
    if (assets.length >= maxAssets || !source.url) break;
    const page = await safeWebFetch(source.url, 240_000, {
      'User-Agent': 'Mozilla/5.0 (compatible; DelegatorsWorkbench/1.0)',
      Accept: 'text/html,application/xhtml+xml'
    }, true).catch(() => null);
    if (!page || !/html/i.test(page.contentType)) continue;
    const metadata = pageImageMetadata(page.text, page.url);
    if (!metadata?.url || seen.has(metadata.url)) continue;
    const image = await safeImageFetch(metadata.url, maxImageBytes).catch(() => null);
    if (!image || seen.has(image.url)) continue;
    const dimensions = imageDimensions(image.body);
    if (!dimensions || dimensions.width < minImageWidth || dimensions.height < minImageHeight) continue;

    seen.add(image.url);
    const attribution = sourceAttribution(page.url);
    assets.push({
      id: `IMG${assets.length + 1}`,
      mimeType: image.contentType,
      dataUri: `data:${image.contentType};base64,${image.body.toString('base64')}`,
      sourceUrl: image.url,
      sourcePageUrl: page.url,
      alt: metadata.alt || source.title || 'Source image',
      attribution,
      width: dimensions.width,
      height: dimensions.height
    });
  }
  if (assets.length < maxAssets && imageQuery?.trim()) {
    const commonsAssets = await collectCommonsAssets(
      imageQuery,
      maxAssets - assets.length,
      seen
    ).catch(() => []);
    assets.push(...commonsAssets.map((asset, index) => ({
      ...asset,
      id: `IMG${assets.length + index + 1}`
    })));
  }
  if (assets.length > 0) {
    onStatus?.(`Using ${assets.length} source image${assets.length === 1 ? '' : 's'}`);
  }
  return assets;
}

type CommonsMetadataValue = { value?: string };

type CommonsImageInfo = {
  thumburl?: string;
  descriptionurl?: string;
  mime?: string;
  extmetadata?: Record<string, CommonsMetadataValue>;
};

type CommonsPage = {
  title?: string;
  imageinfo?: CommonsImageInfo[];
};

async function collectCommonsAssets(
  query: string,
  limit: number,
  seen: Set<string>
): Promise<ArtifactAsset[]> {
  const endpoint = new URL('https://commons.wikimedia.org/w/api.php');
  endpoint.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrnamespace: '6',
    gsrlimit: '20',
    gsrsearch: `${query.replace(/\s+/g, ' ').trim().slice(0, 160)} filetype:bitmap`,
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '1600'
  }).toString();
  const response = await safeWebFetch(endpoint.toString(), 500_000, {
    'User-Agent': 'DelegatorsWorkbench/1.0 (research image acquisition)',
    Accept: 'application/json'
  }, true);
  const payload = JSON.parse(response.text) as { query?: { pages?: CommonsPage[] } };
  const assets: ArtifactAsset[] = [];
  for (const page of payload.query?.pages ?? []) {
    if (assets.length >= limit) break;
    const info = page.imageinfo?.[0];
    if (!info?.thumburl || !info.descriptionurl || seen.has(info.thumburl)) continue;
    if (!/^image\/(?:png|jpeg)$/i.test(info.mime ?? '') || !/\.(?:png|jpe?g)$/i.test(page.title ?? '')) continue;
    if (!commonsResultMatchesQuery(page, query)) continue;
    const image = await safeImageFetch(info.thumburl, maxImageBytes).catch(() => null);
    if (!image || seen.has(image.url)) continue;
    const dimensions = imageDimensions(image.body);
    if (!dimensions || dimensions.width < minImageWidth || dimensions.height < minImageHeight) continue;
    const metadata = info.extmetadata ?? {};
    const attribution = commonsAttribution(metadata);
    if (!attribution) continue;
    seen.add(image.url);
    assets.push({
      id: '',
      mimeType: image.contentType,
      dataUri: `data:${image.contentType};base64,${image.body.toString('base64')}`,
      sourceUrl: image.url,
      sourcePageUrl: info.descriptionurl,
      alt: metadataText(metadata.ImageDescription) || page.title?.replace(/^File:/i, '') || 'Wikimedia Commons image',
      attribution,
      width: dimensions.width,
      height: dimensions.height
    });
  }
  return assets;
}

function pageImageMetadata(html: string, pageUrl: string): { url: string; alt?: string } | null {
  const metadata = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = parseAttributes(tag);
    const key = (attributes.property || attributes.name || '').toLowerCase();
    if (key && attributes.content) metadata.set(key, decodeHtml(attributes.content));
  }
  const rawUrl = metadata.get('og:image:secure_url')
    || metadata.get('og:image:url')
    || metadata.get('og:image')
    || metadata.get('twitter:image');
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl, pageUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return {
      url: url.toString(),
      alt: metadata.get('og:image:alt') || metadata.get('twitter:image:alt')
    };
  } catch {
    return null;
  }
}

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(tag)) !== null) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attributes;
}

function imageDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length >= 24 && buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
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
      if (length < 2) break;
      offset += 2 + length;
    }
  }
  return null;
}

function sourceAttribution(pageUrl: string): string {
  try {
    return new URL(pageUrl).hostname.replace(/^www\./, '');
  } catch {
    return pageUrl;
  }
}

function commonsAttribution(metadata: Record<string, CommonsMetadataValue>): string | null {
  const credit = metadataText(metadata.Credit);
  const artist = metadataText(metadata.Artist);
  const license = metadataText(metadata.LicenseShortName) || metadataText(metadata.UsageTerms);
  if (!license) return null;
  return [...new Set([credit || artist || 'Wikimedia Commons', license, 'Wikimedia Commons'])]
    .filter(Boolean)
    .join(' / ')
    .slice(0, 300);
}

function commonsResultMatchesQuery(page: CommonsPage, query: string): boolean {
  const description = metadataText(page.imageinfo?.[0]?.extmetadata?.ImageDescription);
  const haystack = `${page.title ?? ''} ${description}`.toLowerCase();
  const terms = query
    .toLowerCase()
    .match(/[a-z0-9]{4,}/g)
    ?.filter((term) => !['about', 'create', 'latest', 'report', 'presentation', 'slides', 'using', 'with'].includes(term))
    .slice(0, 8) ?? [];
  return terms.length === 0 || terms.some((term) => haystack.includes(term));
}

function metadataText(metadata: CommonsMetadataValue | undefined): string {
  if (!metadata?.value) return '';
  return decodeHtml(metadata.value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
    .slice(0, 300);
}
