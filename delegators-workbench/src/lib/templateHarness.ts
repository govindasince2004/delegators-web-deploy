import { findSkillById, resolveSkillFromText } from './skills.js';
import type { ArtifactDocument } from './shared.js';
import {
  buildTemplateAgentContract,
  buildTemplateContextLines,
  buildTemplateTurnGuidance,
  buildTemplateWelcomeMessage,
  templateHarnessMetadataFromTemplate,
  type TemplateHarnessMetadata,
  type TemplateTurn
} from './templateAgentGuidance.js';
import {
  isImplicitArtifactRequest,
  resolveThreadArtifactIntent,
  shouldGenerateNewArtifact
} from './threadArtifactRouting.js';
import {
  inferStructureHints,
  resolveTemplateMetadata,
  workbenchTemplates,
  type WorkbenchTemplate
} from './workbenchTemplates.js';

export type TemplateSessionState = {
  templateId: string;
};

export type { TemplateHarnessMetadata, TemplateTurn };
export { buildTemplateWelcomeMessage };

export function looksLikeSubstantiveBrief(text: string): boolean {
  const clean = text.trim();
  if (clean.length < 48) return false;
  const questionOnly = clean.endsWith('?') && !/\d/.test(clean) && clean.length < 100;
  if (questionOnly) return false;
  const hasNumbers = /\d/.test(clean);
  const hasBullets = /(^|\n)\s*[-*•]\s+\S/m.test(clean);
  const sentenceCount = clean.split(/[.!?]+/).filter((part) => part.trim().length > 12).length;
  return hasNumbers || hasBullets || sentenceCount >= 2;
}

export function resolveTemplateTurnRouting(
  template: WorkbenchTemplate,
  userPrompt: string,
  priorArtifacts: ArtifactDocument[] = []
): TemplateTurn {
  const clean = userPrompt.trim();
  if (!clean) return 'chat';

  const templateSkill = findSkillById(template.skillId);
  const explicitSkill = resolveSkillFromText(clean);
  const threadIntent = resolveThreadArtifactIntent({
    brief: clean,
    priorArtifacts,
    skill: explicitSkill,
    artifactKind: template.format,
    outputFormat: explicitSkill?.primaryOutput ?? templateSkill?.primaryOutput,
    templateId: template.id
  });

  if (threadIntent.mode === 'refine') return 'refine';

  if (
    resolveSkillFromText(clean) ||
    isImplicitArtifactRequest(clean) ||
    shouldGenerateNewArtifact(clean, priorArtifacts) ||
    looksLikeSubstantiveBrief(clean)
  ) {
    return 'generate';
  }

  return 'chat';
}

export function findWorkbenchTemplate(templateId: string): WorkbenchTemplate | undefined {
  return workbenchTemplates.find((template) => template.id === templateId);
}

export function templateSessionFromTemplate(template: WorkbenchTemplate): TemplateSessionState {
  return { templateId: template.id };
}

export function resolveActiveTemplate(
  session: TemplateSessionState | undefined
): WorkbenchTemplate | undefined {
  if (!session?.templateId) return undefined;
  const template = findWorkbenchTemplate(session.templateId);
  return template ? resolveTemplateMetadata(template) : undefined;
}

export function buildTemplateHarnessPrompt(template: WorkbenchTemplate): string {
  const enriched = resolveTemplateMetadata(template);
  return [
    ...buildTemplateContextLines(enriched),
    ...buildTemplateAgentContract(),
    `Starter intent: ${enriched.starterPrompt}`
  ].join(' ');
}

export function buildTemplateTurnMessage(
  template: WorkbenchTemplate,
  userPrompt: string,
  turn: TemplateTurn,
  priorArtifacts: ArtifactDocument[] = []
): string {
  const enriched = resolveTemplateMetadata(template);
  const userDetails = userPrompt.trim();
  const templateSkill = findSkillById(enriched.skillId);
  const explicitSkill = resolveSkillFromText(userDetails);
  const threadIntent = resolveThreadArtifactIntent({
    brief: userDetails,
    priorArtifacts,
    skill: explicitSkill,
    artifactKind: enriched.format,
    outputFormat: explicitSkill?.primaryOutput ?? templateSkill?.primaryOutput,
    templateId: enriched.id
  });

  const fallback =
    turn === 'chat' && !userDetails
      ? `User opened "${enriched.name}" — welcome them with concrete next steps tied to the structure map.`
      : enriched.starterPrompt;

  return [
    buildTemplateHarnessPrompt(enriched),
    ...buildTemplateTurnGuidance(turn, enriched),
    ...threadIntent.routingLines,
    userDetails || fallback
  ].filter(Boolean).join(' ');
}

export function buildGenerationBrief(
  template: WorkbenchTemplate,
  userPrompt = '',
  priorArtifacts: ArtifactDocument[] = []
): string {
  const enriched = resolveTemplateMetadata(template);
  const skill = findSkillById(enriched.skillId);
  const tag = skill?.tag ?? '@ppt';
  const body = buildTemplateTurnMessage(enriched, userPrompt, 'generate', priorArtifacts);
  return [tag, body].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

export function templateComposerDisplayMessage(
  template: WorkbenchTemplate,
  userPrompt = ''
): string {
  const enriched = resolveTemplateMetadata(template);
  const userDetails = userPrompt.trim();
  const label = `[Template: ${enriched.name}]`;
  return userDetails ? `${label} ${userDetails}` : label;
}

export function templateHarnessMetadata(template: WorkbenchTemplate): TemplateHarnessMetadata {
  return templateHarnessMetadataFromTemplate(template);
}

export { inferStructureHints };