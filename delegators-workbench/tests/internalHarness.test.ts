import { describe, expect, it } from 'vitest';
import { fatherStatusForPhase, runFatherOrchestrated } from '../server/internalHarness';

describe('internal harness orchestration', () => {
  it('runs internal specialists in parallel without exposing roles', async () => {
    const started: number[] = [];
    const [left, right] = await runFatherOrchestrated([
      {
        role: 'research_scout',
        execute: async () => {
          started.push(1);
          await new Promise((resolve) => setTimeout(resolve, 20));
          return 'scout';
        }
      },
      {
        role: 'source_analyst',
        execute: async () => {
          started.push(2);
          await new Promise((resolve) => setTimeout(resolve, 20));
          return 'analyst';
        }
      }
    ], { concurrency: 2 });

    expect(left).toBe('scout');
    expect(right).toBe('analyst');
    expect(started).toEqual([1, 2]);
  });

  it('maps father-facing status labels from durable phases', () => {
    expect(fatherStatusForPhase('research')).toMatch(/sources/i);
    expect(fatherStatusForPhase('compose')).toMatch(/artifact/i);
  });
});