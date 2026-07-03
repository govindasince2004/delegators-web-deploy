import { describe, expect, it } from 'vitest';
import {
  briefIsExplicit,
  createRunPhaseTimer,
  deterministicPreflightReply,
  isBlockingPublishIssue,
  publishGateBlocks,
  resolveComposeModel,
  resolveRepairModel,
  outlineSchemaForKind,
  shouldSkipProviderInspection,
  shouldUseStructuredPipeline
} from '../server/artifactPipeline';

describe('artifact pipeline', () => {
  it('detects explicit briefs that should skip provider preflight', () => {
    const brief = [
      'Create a premium 12-slide investor-grade PowerPoint report.',
      'Hard rules:',
      '1. Use latest web research only.',
      '2. Every factual claim must have a source.',
      '3. Use real images.',
      '4. No fake charts.'
    ].join('\n');
    expect(briefIsExplicit(brief, 'deck')).toBe(true);
    expect(deterministicPreflightReply(brief, 'deck', 'pptx')).toContain(
      'production-grade'
    );
  });

  it('routes compose to fast lane and repair to thinking lane', () => {
    expect(resolveComposeModel('swe-fast')).toBe('swe-fast');
    expect(resolveComposeModel('dlg-light')).toBe('swe-fast');
    expect(resolveComposeModel('dlg-pro')).toBe('swe-pro');
    expect(resolveComposeModel('swe-pro-thinking')).toBe('swe-pro');
    expect(resolveRepairModel('dlg-pro')).toBe('swe-pro-thinking');
    expect(resolveRepairModel('swe-pro-thinking')).toBe('swe-pro-thinking');
    expect(resolveComposeModel('swe-ultra')).toBe('swe-ultra');
    expect(resolveRepairModel('swe-fast')).toBe('swe-fast-thinking');
  });

  it('uses structured pipeline for production artifact kinds', () => {
    expect(shouldUseStructuredPipeline('deck', '12-slide investor deck')).toBe(
      true
    );
    expect(
      shouldUseStructuredPipeline('report', 'quarterly operations review')
    ).toBe(true);
    expect(
      shouldUseStructuredPipeline(
        'resume',
        'Maya Rao experience education skills'
      )
    ).toBe(true);
    expect(shouldUseStructuredPipeline('email', 'short thank-you note')).toBe(
      false
    );
    expect(
      shouldUseStructuredPipeline(
        'sheet',
        'calculate forecast from this CSV dataset'
      )
    ).toBe(false);
  });

  it('skips provider inspection on explicit briefs that already pass local checks', () => {
    expect(
      shouldSkipProviderInspection({
        explicitBrief: true,
        localPassed: true,
        blockingIssues: []
      })
    ).toBe(true);
    expect(
      shouldSkipProviderInspection({
        explicitBrief: true,
        localPassed: false,
        blockingIssues: []
      })
    ).toBe(false);
    expect(
      shouldSkipProviderInspection({
        explicitBrief: true,
        localPassed: true,
        blockingIssues: [
          'The primary format is pdf, but the requested format is pptx.'
        ]
      })
    ).toBe(true);
  });

  it('returns kind-specific outline schemas', () => {
    expect(outlineSchemaForKind('resume')).toContain('resumePlan');
    expect(outlineSchemaForKind('sheet')).toContain('sheets');
  });

  it('blocks publication on hard gate issues', () => {
    expect(
      isBlockingPublishIssue(
        'The primary format is pdf, but the requested format is pptx.'
      )
    ).toBe(true);
    expect(
      isBlockingPublishIssue(
        'The user requested 12 slides, but the artifact contains 4.'
      )
    ).toBe(true);
    expect(
      isBlockingPublishIssue('The deck relies on too few layout patterns')
    ).toBe(false);
    expect(
      publishGateBlocks({
        passed: false,
        issues: [
          'The artifact asserts a merger that is not supported by evidence.'
        ]
      })
    ).toBe(true);
  });

  it('formats phased progress messages with elapsed seconds', () => {
    const timer = createRunPhaseTimer();
    timer.start('research');
    const message = timer.status('research', 'Reviewing 8 sources');
    expect(message).toMatch(/^Research · \d+s — Reviewing 8 sources$/);
  });

  it('summarizes completed phase timings for telemetry', () => {
    const timer = createRunPhaseTimer();
    timer.start('outline');
    timer.start('compose');
    expect(timer.startedPhases()).toEqual(['outline', 'compose']);
    expect(timer.formatSummary()).toMatch(/Outline \d+s · Compose \d+s/);
  });
});
