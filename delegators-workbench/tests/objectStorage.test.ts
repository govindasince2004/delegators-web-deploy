import { describe, expect, it, vi } from 'vitest';
import { mirrorWorkbenchObject } from '../server/objectStorage';

describe('Workbench object storage', () => {
  it('signs durable S3-compatible uploads when storage credentials are configured', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 200 }));

    const result = await mirrorWorkbenchObject(
      'runs/thread-1/versions/v1/report.pdf',
      Buffer.from('pdf-body'),
      'application/pdf',
      {
        env: {
          WORKBENCH_OBJECT_STORAGE_URL: 'https://account.r2.cloudflarestorage.com/workbench-artifacts',
          WORKBENCH_OBJECT_STORAGE_ACCESS_KEY: 'access-key',
          WORKBENCH_OBJECT_STORAGE_SECRET: 'secret-key',
          WORKBENCH_OBJECT_STORAGE_REGION: 'auto'
        },
        fetchImpl,
        now: new Date('2026-06-15T12:30:00.000Z')
      }
    );

    expect(result).toEqual({
      stored: true,
      url: 'https://account.r2.cloudflarestorage.com/workbench-artifacts/runs/thread-1/versions/v1/report.pdf'
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      result.url,
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          Authorization: expect.stringContaining('AWS4-HMAC-SHA256 Credential=access-key/20260615/auto/s3/aws4_request'),
          'Content-Type': 'application/pdf',
          'x-amz-content-sha256': expect.stringMatching(/^[a-f0-9]{64}$/),
          'x-amz-date': '20260615T123000Z'
        })
      })
    );
  });

  it('keeps the credential-free SeaweedFS filer upload path for local Compose', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 201 }));

    await mirrorWorkbenchObject('runs/thread-1/file.pdf', Buffer.from('pdf'), 'application/pdf', {
      env: { WORKBENCH_OBJECT_STORAGE_URL: 'http://object-storage:8888/workbench' },
      fetchImpl
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://object-storage:8888/workbench/runs/thread-1/file.pdf',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) })
    );
  });
});
