import { stripSkillTags } from '../src/lib/skills.js';
import type { ArtifactKind, ArtifactPrimaryFormat } from '../src/lib/shared.js';

export type CompiledConstraints = {
  slideCount?: number;
  pageCount?: number;
  sectionCount?: number;
  exactCounts: boolean;
  requiredCharts?: boolean;
  requiredCitations?: boolean;
  hardRules: string[];
};

const slideCountPattern = /\b(?:exactly\s+)?(\d{1,2})\s*(?:-|–|\s)?\s*slides?\b/i;
const pageCountPattern = /\b(?:exactly\s+)?(\d{1,2})\s*(?:-|–|\s)?\s*pages?\b/i;
const sectionCountPattern = /\b(?:exactly\s+)?(\d{1,2})\s*(?:-|–|\s)?\s*(?:sections?|chapters?)\b/i;

export function requestedSlideCount(brief: string): number | undefined {
  const match = stripSkillTags(brief).match(slideCountPattern);
  if (!match) return undefined;
  const count = Number.parseInt(match[1], 10);
  return count > 0 && count <= 30 ? count : undefined;
}

export function requestedPageCount(brief: string): number | undefined {
  const match = stripSkillTags(brief).match(pageCountPattern);
  if (!match) return undefined;
  const count = Number.parseInt(match[1], 10);
  return count > 0 && count <= 24 ? count : undefined;
}

export function requestedSectionCount(brief: string): number | undefined {
  const match = stripSkillTags(brief).match(sectionCountPattern);
  if (!match) return undefined;
  const count = Number.parseInt(match[1], 10);
  return count > 0 && count <= 24 ? count : undefined;
}

function stripSkillTagsPreserveLines(text: string): string {
  return text
    .replace(/(^|\s)@[a-zA-Z][a-zA-Z0-9-]*/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function compileBriefConstraints(brief: string, kind?: ArtifactKind): CompiledConstraints {
  const clean = stripSkillTags(brief);
  const hardRules = stripSkillTagsPreserveLines(brief)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^(?:\d+\.|[-*])\s+\S/.test(line))
    .slice(0, 12);
  const exactCounts = /\b(?:exactly|must be|no more than|no fewer than|hard rules?)\b/i.test(clean);

  return {
    slideCount: kind === 'deck' || /\bslides?\b/i.test(clean) ? requestedSlideCount(clean) : undefined,
    pageCount: requestedPageCount(clean),
    sectionCount: requestedSectionCount(clean),
    exactCounts,
    requiredCharts: /\b(?:charts?|graphs?|visuali[sz]e|data viz)\b/i.test(clean),
    requiredCitations: /\b(?:cite|citations?|sources?|footnotes?)\b/i.test(clean),
    hardRules
  };
}

export function constraintPromptLines(constraints: CompiledConstraints): string[] {
  const lines: string[] = [];
  if (constraints.slideCount) {
    lines.push(`Slide count constraint: produce exactly ${constraints.slideCount} slides.`);
  }
  if (constraints.pageCount) {
    lines.push(`Page count constraint: target ${constraints.pageCount} pages of content.`);
  }
  if (constraints.sectionCount) {
    lines.push(`Section count constraint: produce exactly ${constraints.sectionCount} sections.`);
  }
  if (constraints.requiredCitations) {
    lines.push('Every external factual claim must bind to research sourceIds.');
  }
  if (constraints.requiredCharts) {
    lines.push('Include real chart objects where numeric comparisons or trends exist.');
  }
  if (constraints.hardRules.length > 0) {
    lines.push(`User hard rules:\n${constraints.hardRules.map((rule) => `- ${rule}`).join('\n')}`);
  }
  return lines;
}

export function requestedPrimaryFormat(brief: string): ArtifactPrimaryFormat | undefined {
  const clean = stripSkillTags(brief).toLowerCase();
  if (/\b(?:pptx?|powerpoint|presentation|deck)\b/.test(clean)) return 'pptx';
  if (/\b(?:pdf|report|whitepaper|white paper|memo)\b/.test(clean)) return 'pdf';
  if (/\b(?:xlsx?|spreadsheet|workbook|excel)\b/.test(clean)) return 'xlsx';
  if (/\b(?:docx?|word document)\b/.test(clean)) return 'docx';
  return undefined;
}

export function constraintsViolatedBySlideCount(actual: number, brief: string): string | undefined {
  const requested = requestedSlideCount(brief);
  if (!requested || actual === requested) return undefined;
  return `The user requested ${requested} slides, but the artifact contains ${actual}.`;
}