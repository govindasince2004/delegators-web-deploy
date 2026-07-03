import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('MarkItDown reference conversion', () => {
  it('uses the configured private sidecar before built-in document extractors', async () => {
    vi.stubEnv('WORKBENCH_MARKITDOWN_URL', 'http://markitdown:8490');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      markdown: '# Uploaded brief\n\n| Metric | Value |\n|---|---|\n| Growth | 42% |'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { prepareReferencePack } = await import('../server/references');

    const pack = await prepareReferencePack({
      brief: 'Analyze the upload first.',
      references: [{
        kind: 'file',
        name: 'brief.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        dataBase64: Buffer.from('document-bytes').toString('base64')
      }]
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://markitdown:8490/convert',
      expect.objectContaining({ method: 'POST' })
    );
    expect(pack?.references[0]?.extractor).toBe('markitdown');
    expect(pack?.markdown).toContain('| Growth | 42% |');
  });
});
