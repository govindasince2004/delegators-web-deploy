import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  persistTheme,
  readStoredTheme,
  toggleWorkbenchTheme
} from '../src/lib/theme';

describe('workbench theme', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      }
    });
  });

  it('defaults to dark and persists light selection', () => {
    expect(readStoredTheme()).toBe('dark');
    persistTheme('light');
    expect(readStoredTheme()).toBe('light');
  });

  it('toggles between dark and light', () => {
    expect(toggleWorkbenchTheme('dark')).toBe('light');
    expect(readStoredTheme()).toBe('light');
    expect(toggleWorkbenchTheme('light')).toBe('dark');
    expect(readStoredTheme()).toBe('dark');
  });
});