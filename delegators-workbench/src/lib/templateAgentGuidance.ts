import type { ArtifactDocument, ArtifactKind } from './shared.js';
import { peakArtifactSlideSummary } from './peakArtifacts/registry.js';
import { resolveTemplateMetadata, type WorkbenchTemplate } from './workbenchTemplates.js';

export function briefHasTemplateSessionMarker(brief: string): boolean {
  return /\bTEMPLATE SESSION \(binding\)/i.test(brief);
}

export function isTemplateSkeletonSession(
  templateId: string | undefined,
  priorArtifact: ArtifactDocument | undefined,
  targetKind: ArtifactKind
): boolean {
  return Boolean(templateId && priorArtifact && priorArtifact.kind === targetKind);
}

export function buildTemplateSkeletonRoutingLines(skeleton: ArtifactDocument): string[] {
  const slideCount = skeleton.slides?.length ?? 0;
  const sectionCount = skeleton.sections.length;
  const unitLabel = skeleton.kind === 'deck' ? 'slide' : skeleton.kind === 'sheet' ? 'worksheet' : 'section';
  const unitCount = slideCount || sectionCount || (skeleton.sheet?.sheets.length ?? 0);
  const layoutSummary = skeleton.kind === 'deck' && skeleton.slides?.length
    ? skeleton.slides.map((slide, index) => `Slide ${index + 1}: layout=${slide.layout ?? 'list'}`).join(' · ')
    : '';

  return [
    'TEMPLATE SKELETON (binding — do not rebuild from scratch):',
    `Loaded preview is the structural skeleton${unitCount ? ` with ${unitCount} ${unitLabel}${unitCount === 1 ? '' : 's'}` : ''}.`,
    layoutSummary ? `Locked layouts: ${layoutSummary}.` : '',
    skeleton.design?.template ? `Locked design.template: "${skeleton.design.template}".` : '',
    'FILL this skeleton with the user\'s facts — replace placeholder copy, metrics, bullets, and section bodies only.',
    'Preserve exact unit count, order, per-unit layout, themes, chart/table shells, column structure, and palette unless the user explicitly requests structural changes.',
    'Do not invent a new outline, slide count, or generic deck/report shape — the gallery template already defined the composition.'
  ].filter(Boolean);
}

/** How the workbench routes a template session turn. */
export type TemplateTurn = 'chat' | 'refine' | 'generate';

export type TemplateHarnessMetadata = {
  templateId?: string;
  scaffoldId?: string;
  designPreset?: string;
  peakArtifactId?: string;
  templateName?: string;
  templateCategory?: string;
  format?: ArtifactKind;
  visualDirection?: string;
  visualStyle?: string;
  audience?: string;
};

export function templateHarnessMetadataFromTemplate(template: WorkbenchTemplate): TemplateHarnessMetadata {
  const enriched = resolveTemplateMetadata(template);
  return {
    templateId: enriched.id,
    scaffoldId: enriched.scaffoldId,
    designPreset: enriched.designPreset,
    peakArtifactId: enriched.peakArtifactId,
    templateName: enriched.name,
    templateCategory: enriched.category,
    format: enriched.format,
    visualDirection: enriched.visualDirection,
    visualStyle: enriched.visualStyle,
    audience: enriched.audience
  };
}

function structurePreviewLines(template: WorkbenchTemplate, limit = 4): string[] {
  const slides = peakArtifactSlideSummary(template.peakArtifactId);
  if (slides.length === 0) return [];
  const preview = slides.slice(0, limit);
  const remainder = slides.length - preview.length;
  const tail = remainder > 0 ? ` · +${remainder} more` : '';
  return [`Structure preview: ${preview.join(' · ')}${tail}`];
}

export function buildTemplateContextLines(template: WorkbenchTemplate): string[] {
  const enriched = resolveTemplateMetadata(template);
  const lines = [
    'TEMPLATE SESSION (binding):',
    `Template: ${enriched.name} — ${enriched.category} (${enriched.format}).`,
    enriched.description,
    enriched.useCase ? `Designed for: ${enriched.useCase}` : '',
    enriched.audience ? `Audience: ${enriched.audience}` : '',
    enriched.designPreset ? `Visual system: design.template = "${enriched.designPreset}".` : '',
    enriched.visualStyle ? `Style: ${enriched.visualStyle}` : '',
    enriched.visualDirection ? `Direction: ${enriched.visualDirection}` : '',
    enriched.scaffoldId ? `Narrative scaffold: ${enriched.scaffoldId}.` : '',
    ...structurePreviewLines(enriched),
    peakArtifactSlideSummary(enriched.peakArtifactId).length
      ? `Full structure map: ${peakArtifactSlideSummary(enriched.peakArtifactId).join(' · ')}`
      : '',
    enriched.structureHints?.length
      ? `Composition rules: ${enriched.structureHints.join(' ')}`
      : '',
    'The live preview is already loaded — treat it as the ground truth for layout rhythm and section order.',
    'Read the user message for intent: advise about the template, refine the preview, or generate a production file with their facts.'
  ];
  return lines.filter(Boolean);
}

export function buildTemplateAgentContract(): string[] {
  return [
    'Agent contract:',
    '- Sound like a senior presentation designer paired with a strategist — specific, calm, and useful.',
    '- Reference real slide/section titles from the structure map when advising or refining.',
    '- Never invent company facts, metrics, or citations; ask for missing inputs or label gaps honestly.',
    '- Do not collapse the scaffold into a generic outline — preserve layout diversity and the locked visual system.',
    '- Do not ask for preferences the user already stated in their message.'
  ];
}

export function buildTemplateTurnGuidance(turn: TemplateTurn, template: WorkbenchTemplate): string[] {
  const enriched = resolveTemplateMetadata(template);
  const formatLabel = enriched.format === 'deck'
    ? 'slide'
    : enriched.format === 'sheet'
      ? 'worksheet'
      : 'section';

  switch (turn) {
    case 'chat':
      return [
        'Turn mode: advisory chat (no artifact JSON in this lane).',
        `Help the user understand ${enriched.name}, suggest what to put in each ${formatLabel}, or clarify before a build.`,
        'If they only opened the template, welcome them with two concrete paths: paste their brief to generate, or name a specific slide/section to customize.',
        'When they ask what is in the layout, walk the structure map in plain prose — not a bullet dump.',
        'If they provide substantive facts (metrics, story, audience), acknowledge you can build from the template when they are ready — do not force a separate command.'
      ];
    case 'refine':
      return [
        'Turn mode: surgical refinement of the loaded preview.',
        `Apply only the requested edits; keep ${enriched.designPreset ?? 'the'} visual system and ${enriched.scaffoldId ?? 'template'} narrative rhythm intact.`,
        `Name the ${formatLabel}(s) you are changing using titles from the structure map.`,
        'Do not rebuild unrelated slides/sections or swap the design preset unless explicitly asked.',
        'Preserve chart/table layouts when editing nearby copy.'
      ];
    case 'generate':
      return [
        'Turn mode: fill the loaded template skeleton (not a from-scratch build).',
        `Start from the preview JSON already in the workspace — same ${formatLabel} count, layouts, and design.template.`,
        `Bind every user-supplied fact into the ${enriched.scaffoldId ?? 'template'} structure map — replace placeholder copy only.`,
        `Honor design.template = "${enriched.designPreset ?? 'the curated preset'}" and the locked layout rhythm.`,
        'Map metrics and evidence to the proof slots already in the skeleton; keep opener and close aligned with the template arc.',
        'If a fact is missing, leave an honest gap or nextQuestions item — never fabricate traction, funding, or citations.'
      ];
    default:
      return [];
  }
}

export function buildTemplateWelcomeMessage(template: WorkbenchTemplate): string {
  const enriched = resolveTemplateMetadata(template);
  const slides = peakArtifactSlideSummary(enriched.peakArtifactId);
  const structureHint = slides.length >= 2
    ? `${slides[0]} through ${slides[slides.length - 1]}`
    : slides[0] ?? enriched.category.toLowerCase();

  return [
    `${enriched.name} is live in your preview`,
    structureHint ? `(${structureHint})` : '',
    '—',
    'Paste your story and facts to build the file, tell me what to change on a specific slide or section, or ask how the layout works.'
  ].filter(Boolean).join(' ');
}

export function buildTemplateChatSystemLines(template: WorkbenchTemplate): string[] {
  const enriched = resolveTemplateMetadata(template);
  return [
    'Active template session:',
    ...buildTemplateContextLines(enriched).slice(1),
    ...buildTemplateAgentContract(),
    'You are in advisory chat for this template — help with structure, content strategy, and customization guidance.',
    'Do not output artifact JSON or claim a downloadable export was created in this lane.',
    'When the user provides enough substance, they can send again to trigger generation — your job now is to be genuinely helpful about the loaded design.'
  ];
}