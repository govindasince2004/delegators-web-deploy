import { archetypeTemplateSeeds } from './peakArtifacts/archetypes/seedFactory.js';
import { kingsoftTemplateSeeds } from './kingsoftTemplateSeeds.js';
import { atsResumeVariants } from './peakArtifacts/atsResumeFamily.js';
import { cobaltSaasVerticals } from './peakArtifacts/cobaltSaasFamily.js';
import { forestInvoiceVariants } from './peakArtifacts/forestInvoiceFamily.js';
import { wellnessGuideVariants } from './peakArtifacts/wellnessGuideFamily.js';
import { xboardVerticals } from './peakArtifacts/xboardLimeFamily.js';
import type { WorkbenchTemplate } from './workbenchTemplates.js';

type PeakTemplateSeed = Omit<WorkbenchTemplate, 'thumbnail'>;

const MS_PPT = 'https://powerpoint.cloud.microsoft/create/en/pitch-deck-templates/';
const MS_XLS = 'https://excel.cloud.microsoft/create/en/templates/';
const MS_WORD = 'https://word.cloud.microsoft/create/en/templates/';

const xboardSeeds: PeakTemplateSeed[] = xboardVerticals.map((vertical, index) => ({
  id: `peak-xboard-lime-${vertical.id}`,
  name: `${vertical.product} Lime Pitch`,
  category: 'Investor pitch',
  format: 'deck',
  skillId: 'ppt',
  sourceUrl: MS_PPT,
  description: `${vertical.thesis}. Ten-slide color-block investor deck mapped from the Xboard peak reference.`,
  useCase: `${vertical.category} fundraising with agenda, traction chart, TAM, and ask slides.`,
  source: 'workbench-curated',
  tags: ['investor', 'pitch', 'peak-artifact', 'lime', vertical.id],
  designPreset: 'bold-pop',
  scaffoldId: 'investor-12',
  peakArtifactId: `peak-xboard-lime-${vertical.id}`,
  peakFamily: 'xboard-lime',
  visualDirection: 'Lime agenda, white/orange cover, orange ask, pink traction chart, yellow TAM, cobalt close.',
  audience: 'Investors and fundraising stakeholders',
  visualStyle: 'Bold geometric color-block pitch with metric-forward layouts',
  structureHints: [
    '10-slide arc: agenda, cover, ask, metrics, traction chart, comparison, team, TAM, facts, close',
    'Preserve per-slide tone blocks: lime, white, orange, pink, yellow, cobalt'
  ],
  featured: index < 3,
  sortOrder: index + 1,
  starterPrompt: `Create a 10-slide ${vertical.category} investor deck using the ${vertical.product} lime color-block structure.`
}));

const cobaltSeeds: PeakTemplateSeed[] = cobaltSaasVerticals.map((vertical, index) => ({
  id: `peak-cobalt-saas-${vertical.id}`,
  name: `${vertical.product} Cobalt SaaS`,
  category: 'Startup pitch',
  format: 'deck',
  skillId: 'ppt',
  sourceUrl: MS_PPT,
  description: `${vertical.tagline}. Nine-slide cobalt gradient SaaS deck from peak reference.`,
  useCase: 'B2B SaaS investor and enterprise buyer presentations.',
  source: 'workbench-curated',
  tags: ['startup', 'saas', 'peak-artifact', 'cobalt', vertical.id],
  designPreset: 'cobalt-bold',
  peakArtifactId: `peak-cobalt-saas-${vertical.id}`,
  peakFamily: 'cobalt-saas',
  visualStyle: 'Cobalt gradient opener with white proof slides and ARR chart',
  featured: index === 0,
  sortOrder: 20 + index,
  starterPrompt: `Create a cobalt SaaS pitch deck for ${vertical.product} with ARR chart and enterprise proof slides.`
}));

const invoiceSeeds: PeakTemplateSeed[] = forestInvoiceVariants.map((variant, index) => ({
  id: `peak-forest-invoice-${variant.id}`,
  name: `${variant.title}`,
  category: 'Invoice',
  format: 'sheet',
  skillId: 'xlsx',
  sourceUrl: MS_XLS,
  description: `Forest-green header invoice for ${variant.client} with formulas and totals.`,
  useCase: 'Professional billing with itemized rows and tax calculations.',
  source: 'workbench-curated',
  tags: ['invoice', 'peak-artifact', 'forest', variant.id],
  designPreset: 'spreadsheet-forest',
  peakArtifactId: `peak-forest-invoice-${variant.id}`,
  peakFamily: 'forest-invoice',
  visualStyle: 'Green header band invoice with zebra rows and formula totals',
  featured: index === 0,
  sortOrder: 40 + index,
  starterPrompt: `Create a forest-green invoice spreadsheet for ${variant.client} with line items and tax.`
}));

const guideSeeds: PeakTemplateSeed[] = wellnessGuideVariants.map((variant, index) => ({
  id: `peak-wellness-guide-${variant.id}`,
  name: variant.title,
  category: 'Brand guide',
  format: 'report',
  skillId: 'pdf',
  sourceUrl: MS_WORD,
  description: `${variant.brand} personalized guide with routines, product grid, and progress tracker.`,
  useCase: 'Client onboarding guides and membership playbooks.',
  source: 'workbench-curated',
  tags: ['guide', 'peak-artifact', 'wellness', variant.id],
  designPreset: 'wellness-signal',
  peakArtifactId: `peak-wellness-guide-${variant.id}`,
  peakFamily: 'wellness-guide',
  visualStyle: 'Orange and blue wellness cards with routine tables and progress sections',
  featured: index === 0,
  sortOrder: 60 + index,
  starterPrompt: `Create a personalized ${variant.brand} client guide PDF with routines and progress tracking.`
}));

const resumeSeeds: PeakTemplateSeed[] = atsResumeVariants.map((variant, index) => ({
  id: `peak-ats-resume-${variant.id}`,
  name: `${variant.name} ${variant.role}`,
  category: index === 4 ? 'Executive resume' : index === 3 ? 'Campus resume' : 'ATS resume',
  format: 'resume',
  skillId: 'resume',
  sourceUrl: MS_WORD,
  description: `ATS-ready ${variant.role} resume with measurable bullets and clean hierarchy.`,
  useCase: 'Job applications using only supplied candidate facts.',
  source: 'workbench-curated',
  tags: ['resume', 'peak-artifact', 'ats', variant.id],
  designPreset: 'classic-ats',
  peakArtifactId: `peak-ats-resume-${variant.id}`,
  peakFamily: 'ats-resume',
  visualStyle: 'Monochrome ATS layout with summary band and role-focused experience',
  featured: index < 2,
  sortOrder: 80 + index,
  starterPrompt: `Create an ATS resume for ${variant.role} using only the facts I provide.`
}));

export const peakTemplateSeeds: PeakTemplateSeed[] = [
  ...xboardSeeds,
  ...cobaltSeeds,
  ...invoiceSeeds,
  ...guideSeeds,
  ...resumeSeeds,
  ...archetypeTemplateSeeds,
  ...kingsoftTemplateSeeds
];