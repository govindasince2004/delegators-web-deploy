import crypto from 'node:crypto';
import path from 'node:path';

export async function mirrorWorkbenchObject(
  objectPath: string,
  body: Buffer,
  contentType: string,
  options: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: typeof fetch;
    now?: Date;
  } = {}
): Promise<{ stored: boolean; url?: string }> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = env.WORKBENCH_OBJECT_STORAGE_URL?.trim();
  if (!endpoint) return { stored: false };
  const normalizedPath = objectPath
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
  if (!normalizedPath || objectPath.includes('..') || objectPath.includes('\0')) {
    throw new Error('Invalid Workbench object path.');
  }

  const target = `${endpoint.replace(/\/$/, '')}/${normalizedPath}`;
  const accessKey = env.WORKBENCH_OBJECT_STORAGE_ACCESS_KEY?.trim();
  const secretKey = env.WORKBENCH_OBJECT_STORAGE_SECRET?.trim();
  if (Boolean(accessKey) !== Boolean(secretKey)) {
    throw new Error('Workbench object storage requires both access key and secret.');
  }
  if (accessKey && secretKey) {
    return putSignedS3Object({
      target,
      body,
      contentType,
      accessKey,
      secretKey,
      region: env.WORKBENCH_OBJECT_STORAGE_REGION?.trim() || 'auto',
      fetchImpl,
      now: options.now ?? new Date()
    });
  }

  const form = new FormData();
  form.append('file', new Blob([Uint8Array.from(body)], { type: contentType }), path.posix.basename(objectPath));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetchImpl(target, {
      method: 'POST',
      signal: controller.signal,
      body: form
    });
    if (!response.ok) {
      const details = (await response.text()).slice(0, 500);
      throw new Error(`Object storage returned HTTP ${response.status}: ${details}`);
    }
    return { stored: true, url: target };
  } finally {
    clearTimeout(timer);
  }
}

async function putSignedS3Object(options: {
  target: string;
  body: Buffer;
  contentType: string;
  accessKey: string;
  secretKey: string;
  region: string;
  fetchImpl: typeof fetch;
  now: Date;
}): Promise<{ stored: true; url: string }> {
  const target = new URL(options.target);
  const amzDate = options.now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(options.body);
  const canonicalHeaders = [
    `content-type:${options.contentType}`,
    `host:${target.host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
    ''
  ].join('\n');
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    'PUT',
    target.pathname,
    target.searchParams.toString(),
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');
  const scope = `${dateStamp}/${options.region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256(canonicalRequest)
  ].join('\n');
  const signingKey = hmac(
    hmac(
      hmac(
        hmac(Buffer.from(`AWS4${options.secretKey}`, 'utf8'), dateStamp),
        options.region
      ),
      's3'
    ),
    'aws4_request'
  );
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await options.fetchImpl(target.toString(), {
      method: 'PUT',
      signal: controller.signal,
      headers: {
        Authorization: `AWS4-HMAC-SHA256 Credential=${options.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
        'Content-Type': options.contentType,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate
      },
      body: new Uint8Array(options.body)
    });
    if (!response.ok) {
      const details = (await response.text()).slice(0, 500);
      throw new Error(`Object storage returned HTTP ${response.status}: ${details}`);
    }
    return { stored: true, url: target.toString() };
  } finally {
    clearTimeout(timer);
  }
}

function sha256(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(key: Buffer, value: string): Buffer {
  return crypto.createHmac('sha256', key).update(value).digest();
}
