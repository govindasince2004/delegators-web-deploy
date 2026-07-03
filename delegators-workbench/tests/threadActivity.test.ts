import { describe, expect, it } from 'vitest';
import {
  appendActivityLog,
  isThreadWorking,
  latestActivityMessage,
  sanitizeHydratedThread,
} from '../src/lib/threadActivity';

describe('thread activity helpers', () => {
  it('detects active artifact and chat runs', () => {
    expect(isThreadWorking({ runStatus: 'running', runId: 'run-1' })).toBe(true);
    expect(isThreadWorking({ runStatus: 'completed', runId: 'run-1' })).toBe(false);
    expect(isThreadWorking(undefined)).toBe(false);
  });

  it('appends harness trace lines with a cap', () => {
    const next = appendActivityLog(['a'], 'Searching current sources');
    expect(next).toEqual(['a', 'Searching current sources']);
  });

  it('prefers the latest trace line for the breadcrumb', () => {
    expect(latestActivityMessage(['Planning', 'Finding source images'], 'Deck plan')).toBe('Finding source images');
  });

  it('clears orphaned chat turns left behind by reload', () => {
    const next = sanitizeHydratedThread({
      runStatus: 'running',
      messages: [{ role: 'user', text: 'hi' }],
      activityLog: ['Thinking']
    });
    expect(next.runStatus).toBeUndefined();
    expect(next.messages).toEqual([]);
    expect(next.activityLog).toEqual([]);
  });

  it('clears stale lone user messages even when run status was already cleared', () => {
    const next = sanitizeHydratedThread({
      messages: [{ role: 'user', text: 'hi' }],
      activityLog: ['Thinking']
    });
    expect(next.messages).toEqual([]);
    expect(next.activityLog).toEqual([]);
  });

  it('keeps artifact recovery threads with a pending request', () => {
    const next = sanitizeHydratedThread({
      runStatus: 'interrupted',
      pendingRequest: { operation: 'generate' },
      messages: [{ role: 'user', text: 'build a deck' }],
      activityLog: ['Planning your artifact']
    });
    expect(next.messages).toEqual([{ role: 'user', text: 'build a deck' }]);
    expect(next.runStatus).toBe('interrupted');
  });
});