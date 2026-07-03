import { describe, expect, it } from 'vitest';
import {
  assessRunDepth,
  assessRunDepthWithContext,
  clampDepthTierToModel,
  providerRequestTimeoutMs,
  researchWaveCount,
  scaleToolBudgetForDepth,
  shouldCritiqueOutline,
  mapComposeConcurrency,
  fatherOrchestratorConcurrency,
  toolResultKeepCount
} from '../server/agenticDepth';
import { guardPreflightQuestions } from '../server/preflightGuard';
import { toActionStatus } from '../server/progressVoice';
import { briefAnswersQuestion, buildUserPromptContract } from '../server/userPromptContract';

describe('agentic depth orchestration', () => {
  it('escalates marathon and deep tiers from explicit brief signals', () => {
    expect(assessRunDepth('Write an exhaustive marathon white-paper on AI regulation')).toBe('marathon');
    expect(assessRunDepth('Create a comprehensive 12-slide investor-grade deck with citations')).toBe('deep');
    expect(assessRunDepth('Short thank-you email')).toBe('fast');
  });

  it('uses contextual signals and model ceilings when assessing depth', () => {
    const rich = assessRunDepthWithContext('Build a 10-slide board deck with citations on Acme Corp.', {
      kind: 'deck',
      needsResearch: true,
      hasReferences: true,
      priorArtifactCount: 1,
      model: 'swe-pro-thinking'
    });
    expect(rich.tier).toBe('deep');
    expect(rich.signals.length).toBeGreaterThan(2);

    const capped = assessRunDepthWithContext('Write an exhaustive marathon white-paper on AI regulation', {
      kind: 'report',
      model: 'swe-fast'
    });
    expect(capped.tier).toBe('standard');
    expect(clampDepthTierToModel('swe-fast', 'marathon')).toBe('standard');
    expect(clampDepthTierToModel('swe-pro-thinking', 'marathon')).toBe('marathon');
  });

  it('caps map compose and father orchestrator concurrency to the session stream limit', () => {
    expect(mapComposeConcurrency('deep', 2)).toBe(1);
    expect(mapComposeConcurrency('deep', 8)).toBe(4);
    expect(fatherOrchestratorConcurrency(2, 2)).toBe(1);
    expect(fatherOrchestratorConcurrency(8, 2)).toBe(2);
  });

  it('schedules extra research waves and outline critique only for deep runs', () => {
    expect(researchWaveCount('deep')).toBe(2);
    expect(researchWaveCount('marathon')).toBe(3);
    expect(shouldCritiqueOutline('deep')).toBe(true);
    expect(shouldCritiqueOutline('fast')).toBe(false);
    expect(shouldCritiqueOutline('standard', 'Create exactly 10 slides on SpaceX', 'deck')).toBe(true);
    expect(shouldCritiqueOutline('standard', 'Quick 4-slide update', 'deck')).toBe(false);
  });

  it('scales tool budgets and timeouts for long-horizon tiers', () => {
    const base = {
      maxToolCalls: 10,
      maxTerminalRuns: 2,
      maxWebRequests: 4,
      timeoutMs: 90_000,
      maxToolResultBytes: 10_000
    };
    expect(scaleToolBudgetForDepth(base, 'fast').maxToolCalls).toBe(10);
    expect(scaleToolBudgetForDepth(base, 'deep').maxToolCalls).toBeGreaterThan(10);
    expect(scaleToolBudgetForDepth(base, 'marathon').maxToolCalls).toBeGreaterThan(
      scaleToolBudgetForDepth(base, 'deep').maxToolCalls
    );
    expect(toolResultKeepCount('marathon')).toBeGreaterThan(toolResultKeepCount('fast'));
    expect(providerRequestTimeoutMs('marathon', 90_000)).toBeGreaterThan(providerRequestTimeoutMs('fast', 90_000));
  });

  it('filters stock preflight questions already answered by the brief', () => {
    const guarded = guardPreflightQuestions(
      'Create a 12-slide investor deck for the board with an executive tone.',
      [{
        id: 'audience',
        question: 'Who is the audience for this deck?',
        options: ['Investors', 'Students'],
        allowCustom: true
      }]
    );
    expect(guarded).toHaveLength(0);
  });

  it('strips thinking language from progress status', () => {
    expect(toActionStatus('Let me think about the competitor landscape')).toBe('About the competitor landscape');
  });

  it('builds a strict user prompt contract with must-honor constraints', () => {
    const contract = buildUserPromptContract('Create exactly 8 slides on SpaceX with charts and citations.', 'deck');
    expect(contract.constraints.slideCount).toBe(8);
    expect(contract.mustHonor.join(' ')).toMatch(/8 slides/i);
    expect(briefAnswersQuestion(contract.verbatimBrief, 'How many slides should this deck have?')).toBe(true);
  });
});