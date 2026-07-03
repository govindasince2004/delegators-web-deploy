import type { ArtifactKind, ArtifactPrimaryFormat } from './shared.js';

export type SkillCategory = 'Career' | 'Office' | 'College' | 'Sheets' | 'Slides';

export type SkillDefinition = {
  id: string;
  tag: string;
  aliases: string[];
  kind: ArtifactKind;
  label: string;
  category: SkillCategory;
  description: string;
  instruction: string;
  primaryOutput: ArtifactPrimaryFormat;
  outputs: string[];
};

export const skillCatalog = [
  {
    id: 'ppt',
    tag: '@ppt',
    aliases: ['@ppt', '@slides', '@deck', '@presentation'],
    kind: 'deck',
    label: 'PPT Deck',
    category: 'Slides',
    description: 'PowerPoint-ready decks with concise slides and speaker notes.',
    instruction:
      'Create a presentation that follows the user’s requested audience, structure, visual direction, fonts, colors, density, and slide count. Return slide objects and speaker notes where useful.',
    primaryOutput: 'pptx',
    outputs: ['pptx', 'pdf', 'zip']
  },
  {
    id: 'pdf',
    tag: '@pdf',
    aliases: ['@pdf', '@report', '@writeup'],
    kind: 'report',
    label: 'PDF Report',
    category: 'Office',
    description: 'Structured reports, project PDFs, and formal writeups.',
    instruction:
      'Create a complete PDF-ready document that follows the user’s requested structure, paper size, orientation, typography, palette, and level of detail.',
    primaryOutput: 'pdf',
    outputs: ['pdf', 'docx', 'zip']
  },
  {
    id: 'word',
    tag: '@word',
    aliases: ['@word', '@docx', '@document', '@doc'],
    kind: 'report',
    label: 'Word Document',
    category: 'Office',
    description: 'Editable Word documents, briefs, policies, and formatted writeups.',
    instruction:
      'Create an editable Word document that follows the user’s requested structure, page setup, typography, palette, tables, and level of detail.',
    primaryOutput: 'docx',
    outputs: ['docx', 'pdf', 'zip']
  },
  {
    id: 'resume',
    tag: '@resume',
    aliases: ['@resume', '@cv', '@ats'],
    kind: 'resume',
    label: 'Resume',
    category: 'Career',
    description: 'Truthful ATS-friendly resumes for students and employees.',
    instruction:
      'Create a truthful resume that follows the user’s requested structure and visual direction while remaining readable and ATS-friendly when requested. Do not invent companies, marks, dates, projects, achievements, phone numbers, links, or metrics.',
    primaryOutput: 'docx',
    outputs: ['pdf', 'docx', 'zip']
  },
  {
    id: 'cover-letter',
    tag: '@coverletter',
    aliases: ['@coverletter', '@cover', '@letter'],
    kind: 'resume',
    label: 'Cover Letter',
    category: 'Career',
    description: 'Role-specific cover letters using only supplied facts.',
    instruction:
      'Create a role-specific cover letter using the user’s requested structure and visual direction. Use only supplied facts and ask for missing company or role details.',
    primaryOutput: 'docx',
    outputs: ['pdf', 'docx', 'zip']
  },
  {
    id: 'assignment',
    tag: '@assignment',
    aliases: ['@assignment', '@homework', '@school', '@college'],
    kind: 'assignment',
    label: 'Assignment',
    category: 'College',
    description: 'Submission-ready academic drafts and explanation notes.',
    instruction:
      'Create a submission-ready assignment draft that follows the requested structure, citation style, page setup, and visual direction. Do not fabricate sources, marks, professor names, or required readings.',
    primaryOutput: 'docx',
    outputs: ['pdf', 'docx', 'zip']
  },
  {
    id: 'project',
    tag: '@project',
    aliases: ['@project', '@synopsis', '@minorproject', '@majorproject'],
    kind: 'report',
    label: 'Project Report',
    category: 'College',
    description: 'College project reports, abstracts, synopsis, and viva notes.',
    instruction:
      'Create a college project document that follows the user’s requested sections, format, visual direction, and academic constraints. When no structure is specified, use a conventional project-report structure.',
    primaryOutput: 'pdf',
    outputs: ['pdf', 'docx', 'zip']
  },
  {
    id: 'email',
    tag: '@email',
    aliases: ['@email', '@mail', '@memo', '@reply'],
    kind: 'email',
    label: 'Office Mail',
    category: 'Office',
    description: 'Concise workplace emails, replies, escalations, and memos.',
    instruction:
      'Create workplace communication with the user’s requested tone, structure, length, and presentation. Do not invent commitments or approvals.',
    primaryOutput: 'docx',
    outputs: ['pdf', 'docx', 'zip']
  },
  {
    id: 'xlsx',
    tag: '@xlsx',
    aliases: ['@xlsx', '@excel', '@sheet', '@spreadsheet', '@csv'],
    kind: 'sheet',
    label: 'Spreadsheet',
    category: 'Sheets',
    description: 'Clean tables and Excel-ready workbooks from pasted data.',
    instruction:
      'Create an editable spreadsheet that follows the user’s requested sheets, columns, formulas, number formats, colors, and table organization.',
    primaryOutput: 'xlsx',
    outputs: ['xlsx', 'zip']
  },
  {
    id: 'proposal',
    tag: '@proposal',
    aliases: ['@proposal', '@pitch', '@brief'],
    kind: 'report',
    label: 'Proposal',
    category: 'Office',
    description: 'Client proposals, project briefs, and internal approval docs.',
    instruction:
      'Create a practical proposal that follows the user’s requested structure and visual direction. When no structure is specified, cover context, scope, deliverables, timeline, risks, and next steps. Avoid unsupported pricing or guarantees.',
    primaryOutput: 'docx',
    outputs: ['pdf', 'docx', 'zip']
  },
  {
    id: 'sop',
    tag: '@sop',
    aliases: ['@sop', '@statement', '@lor'],
    kind: 'report',
    label: 'SOP Draft',
    category: 'Career',
    description: 'Statement of purpose drafts and application narratives.',
    instruction:
      'Create an honest application narrative using supplied education, goals, projects, and constraints. Do not invent admissions facts.',
    primaryOutput: 'docx',
    outputs: ['pdf', 'docx', 'zip']
  }
] satisfies SkillDefinition[];

export type SkillId = (typeof skillCatalog)[number]['id'];

export function findSkillById(id: string): SkillDefinition | undefined {
  return skillCatalog.find((skill) => skill.id === id);
}

export function findSkillByTag(tag: string): SkillDefinition | undefined {
  const normalized = normalizeTag(tag);
  return skillCatalog.find((skill) => skill.aliases.includes(normalized));
}

export function resolveSkillFromText(text: string): SkillDefinition | undefined {
  const tags = text.match(/(^|\s)(@[a-zA-Z][a-zA-Z0-9-]*)/g) ?? [];
  for (const raw of tags) {
    const skill = findSkillByTag(raw.trim());
    if (skill) return skill;
  }
  return undefined;
}

export function stripSkillTags(text: string): string {
  return text.replace(/(^|\s)@[a-zA-Z][a-zA-Z0-9-]*/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeTag(tag: string): string {
  const trimmed = tag.trim().toLowerCase();
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}
