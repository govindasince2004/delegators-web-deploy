import { describe, expect, it } from 'vitest';
import { buildWorkbenchClockContext } from '../server/clockContext.js';

describe('buildWorkbenchClockContext', () => {
  it('includes an authoritative UTC date and anti-snippet guidance', () => {
    const context = buildWorkbenchClockContext(new Date('2026-06-16T14:30:00.000Z'));
    expect(context).toContain('Tuesday, June 16, 2026');
    expect(context).toContain('2026-06-16T14:30:00.000Z');
    expect(context).toContain('answer from this clock');
    expect(context).toContain('not today\'s date');
  });
});