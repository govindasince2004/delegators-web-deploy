import { describe, expect, it } from 'vitest';
import { sanitizeStreamEvent } from '../server/streamSanitizer';

describe('stream sanitizer', () => {
  it('strips tool xml from message events', () => {
    const sanitized = sanitizeStreamEvent({
      type: 'message',
      text: '<tool_call>terminal_run</tool_call> Here is your deck outline.'
    });
    expect(sanitized.type).toBe('message');
    if (sanitized.type !== 'message') return;
    expect(sanitized.text).not.toContain('terminal_run');
    expect(sanitized.text).toContain('deck outline');
  });

  it('redacts secrets and truncates long status events', () => {
    const sanitized = sanitizeStreamEvent({
      type: 'status',
      message: `Let me think about Bearer sess_live_secret_key ${'x'.repeat(300)}`
    });
    expect(sanitized.type).toBe('status');
    if (sanitized.type !== 'status') return;
    expect(sanitized.message).not.toContain('sess_live_secret_key');
    expect(sanitized.message.length).toBeLessThanOrEqual(240);
  });

  it('maps internal errors to friendly client messages', () => {
    const sanitized = sanitizeStreamEvent({
      type: 'error',
      message: 'HTTP 429 Too Many Requests from upstream'
    });
    expect(sanitized.type).toBe('error');
    if (sanitized.type !== 'error') return;
    expect(sanitized.message).toMatch(/busy right now/i);
  });
});