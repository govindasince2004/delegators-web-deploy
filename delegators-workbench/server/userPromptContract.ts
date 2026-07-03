import { stripSkillTags } from '../src/lib/skills.js';
import type { ArtifactKind } from '../src/lib/shared.js';
import {
  compileBriefConstraints,
  constraintPromptLines,
  type CompiledConstraints
} from './constraintCompiler.js';

export type UserPromptContract = {
  verbatimBrief: string;
  constraints: CompiledConstraints;
  namedEntities: string[];
  forbiddenBehaviors: string[];
  mustHonor: string[];
  depthSignals: string[];
};

const oversmartTriggers = /\b(?:you decide|up to you|whatever you think|surprise me|be creative|use your judgment|your call)\b/i;
const strictTriggers = /\b(?:exactly|must|required|hard rules?|do not|never|only use|follow strictly|as specified)\b/i;

export function buildUserPromptContract(brief: string, kind?: ArtifactKind): UserPromptContract {
  const verbatimBrief = stripSkillTags(brief).trim();
  const constraints = compileBriefConstraints(verbatimBrief, kind);
  const namedEntities = extractNamedEntities(verbatimBrief);
  const depthSignals = extractDepthSignals(verbatimBrief);

  const mustHonor: string[] = [];
  if (constraints.slideCount) mustHonor.push(`Deliver exactly ${constraints.slideCount} slides.`);
  if (constraints.pageCount) mustHonor.push(`Target ${constraints.pageCount} pages of substantive content.`);
  if (constraints.sectionCount) mustHonor.push(`Deliver exactly ${constraints.sectionCount} sections.`);
  if (constraints.hardRules.length > 0) {
    mustHonor.push('Honor every numbered hard rule in the user brief.');
  }
  if (namedEntities.length > 0) {
    mustHonor.push(`Preserve these named subjects verbatim where relevant: ${namedEntities.join(', ')}.`);
  }

  const forbiddenBehaviors = [
    'Do not substitute a generic artifact that could have been written without reading the brief.',
    'Do not invent facts, metrics, mergers, funding rounds, dates, or citations.',
    'Do not add sections, slides, or topics the user did not ask for unless they serve an explicit brief constraint.',
    'Do not reframe the user\'s topic into a safer, vaguer, or more conventional substitute.',
    'Do not use placeholders, lorem ipsum, TBD, [Company], sample data, or plausible-but-fake numbers.',
    'Do not oversmart the user: if they specified structure, length, audience, or tone, follow it — do not "improve" by changing the assignment.',
    'Do not ask the user for preferences already stated in the brief.',
    'When a fact is missing, leave the field honest and add one concrete nextQuestions item — never fabricate.',
    'Do not write institutional hype copy: banned unless directly quoted from a source — “most consequential”, “unprecedented”, “new chapter”, “strategic analysis”, “paradigm shift”, “game-changing”.',
    'Do not simulate authority with anonymous expert voice (“analysts, researchers, and technology strategists”) — use sourceIds, citations, or honest UNVERIFIED labels.',
    'Do not ship researched work without citations[], a Sources appendix, methodology/limitations notes, confidence labels, and an as-of date.',
    'Do not publish empty template covers or one-paragraph openers with massive whitespace — design complete openers with scope, BLUF, and sourced substance.'
  ];

  if (!oversmartTriggers.test(verbatimBrief)) {
    forbiddenBehaviors.push('Do not expand scope beyond the brief unless research proves a named fact the user already referenced.');
  }
  if (strictTriggers.test(verbatimBrief)) {
    forbiddenBehaviors.push('This brief is strict: treat every explicit constraint as a publication gate.');
  }

  return {
    verbatimBrief,
    constraints,
    namedEntities,
    forbiddenBehaviors,
    mustHonor,
    depthSignals
  };
}

export function userPromptContractLines(contract: UserPromptContract): string[] {
  return [
    'USER PROMPT CONTRACT (binding):',
    `Verbatim brief:\n${contract.verbatimBrief}`,
    ...contract.mustHonor.map((line) => `- ${line}`),
    ...constraintPromptLines(contract.constraints),
    'Forbidden behaviors:',
    ...contract.forbiddenBehaviors.map((line) => `- ${line}`)
  ];
}

export function briefAnswersQuestion(brief: string, question: string): boolean {
  const clean = stripSkillTags(brief).toLowerCase();
  const q = question.toLowerCase();
  const probes: Array<[RegExp, RegExp]> = [
    [/\b(?:audience|for whom|who is this for)\b/i, /\b(?:audience|investor|board|student|client|executive|professor|beginner)\b/i],
    [/\b(?:tone|voice|style)\b/i, /\b(?:formal|casual|professional|executive|academic|confident|friendly)\b/i],
    [/\b(?:how many|slide count|number of slides)\b/i, /\b\d+\s*(?:-|–|\s)?\s*slides?\b/i],
    [/\b(?:color|palette|visual|design|branding)\b/i, /\b(?:palette|color|visual|design|template|editorial|slate|indigo|brand)\b/i],
    [/\b(?:length|how long|page count)\b/i, /\b\d+\s*(?:-|–|\s)?\s*pages?\b/i],
    [/\b(?:topic|subject|about what)\b/i, /\b(?:on|about|covering|focused on)\s+\S{3,}/i]
  ];
  return probes.some(([questionPattern, briefPattern]) => questionPattern.test(q) && briefPattern.test(clean));
}

function extractNamedEntities(brief: string): string[] {
  const quoted = [...brief.matchAll(/["']([^"']{3,80})["']/g)].map((match) => match[1].trim());
  const proper = [...brief.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/g)]
    .map((match) => match[1].trim())
    .filter((value) => !/^(Create|Build|Write|Make|Please|The|This|That|Every|Each|Hard|Slide|Page)$/i.test(value));
  return [...new Set([...quoted, ...proper])].slice(0, 12);
}

function extractDepthSignals(brief: string): string[] {
  const signals: string[] = [];
  if (/\b(?:comprehensive|exhaustive|in[- ]depth|deep(?:ly)?|thorough|detailed|extensive|marathon|hours?)\b/i.test(brief)) {
    signals.push('depth');
  }
  if (/\b(?:latest|current|cite|citations?|sources?|research)\b/i.test(brief)) {
    signals.push('research');
  }
  if (/\b(?:compare|comparison|versus|vs\.?|landscape|competitive)\b/i.test(brief)) {
    signals.push('comparison');
  }
  if (/\b(?:chart|graph|data|metrics?|statistics?)\b/i.test(brief)) {
    signals.push('data-viz');
  }
  return signals;
}