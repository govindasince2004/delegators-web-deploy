import { describe, expect, it } from 'vitest';
import { workbenchHarnessIdentity } from '../server/delegatorsHarness';

describe('original Delegators harness identity', () => {
  it('uses stable project and thread metadata for every Workbench model turn', () => {
    expect(workbenchHarnessIdentity('thread-board-review')).toEqual({
      project_id: 'delegators-workbench',
      thread_id: 'thread-board-review'
    });
  });

  it('hashes oversized or unsafe thread identifiers before sending them to the gateway', () => {
    const identity = workbenchHarnessIdentity('../'.repeat(80));

    expect(identity.project_id).toBe('delegators-workbench');
    expect(identity.thread_id).toMatch(/^wb-[a-f0-9]{32}$/);
  });
});
