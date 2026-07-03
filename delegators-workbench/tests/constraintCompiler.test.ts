import { describe, expect, it } from 'vitest';
import {
  compileBriefConstraints,
  requestedSlideCount,
  constraintsViolatedBySlideCount
} from '../server/constraintCompiler';
import { isBlockingPublishIssue, publishGateBlocks } from '../server/artifactPipeline';

describe('constraint compiler', () => {
  it('parses hyphenated slide counts', () => {
    expect(requestedSlideCount('Create a premium 12-slide investor deck')).toBe(12);
    expect(requestedSlideCount('Build exactly 8 slides on AI')).toBe(8);
    expect(requestedSlideCount('short deck')).toBeUndefined();
  });

  it('compiles hard rules and chart requirements', () => {
    const constraints = compileBriefConstraints(
      '12-slide deck with charts and citations.\n1. Use latest sources only.\n2. No fake metrics.',
      'deck'
    );
    expect(constraints.slideCount).toBe(12);
    expect(constraints.requiredCharts).toBe(true);
    expect(constraints.requiredCitations).toBe(true);
    expect(constraints.hardRules.length).toBeGreaterThanOrEqual(2);
  });

  it('flags slide count violations as blocking publish issues', () => {
    const issue = constraintsViolatedBySlideCount(4, 'Create a 12-slide deck');
    expect(issue).toMatch(/12 slides/i);
    expect(isBlockingPublishIssue(issue ?? '')).toBe(true);
    expect(publishGateBlocks({ passed: false, issues: [issue ?? ''] })).toBe(true);
  });
});