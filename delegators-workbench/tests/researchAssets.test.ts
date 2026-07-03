import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../server/workbenchTools', () => ({
  safeWebFetch: vi.fn(),
  safeImageFetch: vi.fn()
}));

import { collectResearchAssets } from '../server/researchAssets';
import { safeImageFetch, safeWebFetch } from '../server/workbenchTools';

const mockedPageFetch = vi.mocked(safeWebFetch);
const mockedImageFetch = vi.mocked(safeImageFetch);

describe('research image assets', () => {
  beforeEach(() => {
    mockedPageFetch.mockReset();
    mockedImageFetch.mockReset();
  });

  it('downloads a validated Open Graph image with source attribution', async () => {
    mockedPageFetch.mockResolvedValue({
      url: 'https://example.com/news/product',
      contentType: 'text/html',
      text: '<meta property="og:image" content="/media/product.png"><meta property="og:image:alt" content="Product launch stage">'
    });
    mockedImageFetch.mockResolvedValue({
      url: 'https://example.com/media/product.png',
      contentType: 'image/png',
      body: pngHeader(1200, 675)
    });

    const assets = await collectResearchAssets([{
      title: 'Official product announcement',
      url: 'https://example.com/news/product'
    }]);

    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({
      id: 'IMG1',
      mimeType: 'image/png',
      sourcePageUrl: 'https://example.com/news/product',
      sourceUrl: 'https://example.com/media/product.png',
      alt: 'Product launch stage',
      width: 1200,
      height: 675
    });
    expect(assets[0]?.dataUri).toMatch(/^data:image\/png;base64,/);
  });

  it('rejects tiny page images that would render as logos or thumbnails', async () => {
    mockedPageFetch.mockResolvedValue({
      url: 'https://example.com/news/product',
      contentType: 'text/html',
      text: '<meta property="og:image" content="/logo.png">'
    });
    mockedImageFetch.mockResolvedValue({
      url: 'https://example.com/logo.png',
      contentType: 'image/png',
      body: pngHeader(120, 120)
    });

    await expect(collectResearchAssets([{
      title: 'Official product announcement',
      url: 'https://example.com/news/product'
    }])).resolves.toEqual([]);
  });

  it('fills remaining slots from Wikimedia Commons with license attribution', async () => {
    mockedPageFetch.mockResolvedValue({
      url: 'https://commons.wikimedia.org/w/api.php?action=query',
      contentType: 'application/json',
      text: JSON.stringify({
        query: {
          pages: [{
            title: 'File:Solar farm.jpg',
            imageinfo: [{
              thumburl: 'https://upload.wikimedia.org/solar-farm.jpg',
              thumbwidth: 1200,
              thumbheight: 800,
              mime: 'image/jpeg',
              descriptionurl: 'https://commons.wikimedia.org/wiki/File:Solar_farm.jpg',
              extmetadata: {
                ImageDescription: { value: 'Solar farm at sunset' },
                Artist: { value: '<a href="/wiki/User:Example">Example Author</a>' },
                LicenseShortName: { value: 'CC BY-SA 4.0' }
              }
            }]
          }]
        }
      })
    });
    mockedImageFetch.mockResolvedValue({
      url: 'https://upload.wikimedia.org/solar-farm.jpg',
      contentType: 'image/jpeg',
      body: jpegHeader(1200, 800)
    });

    const assets = await collectResearchAssets([], undefined, 'clean energy solar farm');

    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({
      id: 'IMG1',
      sourcePageUrl: 'https://commons.wikimedia.org/wiki/File:Solar_farm.jpg',
      alt: 'Solar farm at sunset',
      attribution: 'Example Author / CC BY-SA 4.0 / Wikimedia Commons'
    });
  });
});

function pngHeader(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(24);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(buffer, 0);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function jpegHeader(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(23);
  buffer[0] = 0xff;
  buffer[1] = 0xd8;
  buffer[2] = 0xff;
  buffer[3] = 0xc0;
  buffer.writeUInt16BE(17, 4);
  buffer[6] = 8;
  buffer.writeUInt16BE(height, 7);
  buffer.writeUInt16BE(width, 9);
  buffer[11] = 3;
  return buffer;
}
