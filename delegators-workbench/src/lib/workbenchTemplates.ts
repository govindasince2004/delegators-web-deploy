import type { ArtifactKind } from './shared.js';
import type { SkillId } from './skills.js';
import { findSkillById } from './skills.js';
import {
  filterByAudience,
  premiumSeedToWorkbenchTemplate,
  premiumTemplateCatalog,
  templateAudienceTabs,
  type TemplateAudience
} from './workbenchTemplateCatalog.js';
import { peakArtifactSlideSummary } from './peakArtifacts/registry.js';
import { peakTemplateSeeds } from './peakTemplateSeeds.js';
import { buildTemplateDisplayNameMap } from './templateDisplayNames.js';

export { filterByAudience, templateAudienceTabs, type TemplateAudience };

export type TemplateSource =
  | 'microsoft-create'
  | 'kingsoft-wps'
  | 'canva'
  | 'google'
  | 'notion'
  | 'workbench-curated';

export type TemplateFormatFilter = 'all' | ArtifactKind;

export type WorkbenchTemplate = {
  id: string;
  name: string;
  category: string;
  format: ArtifactKind;
  skillId: SkillId;
  thumbnail?: string;
  sourceUrl: string;
  description: string;
  useCase: string;
  source: TemplateSource;
  tags: string[];
  designPreset?: string;
  scaffoldId?: string;
  visualDirection?: string;
  audience?: string;
  visualStyle?: string;
  structureHints?: string[];
  featured: boolean;
  sortOrder: number;
  starterPrompt: string;
  peakArtifactId?: string;
  peakFamily?: string;
};

const MS_PPT = 'https://powerpoint.cloud.microsoft/create/en/';
const MS_XLS = 'https://excel.cloud.microsoft/create/en/templates/';
const MS_WORD = 'https://word.cloud.microsoft/create/en/templates/';
const MS_PITCH = 'https://powerpoint.cloud.microsoft/create/en/pitch-deck-templates/';

type TemplateSeed = Omit<WorkbenchTemplate, 'thumbnail'> & {
  thumbFolder?: 'pptx' | 'excel' | 'pdf' | 'resume';
  thumbIndex?: number;
};

/** Strips legacy thumb metadata; list UI uses CSS mini-previews instead of PNG paths. */
function finalizeTemplate(seed: TemplateSeed): WorkbenchTemplate {
  const { thumbFolder: _thumbFolder, thumbIndex: _thumbIndex, ...rest } = seed;
  return rest;
}

const deckSeeds: TemplateSeed[] = [
  {
    id: 'wb-midnight-investor',
    name: 'Midnight Aurora Pitch',
    category: 'Investor pitch',
    format: 'deck',
    skillId: 'ppt',
    thumbFolder: 'pptx',
    thumbIndex: 1,
    sourceUrl: MS_PITCH,
    description: 'Cinematic dark investor deck with bold metrics, traction charts, and a clean ask slide.',
    useCase: 'Fundraising, seed/Series A narrative, product strategy reviews.',
    source: 'workbench-curated',
    tags: ['investor', 'dark', 'metrics', '12-slide'],
    designPreset: 'bold-pop',
    scaffoldId: 'investor-12',
    peakArtifactId: 'peak-xboard-lime-hr',
    peakFamily: 'xboard-lime',
    visualDirection: 'Lime agenda, orange ask, pink traction chart, yellow TAM — mapped from Xboard peak reference.',
    audience: 'Investors and fundraising stakeholders',
    visualStyle: 'Bold lime-orange-pink-yellow color-block investor deck with real slide map',
    structureHints: [
      '10-slide color-block arc: agenda, cover, ask, metrics, traction, comparison, team, TAM, facts, close',
      'Preserve per-slide tone blocks from peak artifact harness'
    ],
    featured: true,
    sortOrder: 1,
    starterPrompt: 'Create a 12-slide investor pitch deck with traction metrics, market sizing, team, and use-of-funds slides.'
  },
  {
    id: 'ms-aura-deck',
    name: 'Aura Presentation',
    category: 'Business deck',
    format: 'deck',
    skillId: 'ppt',
    thumbFolder: 'pptx',
    thumbIndex: 2,
    sourceUrl: 'https://powerpoint.cloud.microsoft/create/en/presentation-maker/',
    description: 'Microsoft Create flagship deck with organic shapes and calm professional pacing.',
    useCase: 'General business presentations and client updates.',
    source: 'microsoft-create',
    tags: ['business', 'microsoft', 'clean'],
    designPreset: 'midnight-aurora',
    featured: true,
    sortOrder: 2,
    starterPrompt: 'Create a polished 10-slide business presentation with agenda, insights, and next steps.'
  },
  {
    id: 'wb-executive-board',
    name: 'Executive Slate Board',
    category: 'Board briefing',
    format: 'deck',
    skillId: 'ppt',
    thumbFolder: 'pptx',
    thumbIndex: 3,
    sourceUrl: MS_PPT,
    description: 'Boardroom-ready 8-slide arc: BLUF, risks, evidence, decision, and plan.',
    useCase: 'Board meetings, executive briefings, quarterly reviews.',
    source: 'workbench-curated',
    tags: ['board', 'executive', '8-slide'],
    designPreset: 'executive-slate',
    scaffoldId: 'board-8',
    audience: 'Board members and executive leadership',
    visualStyle: 'Boardroom slate palette with BLUF-first hierarchy',
    structureHints: [
      '8-slide board arc: BLUF, context, risk, evidence, decision, plan, proof, close',
      'Open with the decision or recommendation'
    ],
    featured: true,
    sortOrder: 3,
    starterPrompt: 'Create an 8-slide board briefing with BLUF opener, risk view, evidence, and decision slide.'
  },
  {
    id: 'ms-sales-deck',
    name: 'Business Sales Deck',
    category: 'Sales deck',
    format: 'deck',
    skillId: 'ppt',
    thumbFolder: 'pptx',
    thumbIndex: 4,
    sourceUrl: 'https://powerpoint.cloud.microsoft/create/en/sales-presentations/',
    description: 'Sales narrative with proof points, comparison, and customer outcomes.',
    useCase: 'B2B sales calls, pipeline reviews, account planning.',
    source: 'microsoft-create',
    tags: ['sales', 'b2b', 'comparison'],
    designPreset: 'executive-slate',
    featured: false,
    sortOrder: 4,
    starterPrompt: 'Create a sales presentation with problem framing, solution proof, and customer outcomes.'
  },
  {
    id: 'ms-financial-deck',
    name: 'Financial Review',
    category: 'Financial deck',
    format: 'deck',
    skillId: 'ppt',
    thumbFolder: 'pptx',
    thumbIndex: 5,
    sourceUrl: 'https://powerpoint.cloud.microsoft/create/en/financial-presentations/',
    description: 'Quarterly financial storytelling with charts, variance commentary, and forecast slides.',
    useCase: 'CFO reviews, investor updates, budget readouts.',
    source: 'microsoft-create',
    tags: ['finance', 'charts', 'quarterly'],
    designPreset: 'consulting-mono',
    featured: false,
    sortOrder: 5,
    starterPrompt: 'Create a financial review deck with revenue trends, margin analysis, and forecast charts.'
  },
  {
    id: 'wb-signal-launch',
    name: 'Signal Orange Launch',
    category: 'Product launch',
    format: 'deck',
    skillId: 'ppt',
    thumbFolder: 'pptx',
    thumbIndex: 6,
    sourceUrl: MS_PPT,
    description: 'High-energy product launch with bold accent panels and roadmap timeline.',
    useCase: 'Product launches, feature announcements, GTM kickoffs.',
    source: 'workbench-curated',
    tags: ['product', 'launch', 'bold'],
    designPreset: 'signal-orange',
    featured: true,
    sortOrder: 6,
    starterPrompt: 'Create a product launch deck with positioning, feature highlights, roadmap, and GTM plan.'
  },
  {
    id: 'canva-pitch-pro',
    name: 'Canva Pitch Pro',
    category: 'Startup pitch',
    format: 'deck',
    skillId: 'ppt',
    thumbFolder: 'pptx',
    thumbIndex: 1,
    sourceUrl: 'https://www.canva.com/presentations/templates/pitch-deck/',
    description: 'Startup pitch structure with bold hero slides and investor-friendly pacing.',
    useCase: 'Demo days, accelerator pitches, angel meetings.',
    source: 'canva',
    tags: ['startup', 'pitch', 'canva'],
    designPreset: 'cobalt-bold',
    scaffoldId: 'investor-12',
    featured: false,
    sortOrder: 7,
    starterPrompt: 'Create a startup pitch deck with problem, solution, traction, and fundraising ask.'
  },
  {
    id: 'wb-academic-teach',
    name: 'Bold Pop Academic',
    category: 'Academic lecture',
    format: 'deck',
    skillId: 'ppt',
    thumbFolder: 'pptx',
    thumbIndex: 2,
    sourceUrl: MS_PPT,
    description: 'Teaching deck with readable hierarchy, citations, and discussion prompts.',
    useCase: 'College lectures, seminars, and student presentations.',
    source: 'workbench-curated',
    tags: ['academic', 'teaching', 'readable'],
    designPreset: 'bold-pop',
    scaffoldId: 'academic-10',
    audience: 'Students, faculty, and seminar audiences',
    visualStyle: 'Readable academic hierarchy with citation-friendly evidence slides',
    structureHints: [
      '10-slide teaching arc with theory, evidence, critique, and synthesis',
      'Include discussion prompts on insight slides'
    ],
    featured: false,
    sortOrder: 8,
    starterPrompt: 'Create a 10-slide academic lecture deck with theory, evidence, critique, and synthesis.'
  },
  {
    id: 'ms-marketing-deck',
    name: 'Marketing Campaign',
    category: 'Marketing deck',
    format: 'deck',
    skillId: 'ppt',
    thumbFolder: 'pptx',
    thumbIndex: 3,
    sourceUrl: 'https://powerpoint.cloud.microsoft/create/en/marketing-presentations/',
    description: 'Campaign overview with audience segments, channel plan, and KPI targets.',
    useCase: 'Marketing reviews, campaign kickoffs, agency pitches.',
    source: 'microsoft-create',
    tags: ['marketing', 'campaign', 'kpi'],
    designPreset: 'noir-lumina',
    featured: false,
    sortOrder: 9,
    starterPrompt: 'Create a marketing campaign deck with audience, messaging, channels, and KPI targets.'
  },
  {
    id: 'ms-timeline-deck',
    name: 'Timeline Roadmap',
    category: 'Roadmap',
    format: 'deck',
    skillId: 'ppt',
    thumbFolder: 'pptx',
    thumbIndex: 4,
    sourceUrl: 'https://powerpoint.cloud.microsoft/create/en/timeline-slide-templates/',
    description: 'Milestone timeline slides for roadmaps, rollouts, and program plans.',
    useCase: 'Program planning, release roadmaps, implementation timelines.',
    source: 'microsoft-create',
    tags: ['timeline', 'roadmap', 'milestones'],
    designPreset: 'executive-slate',
    featured: false,
    sortOrder: 10,
    starterPrompt: 'Create a roadmap presentation with phased milestones, owners, and delivery dates.'
  }
];

const reportSeeds: TemplateSeed[] = [
  {
    id: 'wb-executive-memo',
    name: 'Executive Memo',
    category: 'Executive memo',
    format: 'report',
    skillId: 'pdf',
    thumbFolder: 'pdf',
    thumbIndex: 1,
    sourceUrl: MS_WORD,
    description: 'BLUF memo with background, options, recommendation, and next steps.',
    useCase: 'Leadership decisions, policy updates, internal approvals.',
    source: 'workbench-curated',
    tags: ['memo', 'bluf', 'executive'],
    designPreset: 'executive-slate',
    scaffoldId: 'executive-memo',
    audience: 'Executive sponsors and internal decision makers',
    visualStyle: 'Tight executive memo typography with BLUF-first sections',
    structureHints: [
      'Memo flow: BLUF, background, analysis, options, recommendation, risks, next steps',
      'Keep recommendations actionable and time-bound'
    ],
    featured: true,
    sortOrder: 11,
    starterPrompt: 'Create an executive memo with BLUF summary, analysis, options, and recommendation.'
  },
  {
    id: 'wb-brand-guide-pdf',
    name: 'Brand Guide PDF',
    category: 'Brand guide',
    format: 'report',
    skillId: 'pdf',
    thumbFolder: 'pdf',
    thumbIndex: 2,
    sourceUrl: MS_WORD,
    description: 'Multi-section brand guide with typography, palette, and usage examples.',
    useCase: 'Brand kits, client onboarding, creative handoffs.',
    source: 'workbench-curated',
    tags: ['brand', 'guide', 'visual'],
    designPreset: 'editorial-ivory',
    visualDirection: 'Premium editorial layout with generous whitespace and structured section cards.',
    featured: true,
    sortOrder: 12,
    starterPrompt: 'Create a brand guide PDF with logo usage, color palette, typography, and voice guidelines.'
  },
  {
    id: 'ms-business-plan',
    name: 'Business Plan',
    category: 'Business plan',
    format: 'report',
    skillId: 'word',
    thumbFolder: 'pdf',
    thumbIndex: 3,
    sourceUrl: 'https://word.cloud.microsoft/create/en/business-plans/',
    description: 'Structured plan covering market, model, operations, and financial outlook.',
    useCase: 'Investor diligence, internal planning, loan applications.',
    source: 'microsoft-create',
    tags: ['business-plan', 'strategy', 'word'],
    designPreset: 'editorial-warm',
    featured: true,
    sortOrder: 13,
    starterPrompt: 'Create a business plan document with market analysis, model, operations, and financial outlook.'
  },
  {
    id: 'wb-research-brief',
    name: 'Research Brief',
    category: 'Research report',
    format: 'report',
    skillId: 'pdf',
    thumbFolder: 'pdf',
    thumbIndex: 4,
    sourceUrl: MS_WORD,
    description: 'Citation-ready research brief with methods, findings, and implications.',
    useCase: 'Analyst notes, policy research, strategy deep dives.',
    source: 'workbench-curated',
    tags: ['research', 'citations', 'analysis'],
    designPreset: 'editorial-ivory',
    scaffoldId: 'research-brief',
    audience: 'Analysts, policy teams, and strategy reviewers',
    visualStyle: 'Editorial ivory layout with citation-ready evidence blocks',
    structureHints: [
      'Research brief: question, methods, findings, implications, limitations, sources',
      'Separate verified findings from interpretation'
    ],
    featured: false,
    sortOrder: 14,
    starterPrompt: 'Create a research brief with question, methods, findings, implications, and sources.'
  },
  {
    id: 'wb-client-proposal',
    name: 'Client Proposal',
    category: 'Proposal',
    format: 'report',
    skillId: 'proposal',
    thumbFolder: 'pdf',
    thumbIndex: 5,
    sourceUrl: MS_WORD,
    description: 'Client-facing proposal with scope, deliverables, timeline, and commercial terms.',
    useCase: 'Agency pitches, consulting engagements, SOW drafts.',
    source: 'workbench-curated',
    tags: ['proposal', 'client', 'scope'],
    designPreset: 'modern-indigo',
    featured: true,
    sortOrder: 15,
    starterPrompt: 'Create a client proposal with context, scope, deliverables, timeline, risks, and next steps.'
  },
  {
    id: 'ms-brochure-report',
    name: 'Marketing Brochure',
    category: 'Brochure',
    format: 'report',
    skillId: 'pdf',
    thumbFolder: 'pdf',
    thumbIndex: 1,
    sourceUrl: 'https://word.cloud.microsoft/create/en/brochures/',
    description: 'Visual brochure layout for services, programs, or product lines.',
    useCase: 'Sales leave-behinds, program marketing, event handouts.',
    source: 'microsoft-create',
    tags: ['brochure', 'marketing', 'visual'],
    designPreset: 'cobalt-bold',
    featured: false,
    sortOrder: 16,
    starterPrompt: 'Create a marketing brochure PDF with hero section, benefits, proof points, and contact CTA.'
  }
];

const sheetSeeds: TemplateSeed[] = [
  {
    id: 'ms-invoice-classic',
    name: 'Classic Invoice',
    category: 'Invoice',
    format: 'sheet',
    skillId: 'xlsx',
    thumbFolder: 'excel',
    thumbIndex: 1,
    sourceUrl: MS_XLS,
    description: 'Clean invoice with bill-to, line items, tax, and totals.',
    useCase: 'Freelance billing, vendor invoices, service billing.',
    source: 'microsoft-create',
    tags: ['invoice', 'billing', 'classic'],
    designPreset: 'spreadsheet-forest',
    featured: true,
    sortOrder: 21,
    starterPrompt: 'Create a professional invoice spreadsheet with bill-to, line items, tax, and totals.'
  },
  {
    id: 'ms-invoice-tm',
    name: 'Time & Materials Invoice',
    category: 'Invoice',
    format: 'sheet',
    skillId: 'xlsx',
    thumbFolder: 'excel',
    thumbIndex: 2,
    sourceUrl: MS_XLS,
    description: 'Service invoice with hours, rates, materials, and subtotals.',
    useCase: 'Consulting, agencies, contractors billing by hour.',
    source: 'microsoft-create',
    tags: ['invoice', 'time', 'materials'],
    designPreset: 'cobalt-bold',
    featured: true,
    sortOrder: 22,
    starterPrompt: 'Create a time and materials invoice with hours, rates, expenses, and totals.'
  },
  {
    id: 'ms-budget-planner',
    name: 'Personal Budget',
    category: 'Budget',
    format: 'sheet',
    skillId: 'xlsx',
    thumbFolder: 'excel',
    thumbIndex: 3,
    sourceUrl: MS_XLS,
    description: 'Monthly budget tracker with income, categories, and variance.',
    useCase: 'Personal finance, household planning, savings goals.',
    source: 'microsoft-create',
    tags: ['budget', 'personal', 'tracker'],
    designPreset: 'editorial-warm',
    featured: true,
    sortOrder: 23,
    starterPrompt: 'Create a monthly budget spreadsheet with income, expense categories, and variance columns.'
  },
  {
    id: 'ms-gantt-chart',
    name: 'Gantt Project Tracker',
    category: 'Project tracker',
    format: 'sheet',
    skillId: 'xlsx',
    thumbFolder: 'excel',
    thumbIndex: 4,
    sourceUrl: MS_XLS,
    description: 'Project timeline with phases, owners, and status columns.',
    useCase: 'Project management, implementation tracking, sprint planning.',
    source: 'microsoft-create',
    tags: ['gantt', 'project', 'timeline'],
    designPreset: 'spreadsheet-royal',
    featured: true,
    sortOrder: 24,
    starterPrompt: 'Create a project tracker spreadsheet with phases, owners, dates, and status.'
  },
  {
    id: 'ms-expense-report',
    name: 'Expense Report',
    category: 'Expense report',
    format: 'sheet',
    skillId: 'xlsx',
    thumbFolder: 'excel',
    thumbIndex: 5,
    sourceUrl: MS_XLS,
    description: 'Travel and expense reimbursement with receipts summary and approval row.',
    useCase: 'Employee reimbursements, travel claims, finance ops.',
    source: 'microsoft-create',
    tags: ['expense', 'reimbursement', 'travel'],
    designPreset: 'teal-momentum',
    featured: false,
    sortOrder: 25,
    starterPrompt: 'Create an expense report spreadsheet with date, category, amount, and approval totals.'
  },
  {
    id: 'ms-inventory-list',
    name: 'Inventory List',
    category: 'Inventory',
    format: 'sheet',
    skillId: 'xlsx',
    thumbFolder: 'excel',
    thumbIndex: 6,
    sourceUrl: MS_XLS,
    description: 'Stock inventory with SKU, quantity, location, and reorder flags.',
    useCase: 'Warehouse tracking, retail stock, asset inventory.',
    source: 'microsoft-create',
    tags: ['inventory', 'stock', 'operations'],
    designPreset: 'spreadsheet-forest',
    featured: false,
    sortOrder: 26,
    starterPrompt: 'Create an inventory spreadsheet with SKU, description, quantity, location, and reorder level.'
  },
  {
    id: 'ms-todo-kanban',
    name: 'Kanban To-Do',
    category: 'Task tracker',
    format: 'sheet',
    skillId: 'xlsx',
    thumbFolder: 'excel',
    thumbIndex: 7,
    sourceUrl: MS_XLS,
    description: 'To-do, in progress, and done columns for lightweight task tracking.',
    useCase: 'Team task boards, personal productivity, sprint boards.',
    source: 'microsoft-create',
    tags: ['todo', 'kanban', 'tasks'],
    designPreset: 'lime-metric',
    featured: false,
    sortOrder: 27,
    starterPrompt: 'Create a kanban-style to-do spreadsheet with To Do, In Progress, and Done sections.'
  }
];

const resumeSeeds: TemplateSeed[] = [
  {
    id: 'wb-classic-ats',
    name: 'Classic ATS Resume',
    category: 'ATS resume',
    format: 'resume',
    skillId: 'resume',
    thumbFolder: 'resume',
    thumbIndex: 1,
    sourceUrl: MS_WORD,
    description: 'Single-column ATS-safe resume with clear section hierarchy.',
    useCase: 'Job applications, recruiter screening, campus placements.',
    source: 'workbench-curated',
    tags: ['ats', 'resume', 'classic'],
    designPreset: 'classic-ats',
    featured: true,
    sortOrder: 31,
    starterPrompt: 'Create an ATS-friendly resume using only the facts I provide. Use a classic single-column layout.'
  },
  {
    id: 'wb-modern-indigo',
    name: 'Modern Indigo Resume',
    category: 'Modern resume',
    format: 'resume',
    skillId: 'resume',
    thumbFolder: 'resume',
    thumbIndex: 2,
    sourceUrl: MS_WORD,
    description: 'Contemporary resume with accent typography and crisp section breaks.',
    useCase: 'Tech roles, product managers, design-adjacent professionals.',
    source: 'workbench-curated',
    tags: ['modern', 'resume', 'accent'],
    designPreset: 'modern-indigo',
    featured: true,
    sortOrder: 32,
    starterPrompt: 'Create a modern professional resume with accent styling using only supplied facts.'
  },
  {
    id: 'ms-cover-letter',
    name: 'Cover Letter Pair',
    category: 'Cover letter',
    format: 'resume',
    skillId: 'cover-letter',
    thumbFolder: 'resume',
    thumbIndex: 3,
    sourceUrl: 'https://word.cloud.microsoft/create/en/cover-letters/',
    description: 'Role-specific cover letter with matching professional tone.',
    useCase: 'Job applications paired with resume submissions.',
    source: 'microsoft-create',
    tags: ['cover-letter', 'application'],
    designPreset: 'editorial-ivory',
    featured: true,
    sortOrder: 33,
    starterPrompt: 'Create a role-specific cover letter using only the company and role details I provide.'
  },
  {
    id: 'wb-tpm-resume',
    name: 'Technical Program Manager',
    category: 'TPM resume',
    format: 'resume',
    skillId: 'resume',
    thumbFolder: 'resume',
    thumbIndex: 4,
    sourceUrl: MS_WORD,
    description: 'Structured TPM resume with project highlights and leadership bullets.',
    useCase: 'Program management, technical leadership, cross-functional roles.',
    source: 'workbench-curated',
    tags: ['tpm', 'program', 'leadership'],
    designPreset: 'modern-indigo',
    featured: false,
    sortOrder: 34,
    starterPrompt: 'Create a technical program manager resume with project highlights and leadership outcomes.'
  },
  {
    id: 'wb-finance-resume',
    name: 'Finance Analyst Resume',
    category: 'Finance resume',
    format: 'resume',
    skillId: 'resume',
    thumbFolder: 'resume',
    thumbIndex: 5,
    sourceUrl: MS_WORD,
    description: 'Finance resume emphasizing metrics, modeling, and business impact.',
    useCase: 'Analyst, FP&A, and business development roles.',
    source: 'workbench-curated',
    tags: ['finance', 'analyst', 'metrics'],
    designPreset: 'classic-ats',
    featured: false,
    sortOrder: 35,
    starterPrompt: 'Create a finance analyst resume highlighting metrics, modeling skills, and business impact.'
  }
];

const emailSeeds: TemplateSeed[] = [
  {
    id: 'wb-status-email',
    name: 'Executive Status Update',
    category: 'Status email',
    format: 'email',
    skillId: 'email',
    thumbFolder: 'pdf',
    thumbIndex: 2,
    sourceUrl: MS_WORD,
    description: 'Weekly stakeholder update with wins, risks, and asks.',
    useCase: 'Leadership updates, client status notes, program reporting.',
    source: 'workbench-curated',
    tags: ['email', 'status', 'executive'],
    designPreset: 'executive-slate',
    featured: true,
    sortOrder: 41,
    starterPrompt: 'Draft a concise executive status email with wins, risks, blockers, and next-week priorities.'
  },
  {
    id: 'wb-client-followup',
    name: 'Client Follow-Up',
    category: 'Client email',
    format: 'email',
    skillId: 'email',
    thumbFolder: 'pdf',
    thumbIndex: 3,
    sourceUrl: MS_WORD,
    description: 'Professional follow-up after meetings with action items.',
    useCase: 'Sales follow-ups, consulting recaps, partnership threads.',
    source: 'workbench-curated',
    tags: ['email', 'client', 'follow-up'],
    designPreset: 'editorial-ivory',
    featured: false,
    sortOrder: 42,
    starterPrompt: 'Draft a client follow-up email summarizing the meeting and listing clear action items.'
  }
];

const assignmentSeeds: TemplateSeed[] = [
  {
    id: 'wb-research-paper',
    name: 'Research Paper Draft',
    category: 'Research paper',
    format: 'assignment',
    skillId: 'assignment',
    thumbFolder: 'pdf',
    thumbIndex: 4,
    sourceUrl: MS_WORD,
    description: 'Academic paper scaffold with abstract, methods, findings, and references.',
    useCase: 'College submissions, literature reviews, course papers.',
    source: 'workbench-curated',
    tags: ['academic', 'paper', 'citations'],
    designPreset: 'editorial-ivory',
    featured: false,
    sortOrder: 51,
    starterPrompt: 'Create a research paper draft with abstract, introduction, methods, findings, and references.'
  },
  {
    id: 'wb-project-report',
    name: 'College Project Report',
    category: 'Project report',
    format: 'assignment',
    skillId: 'project',
    thumbFolder: 'pdf',
    thumbIndex: 5,
    sourceUrl: MS_WORD,
    description: 'Conventional project report with abstract, methodology, results, and conclusion.',
    useCase: 'Minor/major projects, viva submissions, synopsis drafts.',
    source: 'workbench-curated',
    tags: ['college', 'project', 'report'],
    designPreset: 'editorial-ivory',
    featured: false,
    sortOrder: 52,
    starterPrompt: 'Create a college project report with abstract, introduction, methodology, results, and conclusion.'
  }
];

function expandInvoiceVariants(): TemplateSeed[] {
  const palettes: Array<{ name: string; preset: string; thumbIndex: number }> = [
    { name: 'Teal', preset: 'spreadsheet-forest', thumbIndex: 1 },
    { name: 'Navy', preset: 'cobalt-bold', thumbIndex: 4 },
    { name: 'Purple', preset: 'spreadsheet-royal', thumbIndex: 6 },
    { name: 'Coral', preset: 'signal-orange', thumbIndex: 2 },
    { name: 'Slate', preset: 'consulting-mono', thumbIndex: 7 },
    { name: 'Forest', preset: 'spreadsheet-forest', thumbIndex: 1 },
    { name: 'Amber', preset: 'editorial-warm', thumbIndex: 2 },
    { name: 'Minimal', preset: 'classic-ats', thumbIndex: 3 }
  ];
  return palettes.map((palette, index) => ({
    id: `ms-invoice-${palette.name.toLowerCase()}`,
    name: `${palette.name} Invoice`,
    category: 'Invoice',
    format: 'sheet' as const,
    skillId: 'xlsx' as const,
    thumbFolder: 'excel' as const,
    thumbIndex: palette.thumbIndex,
    sourceUrl: MS_XLS,
    description: `${palette.name}-themed invoice layout with itemized billing and totals.`,
    useCase: 'Fast billing for services, products, and recurring clients.',
    source: 'microsoft-create' as const,
    tags: ['invoice', palette.name.toLowerCase(), 'variant'],
    designPreset: palette.preset,
    featured: false,
    sortOrder: 60 + index,
    starterPrompt: `Create a ${palette.name.toLowerCase()}-styled invoice spreadsheet with bill-to, line items, and totals.`
  }));
}

function expandDeckVariants(): TemplateSeed[] {
  const variants = [
    { name: 'Consulting Mono Strategy', preset: 'consulting-mono', cat: 'Strategy deck', prompt: 'Create a strategy deck with evidence blocks, comparisons, and recommendations.' },
    { name: 'Cobalt Bold Sales', preset: 'cobalt-bold', cat: 'Sales deck', prompt: 'Create a bold sales deck with customer proof and competitive differentiation.' },
    { name: 'Noir Lumina Keynote', preset: 'noir-lumina', cat: 'Keynote', prompt: 'Create a keynote-style deck with cinematic contrast and minimal text per slide.' },
    { name: 'Editorial Warm Workshop', preset: 'editorial-warm', cat: 'Workshop deck', prompt: 'Create a workshop deck with exercises, discussion prompts, and takeaways.' },
    { name: 'Bold Pop Campus', preset: 'bold-pop', cat: 'Campus deck', prompt: 'Create a campus presentation with clear headings and student-friendly pacing.' }
  ];
  const thumbMap = [4, 3, 5, 6, 1];
  return variants.map((variant, index) => ({
    id: `wb-deck-${variant.preset}`,
    name: variant.name,
    category: variant.cat,
    format: 'deck' as const,
    skillId: 'ppt' as const,
    thumbFolder: 'pptx' as const,
    thumbIndex: thumbMap[index] ?? ((index % 6) + 1),
    sourceUrl: MS_PPT,
    description: `Workbench ${variant.preset} visual system tuned for ${variant.cat.toLowerCase()}.`,
    useCase: 'Fast-start decks with curated visual direction.',
    source: 'workbench-curated' as const,
    tags: ['deck', variant.preset, 'curated', 'variant'],
    designPreset: variant.preset,
    featured: false,
    sortOrder: 70 + index,
    starterPrompt: variant.prompt
  }));
}

function expandReportVariants(): TemplateSeed[] {
  const variants = [
    { name: 'Case Study PDF', prompt: 'Create a case study PDF with challenge, approach, results, and testimonial.' },
    { name: 'White Paper', prompt: 'Create a white paper with executive summary, analysis, and recommendations.' },
    { name: 'Status Report', prompt: 'Create a weekly status report with progress, risks, and next milestones.' },
    { name: 'Policy Brief', prompt: 'Create a policy brief with background, options, and recommended action.' },
    { name: 'One-Pager', prompt: 'Create a one-page executive summary with visuals and key metrics.' }
  ];
  const reportPresets = ['executive-slate', 'editorial-ivory', 'teal-momentum', 'wellness-signal', 'rose-editorial'] as const;
  return variants.map((variant, index) => ({
    id: `wb-report-${index + 1}`,
    name: variant.name,
    category: 'Report',
    format: 'report' as const,
    skillId: 'pdf' as const,
    thumbFolder: 'pdf' as const,
    thumbIndex: index + 1,
    sourceUrl: MS_WORD,
    description: `${variant.name} with professional typography and section hierarchy.`,
    useCase: 'Internal and client-facing document workflows.',
    source: 'workbench-curated' as const,
    tags: ['report', 'document', 'variant'],
    designPreset: reportPresets[index] ?? 'editorial-ivory',
    featured: false,
    sortOrder: 80 + index,
    starterPrompt: variant.prompt
  }));
}

function expandSheetVariants(): TemplateSeed[] {
  const variants = [
    { name: 'KPI Dashboard', preset: 'lime-metric', thumbIndex: 3, prompt: 'Create a KPI dashboard spreadsheet with metrics, targets, and trend columns.' },
    { name: 'Sales Pipeline', preset: 'spreadsheet-royal', thumbIndex: 7, prompt: 'Create a sales pipeline tracker with stages, amounts, and close dates.' },
    { name: 'Cap Table', preset: 'cobalt-bold', thumbIndex: 4, prompt: 'Create a capitalization table with shareholders, shares, and ownership percentages.' },
    { name: 'P&L Statement', preset: 'consulting-mono', thumbIndex: 5, prompt: 'Create a profit and loss statement with revenue, COGS, expenses, and net income.' },
    { name: 'Wedding Budget', preset: 'rose-editorial', thumbIndex: 2, prompt: 'Create a wedding budget spreadsheet with categories, estimates, and actuals.' },
    { name: 'Home Remodel To-Do', preset: 'editorial-warm', thumbIndex: 6, prompt: 'Create a home remodel to-do list with rooms, tasks, costs, and status.' },
    { name: 'Attendance Sheet', preset: 'spreadsheet-forest', thumbIndex: 1, prompt: 'Create an attendance tracker with names, dates, and presence markers.' },
    { name: 'Loan Amortization', preset: 'teal-momentum', thumbIndex: 1, prompt: 'Create a loan amortization schedule with payment, principal, and interest.' }
  ];
  return variants.map((variant, index) => ({
    id: `wb-sheet-${index + 1}`,
    name: variant.name,
    category: 'Spreadsheet',
    format: 'sheet' as const,
    skillId: 'xlsx' as const,
    thumbFolder: 'excel' as const,
    thumbIndex: variant.thumbIndex,
    sourceUrl: MS_XLS,
    description: `${variant.name} workbook with structured tables and summary rows.`,
    useCase: 'Operational tracking and finance workflows.',
    source: 'microsoft-create' as const,
    tags: ['sheet', 'excel', 'tracker', 'variant'],
    designPreset: variant.preset,
    featured: false,
    sortOrder: 90 + index,
    starterPrompt: variant.prompt
  }));
}

function expandResumeVariants(): TemplateSeed[] {
  const variants = [
    { name: 'Creative Portfolio Resume', preset: 'modern-indigo' },
    { name: 'Executive Leadership Resume', preset: 'executive-slate' },
    { name: 'Campus Placement Resume', preset: 'classic-ats' }
  ];
  return variants.map((variant, index) => ({
    id: `wb-resume-variant-${index + 1}`,
    name: variant.name,
    category: 'Resume',
    format: 'resume' as const,
    skillId: 'resume' as const,
    thumbFolder: 'resume' as const,
    thumbIndex: ((index + 4) % 7) + 1,
    sourceUrl: MS_WORD,
    description: `${variant.name} with clean hierarchy and readable spacing.`,
    useCase: 'Role-targeted resume drafts from supplied facts only.',
    source: 'workbench-curated' as const,
    tags: ['resume', 'variant'],
    designPreset: variant.preset,
    featured: false,
    sortOrder: 100 + index,
    starterPrompt: `Create a ${variant.name.toLowerCase()} using only the facts I provide.`
  }));
}

const baseTemplates: WorkbenchTemplate[] = [
  ...deckSeeds,
  ...expandDeckVariants(),
  ...reportSeeds,
  ...expandReportVariants(),
  ...sheetSeeds,
  ...expandInvoiceVariants(),
  ...expandSheetVariants(),
  ...resumeSeeds,
  ...expandResumeVariants(),
  ...emailSeeds,
  ...assignmentSeeds
].map(finalizeTemplate);

const premiumTemplates = premiumTemplateCatalog.map((seed) => {
  const { thumbnail: _thumbnail, ...template } = premiumSeedToWorkbenchTemplate(
    seed,
    () => '',
    { pptx: 1, excel: 1, pdf: 1, resume: 1 }
  );
  return template;
});

const peakTemplates = peakTemplateSeeds.map(finalizeTemplate);

export const workbenchTemplates: WorkbenchTemplate[] = [
  ...peakTemplates,
  ...baseTemplates,
  ...premiumTemplates
]
  .filter((template, index, list) => list.findIndex((item) => item.id === template.id) === index)
  .sort((a, b) => a.sortOrder - b.sortOrder);

export const templateDisplayNameById = buildTemplateDisplayNameMap(workbenchTemplates);

export function templateDisplayName(template: WorkbenchTemplate): string {
  return templateDisplayNameById.get(template.id) ?? template.name;
}

export const templateFormatTabs: Array<{ id: TemplateFormatFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'deck', label: 'PPT' },
  { id: 'report', label: 'PDF' },
  { id: 'sheet', label: 'XLS' },
  { id: 'resume', label: 'CV' },
  { id: 'email', label: 'Mail' },
  { id: 'assignment', label: 'Doc' }
];

export function filterWorkbenchTemplates(
  templates: WorkbenchTemplate[],
  format: TemplateFormatFilter,
  query: string,
  audience: TemplateAudience | 'all' = 'all'
): WorkbenchTemplate[] {
  const normalized = query.trim().toLowerCase();
  const byAudience = filterByAudience(templates, audience);
  return byAudience.filter((template) => {
    if (format !== 'all' && template.format !== format) return false;
    if (!normalized) return true;
    const haystack = [
      template.name,
      templateDisplayName(template),
      template.category,
      template.description,
      template.useCase,
      template.audience,
      template.visualStyle,
      ...template.tags
    ].join(' ').toLowerCase();
    return haystack.includes(normalized);
  });
}

export function featuredWorkbenchTemplates(templates: WorkbenchTemplate[]): WorkbenchTemplate[] {
  return templates.filter((template) => template.featured);
}

const scaffoldStructureHints: Record<string, string[]> = {
  'investor-12': [
    '12-slide investor arc: cover, thesis, market tension, evidence, product, traction, economics, team, roadmap, ask, appendix',
    'Alternate proof and plan slides; end with a crisp fundraising ask'
  ],
  'board-8': [
    '8-slide board briefing: BLUF opener, context, risks, evidence, decision frame, plan, proof, close',
    'Lead with the decision or recommendation — not background'
  ],
  'academic-10': [
    '10-slide teaching arc: question, framing, theory, evidence, case study, critique, synthesis, implications, limitations, close',
    'Keep text readable for lecture delivery; cite sources on evidence slides'
  ],
  'executive-memo': [
    'Executive memo sections: BLUF, background, analysis, options, recommendation, risks, next steps, appendix',
    'Front-load the recommendation; keep options comparable'
  ],
  'research-brief': [
    'Research brief sections: question, methods, findings, implications, limitations, sources',
    'Bind claims to citations; separate facts from interpretation'
  ]
};

const formatStructureHints: Partial<Record<ArtifactKind, string[]>> = {
  deck: ['One sharp message per slide; vary layouts across the deck'],
  report: ['Use clear section hierarchy with scannable headings and evidence blocks'],
  sheet: ['Separate inputs, calculations, and outputs across worksheets when needed'],
  resume: ['Use only supplied facts; emphasize measurable outcomes and role fit'],
  email: ['Keep subject, greeting, purpose, and action items explicit and concise'],
  assignment: ['Follow academic section order with citations where claims need support']
};

export function inferStructureHints(template: WorkbenchTemplate): string[] {
  if (template.structureHints?.length) return template.structureHints;
  if (template.scaffoldId && scaffoldStructureHints[template.scaffoldId]) {
    return scaffoldStructureHints[template.scaffoldId];
  }
  return formatStructureHints[template.format] ?? [];
}

function inferTemplateAudience(template: WorkbenchTemplate): string {
  if (template.audience) return template.audience;
  const category = template.category.toLowerCase();
  if (category.includes('investor') || category.includes('pitch') || category.includes('startup')) {
    return 'Investors and fundraising stakeholders';
  }
  if (category.includes('board') || category.includes('executive')) {
    return 'Executive leadership and decision makers';
  }
  if (category.includes('academic') || category.includes('college') || category.includes('research')) {
    return 'Academic and research audiences';
  }
  if (category.includes('sales') || category.includes('client') || category.includes('marketing')) {
    return 'Business buyers and external stakeholders';
  }
  if (template.format === 'resume') return 'Hiring managers and recruiters';
  if (template.format === 'sheet') return 'Operators and finance teams';
  if (template.format === 'email') return 'Professional workplace recipients';
  return 'Professional business audience';
}

function inferTemplateVisualStyle(template: WorkbenchTemplate): string | undefined {
  if (template.visualStyle) return template.visualStyle;
  if (template.visualDirection) return template.visualDirection;
  if (template.designPreset) return `${template.designPreset} visual system`;
  return undefined;
}

export function resolveTemplateMetadata(template: WorkbenchTemplate): WorkbenchTemplate {
  return {
    ...template,
    audience: inferTemplateAudience(template),
    visualStyle: inferTemplateVisualStyle(template),
    structureHints: inferStructureHints(template)
  };
}

export function buildTemplateComposerPrompt(template: WorkbenchTemplate, userPrompt = ''): string {
  const skill = findSkillById(template.skillId);
  const tag = skill?.tag ?? '@ppt';
  const enriched = resolveTemplateMetadata(template);
  const harness = [
    `Workbench template: ${enriched.name} (${enriched.category}).`,
    enriched.description,
    enriched.useCase ? `Use case: ${enriched.useCase}` : '',
    enriched.audience ? `Target audience: ${enriched.audience}` : '',
    enriched.designPreset ? `Set design.template to "${enriched.designPreset}".` : '',
    enriched.visualStyle ? `Visual style: ${enriched.visualStyle}` : '',
    enriched.visualDirection ? `Visual direction: ${enriched.visualDirection}` : '',
    enriched.scaffoldId ? `Follow the ${enriched.scaffoldId} narrative scaffold.` : '',
    enriched.peakArtifactId ? `Peak artifact harness: ${enriched.peakArtifactId}.` : '',
    peakArtifactSlideSummary(enriched.peakArtifactId).length
      ? `Locked structure map: ${peakArtifactSlideSummary(enriched.peakArtifactId).join(' · ')}`
      : '',
    enriched.structureHints?.length ? `Structure hints: ${enriched.structureHints.join(' ')}` : '',
    `Starter intent: ${enriched.starterPrompt}`,
    'Preserve this template structure and visual system. Apply any user-specific details on top without collapsing the scaffold.'
  ].filter(Boolean).join(' ');
  const userDetails = userPrompt.trim();
  return [tag, harness, userDetails].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

export function templateSourceLabel(source: TemplateSource): string {
  if (source === 'microsoft-create') return 'Microsoft Create';
  if (source === 'kingsoft-wps') return 'Kingsoft WPS';
  if (source === 'canva') return 'Canva';
  if (source === 'google') return 'Google';
  if (source === 'notion') return 'Notion';
  return 'Workbench';
}