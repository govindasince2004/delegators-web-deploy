import { microsoftExcelRefs, microsoftWordRefs } from './microsoftInspiredCatalog.js';
import type { ReportArchetype, ResumeArchetype, SheetArchetype } from './types.js';

const REPORT_STRUCTURES = [
  'annual-report', 'whitepaper', 'case-study', 'policy-brief', 'research-memo',
  'brand-guidelines', 'market-analysis', 'impact-report', 'technical-spec', 'user-manual',
  'compliance-audit', 'quarterly-review', 'feasibility-study', 'grant-proposal', 'sustainability-report',
  'product-brief', 'competitive-landscape', 'onboarding-playbook', 'training-handbook', 'event-program'
] as const;

const SHEET_STRUCTURES = [
  'dashboard', 'budget', 'pl-statement', 'okr-tracker', 'sales-pipeline',
  'inventory', 'expense-tracker', 'project-timeline', 'cash-flow', 'marketing-roi',
  'customer-cohort', 'vendor-scorecard', 'sprint-velocity', 'content-calendar', 'attendance-log',
  'gradebook', 'timesheet', 'price-comparison', 'survey-results', 'risk-register'
] as const;

const RESUME_LAYOUTS = [
  'executive', 'creative', 'technical', 'academic', 'minimalist',
  'two-column', 'sidebar-skills', 'designer', 'data-science', 'product',
  'sales', 'healthcare', 'legal', 'education', 'architecture',
  'consulting', 'founder', 'remote', 'marketing', 'finance'
] as const;

const WORD_PALETTES = [
  { background: '#FFFFFF', surface: '#EFF6FF', text: '#1E3A8A', muted: '#3B82F6', primary: '#1D4ED8', accent: '#60A5FA' },
  { background: '#FFFBF5', surface: '#F5EDE3', text: '#292524', muted: '#A8A29E', primary: '#57534E', accent: '#D97706' },
  { background: '#F0FDF4', surface: '#DCFCE7', text: '#14532D', muted: '#16A34A', primary: '#15803D', accent: '#4ADE80' },
  { background: '#FFF1F2', surface: '#FECDD3', text: '#881337', muted: '#BE123C', primary: '#E11D48', accent: '#FB7185' },
  { background: '#F8FAFC', surface: '#E2E8F0', text: '#0F172A', muted: '#64748B', primary: '#334155', accent: '#0EA5E9' },
  { background: '#FDF4FF', surface: '#F3E8FF', text: '#581C87', muted: '#9333EA', primary: '#7E22CE', accent: '#C084FC' }
];

const EXCEL_PALETTES = [
  { background: '#FFFFFF', surface: '#ECFDF5', text: '#052E1B', muted: '#4B6B5A', primary: '#217346', accent: '#34D399' },
  { background: '#FFFFFF', surface: '#DBEAFE', text: '#1E3A8A', muted: '#3B82F6', primary: '#1D4ED8', accent: '#60A5FA' },
  { background: '#FFFFFF', surface: '#FEF9C3', text: '#713F12', muted: '#CA8A04', primary: '#A16207', accent: '#FACC15' },
  { background: '#FFFFFF', surface: '#F5F3FF', text: '#2E1065', muted: '#7C3AED', primary: '#6B46C1', accent: '#A78BFA' },
  { background: '#FFFFFF', surface: '#FFF1F2', text: '#881337', muted: '#BE123C', primary: '#BE185D', accent: '#F472B6' },
  { background: '#FFFFFF', surface: '#F0FDFA', text: '#134E4A', muted: '#0F766E', primary: '#115E59', accent: '#14B8A6' }
];

const RESUME_PALETTES = [
  { background: '#FFFFFF', surface: '#F8FAFC', text: '#0F172A', muted: '#64748B', primary: '#1E293B', accent: '#2563EB' },
  { background: '#FFFFFF', surface: '#FDF4FF', text: '#581C87', muted: '#9333EA', primary: '#7E22CE', accent: '#C084FC' },
  { background: '#FFFFFF', surface: '#ECFDF5', text: '#064E3B', muted: '#047857', primary: '#059669', accent: '#10B981' },
  { background: '#FFFBEB', surface: '#FEF3C7', text: '#78350F', muted: '#B45309', primary: '#92400E', accent: '#D97706' },
  { background: '#FFFFFF', surface: '#FFF1F2', text: '#881337', muted: '#BE123C', primary: '#E11D48', accent: '#FB7185' },
  { background: '#0F172A', surface: '#1E293B', text: '#F8FAFC', muted: '#94A3B8', primary: '#0F766E', accent: '#14B8A6' }
];

const MS_REPORT_NAMES = [
  'MS Business Report', 'MS White Paper', 'MS Case Study Brief', 'MS Policy Brief',
  'MS Research Memo', 'MS Brand Guidelines', 'MS Market Analysis', 'MS Impact Report',
  'MS Technical Spec', 'MS User Manual', 'MS Compliance Audit', 'MS Quarterly Review',
  'MS Feasibility Study', 'MS Grant Proposal', 'MS Sustainability Report', 'MS Product Brief',
  'MS Competitive Landscape', 'MS Onboarding Playbook', 'MS Training Handbook', 'MS Event Program'
];

const MS_SHEET_NAMES = microsoftExcelRefs.map((ref) => `MS ${ref.category}`);
const MS_RESUME_NAMES = [
  'MS Professional Resume', 'MS Modern Resume', 'MS Creative Resume', 'MS Executive Resume',
  'MS Technical Resume', 'MS Academic CV', 'MS Minimal Resume', 'MS Two-Column Resume',
  'MS Designer Resume', 'MS Data Resume', 'MS Product Resume', 'MS Sales Resume',
  'MS Healthcare Resume', 'MS Legal Resume', 'MS Education Resume', 'MS Consulting Resume',
  'MS Founder Resume', 'MS Remote Resume', 'MS Marketing Resume', 'MS Finance Resume'
];

export const microsoftReportExpansions: ReportArchetype[] = MS_REPORT_NAMES.map((title, index) => {
  const ref = microsoftWordRefs[index % microsoftWordRefs.length];
  const structure = REPORT_STRUCTURES[index % REPORT_STRUCTURES.length];
  const palette = WORD_PALETTES[index % WORD_PALETTES.length];
  const id = `ms-word-${ref.id}-${index + 1}`;
  return {
    id,
    title,
    category: ref.category,
    audience: 'Business and enterprise stakeholders',
    tone: 'professional',
    structure,
    designPreset: id,
    template: 'modern-indigo',
    headingFont: index % 3 === 0 ? 'Georgia' : 'Aptos Display',
    bodyFont: index % 3 === 0 ? 'Georgia' : 'Aptos',
    pageSize: index % 2 === 0 ? 'letter' : 'a4',
    density: index % 2 === 0 ? 'airy' : 'balanced',
    palette,
    orgName: 'Contoso Analytics',
    subject: `${ref.designMood} — Microsoft Word Create inspired`
  };
});

export const microsoftSheetExpansions: SheetArchetype[] = MS_SHEET_NAMES.map((title, index) => {
  const ref = microsoftExcelRefs[index];
  const structure = SHEET_STRUCTURES[index % SHEET_STRUCTURES.length];
  const palette = EXCEL_PALETTES[index % EXCEL_PALETTES.length];
  const id = `ms-excel-${ref.id}`;
  return {
    id,
    title,
    category: ref.category,
    audience: 'Operations and finance teams',
    tone: 'professional',
    structure,
    designPreset: id,
    template: 'executive-slate',
    headingFont: 'Aptos',
    bodyFont: 'Aptos',
    density: index % 2 === 0 ? 'compact' : 'balanced',
    palette,
    entity: 'Fabrikam Operations'
  };
});

export const microsoftResumeExpansions: ResumeArchetype[] = MS_RESUME_NAMES.map((title, index) => {
  const ref = microsoftWordRefs[index % microsoftWordRefs.length];
  const layout = RESUME_LAYOUTS[index % RESUME_LAYOUTS.length];
  const palette = RESUME_PALETTES[index % RESUME_PALETTES.length];
  const id = `ms-resume-${index + 1}`;
  const roles = ['Product Manager', 'Software Engineer', 'Marketing Lead', 'Finance Analyst', 'Designer'];
  const names = ['Jordan Lee', 'Sam Rivera', 'Alex Kim', 'Taylor Morgan', 'Casey Park'];
  return {
    id,
    title,
    category: ref.category,
    audience: 'Hiring managers and recruiters',
    tone: 'professional',
    layout,
    designPreset: id,
    template: 'classic-ats',
    headingFont: index % 4 === 0 ? 'Georgia' : 'Aptos',
    bodyFont: 'Aptos',
    density: index % 2 === 0 ? 'compact' : 'balanced',
    palette,
    name: names[index % names.length],
    headline: roles[index % roles.length],
    role: roles[index % roles.length]
  };
});