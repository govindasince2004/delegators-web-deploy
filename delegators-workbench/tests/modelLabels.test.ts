import { describe, expect, it } from 'vitest';
import { displayModelName } from '../src/lib/modelLabels';

describe('model display labels', () => {
  it('maps public and compatibility aliases to Pro names', () => {
    expect(displayModelName('dlg-light')).toBe('Light thinking');
    expect(displayModelName('dlg-pro')).toBe('Pro thinking');
    expect(displayModelName('swe-fast')).toBe('Pro fast');
    expect(displayModelName('swe-fast-thinking')).toBe('Pro fast thinking');
    expect(displayModelName('swe-pro')).toBe('Pro');
    expect(displayModelName('swe-pro-thinking')).toBe('Pro thinking');
    expect(displayModelName('swe-ultra')).toBe('UltraSpeed');
  });
});
