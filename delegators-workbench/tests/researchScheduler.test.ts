import { describe, expect, it } from 'vitest';
import {
  scheduleResearchGapQueries,
  scheduleResearchQueries,
  tieredResearchSummary
} from '../server/researchScheduler';

describe('research scheduler', () => {
  it('schedules one deep and multiple fast queries', () => {
    const tiers = scheduleResearchQueries('Create a report on Project Glasswing by Anthropic with latest sources.', 'standard');
    expect(tiers).toHaveLength(5);
    expect(tiers.filter((tier) => tier.mode.startsWith('deep')).length).toBeGreaterThanOrEqual(1);
    expect(tieredResearchSummary(tiers)).toMatch(/deep \+ \d+ fast/);
  });

  it('adds gap-fill queries for later research waves', () => {
    const wave2 = scheduleResearchGapQueries('AI infrastructure market report', 2, ['anthropic.com']);
    expect(wave2.some((tier) => tier.label === 'competitors')).toBe(true);
  });
});