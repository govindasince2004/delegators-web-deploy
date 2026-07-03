import { describe, expect, it } from 'vitest';
import { ArtifactDocumentSchema } from '../src/lib/shared';
import { prepareThreadArchive } from '../src/lib/threadStorage';

const artifact = ArtifactDocumentSchema.parse({
  kind: 'report',
  primaryFormat: 'pdf',
  title: 'Visual report',
  audience: 'Leadership',
  tone: 'Executive',
  executiveSummary: 'Summary',
  sections: [{ heading: 'Finding', body: 'Evidence', bullets: [], imageAssetId: 'IMG1' }],
  assets: [{
    id: 'IMG1',
    mimeType: 'image/png',
    dataUri: 'data:image/png;base64,AAAA',
    alt: 'Evidence image',
    attribution: 'Example source',
    width: 640,
    height: 360
  }]
});

const thread = {
  id: 'thread-1',
  title: 'Visual report',
  messages: [{
    id: 'message-1',
    role: 'assistant' as const,
    text: 'Done',
    artifact
  }],
  artifact,
  versions: [artifact],
  activeVersion: 0,
  pendingRequest: {
    operation: 'refine',
    instruction: 'Tighten this',
    artifact,
    references: [
      { kind: 'file', name: 'source.png', mimeType: 'image/png', dataBase64: 'AAAA' },
      { kind: 'text', text: 'Keep this source note.' }
    ]
  },
  updatedAt: 1
};

describe('thread storage', () => {
  it('deduplicates the active and message artifacts in the durable archive', () => {
    const [stored] = prepareThreadArchive([thread], true);

    expect(stored.artifact).toBeNull();
    expect(stored.messages[0]).not.toHaveProperty('artifact');
    expect(stored.versions[0].assets[0].dataUri).toContain('base64,AAAA');
  });

  it('strips binary artifact data from the synchronous localStorage fallback', () => {
    const [stored] = prepareThreadArchive([thread], false);

    expect(stored.versions[0].assets).toEqual([]);
    expect(stored.pendingRequest).toMatchObject({
      artifact: { assets: [] },
      references: [{ kind: 'text', text: 'Keep this source note.' }]
    });
    expect(JSON.stringify(stored)).not.toContain('base64,AAAA');
    expect(JSON.stringify(stored)).not.toContain('source.png');
  });

  it('keeps uploaded references in IndexedDB so failed runs can be retried', () => {
    const [stored] = prepareThreadArchive([thread], true);

    expect(stored.pendingRequest).toMatchObject({
      references: [
        { kind: 'file', name: 'source.png', dataBase64: 'AAAA' },
        { kind: 'text', text: 'Keep this source note.' }
      ]
    });
  });
});
