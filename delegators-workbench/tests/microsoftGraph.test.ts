import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MICROSOFT_GRAPH_READ_ONLY_ALLOWLIST,
  resolveAllowlistedGraphUrl
} from '../server/microsoftGraph';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Microsoft Graph wrapper', () => {
  it('exposes the read-only beta allowlist', () => {
    expect(MICROSOFT_GRAPH_READ_ONLY_ALLOWLIST).toEqual([
      'me/drive/root/children',
      'me/drive/items/{item_id}',
      'me/drive/items/{item_id}/content'
    ]);
  });

  it('resolves allowlisted OneDrive paths', () => {
    expect(resolveAllowlistedGraphUrl({ path: 'me/drive/root/children', query: { $top: '10' } }))
      .toBe('https://graph.microsoft.com/v1.0/me/drive/root/children?%24top=10');
    expect(resolveAllowlistedGraphUrl({ path: 'me/drive/items/{item_id}', item_id: 'abc123' }))
      .toBe('https://graph.microsoft.com/v1.0/me/drive/items/abc123');
  });

  it('blocks dangerous graph paths', () => {
    expect(() => resolveAllowlistedGraphUrl({ path: 'me/drive/root/children/delete' }))
      .toThrow(/not allowlisted/i);
    expect(() => resolveAllowlistedGraphUrl({ path: 'me/sendMail' }))
      .toThrow(/not allowlisted/i);
  });
});