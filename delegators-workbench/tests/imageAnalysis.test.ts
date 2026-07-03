import { describe, expect, it, vi } from 'vitest';
import { analyzeImageWithoutPaid, buildNativeVisionPrompt } from '../server/imageAnalysis';

describe('no-paid image analysis', () => {
  it('requests a structured visual-system audit for native image analysis', () => {
    const prompt = buildNativeVisionPrompt('brand-board.png');

    expect(prompt).toContain('brand-board.png');
    expect(prompt).toMatch(/typeface|font/i);
    expect(prompt).toMatch(/hex/i);
    expect(prompt).toMatch(/grid|spacing/i);
    expect(prompt).toMatch(/observation/i);
    expect(prompt).toMatch(/artifact implications/i);
  });

  it('uses a configured self-hosted vision endpoint before OCR', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'A dashboard with three labeled bars.' } }]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));
    const runOcr = vi.fn(async () => {
      throw new Error('OCR should not run when self-hosted vision succeeds.');
    });

    const result = await analyzeImageWithoutPaid(
      Buffer.from('image'),
      'dashboard.png',
      'image/png',
      {
        env: {
          WORKBENCH_VISION_BASE_URL: 'http://vision.local:11434',
          WORKBENCH_VISION_MODEL: 'local-vision'
        },
        fetchImpl: fetchImpl as typeof fetch,
        runOcr
      }
    );

    expect(result).toEqual({
      extractor: 'self-hosted-vision',
      text: 'A dashboard with three labeled bars.',
      warnings: []
    });
    expect(runOcr).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://vision.local:11434/v1/chat/completions',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('falls back to local OCR without calling a paid service', async () => {
    const result = await analyzeImageWithoutPaid(
      Buffer.from('image'),
      'invoice.png',
      'image/png',
      {
        env: {},
        fetchImpl: vi.fn() as unknown as typeof fetch,
        runOcr: vi.fn(async () => 'Invoice total: $120.00')
      }
    );

    expect(result?.extractor).toBe('local-ocr');
    expect(result?.text).toContain('Invoice total: $120.00');
    expect(result?.warnings[0]).toContain('non-text visual details');
  });
});
