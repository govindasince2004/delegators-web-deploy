import type { ArtifactKind, ArtifactPrimaryFormat } from '../src/lib/shared.js';
import type { SkillDefinition } from '../src/lib/skills.js';
import type { ReferenceSeedFile } from './references.js';

export type ArtifactSkillPack = {
  guide: string;
  seedFiles: ReferenceSeedFile[];
};

export function buildArtifactSkillPack(options: {
  kind: ArtifactKind;
  primaryFormat: ArtifactPrimaryFormat;
  selectedSkill?: SkillDefinition;
}): ArtifactSkillPack {
  const label = options.selectedSkill?.label ?? formatLabel(options.primaryFormat);
  const guide = [
    `# ${label} production skill`,
    '',
    '## Required workflow',
    '',
    '1. Read uploaded/reference material before drafting. Treat extracted Markdown, tables, and image analysis as primary evidence.',
    '2. Follow explicit user constraints exactly: requested format, audience, length, structure, facts, visual direction, fonts, colors, and source rules.',
    '3. Use workspace and terminal tools when they improve correctness: inspect files, calculate values, shape tables, validate structure, or test an export. Do not use tools as ceremony.',
    '4. Build a complete, reusable artifact rather than a chat answer or generic template. Do not invent facts or use placeholders.',
    '5. Validate the final artifact structure and preserve traceable citations and reusable imageAssetId values.',
    '',
    '## Format craft',
    '',
    formatCraft(options.kind, options.primaryFormat),
    '',
    options.selectedSkill?.instruction
      ? `## Request skill\n\n${options.selectedSkill.instruction}`
      : '',
    '',
    '## Evidence architecture (mandatory for reports, decks, and researched work)',
    '',
    '- Separate FACT (sourced), ANALYSIS (your inference), and RECOMMENDATION (action) — never blend them in one confident sentence.',
    '- Open with BLUF: one plain sentence stating the bottom line. No hype words (unprecedented, consequential, new chapter, strategic analysis).',
    '- Every non-trivial claim needs a traceable sourceId or an explicit UNVERIFIED / LOW CONFIDENCE label.',
    '- Use calibrated language: confirmed, reported, likely, unclear, high confidence, low confidence — never one flat authoritative voice.',
    '- Charts and tables require verified values, axis labels, units, and a one-line methodology note. No decorative charts.',
    '- Do not repeat the same point as a paragraph and then again as bullets. One sharp formulation per idea.',
    '- Include a final section or appendix: Sources, Methodology, Limitations, As-of date.',
    '- Name the analyst role honestly (e.g. "Prepared by Delegators Workbench") — no fake institutional bylines.',
    '- Contents must match depth: do not list eleven heavy sections in a short document; fewer sections with real coverage beats a shallow table of contents.',
    '',
    '## Publication craft (Gamma / Claude Artifacts / Genspark bar)',
    '',
    '- Narrative first: each slide or section must advance one argument — not a topic inventory or template filler.',
    '- One visual job per slide: metric, comparison, timeline, quote-with-source, or decision — never a decorative chart.',
    '- Bind every number to a captured sourceId or mark UNVERIFIED; Claude-style artifacts fail when numbers float without lineage.',
    '- Use editorial systems (cover → BLUF → evidence blocks → implications → risks → sources), not repeated heading/bullet rhythms.',
    '- Decks: title states the point; light content run with structured evidence slides; dark opener/close only when it serves hierarchy.',
    '- Reports: executive summary ≤ 120 words; each section opens with its claim, then evidence, then implication — never claim → implication alone.',
    '- Prefer fewer, denser sections over many shallow ones; Genspark-quality work synthesizes sources instead of restating them.',
    '- Callout panels for KEY JUDGMENT, RISK, and UNVERIFIED only — not for every paragraph.',
    '- Final page mandatory: Sources (with URLs/labels), Methodology, Limitations, As-of date.',
    '',
    '## Final standard',
    '',
    'The result should be immediately useful after download: coherent content, purposeful hierarchy, correct data, editable native structures where supported, traceable evidence, and no visible execution details.'
  ].filter(Boolean).join('\n');

  return {
    guide,
    seedFiles: [
      { path: 'skills/active/SKILL.md', content: guide },
      { path: 'skills/active/quality-checklist.md', content: qualityChecklist(options.kind, options.primaryFormat) }
    ]
  };
}

function formatCraft(kind: ArtifactKind, format: ArtifactPrimaryFormat): string {
  if (kind === 'deck' || format === 'pptx') {
    return [
      '- Architect the deck before writing slides: define the audience decision, narrative arc, evidence needed, and the visual job of each slide.',
      '- Give the deck a narrative arc. Each slide must have one clear communication job and a title that states the point, not merely the topic.',
      '- Build a role sequence before slide copy: opener → context/tension → evidence/insight → solution/plan/proof → close. Every slide advances the same argument.',
      '- Use 3-5 recurring layout families as a visual grammar. Avoid both monotonous repetition and a random new composition on every slide.',
      '- Keep on-slide copy concise: prefer 2-5 short points, fewer than 520 total bullet characters per slide, and put nuance, transitions, and delivery guidance in speaker notes.',
      '- Use structured metrics for quantified evidence and structured columns for before/after or option comparisons. Do not simulate either with long paragraphs.',
      '- Use an editable chart or table when verified data tells a comparison, trend, composition, or sequence. Never fabricate chart values.',
      '- Use validated source images only through imageAssetId, with attribution retained. Images must support the message rather than decorate empty space.',
      '- Preserve strong alignment, contrast, whitespace, and a restrained palette suitable for the requested audience.',
      '- Use controlled theme rhythm: dark opener and close, a coherent light content run, and no more than one intentional accent interruption unless the user requests otherwise.',
      '- A deck of six or more slides must use at least three layout families and make at least one-third of slides visually structured with evidence, metrics, comparisons, processes, timelines, or source imagery.'
    ].join('\n');
  }
  if (kind === 'sheet' || format === 'xlsx') {
    return [
      '- Separate inputs, calculations, and outputs when the workbook is more than a simple table.',
      '- Use real formulas when the user asks for calculations; do not replace formulas with guessed values.',
      '- Apply meaningful number formats, dates, percentages, currencies, column widths, headers, freezes, and filters.',
      '- Keep source rows intact, make assumptions explicit, and include a summary sheet or chart when it materially improves comprehension.',
      '- Check row/column consistency and derived totals with terminal calculations before finalizing.'
    ].join('\n');
  }
  if (kind === 'resume') {
    return [
      '- Use only supplied facts. Never invent employers, dates, education, contact details, links, achievements, or metrics.',
      '- Make the evidence easy to scan: role, organization, dates, action, scope, and outcome where the source supports them.',
      '- Keep ATS reading order simple and use restrained typography unless the user explicitly requests a visual resume.',
      '- Tailor emphasis and keywords to a supplied role description without claiming experience the user did not provide.',
      '- Surface missing high-value facts in nextQuestions instead of inserting placeholders.'
    ].join('\n');
  }
  if (kind === 'email') {
    return [
      '- Lead with the purpose, make the requested action and owner unambiguous, and keep the message proportionate to the situation.',
      '- Preserve the requested voice. Do not invent approvals, deadlines, recipients, commitments, or incident details.',
      '- Use short paragraphs and bullets only when they improve actionability.'
    ].join('\n');
  }
  return [
    '- Establish an editorial hierarchy: title, executive summary or opening, logically ordered sections, evidence, and a useful close.',
    '- Use tables, charts, callouts, and source images only where they improve understanding. Do not turn every paragraph into a component.',
    '- Keep page density readable, headings specific, and transitions coherent. Avoid repetitive boilerplate and shallow one-paragraph sections.',
    '- For researched work, use claim → evidence → implication → risk → source layering. Distinguish FACT, ANALYSIS, and RECOMMENDATION.',
    '- Add confidence labels, source footnotes, methodology notes, and a sources appendix. No decorative charts without methodology.',
    '- Avoid institutional hype tone. Prefer plain, evidence-backed language over analyst-report theatrics.',
    '- For PDF output, design for stable pagination and print readability; for DOCX, preserve editability and native document structure.'
  ].join('\n');
}

function qualityChecklist(kind: ArtifactKind, format: ArtifactPrimaryFormat): string {
  return [
    '# Publication checklist',
    '',
    `- Correct kind and primary format: ${kind} / ${format}`,
    '- Every explicit user requirement is represented or called out honestly as unavailable.',
    '- Uploaded files and extracted Markdown were read before drafting.',
    '- No placeholders, fabricated facts, unsupported numbers, or invented citations.',
    '- Content has a clear hierarchy and avoids repeated generic layouts or filler.',
    '- Tables and charts use verified values and internally consistent labels.',
    '- Images use valid source asset IDs and retain attribution.',
    '- Artifact schema validates and the primary export opens with the expected file signature.',
    '- Researched artifacts include sources appendix, methodology, limitations, and as-of date.',
    '- Claims carry confidence labels or sourceIds; no unsupported superlatives or fake authority.',
    '- No bullet stuffing or decorative charts without verified data and methodology.'
  ].join('\n');
}

function formatLabel(format: ArtifactPrimaryFormat): string {
  if (format === 'pptx') return 'Presentation';
  if (format === 'xlsx') return 'Spreadsheet';
  if (format === 'docx') return 'Document';
  return 'PDF report';
}
