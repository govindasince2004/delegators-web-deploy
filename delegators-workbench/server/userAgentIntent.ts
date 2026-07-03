import { stripSkillTags } from '../src/lib/skills.js';
import type { ArtifactKind } from '../src/lib/shared.js';
import type { RunDepthTier } from './agenticDepth.js';
import { briefRequiresComputation } from './artifactPipeline.js';
import { compileBriefConstraints } from './constraintCompiler.js';
import { buildUserPromptContract } from './userPromptContract.js';
import { isGoogleWorkspaceEnabled } from './googleWorkspace.js';
import { isMicrosoft365Enabled } from './microsoftGraph.js';
import { personalKnowledgeAvailable } from './personalKnowledge.js';

export type UserAgentMode = 'strict' | 'guided' | 'autonomous';

export type UserAgentGoal =
  | 'produce-deliverable'
  | 'research-heavy'
  | 'data-compute'
  | 'template-fill'
  | 'cloud-continue'
  | 'refine-targeted';

export type UserAgentIntent = {
  mode: UserAgentMode;
  goal: UserAgentGoal;
  primaryObjective: string;
  successCriteria: string[];
  toolPlaybook: string[];
  phasePriorities: string[];
  avoidBehaviors: string[];
  autonomyNotes: string[];
};

export type HarnessSeedFile = {
  path: string;
  content: string;
};

const oversmartTriggers = /\b(?:you decide|up to you|whatever you think|surprise me|be creative|use your judgment|your call|figure out|work through|investigate|find out)\b/i;
const strictTriggers = /\b(?:exactly|must|required|hard rules?|do not|never|only use|follow strictly|as specified)\b/i;
const cloudTriggers = /\b(?:google drive|googledocs?|google sheets?|onedrive|sharepoint|office 365|microsoft 365|my docs?|my drive|cloud file|connected)\b/i;
const personalTriggers = /\b(?:my files?|my documents?|uploaded|attached|prior work|saved memory|personal knowledge|from my)\b/i;
const refineTriggers = /\b(?:fix|change|update|revise|rewrite|shorten|lengthen|slide\s+\d+|section\s+\d+|replace)\b/i;

export function deriveUserAgentIntent(options: {
  brief: string;
  kind?: ArtifactKind;
  depthTier: RunDepthTier;
  needsResearch?: boolean;
  hasReferences?: boolean;
  hasResearchPack?: boolean;
  hasPersonalKnowledgeSeed?: boolean;
  templateFill?: boolean;
  wpsTemplate?: boolean;
  threadMode?: 'new' | 'refine' | 'reuse-content' | 'template-fill';
  ownerSubject?: string;
  env?: NodeJS.ProcessEnv;
}): UserAgentIntent {
  const env = options.env ?? process.env;
  const clean = stripSkillTags(options.brief).trim();
  const contract = buildUserPromptContract(clean, options.kind);
  const constraints = compileBriefConstraints(clean, options.kind);
  const mode: UserAgentMode = strictTriggers.test(clean)
    ? 'strict'
    : oversmartTriggers.test(clean)
      ? 'autonomous'
      : 'guided';

  const cloudEnabled = isGoogleWorkspaceEnabled(env) || isMicrosoft365Enabled(env);
  const knowledgeEnabled = personalKnowledgeAvailable(env) && Boolean(options.ownerSubject?.trim());
  const mentionsCloud = cloudTriggers.test(clean);
  const mentionsPersonal = personalTriggers.test(clean) || Boolean(options.hasReferences) || Boolean(options.hasPersonalKnowledgeSeed);
  const computation = briefRequiresComputation(clean) || constraints.requiredCharts;
  const refine = options.threadMode === 'refine' || (options.threadMode !== 'template-fill' && refineTriggers.test(clean) && clean.length < 420);

  let goal: UserAgentGoal = 'produce-deliverable';
  if (options.templateFill) goal = 'template-fill';
  else if (refine) goal = 'refine-targeted';
  else if (mentionsCloud && cloudEnabled) goal = 'cloud-continue';
  else if (computation) goal = 'data-compute';
  else if (options.needsResearch || contract.depthSignals.includes('research') || options.hasResearchPack) goal = 'research-heavy';

  const topic = extractTopic(clean);
  const primaryObjective = goal === 'refine-targeted'
    ? `Apply the user's revision instruction precisely: ${truncate(clean, 220)}`
    : goal === 'template-fill'
      ? `Fill the template skeleton with user facts while preserving structure for ${options.kind ?? 'artifact'}.`
      : `Deliver a ${options.kind ?? 'production'} artifact about ${topic} that satisfies the verbatim user brief.`;

  const successCriteria = [
    'Honor every explicit constraint in input/brief.md and the user prompt contract.',
    constraints.slideCount ? `Exactly ${constraints.slideCount} slides.` : '',
    constraints.pageCount ? `Substantive content for ~${constraints.pageCount} pages.` : '',
    constraints.sectionCount ? `Exactly ${constraints.sectionCount} sections.` : '',
    constraints.requiredCitations || options.needsResearch ? 'Claims bound to real sources or honest gaps.' : '',
    constraints.requiredCharts ? 'Charts with aligned labels and series lengths.' : '',
    options.wpsTemplate ? 'Export-safe structure for WPS Office.' : '',
    'artifact_validate passes before final JSON response.'
  ].filter(Boolean);

  const toolPlaybook = buildToolPlaybook({
    goal,
    mode,
    depthTier: options.depthTier,
    knowledgeEnabled,
    cloudEnabled,
    mentionsCloud,
    mentionsPersonal,
    hasResearchPack: options.hasResearchPack,
    hasReferences: options.hasReferences,
    computation
  });

  const phasePriorities = buildPhasePriorities(options.depthTier, goal, {
    hasResearchPack: options.hasResearchPack,
    templateFill: options.templateFill
  });

  const avoidBehaviors = [
    ...contract.forbiddenBehaviors.slice(0, 4),
    mode === 'strict' ? 'Do not reinterpret strict brief language — execute literally.' : '',
    mode === 'autonomous' ? 'Autonomy is for structure and pacing only — never invent facts.' : '',
    goal === 'refine-targeted' ? 'Do not rebuild unrelated sections the user did not ask to change.' : '',
    'Do not burn the tool budget on browsing when seeded research or references already answer the question.'
  ].filter(Boolean);

  const autonomyNotes = [
    mode === 'autonomous'
      ? 'User granted judgment on sequencing and emphasis — still bind every external claim to evidence.'
      : mode === 'strict'
        ? 'User marked the brief strict — treat constraints as publication gates.'
        : 'Default: guided agent — infer missing logistics only when the brief already implies them.',
    goal === 'research-heavy'
      ? 'Act like a research analyst first, composer second.'
      : goal === 'data-compute'
        ? 'Act like a quantitative analyst — compute before writing narrative.'
        : goal === 'cloud-continue'
          ? 'Act like a workspace assistant — pull live truth from connected cloud before guessing.'
          : 'Act like a production editor — ship a complete artifact, not a plan.'
  ];

  return {
    mode,
    goal,
    primaryObjective,
    successCriteria,
    toolPlaybook,
    phasePriorities,
    avoidBehaviors,
    autonomyNotes
  };
}

export function userAgentPromptLines(intent: UserAgentIntent): string[] {
  return [
    'AGENTIC EXECUTION: you are an autonomous production agent, not a one-shot formatter.',
    `Primary objective: ${intent.primaryObjective}`,
    `Agent mode: ${intent.mode} · goal: ${intent.goal}.`,
    ...intent.autonomyNotes.map((line) => `- ${line}`),
    'Read context/user-agent-intent.md and harness/agent-playbook.md when the harness is active — execute the playbook from the user brief.',
    'Success criteria:',
    ...intent.successCriteria.map((line) => `- ${line}`)
  ];
}

export function userAgentHarnessPromptLines(): string[] {
  return [
    'USER-AGENT PLAYBOOK: read context/user-agent-intent.md first, then harness/agent-playbook.md.',
    'Execute the playbook step-by-step from the user brief — choose tools based on the stated goal, not habit.',
    'After each major phase, write a short checkpoint note to workspace/agent-log.md (what you learned, what is next).',
    'If the brief is strict, do not improvise scope. If autonomous, optimize sequencing only — never fabricate facts.',
    'When input/brief.md conflicts with thread memory, the brief wins.'
  ];
}

export function buildUserAgentIntentSeeds(intent: UserAgentIntent, brief: string): HarnessSeedFile[] {
  const intentMarkdown = [
    '# User agent intent',
    '',
    `- Mode: ${intent.mode}`,
    `- Goal: ${intent.goal}`,
    `- Objective: ${intent.primaryObjective}`,
    '',
    '## Success criteria',
    ...intent.successCriteria.map((line) => `- ${line}`),
    '',
    '## Phase priorities',
    ...intent.phasePriorities.map((line) => `- ${line}`),
    '',
    '## Tool playbook',
    ...intent.toolPlaybook.map((line) => `- ${line}`),
    '',
    '## Avoid',
    ...intent.avoidBehaviors.map((line) => `- ${line}`),
    '',
    '## Verbatim brief anchor',
    brief.trim()
  ].join('\n');

  const playbookMarkdown = [
    '# Agent playbook (from user prompt)',
    '',
    '## Step 0 — Intake',
    '- Read input/brief.md and this file.',
    '- Lock objective and success criteria from context/user-agent-intent.md.',
    '',
    '## Step 1 — Gather truth',
    ...intent.toolPlaybook.slice(0, 4).map((line, index) => `${index + 1}. ${line}`),
    '',
    '## Step 2 — Structure',
    '- Write or update drafts/outline.md when the brief implies 6+ sections or 8+ slides.',
    '- Map claims → source ids before composing body copy.',
    '',
    '## Step 3 — Compose',
    '- Fill structure with evidence-bound content; run terminal_run for derived numbers.',
    '- Prefer workspace drafts before emitting final artifact JSON.',
    '',
    '## Step 4 — Validate',
    '- Score against harness/quality-rubric.md when present.',
    '- Call artifact_validate; fix issues before responding.',
    '',
    `Goal focus: ${intent.goal}`
  ].join('\n');

  return [
    { path: 'context/user-agent-intent.md', content: intentMarkdown },
    { path: 'harness/agent-playbook.md', content: playbookMarkdown },
    {
      path: 'workspace/agent-log.md',
      content: [
        '# Agent log',
        '',
        'Append checkpoint notes here as you work (sources checked, outline locked, validation result).',
        `Started with goal: ${intent.goal}`
      ].join('\n')
    }
  ];
}

function buildToolPlaybook(options: {
  goal: UserAgentGoal;
  mode: UserAgentMode;
  depthTier: RunDepthTier;
  knowledgeEnabled: boolean;
  cloudEnabled: boolean;
  mentionsCloud: boolean;
  mentionsPersonal: boolean;
  hasResearchPack?: boolean;
  hasReferences?: boolean;
  computation?: boolean;
}): string[] {
  const lines: string[] = [];
  if (options.hasResearchPack) {
    lines.push('Start from research/source-pack.md — extract claims and citation ids before any web call.');
  } else if (options.goal === 'research-heavy') {
    lines.push('Use web_search/web_fetch for current facts; prefer primary sources and official announcements.');
  }
  if (options.hasReferences) {
    lines.push('Mine references/ and reference analysis before inventing structure or facts.');
  }
  if (options.knowledgeEnabled && (options.mentionsPersonal || options.goal === 'cloud-continue')) {
    lines.push('Call personal_knowledge_search when the brief references the user\'s files, memories, or prior artifacts.');
  }
  if (options.cloudEnabled && options.mentionsCloud) {
    lines.push('Use google_workspace_run or microsoft_graph_run for live Drive/OneDrive truth when the brief names cloud docs.');
  }
  if (options.computation || options.goal === 'data-compute') {
    lines.push('Use terminal_run to compute percentages, totals, and table transforms — never mental math on supplied numbers.');
  }
  if (options.goal === 'template-fill') {
    lines.push('Read input/template-skeleton.json if present; preserve layouts, chart shells, and design.template.');
  }
  if (options.goal === 'refine-targeted') {
    lines.push('Read input/current-artifact.json; change only what the revision instruction targets.');
  }
  lines.push('Use workspace_write/read for outlines, synthesis notes, and draft JSON before the final response.');
  lines.push('Call artifact_validate before returning final artifact JSON.');
  if (options.depthTier === 'fast') {
    lines.push('Fast run: skip exploratory loops — one research pass, one compose pass, validate, finish.');
  }
  if (options.mode === 'autonomous') {
    lines.push('User invited judgment: choose the leanest tool path that still meets success criteria.');
  }
  return [...new Set(lines)];
}

function buildPhasePriorities(
  tier: RunDepthTier,
  goal: UserAgentGoal,
  context: { hasResearchPack?: boolean; templateFill?: boolean }
): string[] {
  const phases: string[] = [];
  if (context.templateFill) phases.push('Template fill: skeleton → user facts → validate.');
  else if (goal === 'refine-targeted') phases.push('Revision: interpret instruction → patch artifact → validate.');
  else if (goal === 'research-heavy' || context.hasResearchPack) phases.push('Research synthesis before outline.');
  else phases.push('Brief lock before outline.');

  if (tier === 'marathon' || tier === 'deep') {
    phases.push('Outline lock before body composition.');
    phases.push('Checkpoint workspace files after outline and first full draft.');
  } else {
    phases.push('Compose directly when brief is explicit and short.');
  }
  phases.push('Validate and export-readiness before final JSON.');
  return phases;
}

function extractTopic(brief: string): string {
  const clean = brief
    .replace(/^(please\s+)?(can you\s+|could you\s+)?/i, '')
    .replace(/^(create|make|build|write|prepare|generate|design)\s+(me\s+)?(a|an|the)?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  const topic = clean.split(/[.!?]/)[0]?.trim() || 'the requested topic';
  return truncate(topic, 100);
}

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 3).trimEnd()}...`;
}