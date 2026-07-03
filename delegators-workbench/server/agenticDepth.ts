import type { ArtifactKind } from '../src/lib/shared.js';
import { briefIsExplicit } from './artifactPipeline.js';
import { compileBriefConstraints, requestedSlideCount } from './constraintCompiler.js';
import { buildUserPromptContract, userPromptContractLines } from './userPromptContract.js';
import { effectiveLlmConcurrency } from './sessionLimits.js';

type DepthToolBudget = {
  maxToolCalls: number;
  maxTerminalRuns: number;
  maxWebRequests: number;
  timeoutMs: number;
  maxToolResultBytes: number;
};

export type RunDepthTier = 'fast' | 'standard' | 'deep' | 'marathon';

const tierRank: Record<RunDepthTier, number> = {
  fast: 0,
  standard: 1,
  deep: 2,
  marathon: 3
};

export type AssessRunDepthContext = {
  kind?: ArtifactKind;
  needsResearch?: boolean;
  hasReferences?: boolean;
  priorArtifactCount?: number;
  requiresComputation?: boolean;
  model?: string;
};

export type RunDepthAssessment = {
  tier: RunDepthTier;
  score: number;
  signals: string[];
};

export function assessRunDepth(brief: string, kind?: ArtifactKind): RunDepthTier {
  return assessRunDepthWithContext(brief, { kind }).tier;
}

export function assessRunDepthWithContext(
  brief: string,
  context: AssessRunDepthContext = {}
): RunDepthAssessment {
  const clean = brief.trim();
  const kind = context.kind;
  const constraints = compileBriefConstraints(clean, kind);
  const contract = buildUserPromptContract(clean, kind);
  const slideCount = constraints.slideCount ?? requestedSlideCount(clean) ?? 0;
  const pageCount = constraints.pageCount ?? 0;
  const sectionCount = constraints.sectionCount ?? 0;
  let score = 0;
  const signals: string[] = [];

  const bump = (points: number, signal: string) => {
    score += points;
    signals.push(signal);
  };

  if (/\b(?:marathon|multi[- ]hour|all day|exhaustive|encyclopedic|white[- ]paper|thesis|dissertation)\b/i.test(clean)) {
    bump(42, 'marathon-scope language');
  }
  if (/\b(?:comprehensive|in[- ]depth|deep(?:ly)?|thorough|detailed|extensive|board[- ]ready|investor[- ]grade)\b/i.test(clean)) {
    bump(24, 'depth language');
  }
  if (clean.length >= 900) bump(20, 'very long brief');
  else if (clean.length >= 500) bump(12, 'long brief');
  else if (clean.length >= 320) bump(6, 'medium brief');

  if (slideCount >= 16) bump(22, `${slideCount}-slide deck`);
  else if (slideCount >= 12) bump(18, `${slideCount}-slide deck`);
  else if (slideCount >= 10) bump(12, `${slideCount}-slide deck`);
  else if (slideCount >= 8) bump(10, `${slideCount}-slide deck`);

  if (pageCount >= 10) bump(14, `${pageCount}-page deliverable`);
  else if (pageCount >= 6) bump(8, `${pageCount}-page deliverable`);

  if (sectionCount >= 8) bump(10, `${sectionCount} sections`);
  else if (sectionCount >= 5) bump(6, `${sectionCount} sections`);

  if (constraints.hardRules.length >= 4 && briefIsExplicit(clean, kind)) bump(12, 'explicit hard rules');
  else if (constraints.hardRules.length >= 2) bump(6, 'numbered constraints');

  if (constraints.exactCounts) bump(8, 'exact-count requirement');
  if (constraints.requiredCitations) bump(8, 'citations required');
  if (constraints.requiredCharts) bump(6, 'charts required');
  if (context.needsResearch) bump(6, 'live research needed');
  if (context.hasReferences) bump(5, 'uploaded references');
  if (context.requiresComputation) bump(8, 'computation or tables');
  if ((context.priorArtifactCount ?? 0) > 0) bump(8, 'thread continuation');

  if (kind === 'deck' || kind === 'report' || kind === 'assignment' || kind === 'sheet') {
    bump(4, `${kind} artifact`);
  }
  if (contract.namedEntities.length >= 3) bump(5, 'multi-entity brief');

  for (const depthSignal of contract.depthSignals) {
    if (depthSignal === 'depth') bump(4, 'depth signal');
    if (depthSignal === 'research') bump(4, 'research signal');
    if (depthSignal === 'comparison') bump(6, 'comparison signal');
    if (depthSignal === 'data-viz') bump(4, 'data-viz signal');
  }

  let tier: RunDepthTier = 'fast';
  if (score >= 72 || signals.includes('marathon-scope language')) tier = 'marathon';
  else if (score >= 46) tier = 'deep';
  else if (score >= 22) tier = 'standard';

  if (context.model) {
    const capped = clampDepthTierToModel(context.model, tier);
    if (capped !== tier) {
      signals.push(`capped to ${capped} for ${context.model}`);
      tier = capped;
    }
  }

  return { tier, score, signals: [...new Set(signals)] };
}

export function clampDepthTierToModel(model: string, tier: RunDepthTier): RunDepthTier {
  const lower = model.toLowerCase();
  const maxTier: RunDepthTier = lower.includes('ultra') || (lower.includes('pro') && lower.includes('thinking'))
    ? 'marathon'
    : lower.includes('pro') || lower.includes('thinking')
      ? 'deep'
      : 'standard';
  return tierRank[tier] > tierRank[maxTier] ? maxTier : tier;
}

export function depthExecutionBrief(tier: RunDepthTier, signals: string[] = []): string[] {
  const signalLine = signals.length > 0
    ? `Depth signals: ${signals.slice(0, 6).join('; ')}.`
    : '';
  switch (tier) {
    case 'marathon':
      return [
        'RUN DEPTH: marathon — treat this as an extended production assignment.',
        'Work in phases: research synthesis → outline lock → section/slide composition → validation → export readiness.',
        'Prefer verified sources, explicit calculations, and complete deliverables over speed.',
        signalLine
      ].filter(Boolean);
    case 'deep':
      return [
        'RUN DEPTH: deep — this brief needs thorough research, structure, and evidence binding.',
        'Do not shortcut outline quality, citation coverage, or numeric accuracy.',
        signalLine
      ].filter(Boolean);
    case 'standard':
      return [
        'RUN DEPTH: standard — deliver a complete artifact with correct scope and polish.',
        signalLine
      ].filter(Boolean);
    default:
      return [
        'RUN DEPTH: fast — keep the response tight while still honoring explicit constraints.',
        signalLine
      ].filter(Boolean);
  }
}

export function researchWaveCount(tier: RunDepthTier): number {
  switch (tier) {
    case 'marathon': return 3;
    case 'deep': return 2;
    case 'standard': return 1;
    default: return 1;
  }
}

export function researchSourceCap(tier: RunDepthTier): number {
  switch (tier) {
    case 'marathon': return 16;
    case 'deep': return 12;
    case 'standard': return 10;
    default: return 8;
  }
}

export function researchFetchBytes(tier: RunDepthTier): number {
  switch (tier) {
    case 'marathon': return 32_000;
    case 'deep': return 24_000;
    default: return 16_000;
  }
}

export function mapComposeConcurrency(tier: RunDepthTier, streamLimit?: number): number {
  const tierCap = tier === 'marathon' || tier === 'deep' ? 4 : 4;
  return effectiveLlmConcurrency(streamLimit, tierCap);
}

export function fatherOrchestratorConcurrency(streamLimit: number | undefined, requested = 2): number {
  return effectiveLlmConcurrency(streamLimit, requested);
}

export function shouldCritiqueOutline(tier: RunDepthTier, brief?: string, kind?: ArtifactKind): boolean {
  if (tier === 'deep' || tier === 'marathon') return true;
  if (!brief) return false;
  const constraints = compileBriefConstraints(brief, kind);
  const slideCount = constraints.slideCount ?? requestedSlideCount(brief) ?? 0;
  return slideCount >= 10 || (briefIsExplicit(brief, kind) && slideCount >= 8);
}

export function depthStatusLabel(tier: RunDepthTier): string {
  switch (tier) {
    case 'marathon': return 'Extended production run';
    case 'deep': return 'Deep production run';
    case 'standard': return 'Production run';
    default: return 'Fast production run';
  }
}

export function scaleToolBudgetForDepth<T extends DepthToolBudget>(budget: T, tier: RunDepthTier): T {
  switch (tier) {
    case 'marathon':
      return {
        ...budget,
        maxToolCalls: Math.min(Math.round(budget.maxToolCalls * 1.75), 24),
        maxTerminalRuns: Math.min(budget.maxTerminalRuns + 2, 6),
        maxWebRequests: Math.min(budget.maxWebRequests + 1, 8),
        timeoutMs: Math.min(Math.round(budget.timeoutMs * 2), 240_000),
        maxToolResultBytes: Math.min(budget.maxToolResultBytes + 4_000, 20_000)
      };
    case 'deep':
      return {
        ...budget,
        maxToolCalls: Math.min(Math.round(budget.maxToolCalls * 1.4), 18),
        maxTerminalRuns: Math.min(budget.maxTerminalRuns + 1, 5),
        timeoutMs: Math.min(Math.round(budget.timeoutMs * 1.5), 180_000),
        maxToolResultBytes: Math.min(budget.maxToolResultBytes + 2_000, 18_000)
      };
    case 'standard':
      return {
        ...budget,
        maxToolCalls: Math.min(Math.round(budget.maxToolCalls * 1.15), 14),
        timeoutMs: Math.min(Math.round(budget.timeoutMs * 1.2), 150_000),
        maxToolResultBytes: Math.min(budget.maxToolResultBytes + 1_000, 16_000)
      };
    default:
      return budget;
  }
}

export function toolResultKeepCount(tier: RunDepthTier): number {
  switch (tier) {
    case 'marathon': return 8;
    case 'deep': return 6;
    case 'standard': return 5;
    default: return 4;
  }
}

export function providerRequestTimeoutMs(tier: RunDepthTier, baseMs: number): number {
  const base = Math.max(baseMs, 45_000);
  switch (tier) {
    case 'marathon': return Math.min(Math.round(base * 2), 180_000);
    case 'deep': return Math.min(Math.round(base * 1.5), 135_000);
    case 'standard': return Math.min(Math.round(base * 1.2), 108_000);
    default: return base;
  }
}

export function harnessDepthGuidance(tier: RunDepthTier): string[] {
  if (tier === 'fast') return [];
  if (tier === 'standard') {
    return [
      'This is a standard production run: finish the artifact in deliberate phases and checkpoint workspace files before large transforms.'
    ];
  }
  return [
    'This is a long-horizon production run: work in deliberate phases, checkpoint workspace files before large transforms, and use terminal_run for computations instead of guessing.',
    'Prioritize a complete artifact over exploratory tool churn. If a step fails, retry with a smaller scope before burning the remaining tool budget.',
    'When research/source-pack.md exists, mine it thoroughly before requesting more web calls.'
  ];
}

export function buildOutlineCritiqueMessages(options: {
  artifactKind: ArtifactKind;
  cleanBrief: string;
  outlineJson: string;
  combinedSourceText: string;
}): Array<{ role: string; content: string }> {
  const contract = buildUserPromptContract(options.cleanBrief, options.artifactKind);
  return [
    {
      role: 'system',
      content: [
        'You are the Delegators Workbench outline critic.',
        'Return only revised outline JSON in the same schema as the input.',
        'Fix slide/section count mismatches, weak narrative arc, repetitive roles, and topic-label titles.',
        'Increase layout diversity without changing the user\'s requested scope.',
        'Never add content the user did not ask for. Never remove explicit user constraints.',
        'Do not reveal reasoning — output the corrected outline only.',
        ...userPromptContractLines(contract)
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        `Kind: ${options.artifactKind}`,
        options.combinedSourceText ? `Sources:\n${options.combinedSourceText}` : '',
        `Current outline:\n${options.outlineJson}`
      ].filter(Boolean).join('\n\n')
    }
  ];
}