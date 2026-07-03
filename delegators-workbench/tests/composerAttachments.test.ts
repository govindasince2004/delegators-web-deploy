import { describe, expect, it } from 'vitest';
import {
  buildSubmitPrompt,
  composerPreviewHeight,
  imageAttachmentToken,
  refsReferencedInPrompt
} from '../src/lib/composerAttachments';

describe('composer attachments', () => {
  it('builds submit text with tokens only when the message is sent', () => {
    expect(buildSubmitPrompt('analyze this', [
      {
        id: 'a',
        kind: 'file',
        name: 'chart.png',
        imageIndex: 1,
        mimeType: 'image/png',
        dataBase64: 'abc'
      },
      {
        id: 'b',
        kind: 'file',
        name: 'notes.pdf',
        mimeType: 'application/pdf',
        dataBase64: 'def'
      }
    ])).toBe(`analyze this\n${imageAttachmentToken(1)}\nattached file 📁 notes.pdf`);
  });

  it('keeps references aligned with generated submit tokens', () => {
    const prompt = buildSubmitPrompt('hello', [
      {
        id: 'a',
        kind: 'file',
        name: 'chart.png',
        imageIndex: 1,
        mimeType: 'image/png',
        dataBase64: 'abc'
      }
    ]);
    const refs = refsReferencedInPrompt([
      {
        id: 'a',
        kind: 'file',
        name: 'chart.png',
        imageIndex: 1,
        mimeType: 'image/png',
        dataBase64: 'abc'
      }
    ], prompt);
    expect(refs).toHaveLength(1);
  });

  it('shrinks composer previews as more images are attached', () => {
    expect(composerPreviewHeight(1)).toBeGreaterThan(composerPreviewHeight(4));
  });
});