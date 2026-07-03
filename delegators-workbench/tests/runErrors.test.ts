import { describe, expect, it } from 'vitest';
import {
  friendlyHttpError,
  friendlyRunError,
  isNetworkDelegatorsError,
  isTransientDelegatorsError
} from '../src/lib/runErrors';

describe('run error helpers', () => {
  it('detects transient rate-limit errors', () => {
    expect(isTransientDelegatorsError('Delegators endpoint returned HTTP 429')).toBe(true);
    expect(isTransientDelegatorsError('Too many requests. Retry in 12s.')).toBe(true);
    expect(isTransientDelegatorsError('Reconnect a valid sess_ key')).toBe(false);
  });

  it('maps raw 429 errors to a friendly message', () => {
    expect(friendlyRunError(new Error('Delegators endpoint returned HTTP 429'))).toMatch(/busy right now/i);
    expect(friendlyHttpError(429)).toMatch(/busy right now/i);
  });

  it('explains interrupted artifact runs after a server restart', () => {
    expect(friendlyRunError(new Error('Artifact task was interrupted.'))).toMatch(/send your request again/i);
  });

  it('maps network fetch failures to a retryable gateway message', () => {
    expect(isNetworkDelegatorsError('Failed to fetch')).toBe(true);
    expect(friendlyRunError(new TypeError('Failed to fetch'))).toMatch(/could not reach/i);
  });

  it('maps HTTP 503 to a busy message without leaving a raw status string', () => {
    expect(friendlyHttpError(503)).toMatch(/busy right now/i);
    expect(isTransientDelegatorsError(friendlyHttpError(503))).toBe(true);
  });
});