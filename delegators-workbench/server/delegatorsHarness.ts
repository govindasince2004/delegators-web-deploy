import crypto from 'node:crypto';

const safeThreadId = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/;

export function workbenchHarnessIdentity(threadId?: string): {
  project_id: string;
  thread_id: string;
} {
  const candidate = threadId?.trim() || 'default';
  const stableThread = safeThreadId.test(candidate) && !candidate.includes('..')
    ? candidate
    : `wb-${crypto.createHash('sha256').update(candidate).digest('hex').slice(0, 32)}`;
  return {
    project_id: 'delegators-workbench',
    thread_id: stableThread
  };
}
