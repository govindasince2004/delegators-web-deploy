/** Microsoft Create gallery categories — design reference for peak archetypes. */
export type MicrosoftTemplateRef = {
  id: string;
  product: 'powerpoint' | 'excel' | 'word';
  category: string;
  msUrl: string;
  designMood: string;
};

export const microsoftPowerPointRefs: MicrosoftTemplateRef[] = [
  { id: 'pitch-deck', product: 'powerpoint', category: 'Pitch deck', msUrl: 'https://powerpoint.cloud.microsoft/create/en/pitch-deck-templates/', designMood: 'Persuasive investor narrative with timeline and ask slides' },
  { id: 'business-presentation', product: 'powerpoint', category: 'Business presentation', msUrl: 'https://powerpoint.cloud.microsoft/create/en/business-presentation/', designMood: 'Calm professional pacing with agenda and next steps' },
  { id: 'timeline-slides', product: 'powerpoint', category: 'Timeline deck', msUrl: 'https://powerpoint.cloud.microsoft/create/en/timeline-slide-templates/', designMood: 'Horizontal milestone rhythm with process layouts' },
  { id: 'marketing-deck', product: 'powerpoint', category: 'Marketing deck', msUrl: 'https://powerpoint.cloud.microsoft/create/en/marketing-deck-templates/', designMood: 'Bold campaign grids with proof metrics' },
  { id: 'academic-presentation', product: 'powerpoint', category: 'Academic deck', msUrl: 'https://powerpoint.cloud.microsoft/create/en/academic-presentation-templates/', designMood: 'Structured evidence slides with citation-friendly lists' },
  { id: 'sales-deck', product: 'powerpoint', category: 'Sales deck', msUrl: 'https://powerpoint.cloud.microsoft/create/en/sales-deck-templates/', designMood: 'Buyer journey comparison with ROI metrics' },
  { id: 'product-launch', product: 'powerpoint', category: 'Product launch', msUrl: 'https://powerpoint.cloud.microsoft/create/en/product-launch-templates/', designMood: 'Dark cinematic opener with feature grid proof' },
  { id: 'proposal-presentation', product: 'powerpoint', category: 'Proposal deck', msUrl: 'https://powerpoint.cloud.microsoft/create/en/proposal-presentation-templates/', designMood: 'Scope, deliverables, and pricing metric blocks' },
  { id: 'keynote', product: 'powerpoint', category: 'Keynote', msUrl: 'https://powerpoint.cloud.microsoft/create/en/keynote-templates/', designMood: 'Oversized statement slides with minimal chrome' },
  { id: 'portfolio', product: 'powerpoint', category: 'Portfolio', msUrl: 'https://powerpoint.cloud.microsoft/create/en/portfolio-templates/', designMood: 'Visual grid showcase with quote proof' },
  { id: 'copilot-pitch', product: 'powerpoint', category: 'Copilot pitch', msUrl: 'https://powerpoint.cloud.microsoft/create/en/copilot-in-powerpoint/', designMood: 'AI-native indigo workflow with narrative arc' },
  { id: 'financial-review', product: 'powerpoint', category: 'Financial review', msUrl: 'https://powerpoint.cloud.microsoft/create/en/financial-review-templates/', designMood: 'Boardroom slate metrics with chart bridges' },
  { id: 'board-briefing', product: 'powerpoint', category: 'Board briefing', msUrl: 'https://powerpoint.cloud.microsoft/create/en/board-presentation-templates/', designMood: 'BLUF opener with risk comparison columns' },
  { id: 'quarterly-review', product: 'powerpoint', category: 'Quarterly review', msUrl: 'https://powerpoint.cloud.microsoft/create/en/quarterly-business-review-templates/', designMood: 'KPI wall with growth chart and roadmap' },
  { id: 'brand-guidelines-deck', product: 'powerpoint', category: 'Brand guidelines', msUrl: 'https://powerpoint.cloud.microsoft/create/en/brand-guidelines-templates/', designMood: 'Editorial ivory type specimens and color grids' },
  { id: 'training-deck', product: 'powerpoint', category: 'Training deck', msUrl: 'https://powerpoint.cloud.microsoft/create/en/training-presentation-templates/', designMood: 'Step process slides with checklist grids' },
  { id: 'webinar-deck', product: 'powerpoint', category: 'Webinar deck', msUrl: 'https://powerpoint.cloud.microsoft/create/en/webinar-templates/', designMood: 'Teal momentum opener with engagement metrics' },
  { id: 'case-study-deck', product: 'powerpoint', category: 'Case study deck', msUrl: 'https://powerpoint.cloud.microsoft/create/en/case-study-templates/', designMood: 'Before/after comparison with results chart' },
  { id: 'roadmap-deck', product: 'powerpoint', category: 'Roadmap deck', msUrl: 'https://powerpoint.cloud.microsoft/create/en/roadmap-templates/', designMood: 'Timeline sequence with milestone metrics' },
  { id: 'okr-review', product: 'powerpoint', category: 'OKR review', msUrl: 'https://powerpoint.cloud.microsoft/create/en/okr-templates/', designMood: 'Objective grid with progress chart bands' },
  { id: 'all-hands', product: 'powerpoint', category: 'All-hands', msUrl: 'https://powerpoint.cloud.microsoft/create/en/all-hands-templates/', designMood: 'Warm culture statements with team proof' },
  { id: 'customer-success', product: 'powerpoint', category: 'Customer success', msUrl: 'https://powerpoint.cloud.microsoft/create/en/customer-success-templates/', designMood: 'Quote-led retention metrics and health scores' },
  { id: 'partner-pitch', product: 'powerpoint', category: 'Partner pitch', msUrl: 'https://powerpoint.cloud.microsoft/create/en/partner-presentation-templates/', designMood: 'Channel split slides with co-sell grid' },
  { id: 'grant-pitch', product: 'powerpoint', category: 'Grant pitch', msUrl: 'https://powerpoint.cloud.microsoft/create/en/grant-proposal-templates/', designMood: 'Impact metrics with budget ask blocks' },
  { id: 'nonprofit-pitch', product: 'powerpoint', category: 'Nonprofit pitch', msUrl: 'https://powerpoint.cloud.microsoft/create/en/nonprofit-presentation-templates/', designMood: 'Forest green mission statements with donor proof' },
  { id: 'real-estate-pitch', product: 'powerpoint', category: 'Real estate pitch', msUrl: 'https://powerpoint.cloud.microsoft/create/en/real-estate-presentation-templates/', designMood: 'Ivory luxury cover with property metric grid' },
  { id: 'healthcare-pitch', product: 'powerpoint', category: 'Healthcare pitch', msUrl: 'https://powerpoint.cloud.microsoft/create/en/healthcare-presentation-templates/', designMood: 'Clinical cobalt trust slides with outcomes chart' },
  { id: 'education-pitch', product: 'powerpoint', category: 'Education pitch', msUrl: 'https://powerpoint.cloud.microsoft/create/en/education-presentation-templates/', designMood: 'Campus yellow agenda with learning outcome grid' },
  { id: 'startup-pitch', product: 'powerpoint', category: 'Startup pitch', msUrl: 'https://powerpoint.cloud.microsoft/create/en/startup-pitch-deck-templates/', designMood: 'YC-clean list arc with traction chart' },
  { id: 'investor-update', product: 'powerpoint', category: 'Investor update', msUrl: 'https://powerpoint.cloud.microsoft/create/en/investor-update-templates/', designMood: 'Monthly metric snapshot with milestone timeline' },
  { id: 'competitive-analysis', product: 'powerpoint', category: 'Competitive analysis', msUrl: 'https://powerpoint.cloud.microsoft/create/en/competitive-analysis-templates/', designMood: 'Comparison matrix with market sizing metrics' },
  { id: 'event-pitch', product: 'powerpoint', category: 'Event pitch', msUrl: 'https://powerpoint.cloud.microsoft/create/en/event-presentation-templates/', designMood: 'Pink energy opener with sponsor grid' }
];

export const microsoftExcelRefs: MicrosoftTemplateRef[] = [
  { id: 'planner-tracker', product: 'excel', category: 'Planner', msUrl: 'https://excel.cloud.microsoft/create/en/planner-tracker-templates/', designMood: 'Goal tracking with status chips' },
  { id: 'gantt-chart', product: 'excel', category: 'Gantt chart', msUrl: 'https://excel.cloud.microsoft/create/en/gantt-charts/', designMood: 'Timeline dependency columns' },
  { id: 'invoice', product: 'excel', category: 'Invoice', msUrl: 'https://excel.cloud.microsoft/create/en/invoice-templates/', designMood: 'Forest header billing rows' },
  { id: 'budget', product: 'excel', category: 'Budget', msUrl: 'https://excel.cloud.microsoft/create/en/budget-templates/', designMood: 'Variance formula columns' },
  { id: 'dashboard-kpi', product: 'excel', category: 'KPI dashboard', msUrl: 'https://excel.cloud.microsoft/create/en/dashboard-templates/', designMood: 'Lime metric tiles with chart bands' },
  { id: 'expense-report', product: 'excel', category: 'Expense report', msUrl: 'https://excel.cloud.microsoft/create/en/expense-report-templates/', designMood: 'Category rollup with receipt log' },
  { id: 'profit-loss', product: 'excel', category: 'P&L statement', msUrl: 'https://excel.cloud.microsoft/create/en/profit-loss-statement-templates/', designMood: 'Quarterly revenue bridge' },
  { id: 'inventory', product: 'excel', category: 'Inventory', msUrl: 'https://excel.cloud.microsoft/create/en/inventory-templates/', designMood: 'SKU reorder alerts' },
  { id: 'timesheet', product: 'excel', category: 'Timesheet', msUrl: 'https://excel.cloud.microsoft/create/en/timesheet-templates/', designMood: 'Weekly hour grid with totals' },
  { id: 'student-tracker', product: 'excel', category: 'Student tracker', msUrl: 'https://excel.cloud.microsoft/create/en/student-templates/', designMood: 'Grade and attendance bands' }
];

export const microsoftWordRefs: MicrosoftTemplateRef[] = [
  { id: 'business-report', product: 'word', category: 'Business report', msUrl: 'https://word.cloud.microsoft/create/en/business-report-templates/', designMood: 'Executive summary with KPI tables' },
  { id: 'white-paper', product: 'word', category: 'White paper', msUrl: 'https://word.cloud.microsoft/create/en/white-paper-templates/', designMood: 'Long-form technical sections' },
  { id: 'resume', product: 'word', category: 'Resume', msUrl: 'https://word.cloud.microsoft/create/en/resume-templates/', designMood: 'ATS-friendly hierarchy' },
  { id: 'cover-letter', product: 'word', category: 'Cover letter', msUrl: 'https://word.cloud.microsoft/create/en/cover-letter-templates/', designMood: 'Application letter structure' },
  { id: 'brochure', product: 'word', category: 'Brochure', msUrl: 'https://word.cloud.microsoft/create/en/brochure-templates/', designMood: 'Marketing fold sections' },
  { id: 'newsletter', product: 'word', category: 'Newsletter', msUrl: 'https://word.cloud.microsoft/create/en/newsletter-templates/', designMood: 'Editorial column rhythm' }
];

const MS_PPT_HUB = 'https://powerpoint.cloud.microsoft/create/en/templates/';
const MS_XLS_HUB = 'https://excel.cloud.microsoft/create/en/templates/';
const MS_WORD_HUB = 'https://word.cloud.microsoft/create/en/templates/';

const pptUrlById = Object.fromEntries(microsoftPowerPointRefs.map((ref) => [ref.id, ref.msUrl]));
const wordUrlById = Object.fromEntries(microsoftWordRefs.map((ref) => [ref.id, ref.msUrl]));
const excelUrlById = Object.fromEntries(microsoftExcelRefs.map((ref) => [ref.id, ref.msUrl]));

export function resolveMicrosoftDeckUrl(archetypeId: string): string {
  if (!archetypeId.startsWith('ms-')) return MS_PPT_HUB;
  return pptUrlById[archetypeId.slice(3)] ?? MS_PPT_HUB;
}

export function resolveMicrosoftReportUrl(archetypeId: string): string {
  const match = archetypeId.match(/^ms-word-(.+)-\d+$/);
  if (match) return wordUrlById[match[1]] ?? MS_WORD_HUB;
  return MS_WORD_HUB;
}

export function resolveMicrosoftSheetUrl(archetypeId: string): string {
  if (archetypeId.startsWith('ms-excel-')) {
    return excelUrlById[archetypeId.slice('ms-excel-'.length)] ?? MS_XLS_HUB;
  }
  return MS_XLS_HUB;
}

export function resolveMicrosoftResumeUrl(archetypeId: string): string {
  if (archetypeId.startsWith('ms-resume-')) {
    return wordUrlById.resume ?? MS_WORD_HUB;
  }
  return MS_WORD_HUB;
}

export function isMicrosoftArchetypeId(archetypeId: string): boolean {
  return archetypeId.startsWith('ms-');
}