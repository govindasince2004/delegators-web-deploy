import type { ArtifactDocument, ArtifactKind, ArtifactPrimaryFormat } from './shared.js';
import { findSkillByTag, resolveSkillFromText, type SkillDefinition } from './skills.js';
import { artifactFormatLabel } from './threadContext.js';

export type ThreadArtifactMode = 'new' | 'refine' | 'reuse-content' | 'template-fill';

export type ThreadArtifactIntent = {
  mode: ThreadArtifactMode;
  targetKind: ArtifactKind;
  targetFormat: ArtifactPrimaryFormat;
  skill?: SkillDefinition;
  priorArtifact?: ArtifactDocument;
  priorKind?: ArtifactKind;
  priorFormat?: ArtifactPrimaryFormat;
  reusePriorFacts: boolean;
  routingLines: string[];
};

const kindFromBrief: Array<{ pattern: RegExp; kind: ArtifactKind; format: ArtifactPrimaryFormat; tag: string }> = [
  { pattern: /\b(?:@pdf|pdf report|write a report|create a report|research report|white\s*paper|briefing document|write[- ]?up|one[- ]pager|summary document|research summary)\b/i, kind: 'report', format: 'pdf', tag: '@pdf' },
  { pattern: /\b(?:@ppt|@pptx|powerpoint|presentation|slide deck|create a deck|make a deck|board deck|pitch deck|\d+\s*[-–]?\s*slides?)\b/i, kind: 'deck', format: 'pptx', tag: '@ppt' },
  { pattern: /\b(?:@xlsx|@excel|spreadsheet|workbook|excel file)\b/i, kind: 'sheet', format: 'xlsx', tag: '@xlsx' },
  { pattern: /\b(?:@docx|@word|word document|editable document|policy document)\b/i, kind: 'report', format: 'docx', tag: '@docx' },
  { pattern: /\b(?:@resume|@cv|curriculum vitae|resume)\b/i, kind: 'resume', format: 'pdf', tag: '@resume' },
  { pattern: /\b(?:@email|write an email|draft an email|memo to)\b/i, kind: 'email', format: 'docx', tag: '@email' },
  { pattern: /\b(?:assignment|essay|term paper|synopsis|project report|literature review)\b/i, kind: 'assignment', format: 'pdf', tag: '@assignment' }
];

const refinePattern = /\b(?:revise|update|edit|fix|change|tweak|adjust|shorten|lengthen|rewrite|improve|polish|same (?:file|deck|report|document|artifact)|this (?:deck|report|file|document|artifact))\b/i;
const newFromPriorPattern = /\b(?:turn (?:it|this|that) into|convert (?:it|this|that) to|make (?:a|an) (?:new )?|create (?:a|an) (?:new )?|build (?:a|an) (?:new )?|another|separate|different format|from (?:the|this) (?:deck|report|ppt|pdf|conversation|research)|also (?:make|create|build|write|prepare)|now (?:make|create|build|write|prepare)|next (?:make|create|build|write|prepare)|can you (?:also )?(?:make|create|build|write|prepare))\b/i;

const implicitArtifactPatterns: Array<{ pattern: RegExp; kind: ArtifactKind; format: ArtifactPrimaryFormat; tag: string }> = [
  { pattern: /\b(?:document|write up|prepare|summarize)\s+(?:the\s+)?(?:competitive|market|landscape|findings|research|conversation|discussion|analysis)\b/i, kind: 'report', format: 'pdf', tag: '@pdf' },
  { pattern: /\b(?:give me|i need|need a|want a)\s+(?:a\s+)?(?:deck|presentation|slides?)\b/i, kind: 'deck', format: 'pptx', tag: '@ppt' },
  { pattern: /\b(?:give me|i need|need a|want a)\s+(?:a\s+)?(?:report|document|pdf|writeup|spreadsheet|xlsx)\b/i, kind: 'report', format: 'pdf', tag: '@pdf' },
  { pattern: /\b(?:slide deck|presentation|slides?)\s+(?:on|about|for|covering)\b/i, kind: 'deck', format: 'pptx', tag: '@ppt' },
  { pattern: /\b(?:report|document|pdf|writeup)\s+(?:on|about|for|covering)\b/i, kind: 'report', format: 'pdf', tag: '@pdf' }
];

export function isImplicitArtifactRequest(text: string): boolean {
  const clean = text.trim();
  if (!clean) return false;
  if (kindFromBrief.some((candidate) => candidate.pattern.test(clean))) return true;
  if (newFromPriorPattern.test(clean) && !refinePattern.test(clean)) return true;
  return implicitArtifactPatterns.some((candidate) => candidate.pattern.test(clean));
}

export function shouldGenerateNewArtifact(
  text: string,
  priorArtifacts: ArtifactDocument[] = []
): boolean {
  if (priorArtifacts.length === 0) return false;
  if (resolveSkillFromText(text)) return true;
  if (inferSkillFromThreadRequest(text, priorArtifacts)) return true;
  const intent = resolveThreadArtifactIntent({ brief: text, priorArtifacts });
  return intent.mode !== 'refine' && isImplicitArtifactRequest(text);
}

export function inferSkillFromThreadRequest(
  text: string,
  priorArtifacts: ArtifactDocument[] = []
): SkillDefinition | undefined {
  const explicit = resolveSkillFromText(text);
  if (explicit) return explicit;

  const prior = priorArtifacts.at(-1);
  if (!prior) return undefined;

  for (const candidate of kindFromBrief) {
    if (!candidate.pattern.test(text)) continue;
    if (prior.kind === candidate.kind && prior.primaryFormat === candidate.format && refinePattern.test(text)) {
      return undefined;
    }
    return findSkillByTag(candidate.tag);
  }

  for (const candidate of implicitArtifactPatterns) {
    if (!candidate.pattern.test(text)) continue;
    if (prior.kind === candidate.kind && prior.primaryFormat === candidate.format && refinePattern.test(text)) {
      return undefined;
    }
    return findSkillByTag(candidate.tag);
  }

  if (newFromPriorPattern.test(text) && !refinePattern.test(text)) {
    if (/\b(?:deck|presentation|slides?|pptx?)\b/i.test(text) && prior.kind !== 'deck') {
      return findSkillByTag('@ppt');
    }
    if (/\b(?:report|pdf|document|memo|briefing)\b/i.test(text) && prior.kind !== 'report') {
      return findSkillByTag('@pdf');
    }
    if (/\b(?:sheet|spreadsheet|xlsx|excel)\b/i.test(text) && prior.kind !== 'sheet') {
      return findSkillByTag('@xlsx');
    }
  }

  return undefined;
}

function isTemplateBoundBrief(brief: string, templateId?: string): boolean {
  return Boolean(templateId || /\bTEMPLATE SESSION \(binding\)/i.test(brief));
}

export function resolveThreadArtifactIntent(options: {
  brief: string;
  priorArtifacts?: ArtifactDocument[];
  skill?: SkillDefinition;
  outputFormat?: ArtifactPrimaryFormat;
  artifactKind?: ArtifactKind;
  templateId?: string;
}): ThreadArtifactIntent {
  const prior = options.priorArtifacts?.at(-1);
  const explicitSkill = options.skill ?? resolveSkillFromText(options.brief) ?? inferSkillFromThreadRequest(options.brief, options.priorArtifacts ?? []);
  const inferred = kindFromBrief.find((candidate) => candidate.pattern.test(options.brief));

  const targetKind = options.artifactKind ?? explicitSkill?.kind ?? inferred?.kind ?? prior?.kind ?? 'report';
  const targetFormat = options.outputFormat ?? explicitSkill?.primaryOutput ?? inferred?.format ?? prior?.primaryFormat ?? 'pdf';

  const priorKind = prior?.kind;
  const priorFormat = prior?.primaryFormat;
  const isDifferentDeliverable = Boolean(
    prior && (priorKind !== targetKind || (priorFormat && priorFormat !== targetFormat))
  );
  const wantsNewDeliverable = Boolean(
    prior &&
    !refinePattern.test(options.brief) &&
    (explicitSkill || isDifferentDeliverable || isImplicitArtifactRequest(options.brief) || newFromPriorPattern.test(options.brief))
  );
  const wantsRefine = Boolean(
    prior &&
    refinePattern.test(options.brief) &&
    !isDifferentDeliverable &&
    !explicitSkill &&
    !isImplicitArtifactRequest(options.brief)
  );
  const templateBound = isTemplateBoundBrief(options.brief, options.templateId);
  const wantsTemplateFill = Boolean(
    templateBound &&
    prior &&
    !wantsRefine &&
    !isDifferentDeliverable &&
    priorKind === targetKind &&
    (!priorFormat || priorFormat === targetFormat)
  );
  const reusePriorFacts = Boolean(prior && (wantsNewDeliverable || wantsTemplateFill || options.priorArtifacts!.length > 0));

  let mode: ThreadArtifactMode = 'new';
  if (wantsRefine) mode = 'refine';
  else if (wantsTemplateFill) mode = 'template-fill';
  else if (wantsNewDeliverable) mode = isDifferentDeliverable ? 'reuse-content' : 'new';
  else if (prior && !explicitSkill) mode = 'reuse-content';

  const routingLines = buildThreadRoutingLines({
    mode,
    targetKind,
    targetFormat,
    prior,
    priorKind,
    priorFormat,
    reusePriorFacts,
    explicitSkill: Boolean(explicitSkill)
  });

  return {
    mode,
    targetKind,
    targetFormat,
    skill: explicitSkill,
    priorArtifact: prior,
    priorKind,
    priorFormat,
    reusePriorFacts,
    routingLines
  };
}

export function buildThreadRoutingLines(options: {
  mode: ThreadArtifactMode;
  targetKind: ArtifactKind;
  targetFormat: ArtifactPrimaryFormat;
  prior?: ArtifactDocument;
  priorKind?: ArtifactKind;
  priorFormat?: ArtifactPrimaryFormat;
  reusePriorFacts: boolean;
  explicitSkill: boolean;
}): string[] {
  const lines: string[] = [
    'THREAD ROUTING (binding):',
    `Current request deliverable: ${options.targetKind} / ${options.targetFormat.toUpperCase()}.`
  ];

  if (!options.prior) {
    lines.push('No prior artifact in this thread — create the requested deliverable from the brief and any conversation facts.');
    return lines;
  }

  lines.push(
    `Prior artifact in thread: “${options.prior.title}” (${options.priorKind ?? options.prior.kind} / ${artifactFormatLabel(options.prior)}).`
  );

  if (options.mode === 'refine') {
    lines.push('The user is revising the latest artifact — preserve truthful content unless the instruction changes it.');
    return lines;
  }

  if (options.mode === 'template-fill') {
    lines.push(
      'The user selected a gallery template — the loaded preview is the SKELETON, not loose inspiration.',
      'FILL the existing structure: same slide/section/worksheet count, same layout per unit, same design.template, themes, chart shells, and table columns.',
      'Replace placeholder titles, bullets, metrics, and body copy with the user\'s facts — do not design a new outline from scratch.',
      'Renaming units is allowed when the user\'s topic requires it, but keep narrative arc and layout rhythm locked to the template.'
    );
    return lines;
  }

  if (options.priorKind && (options.priorKind !== options.targetKind || (options.priorFormat && options.priorFormat !== options.targetFormat))) {
    lines.push(
      `Create a NEW ${options.targetKind} file. Do NOT recreate the prior ${options.priorKind} or export the same format again unless explicitly asked.`,
      'Reuse facts, research, names, numbers, and citations from prior thread work as source material only — rebuild structure for the new format.'
    );
  } else if (options.explicitSkill || options.mode === 'new') {
    lines.push(
      'The user requested a new deliverable — treat this as a fresh production run, not a replay of the previous file layout.',
      'Mine conversation and prior artifacts for facts, but produce a new artifact shape matching the current request.',
      'Do not copy prior slide titles, section headings, or file structure verbatim — rebuild for the new ask.'
    );
  } else {
    lines.push('Use prior thread artifacts as context and evidence — do not duplicate an earlier file verbatim.');
  }

  if (options.reusePriorFacts) {
    lines.push('Carry forward verified facts from chat and prior artifacts; mark anything unverified honestly.');
  }

  return lines;
}

export function priorArtifactStructureOverlap(
  prior: ArtifactDocument,
  current: ArtifactDocument
): number {
  if (prior.kind !== current.kind) return 0;
  const priorUnits = [
    ...(prior.slides ?? []).map((slide) => slide.title.trim().toLowerCase()),
    ...prior.sections.map((section) => section.heading.trim().toLowerCase())
  ].filter(Boolean);
  const currentUnits = [
    ...(current.slides ?? []).map((slide) => slide.title.trim().toLowerCase()),
    ...current.sections.map((section) => section.heading.trim().toLowerCase())
  ].filter(Boolean);
  if (priorUnits.length === 0 || currentUnits.length === 0) return 0;
  const overlap = currentUnits.filter((unit) => priorUnits.includes(unit)).length;
  return overlap / Math.max(priorUnits.length, currentUnits.length);
}

export function inspectPriorArtifactNovelty(
  prior: ArtifactDocument | undefined,
  current: ArtifactDocument,
  mode: ThreadArtifactMode,
  issues: string[]
): void {
  if (!prior || mode === 'refine' || mode === 'template-fill') return;
  const overlap = priorArtifactStructureOverlap(prior, current);
  const sameTitle = prior.title.trim().toLowerCase() === current.title.trim().toLowerCase();
  if (overlap >= 0.72 && sameTitle) {
    issues.push('The artifact replays the prior thread file instead of producing a new deliverable — rebuild structure and titles for the current request while reusing only verified facts.');
  } else if (overlap >= 0.82) {
    issues.push('The artifact structure is too similar to the prior thread file — create a fresh outline for the new request instead of duplicating prior slide titles or section headings.');
  }
}