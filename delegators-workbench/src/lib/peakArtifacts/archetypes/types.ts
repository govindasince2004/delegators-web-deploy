import type { ArtifactDesign } from '../../shared.js';

export type ArchetypePalette = NonNullable<ArtifactDesign['palette']>;

export type ReportStructure =
  | 'annual-report'
  | 'whitepaper'
  | 'case-study'
  | 'policy-brief'
  | 'research-memo'
  | 'brand-guidelines'
  | 'market-analysis'
  | 'impact-report'
  | 'technical-spec'
  | 'user-manual'
  | 'compliance-audit'
  | 'quarterly-review'
  | 'feasibility-study'
  | 'grant-proposal'
  | 'sustainability-report'
  | 'product-brief'
  | 'competitive-landscape'
  | 'onboarding-playbook'
  | 'training-handbook'
  | 'event-program'
  | 'newsletter-digest'
  | 'press-kit'
  | 'investor-memo'
  | 'legal-brief'
  | 'clinical-summary'
  | 'curriculum-guide'
  | 'safety-protocol'
  | 'project-charter'
  | 'postmortem'
  | 'rfp-response'
  | 'style-guide'
  | 'community-report';

export type ReportArchetype = {
  id: string;
  title: string;
  category: string;
  audience: string;
  tone: string;
  structure: ReportStructure;
  designPreset: string;
  template: NonNullable<ArtifactDesign['template']>;
  headingFont: string;
  bodyFont: string;
  pageSize?: ArtifactDesign['pageSize'];
  orientation?: ArtifactDesign['orientation'];
  density?: ArtifactDesign['density'];
  palette: ArchetypePalette;
  orgName: string;
  subject: string;
};

export type SheetStructure =
  | 'dashboard'
  | 'budget'
  | 'pl-statement'
  | 'cap-table'
  | 'okr-tracker'
  | 'sales-pipeline'
  | 'inventory'
  | 'expense-tracker'
  | 'project-timeline'
  | 'headcount-plan'
  | 'cash-flow'
  | 'marketing-roi'
  | 'customer-cohort'
  | 'vendor-scorecard'
  | 'sprint-velocity'
  | 'content-calendar'
  | 'attendance-log'
  | 'gradebook'
  | 'rental-ledger'
  | 'maintenance-schedule'
  | 'quote-estimator'
  | 'commission-calc'
  | 'fleet-dispatch'
  | 'recipe-costing'
  | 'donation-tracker'
  | 'event-budget'
  | 'social-metrics'
  | 'risk-register'
  | 'asset-depreciation'
  | 'timesheet'
  | 'price-comparison'
  | 'survey-results';

export type SheetArchetype = {
  id: string;
  title: string;
  category: string;
  audience: string;
  tone: string;
  structure: SheetStructure;
  designPreset: string;
  template: NonNullable<ArtifactDesign['template']>;
  headingFont: string;
  bodyFont: string;
  density?: ArtifactDesign['density'];
  palette: ArchetypePalette;
  entity: string;
};

export type ResumeLayout =
  | 'executive'
  | 'creative'
  | 'technical'
  | 'academic'
  | 'minimalist'
  | 'two-column'
  | 'sidebar-skills'
  | 'designer'
  | 'data-science'
  | 'product'
  | 'sales'
  | 'healthcare'
  | 'legal'
  | 'education'
  | 'architecture'
  | 'consulting'
  | 'founder'
  | 'remote'
  | 'career-change'
  | 'federal'
  | 'nursing'
  | 'hospitality'
  | 'engineering-lead'
  | 'marketing'
  | 'finance'
  | 'campus'
  | 'c-suite'
  | 'bilingual'
  | 'contractor'
  | 'nonprofit'
  | 'research'
  | 'operations';

export type ResumeArchetype = {
  id: string;
  title: string;
  category: string;
  audience: string;
  tone: string;
  layout: ResumeLayout;
  designPreset: string;
  template: NonNullable<ArtifactDesign['template']>;
  headingFont: string;
  bodyFont: string;
  density?: ArtifactDesign['density'];
  palette: ArchetypePalette;
  name: string;
  headline: string;
  role: string;
};