import { workbenchFetch } from './account.js';
import { friendlyHttpError } from './runErrors.js';

type ApiError = { error?: string; details?: string };

export function isTransientHttpStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504 || status >= 500;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(attempt: number, response?: Response): number {
  const retryAfter = response?.headers.get('Retry-After');
  if (retryAfter) {
    const seconds = Number.parseInt(retryAfter, 10);
    if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 12_000);
  }
  return Math.min(2000 * (attempt + 1), 8000);
}

/** Retry transient HTTP failures without surfacing intermediate errors to the UI. */
export async function quietWorkbenchFetch(
  path: string,
  init: RequestInit = {},
  options: { maxAttempts?: number; signal?: AbortSignal } = {}
): Promise<Response> {
  const maxAttempts = options.maxAttempts ?? 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (options.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const response = await workbenchFetch(path, { ...init, signal: options.signal });
    if (response.ok) return response;

    const payload = (await response.clone().json().catch(() => ({}))) as ApiError;
    const message = friendlyHttpError(response.status, payload.details || payload.error);
    lastError = new Error(message);

    if (!isTransientHttpStatus(response.status) || attempt === maxAttempts - 1) {
      throw lastError;
    }

    await sleep(retryDelayMs(attempt, response));
  }

  throw lastError ?? new Error('Request failed.');
}