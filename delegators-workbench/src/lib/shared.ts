import { z } from 'zod';

export const ArtifactKindSchema = z.enum(['resume', 'deck', 'report', 'assignment', 'email', 'sheet']);
export type ArtifactKind = z.infer<typeof ArtifactKindSchema>;

export const SkillStyleSchema = z.enum(['professional', 'campus', 'executive', 'minimal', 'detailed']);
export type SkillStyle = z.infer<typeof SkillStyleSchema>;

export const ArtifactPrimaryFormatSchema = z.enum(['pdf', 'docx', 'pptx', 'xlsx']);
export type ArtifactPrimaryFormat = z.infer<typeof ArtifactPrimaryFormatSchema>;

const boundedText = (max = 4000) => z.string().trim().max(max);
const hexColor = z.string().trim().regex(/^#[0-9a-f]{6}$/i, 'Use a six-digit hex color.');

export const ArtifactDesignSchema = z.object({
  visualDirection: boundedText(500).optional(),
  headingFontFamily: boundedText(80).optional(),
  bodyFontFamily: boundedText(80).optional(),
  pageSize: z.enum(['a4', 'letter', 'legal']).optional(),
  orientation: z.enum(['portrait', 'landscape']).optional(),
  slideAspect: z.enum(['wide', 'standard']).optional(),
  density: z.enum(['compact', 'balanced', 'airy']).optional(),
  // Curated design systems; each maps to a full token set in the exporters.
  // The model picks the one that fits the audience, then may fine-tune palette.
  template: z.enum([
    'executive-slate',
    'editorial-ivory',
    'consulting-mono',
    'modern-indigo',
    'midnight-aurora',
    'bold-pop',
    'cobalt-bold',
    'noir-lumina',
    'editorial-warm',
    'signal-orange',
    'classic-ats'
  ]).optional(),
  includeTableOfContents: z.boolean().optional(),
  includePageNumbers: z.boolean().optional(),
  showSectionNumbers: z.boolean().optional(),
  palette: z.object({
    background: hexColor.optional(),
    surface: hexColor.optional(),
    text: hexColor.optional(),
    muted: hexColor.optional(),
    primary: hexColor.optional(),
    accent: hexColor.optional()
  }).optional()
}).default({});
export type ArtifactDesign = z.infer<typeof ArtifactDesignSchema>;

export const TableSchema = z.object({
  columns: z.array(boundedText(80)).min(1).max(16),
  rows: z.array(z.array(boundedText(400)).max(16)).max(80)
});

// Real data visualization (2026-grade artifacts): rendered as a NATIVE editable
// chart in PowerPoint exports and as crisp vector graphics in PDF exports.
export const ChartSchema = z.object({
  type: z.enum(['bar', 'column', 'line', 'area', 'pie', 'donut']),
  title: boundedText(120).optional(),
  labels: z.array(boundedText(40)).min(1).max(24),
  series: z
    .array(
      z.object({
        name: boundedText(60).min(1),
        values: z.array(z.number().finite()).min(1).max(24)
      })
    )
    .min(1)
    .max(6),
  // Optional unit hint shown on the value axis / legend (e.g. "₹ Cr", "%").
  unit: boundedText(16).optional()
});
export type ArtifactChart = z.infer<typeof ChartSchema>;

export const ArtifactAssetSchema = z.object({
  id: boundedText(40).min(1).regex(/^[A-Za-z0-9_-]+$/),
  mimeType: z.enum(['image/png', 'image/jpeg']),
  dataUri: z.string().max(2_100_000).refine(
    (value) => /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value),
    'Image assets must use a PNG or JPEG data URI.'
  ),
  sourceUrl: z.string().trim().url().max(1200).optional(),
  sourcePageUrl: z.string().trim().url().max(1200).optional(),
  alt: boundedText(300).min(1),
  attribution: boundedText(300).min(1),
  width: z.number().int().min(1).max(12_000),
  height: z.number().int().min(1).max(12_000)
});
export type ArtifactAsset = z.infer<typeof ArtifactAssetSchema>;

export const ArtifactSectionSchema = z.object({
  heading: boundedText(140).min(1),
  body: boundedText(12000).default(''),
  bullets: z.array(boundedText(700)).max(24).default([]),
  sourceIds: z.array(boundedText(12).regex(/^S\d+$/)).max(8).optional(),
  imageAssetId: boundedText(40).regex(/^[A-Za-z0-9_-]+$/).optional(),
  table: TableSchema.optional(),
  chart: ChartSchema.optional()
});

export const SlideMetricSchema = z.object({
  value: boundedText(40).min(1),
  label: boundedText(100).min(1),
  detail: boundedText(180).optional()
});

export const SlideColumnSchema = z.object({
  heading: boundedText(80).min(1),
  body: boundedText(500).optional(),
  bullets: z.array(boundedText(180)).max(5).default([])
});

export const SlideSchema = z.object({
  title: boundedText(120).min(1),
  role: z.enum(['opener', 'context', 'tension', 'evidence', 'insight', 'solution', 'plan', 'proof', 'close']).optional(),
  eyebrow: boundedText(60).optional(),
  subtitle: boundedText(180).optional(),
  bullets: z.array(boundedText(220)).max(8).default([]),
  sourceIds: z.array(boundedText(12).regex(/^S\d+$/)).max(8).optional(),
  speakerNotes: boundedText(1200).optional(),
  layout: z.enum([
    'cover',
    'statement',
    'split',
    'grid',
    'list',
    'chart',
    'metric',
    'comparison',
    'timeline',
    'process',
    'quote',
    'image'
  ]).optional(),
  theme: z.enum(['light', 'dark', 'accent']).optional(),
  tone: z.enum(['lime', 'orange', 'pink', 'yellow', 'cobalt', 'ivory', 'noir', 'forest', 'white']).optional(),
  imageAssetId: boundedText(40).regex(/^[A-Za-z0-9_-]+$/).optional(),
  takeaway: boundedText(220).optional(),
  metrics: z.array(SlideMetricSchema).min(1).max(4).optional(),
  columns: z.array(SlideColumnSchema).min(2).max(3).optional(),
  quote: boundedText(500).optional(),
  quoteAttribution: boundedText(160).optional(),
  table: TableSchema.optional(),
  chart: ChartSchema.optional()
}).superRefine((slide, ctx) => {
  const hasContent = slide.bullets.length > 0 ||
    Boolean(slide.subtitle || slide.imageAssetId || slide.takeaway || slide.quote || slide.table || slide.chart) ||
    Boolean(slide.metrics?.length || slide.columns?.length);
  if (!hasContent) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['bullets'],
      message: 'Slides must include a subtitle, bullets, visual data, columns, a quote, or an image.'
    });
  }
  if (slide.layout === 'metric' && !slide.metrics?.length && !slide.bullets.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['metrics'],
      message: 'Metric slides require structured metrics or metric-led bullets.'
    });
  }
  if (slide.layout === 'comparison' && slide.columns?.length !== 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['columns'],
      message: 'Comparison slides require exactly two structured columns.'
    });
  }
  if (slide.layout === 'quote' && !slide.quote) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['quote'],
      message: 'Quote slides require quote text.'
    });
  }
  if (slide.layout === 'image' && !slide.imageAssetId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['imageAssetId'],
      message: 'Image-led slides require a valid imageAssetId.'
    });
  }
});

export const ResumeSchema = z.object({
  name: boundedText(120).optional(),
  headline: boundedText(180).optional(),
  contact: z.array(boundedText(160)).max(8).default([]),
  summary: boundedText(1200).optional(),
  skills: z.array(boundedText(120)).max(40).default([]),
  experience: z.array(ArtifactSectionSchema).max(12).default([]),
  education: z.array(ArtifactSectionSchema).max(8).default([]),
  projects: z.array(ArtifactSectionSchema).max(12).default([])
});

export const SheetSchema = z.object({
  sheets: z
    .array(
      z.object({
        name: boundedText(31).min(1),
        columns: z.array(boundedText(80)).min(1).max(30),
        rows: z.array(z.array(boundedText(500)).max(30)).max(500)
      })
    )
    .min(1)
    .max(6)
});

const ArtifactDocumentBaseSchema = z.object({
  kind: ArtifactKindSchema,
  primaryFormat: ArtifactPrimaryFormatSchema.optional(),
  title: boundedText(140).min(1),
  audience: boundedText(180).min(1),
  tone: boundedText(80).min(1),
  executiveSummary: boundedText(1600).default(''),
  sections: z.array(ArtifactSectionSchema).min(1).max(24),
  slides: z.array(SlideSchema).max(30).optional(),
  assets: z.array(ArtifactAssetSchema).max(3).default([]),
  resume: ResumeSchema.optional(),
  sheet: SheetSchema.optional(),
  citations: z
    .array(
      z.object({
        id: boundedText(12).regex(/^S\d+$/).optional(),
        label: boundedText(180).min(1),
        url: boundedText(500).optional()
      })
    )
    .max(20)
    .default([]),
  nextQuestions: z.array(boundedText(240)).max(6).default([]),
  design: ArtifactDesignSchema
});

const forbiddenPlaceholderPatterns = [
  /\blorem ipsum\b/i,
  /\bTBD\b/,
  /\bto be determined\b/i,
  /\bdummy (?:content|data|text)\b/i,
  /\[(?:project lead name|name|full name|email(?: address)?|phone(?: number)?|company(?: name)?|recipient|insert [^\]]+)\]/i,
  /{{\s*(?:name|email|phone|company|recipient|title|date)\s*}}/i
];

function findForbiddenPlaceholder(value: unknown, path: Array<string | number> = []): {
  path: Array<string | number>;
  value: string;
} | null {
  if (typeof value === 'string') {
    return forbiddenPlaceholderPatterns.some((pattern) => pattern.test(value))
      ? { path, value }
      : null;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findForbiddenPlaceholder(value[index], [...path, index]);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const found = findForbiddenPlaceholder(child, [...path, key]);
      if (found) return found;
    }
  }
  return null;
}

export const ArtifactDocumentSchema = ArtifactDocumentBaseSchema.superRefine((artifact, ctx) => {
  if (artifact.kind === 'resume' && !artifact.resume) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['resume'],
      message: 'Resume artifacts must include structured resume data.'
    });
  }

  if (artifact.kind === 'deck' && !artifact.slides?.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['slides'],
      message: 'Deck artifacts must include slides.'
    });
  }

  if (artifact.primaryFormat === 'pptx' && artifact.kind !== 'deck' && !artifact.slides?.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['primaryFormat'],
      message: 'PPTX primary output requires a deck artifact or slides.'
    });
  }

  if (artifact.primaryFormat === 'xlsx' && artifact.kind !== 'sheet' && !artifact.sheet) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['primaryFormat'],
      message: 'XLSX primary output requires spreadsheet data.'
    });
  }

  const hasSectionTable = artifact.sections.some((section) => Boolean(section.table));
  if (artifact.kind === 'sheet' && !artifact.sheet && !hasSectionTable) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sheet'],
      message: 'Spreadsheet artifacts must include a workbook sheet or real section tables.'
    });
  }

  const placeholder = findForbiddenPlaceholder(artifact);
  if (placeholder) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: placeholder.path,
      message: 'Artifacts must not contain unresolved template placeholders.'
    });
  }
});

export type ArtifactDocument = z.infer<typeof ArtifactDocumentSchema>;
export type ArtifactSection = z.infer<typeof ArtifactSectionSchema>;
export type Slide = z.infer<typeof SlideSchema>;

export const EndpointSchema = z.string().trim().url().max(300);

export const SessionKeySchema = z
  .string()
  .trim()
  .min(16)
  .max(240)
  .refine(
    (value) => value.startsWith('sess_') || value.startsWith('wb_') || value.startsWith('sk-'),
    'API key must start with sess_ or wb_ for Delegators, or sk- for direct provider testing.'
  );


export const WorkbenchReferenceInputSchema = z.object({
  id: boundedText(80).optional(),
  kind: z.enum(['file', 'url', 'text']),
  name: boundedText(180).optional(),
  imageIndex: z.number().int().min(1).max(8).optional(),
  mimeType: boundedText(120).optional(),
  size: z.number().int().min(0).max(8 * 1024 * 1024).optional(),
  url: z.string().trim().url().max(1200).optional(),
  text: z.string().max(120000).optional(),
  dataBase64: z.string().max(12 * 1024 * 1024).optional()
}).superRefine((reference, ctx) => {
  if (reference.kind === 'url' && !reference.url) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['url'], message: 'URL references require a URL.' });
  }
  if (reference.kind === 'text' && !reference.text?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['text'], message: 'Text references require text.' });
  }
  if (reference.kind === 'file' && (!reference.name || !reference.dataBase64)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dataBase64'], message: 'File references require a filename and base64 data.' });
  }
});
export type WorkbenchReferenceInput = z.infer<typeof WorkbenchReferenceInputSchema>;

export const WorkbenchReferencesSchema = z.array(WorkbenchReferenceInputSchema).max(8).default([]);

export const WorkbenchConversationTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: boundedText(8000).min(1)
});
export type WorkbenchConversationTurn = z.infer<typeof WorkbenchConversationTurnSchema>;

export const WorkbenchConversationSchema = z
  .array(WorkbenchConversationTurnSchema)
  .max(20)
  .default([]);

export const GenerateArtifactRequestSchema = z.object({
  endpoint: EndpointSchema,
  sessionKey: SessionKeySchema,
  threadId: boundedText(120).min(1).optional(),
  model: z.string().trim().min(1).max(90),
  skill: ArtifactKindSchema,
  skillId: boundedText(80).optional(),
  outputFormat: ArtifactPrimaryFormatSchema.optional(),
  style: SkillStyleSchema,
  brief: boundedText(24000).min(12),
  sourceText: boundedText(120000).optional(),
  conversation: WorkbenchConversationSchema.optional(),
  priorArtifacts: z.array(ArtifactDocumentSchema).max(6).optional(),
  references: WorkbenchReferencesSchema.optional(),
  templateId: boundedText(120).optional(),
  scaffoldId: boundedText(80).optional(),
  designPreset: boundedText(80).optional()
});

export type GenerateArtifactRequest = z.infer<typeof GenerateArtifactRequestSchema>;

export const RefineArtifactRequestSchema = z.object({
  endpoint: EndpointSchema,
  sessionKey: SessionKeySchema,
  threadId: boundedText(120).min(1).optional(),
  model: z.string().trim().min(1).max(90),
  instruction: boundedText(8000).min(4),
  artifact: ArtifactDocumentSchema,
  conversation: WorkbenchConversationSchema.optional(),
  priorArtifacts: z.array(ArtifactDocumentSchema).max(6).optional(),
  references: WorkbenchReferencesSchema.optional(),
  templateId: boundedText(120).optional(),
  scaffoldId: boundedText(80).optional(),
  designPreset: boundedText(80).optional()
});

export const ProgressStatusSchema = z.enum(['pending', 'active', 'done', 'blocked']);
export type ProgressStatus = z.infer<typeof ProgressStatusSchema>;

export const WorkbenchProgressItemSchema = z.object({
  id: boundedText(80).min(1),
  label: boundedText(120).min(1),
  detail: boundedText(300).optional(),
  status: ProgressStatusSchema
});
export type WorkbenchProgressItem = z.infer<typeof WorkbenchProgressItemSchema>;

export const WorkbenchQuestionItemSchema = z.object({
  id: boundedText(80).min(1),
  question: boundedText(300).min(1),
  options: z.array(boundedText(120).min(1)).max(4).default([]),
  allowCustom: z.boolean().default(true)
});
export type WorkbenchQuestionItem = z.infer<typeof WorkbenchQuestionItemSchema>;

export const WorkbenchQuestionSchema = z.object({
  question: boundedText(300).min(1),
  questions: z.array(WorkbenchQuestionItemSchema).min(1).max(4).optional()
});
export type WorkbenchQuestion = z.infer<typeof WorkbenchQuestionSchema>;

export const WorkbenchStreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('status'), message: boundedText(240).min(1) }),
  z.object({
    type: z.literal('plan'),
    title: boundedText(160).min(1),
    items: z.array(WorkbenchProgressItemSchema).min(1).max(6)
  }),
  z.object({ type: z.literal('checklist'), items: z.array(WorkbenchProgressItemSchema).min(1).max(8) }),
  // Conversational assistant prose surfaced in the chat transcript while the
  // run continues (Claude-style: reply first, then questions, then follow-up).
  z.object({ type: z.literal('message'), text: boundedText(2000).min(1) }),
  z.object({ type: z.literal('question') }).merge(WorkbenchQuestionSchema),
  z.object({ type: z.literal('artifact'), artifact: ArtifactDocumentSchema }),
  z.object({ type: z.literal('error'), message: boundedText(500).min(1) })
]);
export type WorkbenchStreamEvent = z.infer<typeof WorkbenchStreamEventSchema>;

export const WorkbenchRunOperationSchema = z.enum(['generate', 'refine']);
export type WorkbenchRunOperation = z.infer<typeof WorkbenchRunOperationSchema>;

export const WorkbenchRunStatusSchema = z.enum([
  'queued',
  'running',
  'waiting_input',
  'cancelling',
  'interrupted',
  'cancelled',
  'failed',
  'completed'
]);
export type WorkbenchRunStatus = z.infer<typeof WorkbenchRunStatusSchema>;

export const WorkbenchRunStageSchema = z.enum([
  'intake',
  'inspect_inputs',
  'plan',
  'research',
  'ground',
  'outline',
  'compose',
  'compile',
  'inspect',
  'repair',
  'publish'
]);
export type WorkbenchRunStage = z.infer<typeof WorkbenchRunStageSchema>;

export const CreateWorkbenchRunRequestSchema = z.discriminatedUnion('operation', [
  GenerateArtifactRequestSchema.extend({ operation: z.literal('generate') }),
  RefineArtifactRequestSchema.extend({ operation: z.literal('refine') })
]);
export type CreateWorkbenchRunRequest = z.infer<typeof CreateWorkbenchRunRequestSchema>;

export const WorkbenchRunCheckpointSchema = z.object({
  phase: WorkbenchRunStageSchema,
  updatedAt: z.string().datetime(),
  note: boundedText(240).optional()
});
export type WorkbenchRunCheckpoint = z.infer<typeof WorkbenchRunCheckpointSchema>;

export const WorkbenchRunSchema = z.object({
  id: boundedText(100).min(1),
  operation: WorkbenchRunOperationSchema,
  status: WorkbenchRunStatusSchema,
  stage: WorkbenchRunStageSchema,
  threadId: boundedText(120).optional(),
  ownerSubject: boundedText(96).optional(),
  endpoint: EndpointSchema,
  model: boundedText(90).min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  checkpoint: WorkbenchRunCheckpointSchema.optional(),
  artifactHistory: z.array(ArtifactDocumentSchema).max(12).optional(),
  artifact: ArtifactDocumentSchema.optional(),
  error: boundedText(500).optional()
});
export type WorkbenchRun = z.infer<typeof WorkbenchRunSchema>;

export const WorkbenchRunEventSchema = z.object({
  id: boundedText(100).min(1),
  runId: boundedText(100).min(1),
  createdAt: z.string().datetime(),
  stage: WorkbenchRunStageSchema,
  event: WorkbenchStreamEventSchema
});
export type WorkbenchRunEvent = z.infer<typeof WorkbenchRunEventSchema>;

export const WorkbenchRunInstructionSchema = z.object({
  instruction: boundedText(8000).min(1)
});

export const ArtifactExportFormatSchema = z.enum(['pdf', 'docx', 'pptx', 'xlsx', 'zip']);
export type ArtifactExportFormat = z.infer<typeof ArtifactExportFormatSchema>;

export const ExportArtifactRequestSchema = z.object({
  format: ArtifactExportFormatSchema,
  artifact: ArtifactDocumentSchema
});

export const skillInstructions: Record<ArtifactKind, string> = {
  resume:
    'Create a truthful resume or cover-letter artifact. Follow the user’s requested format and visual direction; use measurable achievements only when source material supports them.',
  deck:
    'Create a complete presentation that follows the user’s requested visual direction, structure, slide count, and content density.',
  report:
    'Create a complete document that follows the user’s requested structure, typography, page setup, and visual direction while keeping claims defensible.',
  assignment:
    'Create a submission-ready assignment that follows the user’s requested academic structure and formatting. Mark missing source facts as questions.',
  email:
    'Create ready-to-use communication that follows the user’s requested tone, length, structure, and formatting.',
  sheet:
    'Create an editable workbook that follows the user’s requested sheet structure, formulas, number formats, and visual treatment.'
};

export const skillLabels: Record<ArtifactKind, string> = {
  resume: 'Resume Builder',
  deck: 'PPT Deck',
  report: 'Report PDF',
  assignment: 'Assignment',
  email: 'Office Mail',
  sheet: 'Spreadsheet'
};
