import type { ArtifactKind } from '../src/lib/shared.js';
import { peakArtifactSlideSummary } from '../src/lib/peakArtifacts/registry.js';
import { stripSkillTags } from '../src/lib/skills.js';
import {
  buildTemplateAgentContract,
  type TemplateHarnessMetadata
} from '../src/lib/templateAgentGuidance.js';
import { findWorkbenchTemplate } from '../src/lib/templateHarness.js';
import { resolveTemplateMetadata } from '../src/lib/workbenchTemplates.js';
import { detectArtifactAudience } from './artifactAudience.js';

export type TemplateScaffold = {
  id: string;
  label: string;
  kind: ArtifactKind;
  narrativeArc: string;
  slideRoles?: string[];
  sectionPurposes?: string[];
  layoutRhythm?: string[];
};

const deckScaffolds: TemplateScaffold[] = [
  {
    id: 'investor-12',
    label: 'Investor 12-slide arc',
    kind: 'deck',
    narrativeArc: 'Thesis → market tension → evidence → product → traction → economics → team → roadmap → ask → appendix',
    slideRoles: ['opener', 'context', 'tension', 'evidence', 'insight', 'solution', 'proof', 'plan', 'proof', 'plan', 'close', 'close'],
    layoutRhythm: ['cover', 'statement', 'chart', 'split', 'metric', 'list', 'comparison', 'timeline', 'chart', 'grid', 'statement', 'cover']
  },
  {
    id: 'board-8',
    label: 'Board 8-slide briefing',
    kind: 'deck',
    narrativeArc: 'BLUF → context → risk → evidence → decision → plan → proof → close',
    slideRoles: ['opener', 'context', 'tension', 'evidence', 'insight', 'plan', 'proof', 'close'],
    layoutRhythm: ['cover', 'statement', 'split', 'chart', 'comparison', 'timeline', 'metric', 'statement']
  },
  {
    id: 'academic-10',
    label: 'Academic 10-slide teaching deck',
    kind: 'deck',
    narrativeArc: 'Question → framing → theory → evidence → case → critique → synthesis → implications → limitations → close',
    slideRoles: ['opener', 'context', 'context', 'evidence', 'evidence', 'insight', 'insight', 'solution', 'proof', 'close'],
    layoutRhythm: ['cover', 'statement', 'list', 'quote', 'chart', 'split', 'grid', 'comparison', 'list', 'statement']
  }
];

const reportScaffolds: TemplateScaffold[] = [
  {
    id: 'executive-memo',
    label: 'Executive memo',
    kind: 'report',
    narrativeArc: 'BLUF → background → analysis → options → recommendation → risks → next steps → appendix',
    sectionPurposes: ['BLUF summary', 'Background', 'Analysis', 'Options', 'Recommendation', 'Risks', 'Next steps', 'Appendix']
  },
  {
    id: 'research-brief',
    label: 'Research brief with citations',
    kind: 'report',
    narrativeArc: 'Question → methods → findings → implications → limitations → sources',
    sectionPurposes: ['Research question', 'Methods', 'Findings', 'Implications', 'Limitations', 'Sources']
  }
];

export function getTemplateScaffoldById(scaffoldId: string | undefined): TemplateScaffold | undefined {
  if (!scaffoldId) return undefined;
  return [...deckScaffolds, ...reportScaffolds].find((scaffold) => scaffold.id === scaffoldId);
}

export function selectTemplateScaffold(
  kind: ArtifactKind,
  brief: string,
  preferredScaffoldId?: string
): TemplateScaffold | undefined {
  const preferred = getTemplateScaffoldById(preferredScaffoldId);
  if (preferred && preferred.kind === kind) return preferred;

  const clean = stripSkillTags(brief).toLowerCase();
  const explicitScaffold = clean.match(/\b(?:follow|use|scaffold)\s+(?:the\s+)?([a-z]+-\d+|[a-z]+-[a-z]+)\b/i)?.[1]
    ?? clean.match(/\b(investor-12|board-8|academic-10|executive-memo|research-brief)\b/i)?.[1];
  const explicitMatch = getTemplateScaffoldById(explicitScaffold);
  if (explicitMatch && explicitMatch.kind === kind) return explicitMatch;

  const slideCount = clean.match(/\b(\d{1,2})\s*(?:-|–|\s)?\s*slides?\b/i)?.[1];
  const audience = detectArtifactAudience(brief, kind);

  if (kind === 'deck') {
    if (slideCount === '12' || /\binvestor|pitch|fundraising|series [a-d]\b/i.test(clean)) {
      return deckScaffolds.find((scaffold) => scaffold.id === 'investor-12');
    }
    if (slideCount === '8' || /\bboard|boardroom|executive briefing\b/i.test(clean)) {
      return deckScaffolds.find((scaffold) => scaffold.id === 'board-8');
    }
    if (audience.audience === 'academic' || /\b(?:college|university|lecture|teaching)\b/i.test(clean)) {
      return deckScaffolds.find((scaffold) => scaffold.id === 'academic-10');
    }
    if (Number(slideCount) >= 10) return deckScaffolds[0];
    if (Number(slideCount) >= 6) return deckScaffolds[1];
    return deckScaffolds[2];
  }

  if (kind === 'report' || kind === 'assignment') {
    if (/\b(?:research|cite|citation|sources?)\b/i.test(clean)) {
      return reportScaffolds.find((scaffold) => scaffold.id === 'research-brief');
    }
    return reportScaffolds[0];
  }

  return undefined;
}

export function buildTemplateHarnessRoutingLines(
  options: TemplateHarnessMetadata = {}
): string[] {
  const resolved = resolveTemplateHarnessOptions(options);
  if (!resolved.templateId && !resolved.scaffoldId && !resolved.designPreset) return [];

  const lines = ['TEMPLATE HARNESS (binding):'];
  if (resolved.templateName) {
    lines.push(`Workbench template: ${resolved.templateName}${resolved.templateCategory ? ` (${resolved.templateCategory})` : ''}.`);
  } else if (resolved.templateId) {
    lines.push(`Workbench template id: ${resolved.templateId}.`);
  }
  if (resolved.format) lines.push(`Deliverable format: ${resolved.format}.`);
  if (resolved.audience) lines.push(`Target audience: ${resolved.audience}.`);
  if (resolved.designPreset) {
    lines.push(`Required design.template preset: "${resolved.designPreset}".`);
  }
  if (resolved.visualStyle) lines.push(`Visual style: ${resolved.visualStyle}.`);
  if (resolved.visualDirection) lines.push(`Visual direction: ${resolved.visualDirection}.`);
  if (resolved.scaffoldId) {
    lines.push(...templateScaffoldPromptLines(getTemplateScaffoldById(resolved.scaffoldId)));
  }
  const structureMap = peakArtifactSlideSummary(resolved.peakArtifactId);
  if (structureMap.length) {
    lines.push(`Locked structure map: ${structureMap.join(' · ')}.`);
    lines.push('Bind user facts to these slide/section roles — preserve layout rhythm and titles unless the brief requests a rename.');
  }
  lines.push(...buildTemplateAgentContract());
  lines.push('Preserve the template scaffold and visual system while applying user-specific details from the brief.');
  return lines;
}

function resolveTemplateHarnessOptions(options: TemplateHarnessMetadata): TemplateHarnessMetadata {
  if (!options.templateId) return options;
  const template = findWorkbenchTemplate(options.templateId);
  if (!template) return options;
  const enriched = resolveTemplateMetadata(template);
  return {
    templateId: enriched.id,
    scaffoldId: options.scaffoldId ?? enriched.scaffoldId,
    designPreset: options.designPreset ?? enriched.designPreset,
    peakArtifactId: options.peakArtifactId ?? enriched.peakArtifactId,
    templateName: options.templateName ?? enriched.name,
    templateCategory: options.templateCategory ?? enriched.category,
    format: options.format ?? enriched.format,
    visualDirection: options.visualDirection ?? enriched.visualDirection,
    visualStyle: options.visualStyle ?? enriched.visualStyle,
    audience: options.audience ?? enriched.audience
  };
}

export function templateScaffoldPromptLines(scaffold: TemplateScaffold | undefined): string[] {
  if (!scaffold) return [];
  const lines = [
    `Structure scaffold (${scaffold.label}): ${scaffold.narrativeArc}.`,
    'Use this scaffold for narrative sequencing only — never copy placeholder titles or filler content.'
  ];
  if (scaffold.slideRoles?.length) {
    lines.push(`Suggested slide role rhythm: ${scaffold.slideRoles.join(' → ')}.`);
  }
  if (scaffold.layoutRhythm?.length) {
    lines.push(`Suggested layout rhythm: ${scaffold.layoutRhythm.join(' → ')}.`);
  }
  if (scaffold.sectionPurposes?.length) {
    lines.push(`Suggested section purposes: ${scaffold.sectionPurposes.join(' → ')}.`);
  }
  return lines;
}