import { describe, expect, it } from 'vitest';
import { attachResearchAssets } from '../server/artifactAssets';
import { ArtifactDocumentSchema } from '../src/lib/shared';

const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKAQMAAAC3/F3+AAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAAGUExURf8AAP///0EdNBEAAAABYktHRAH/Ai3eAAAAB3RJTUUH6gYOETEOKJXzJQAAAAtJREFUCNdjYMAHAAAeAAFuhUcyAAAAAElFTkSuQmCC';

describe('artifact research assets', () => {
  it('attaches only validated assets and places them when the model omits placement', () => {
    const artifact = ArtifactDocumentSchema.parse({
      kind: 'deck',
      primaryFormat: 'pptx',
      title: 'Launch research',
      audience: 'Leadership',
      tone: 'executive',
      sections: [{ heading: 'Launch', body: 'Current launch findings.', bullets: [] }],
      slides: [
        { title: 'Launch', bullets: ['Current launch findings.'] },
        { title: 'Evidence', bullets: ['Official announcement details.'] }
      ]
    });

    const enriched = attachResearchAssets(artifact, [{
      id: 'IMG1',
      mimeType: 'image/png',
      dataUri,
      sourceUrl: 'https://example.com/launch.png',
      sourcePageUrl: 'https://example.com/news/launch',
      alt: 'Launch stage',
      attribution: 'example.com',
      width: 1200,
      height: 675
    }]);

    expect(enriched.assets).toHaveLength(1);
    expect(enriched.slides?.some((slide) => slide.imageAssetId === 'IMG1')).toBe(true);
  });

  it('drops model-supplied dangling image identifiers', () => {
    const artifact = ArtifactDocumentSchema.parse({
      kind: 'report',
      primaryFormat: 'pdf',
      title: 'Launch research',
      audience: 'Leadership',
      tone: 'executive',
      sections: [{
        heading: 'Launch',
        body: 'Current launch findings.',
        bullets: [],
        imageAssetId: 'NOT_AVAILABLE'
      }]
    });

    const enriched = attachResearchAssets(artifact, []);
    expect(enriched.sections[0]?.imageAssetId).toBeUndefined();
    expect(enriched.assets).toEqual([]);
  });
});
