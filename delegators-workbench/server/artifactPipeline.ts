import { stripSkillTags } from "../src/lib/skills.js";
import type {
  ArtifactDocument,
  ArtifactKind,
  ArtifactPrimaryFormat,
  GenerateArtifactRequest,
} from "../src/lib/shared.js";
import type { ResearchPack } from "./research.js";
import type { ArtifactSkillPack } from "./artifactSkills.js";
import type { SkillDefinition } from "../src/lib/skills.js";
import type {
  ArtifactAsset,
  ArtifactKind as KindAlias,
} from "../src/lib/shared.js";
import {
  audienceCraftLines,
  audiencePreflightLine,
  detectArtifactAudience,
} from "./artifactAudience.js";
import {
  compileBriefConstraints,
  constraintPromptLines,
} from "./constraintCompiler.js";
import {
  selectTemplateScaffold,
  templateScaffoldPromptLines,
} from "./templateRag.js";
import { artifactForModel } from "./artifactAssets.js";
import {
  buildUserPromptContract,
  userPromptContractLines,
} from "./userPromptContract.js";
import { credibilityPromptLines } from "./artifactCredibility.js";
import { diversityPromptLines } from "./diversityPlanner.js";

export type ArtifactParseContext = {
  expectedKind?: KindAlias;
  expectedPrimaryFormat?: ArtifactPrimaryFormat;
  fallbackTone?: string;
  requiredTable?: boolean;
  citationsRequired?: boolean;
  researchConfidence?: "high" | "low" | "none";
  requestedSubject?: string;
  allowedCitationUrls?: Set<string>;
  allowedCitationIds?: Set<string>;
  allowedCitations?: Map<string, string>;
  availableAssets?: ArtifactAsset[];
  sourceBrief?: string;
  sourceEvidence?: string;
};

export type RunPhaseTimer = {
  start: (phase: RunPhase) => void;
  elapsedSeconds: (phase: RunPhase) => number;
  status: (phase: RunPhase, detail: string) => string;
  startedPhases: () => RunPhase[];
  formatSummary: () => string;
};

export type RunPhase =
  "research" | "outline" | "compose" | "inspect" | "export" | "repair";

const phaseLabels: Record<RunPhase, string> = {
  research: "Research",
  outline: "Outline",
  compose: "Compose",
  inspect: "Inspect",
  export: "Export",
  repair: "Repair",
};

const phaseOrder: RunPhase[] = [
  "research",
  "outline",
  "compose",
  "inspect",
  "repair",
  "export",
];

export function createRunPhaseTimer(): RunPhaseTimer {
  const started = new Map<RunPhase, number>();
  return {
    start(phase) {
      started.set(phase, Date.now());
    },
    elapsedSeconds(phase) {
      const at = started.get(phase);
      if (!at) return 0;
      return Math.max(1, Math.round((Date.now() - at) / 1000));
    },
    status(phase, detail) {
      const label = phaseLabels[phase];
      const at = started.get(phase);
      const elapsed = at
        ? Math.max(1, Math.round((Date.now() - at) / 1000))
        : 0;
      return elapsed > 0
        ? `${label} · ${elapsed}s — ${detail}`
        : `${label} — ${detail}`;
    },
    startedPhases() {
      return phaseOrder.filter((phase) => started.has(phase));
    },
    formatSummary() {
      const parts = this.startedPhases().map(
        (phase) => `${phaseLabels[phase]} ${this.elapsedSeconds(phase)}s`,
      );
      return parts.length > 0 ? parts.join(" · ") : "";
    },
  };
}

export function briefIsExplicit(brief: string, kind?: ArtifactKind): boolean {
  const clean = stripSkillTags(brief);
  if (/\b\d+\s*[-–]?\s*slides?\b/i.test(clean)) return true;
  if (/\bslide\s+structure\b/i.test(clean)) return true;
  if (/\b(?:section|chapter)s?\s*:/i.test(clean)) return true;
  if (/\bhard\s+rules?\b/i.test(clean)) return true;
  if (/\boutput\s+requirements?\b/i.test(clean)) return true;
  const numbered = clean.match(/(?:^|\n)\s*\d+\.\s+\S+/gm) ?? [];
  if (numbered.length >= 4) return true;
  if (
    kind === "deck" &&
    /\b(?:cover|executive thesis|appendix|speaker notes?|investor|boardroom)\b/i.test(
      clean,
    )
  ) {
    return true;
  }
  if (
    clean.length >= 400 &&
    /\b(?:must|required|every slide|max \d+ words)\b/i.test(clean)
  )
    return true;
  return false;
}

export function deterministicPreflightReply(
  brief: string,
  kind: ArtifactKind,
  primaryFormat: ArtifactPrimaryFormat,
): string {
  const topic = stripSkillTags(brief)
    .replace(
      /^(?:please\s+)?(?:create|make|build|write|prepare|produce|design|generate)\s+/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  const formatLabel =
    primaryFormat === "pptx"
      ? "presentation"
      : primaryFormat === "pdf"
        ? "report"
        : primaryFormat;
  const profile = detectArtifactAudience(brief, kind);
  const audienceLine = audiencePreflightLine(profile, primaryFormat);
  if (briefIsExplicit(brief, kind)) {
    return `I'll build this as a production-grade ${formatLabel} from your specified structure and constraints${topic ? ` on ${topic}` : ""}. ${audienceLine}`;
  }
  return `I'll shape this ${kind} into a polished ${formatLabel}${topic ? ` focused on ${topic}` : ""}. ${audienceLine}`;
}

export function briefRequiresComputation(brief: string): boolean {
  return /\b(calculate|calculation|formula|forecast|projection|dataset|csv|spreadsheet|parse|transform|convert|statistical|financial model)\b/i.test(
    stripSkillTags(brief),
  );
}

export function shouldUseStructuredPipeline(
  kind: ArtifactKind,
  brief: string,
): boolean {
  const clean = stripSkillTags(brief);
  if (briefRequiresComputation(clean)) return false;
  if (kind === "email") {
    return (
      /\b(memo|escalation|proposal|brief|policy|announcement|multi[- ]page|detailed)\b/i.test(
        clean,
      ) || clean.length >= 280
    );
  }
  if (kind === "resume") {
    return (
      /\b(experience|education|skills|projects|employment|work history|cv|resume)\b/i.test(
        clean,
      ) || clean.length >= 180
    );
  }
  return (
    kind === "deck" ||
    kind === "report" ||
    kind === "assignment" ||
    kind === "sheet"
  );
}

export function shouldSkipProviderInspection(options: {
  explicitBrief: boolean;
  localPassed: boolean;
  blockingIssues: string[];
}): boolean {
  if (options.blockingIssues.length > 0) return true;
  if (options.localPassed && !options.explicitBrief) return true;
  return options.explicitBrief && options.localPassed;
}

export function outlineSchemaForKind(kind: ArtifactKind): string {
  if (kind === "deck") {
    return "Return JSON: { title, audience, tone, design: { template, visualDirection, palette? }, narrativeArc, slides: [{ index, role, title, message, layout, theme?, sourceIds?, needsChart?, needsImage?, speakerNotesHint? }] }. Roles: opener|context|tension|evidence|insight|solution|plan|proof|close.";
  }
  if (kind === "sheet") {
    return "Return JSON: { title, audience, tone, workbookGoal, sheets: [{ name, purpose, columns, rowGroups: [{ label, rows: string[][] }], formulas?: string[] }] }. Separate inputs, calculations, and outputs when needed.";
  }
  if (kind === "resume") {
    return "Return JSON: { title, audience, tone, design: { template }, resumePlan: { name?, headline?, contact?, summary?, skills?, experience: [{ heading, body?, bullets }], projects?, education? } }. Use only supplied facts.";
  }
  if (kind === "email") {
    return "Return JSON: { title, audience, tone, emailPlan: { subject, greeting, purpose, sections: [{ heading, message }], closing, signatureHint? } }. Keep workplace tone tight.";
  }
  return "Return JSON: { title, audience, tone, design: { template, visualDirection }, narrativeArc, sections: [{ index, heading, purpose, sourceIds?, needsChart?, needsTable? }] }.";
}

export function resolveComposeModel(userModel: string): string {
  const lower = userModel.toLowerCase();
  if (lower.includes("ultra")) return "swe-ultra";
  if (lower.includes("pro")) return "swe-pro";
  return "swe-fast";
}

export function resolveRepairModel(userModel: string): string {
  const lower = userModel.toLowerCase();
  if (lower.includes("thinking")) return userModel;
  if (lower.includes("ultra")) return "swe-pro-thinking";
  if (lower.includes("pro")) return "swe-pro-thinking";
  return "swe-fast-thinking";
}

export function buildOutlineMessages(options: {
  artifactKind: ArtifactKind;
  primaryFormat: ArtifactPrimaryFormat;
  cleanBrief: string;
  skillPack: ArtifactSkillPack;
  combinedSourceText: string;
  selectedSkill?: SkillDefinition;
  instructions: string;
  style: string;
  researchPack: ResearchPack | null;
  threadRoutingLines?: string[];
  preferredScaffoldId?: string;
}): Array<{ role: string; content: string }> {
  const schemaHint = outlineSchemaForKind(options.artifactKind);
  const audience = detectArtifactAudience(
    options.cleanBrief,
    options.artifactKind,
  );
  const contract = buildUserPromptContract(
    options.cleanBrief,
    options.artifactKind,
  );
  const scaffold = selectTemplateScaffold(
    options.artifactKind,
    options.cleanBrief,
    options.preferredScaffoldId,
  );
  const hasSources = (options.researchPack?.sources.length ?? 0) > 0;

  return [
    {
      role: "system",
      content: [
        "You are the Delegators Workbench outline architect.",
        "Return only compact JSON. No Markdown. No commentary.",
        "Plan a publication-grade narrative BEFORE writing final copy.",
        "Each slide/section gets one sharp message — never a topic label.",
        "Bind evidence to sourceIds from the research pack when available.",
        "Never invent mergers, acquisitions, valuations, or metrics absent from sources.",
        "Offer layout and role diversity — vary compositions across the deck/report.",
        ...(options.threadRoutingLines ?? []),
        ...audienceCraftLines(audience, options.artifactKind),
        ...credibilityPromptLines(audience, options.artifactKind, {
          needsResearch: hasSources,
          hasSources,
        }),
        ...templateScaffoldPromptLines(scaffold),
        ...diversityPromptLines([]),
        ...userPromptContractLines(contract),
        options.skillPack.guide,
        schemaHint,
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Kind: ${options.artifactKind}`,
        `Primary format: ${options.primaryFormat}`,
        options.selectedSkill ? `Skill: ${options.selectedSkill.tag}` : "",
        `Instructions: ${options.instructions}`,
        `Tone: ${options.style}`,
        `Brief:\n${options.cleanBrief}`,
        options.combinedSourceText
          ? `Sources:\n${options.combinedSourceText}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
}

export function buildComposeFromOutlineMessages(options: {
  artifactKind: ArtifactKind;
  primaryFormat: ArtifactPrimaryFormat;
  cleanBrief: string;
  skillPack: ArtifactSkillPack;
  combinedSourceText: string;
  outlineJson: string;
  selectedSkill?: SkillDefinition;
  instructions: string;
  style: string;
  designPromptLines: string[];
  formatSkillInstructions: string[];
  schemaContract: string;
}): Array<{ role: string; content: string }> {
  const audience = detectArtifactAudience(
    options.cleanBrief,
    options.artifactKind,
  );
  const contract = buildUserPromptContract(
    options.cleanBrief,
    options.artifactKind,
  );
  return [
    {
      role: "system",
      content: [
        "You are Delegators Workbench composing the final artifact from an approved outline.",
        "Return only valid artifact JSON matching the Workbench schema. No Markdown.",
        `kind must be "${options.artifactKind}". primaryFormat must be "${options.primaryFormat}".`,
        "Follow the outline structure exactly — same slide/section count, roles, and narrative arc.",
        "Write concise on-slide/on-page copy; put depth in speaker notes or section body.",
        "Use only sourceIds and facts from the research pack; mark unverified claims honestly.",
        "Never invent mergers, acquisitions, IPOs, or funding rounds unless explicitly sourced.",
        ...audienceCraftLines(audience, options.artifactKind),
        ...userPromptContractLines(contract),
        options.skillPack.guide,
        ...options.formatSkillInstructions,
        ...options.designPromptLines,
        options.schemaContract,
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Skill: ${options.selectedSkill ? options.selectedSkill.tag : options.artifactKind}`,
        `Instructions: ${options.instructions}`,
        `Tone: ${options.style}`,
        `Brief:\n${options.cleanBrief}`,
        `Approved outline:\n${options.outlineJson}`,
        options.combinedSourceText
          ? `Source material:\n${options.combinedSourceText}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
}

export function isBlockingPublishIssue(issue: string): boolean {
  return /requested kind|requested format|primary format|artifact kind is|requested \d+ slides|user requested \d+ slides|missing design\.template|unknown design\.template|does not match the audience baseline|could have been written without reading the brief|institutional hype|anonymous authority|generic anonymous authority|citations\[\] apparatus|missing a sources|source appendix|claim confidence|underdesigned template cover|marketing copy, not a sourced|unsupported numbers|business metrics|merger|acquisition|could not be cleanly verified|citation urls that were not present|mismatched a research source|does not include usable citations|exposed an internal execution|replays the prior thread file|too similar to the prior thread file/i.test(
    issue,
  );
}

export function publishGateBlocks(inspection: {
  issues: string[];
  passed: boolean;
}): boolean {
  if (inspection.passed) return false;
  return inspection.issues.some(isBlockingPublishIssue);
}

export type StructuredPipelineContext = {
  input: Pick<
    GenerateArtifactRequest,
    "sessionKey" | "model" | "threadId" | "style"
  >;
  delegatorsBaseURL: string;
  artifactKind: ArtifactKind;
  primaryFormat: ArtifactPrimaryFormat;
  cleanBrief: string;
  skillPack: ArtifactSkillPack;
  selectedSkill?: SkillDefinition;
  instructions: string;
  combinedSourceText: string;
  parseOptions: ArtifactParseContext;
  designPromptLines: string[];
  formatSkillInstructions: string[];
  schemaContract: string;
  researchPack: ResearchPack | null;
  phaseTimer: RunPhaseTimer;
  completeTurn: (request: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature: number;
  }) => Promise<string>;
};

export function buildTemplateSkeletonFillMessages(options: {
  skeleton: ArtifactDocument;
  cleanBrief: string;
  skillPack: ArtifactSkillPack;
  threadContext?: string;
  combinedSourceText?: string;
  routingLines?: string[];
}): Array<{ role: string; content: string }> {
  const contract = buildUserPromptContract(
    options.cleanBrief,
    options.skeleton.kind,
  );
  return [
    {
      role: "system",
      content: [
        "You fill Delegators Workbench template skeletons.",
        "Return only the full updated artifact JSON. Do not return a patch.",
        "The loaded preview is the structural skeleton — preserve unit count, order, per-unit layout, design.template, themes, and chart/table shells.",
        "Replace placeholder titles, bullets, metrics, and body copy with user facts — do not rebuild the artifact from scratch.",
        ...(options.routingLines ?? []),
        ...userPromptContractLines(contract),
        options.skillPack.guide,
        "Never ship placeholder copy, lorem ipsum, or fabricated citations after filling.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `User brief:\n${options.cleanBrief}`,
        options.threadContext
          ? `Thread context:\n${options.threadContext}`
          : "",
        options.combinedSourceText
          ? `Sources:\n${options.combinedSourceText}`
          : "",
        `Template skeleton JSON (fill this structure):\n${JSON.stringify(artifactForModel(options.skeleton))}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
}
