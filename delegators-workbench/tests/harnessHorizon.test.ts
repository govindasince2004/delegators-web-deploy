import { describe, expect, it } from 'vitest';
import {
  artifactQualityBoostLines,
  buildHorizonHarnessSeeds,
  horizonHarnessPromptLines
} from '../server/harnessHorizon';

describe('harnessHorizon', () => {
  it('returns no seeds or prompt lines for fast tier', () => {
    expect(buildHorizonHarnessSeeds('fast', 'deck', 'Short brief')).toEqual([]);
    expect(horizonHarnessPromptLines('fast')).toEqual([]);
    expect(artifactQualityBoostLines('fast', 'deck')).toEqual([]);
  });

  it('seeds quality rubric for standard tier', () => {
    const seeds = buildHorizonHarnessSeeds('standard', 'report', 'Quarterly business update');
    expect(seeds.map((seed) => seed.path)).toEqual(['harness/quality-rubric.md']);
    expect(seeds[0]?.content).toMatch(/Artifact quality rubric/);
    expect(horizonHarnessPromptLines('standard').join(' ')).toMatch(/quality-rubric/);
  });

  it('seeds horizon plan and outline for marathon tier', () => {
    const brief = 'Build a comprehensive investor deck with methodology and limitations.';
    const seeds = buildHorizonHarnessSeeds('marathon', 'deck', brief);
    expect(seeds.map((seed) => seed.path)).toEqual([
      'harness/quality-rubric.md',
      'harness/horizon-plan.md',
      'drafts/outline.md'
    ]);
    expect(seeds.find((seed) => seed.path === 'harness/horizon-plan.md')?.content).toMatch(/Phase 5/);
    expect(horizonHarnessPromptLines('marathon').join(' ')).toMatch(/LONG-HORIZON HARNESS/);
    expect(artifactQualityBoostLines('marathon', 'deck').join(' ')).toMatch(/Marathon quality/);
  });

  it('adds horizon plan for deep tier on long briefs', () => {
    const brief = 'x'.repeat(420);
    const seeds = buildHorizonHarnessSeeds('deep', 'sheet', brief);
    expect(seeds.map((seed) => seed.path)).toContain('harness/horizon-plan.md');
    expect(seeds.map((seed) => seed.path)).toContain('drafts/outline.md');
  });
});