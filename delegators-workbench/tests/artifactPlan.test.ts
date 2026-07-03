import { describe, expect, it } from 'vitest';
import { advanceArtifactPlan, buildArtifactPlan, requiresToolHarness } from '../server/artifactPlan';
import { fallbackArtifactPreflight } from '../server/artifactPreflight';

describe('artifact run plans', () => {
  it('builds a request-specific presentation plan instead of fixed harness stages', () => {
    const plan = buildArtifactPlan('deck', 'regarding how to form a team', false, { structured: true });

    expect(plan.title.toLowerCase()).toBe('working through the artifact brief');
    expect(plan.items).toHaveLength(4);
    expect(plan.items.map((item) => item.id)).toContain('outline');
    expect(plan.items[0]?.detail?.toLowerCase()).toContain('form a team');
    expect(plan.items.map((item) => item.label)).not.toEqual(
      expect.arrayContaining(['Understand', 'Verify', 'Create', 'Inspect', 'Prepare'])
    );
    // The scripted 'clarify' step is gone: questions exist only when the model asks.
    expect(plan.items.map((item) => item.id)).not.toContain('clarify');
    expect(plan.items[0]?.status).toBe('active');
  });

  it('advances one plan item at a time and completes earlier work', () => {
    const plan = buildArtifactPlan('report', 'a quarterly operations review', true);
    const advanced = advanceArtifactPlan(plan, 2);

    expect(advanced.items.map((item) => item.status)).toEqual(['done', 'done', 'active', 'pending']);
  });

  it('never asks scripted clarification questions in the fallback preflight', () => {
    // Clarification is the model's judgment call (provider preflight). The
    // fallback path must build silently instead of firing canned popups.
    const preflight = fallbackArtifactPreflight(
      'deck',
      'create a good ppt with great design no generic color and the topic is how to teach ai',
      false
    );

    expect(preflight.questions).toEqual([]);
    expect(preflight.source).toBe('fallback');
  });

  it('makes the workspace harness available for substantive downloadable artifacts', () => {
    expect(requiresToolHarness('deck', 'regarding how to form a team')).toBe(true);
    expect(requiresToolHarness('report', 'write a report using these verified sources')).toBe(true);
    expect(requiresToolHarness('sheet', 'build a hiring budget workbook with formulas')).toBe(true);
    expect(requiresToolHarness('report', 'calculate projections from this CSV dataset')).toBe(true);
    expect(requiresToolHarness('email', 'write a short thank-you note')).toBe(false);
  });
});
