import type { ArtifactDocument } from '../../shared.js';
import { resumeArchetypes } from '../archetypes/resumeArchetypes.js';
import type { ResumeArchetype, ResumeLayout } from '../archetypes/types.js';

type ResumeContent = {
  summary: string;
  skills: string[];
  experienceBullets: string[];
  educationBullets: string[];
  projectBullets: string[];
  layoutHint: string;
};

function buildContent(archetype: ResumeArchetype): ResumeContent {
  const { role, layout, name } = archetype;
  const layoutHints: Record<ResumeLayout, string> = {
    executive: 'Full-width header band with board-ready summary and P&L-scale outcomes.',
    creative: 'Asymmetric section blocks with portfolio callouts and visual hierarchy.',
    technical: 'Monospace-accent skills rail with stack groupings and system metrics.',
    academic: 'Publication and research sections before professional experience.',
    minimalist: 'Single-column sparse layout with generous whitespace and no sidebar.',
    'two-column': 'Left rail for skills and education; right column for experience depth.',
    'sidebar-skills': 'Narrow left sidebar for skills, certs, and tools; wide experience column.',
    designer: 'Project gallery section with case-study bullets and craft-focused skills.',
    'data-science': 'Methods and tooling section with model performance metrics.',
    product: 'Impact metrics per role with roadmap and launch highlights.',
    sales: 'Quota attainment table in summary; logo strip and deal-size bullets.',
    healthcare: 'Licenses and certifications block above clinical experience.',
    legal: 'Matter summaries with practice-area tags and bar admissions.',
    education: 'Certifications and classroom outcomes before work history.',
    architecture: 'Cloud platform matrix and reference designs in projects section.',
    consulting: 'Engagement snapshots with client industry and outcome framing.',
    founder: 'Company-building narrative with funding and team-scale bullets.',
    remote: 'Timezone and async collaboration tools in contact strip.',
    'career-change': 'Transferable skills section bridging prior and target roles.',
    federal: 'Detailed federal format with hours-per-week and supervisor lines.',
    nursing: 'Clinical units, patient ratios, and license numbers in header.',
    hospitality: 'Property scale and RevPAR improvements in experience bullets.',
    'engineering-lead': 'Team size, hiring, and architecture decisions per role.',
    marketing: 'Campaign ROI and channel mix metrics in experience bullets.',
    finance: 'Modeling and forecasting tools with variance analysis outcomes.',
    campus: 'Coursework, GPA, and campus leadership above limited experience.',
    'c-suite': 'Enterprise transformation outcomes with board and investor context.',
    bilingual: 'Language proficiency block with global market experience.',
    contractor: 'Client roster and engagement durations instead of single employer.',
    nonprofit: 'Grant amounts and program reach metrics in experience bullets.',
    research: 'Grants, publications, and lab techniques before employment.',
    operations: 'Process efficiency, cost reduction, and vendor management metrics.'
  };

  const skillSets: Record<ResumeLayout, string[]> = {
    executive: ['P&L ownership', 'Board reporting', 'M&A integration', 'Operational scaling'],
    creative: ['Brand systems', 'Art direction', 'Figma', 'Campaign concepting'],
    technical: ['Python', 'Kubernetes', 'Spark', 'Terraform', 'Observability'],
    academic: ['Research design', 'Statistical modeling', 'Peer review', 'Grant writing'],
    minimalist: ['Stakeholder communication', 'Process design', 'Data analysis', 'Project delivery'],
    'two-column': ['SEO', 'Paid social', 'Content strategy', 'Analytics', 'A/B testing'],
    'sidebar-skills': ['Agile delivery', 'Risk management', 'Roadmapping', 'Jira', 'SQL'],
    designer: ['Design systems', 'Prototyping', 'User research', 'Accessibility', 'Motion'],
    'data-science': ['PyTorch', 'Feature engineering', 'MLOps', 'Experiment design', 'SQL'],
    product: ['Roadmapping', 'User discovery', 'PRDs', 'Launch planning', 'OKRs'],
    sales: ['Enterprise sales', 'Forecasting', 'MEDDIC', 'Contract negotiation', 'QBRs'],
    healthcare: ['Clinical operations', 'HIPAA', 'Quality improvement', 'Staff scheduling'],
    legal: ['Contract negotiation', 'Corporate governance', 'Due diligence', 'Compliance'],
    education: ['Curriculum design', 'STEM instruction', 'IEP coordination', 'Assessment'],
    architecture: ['AWS', 'Azure', 'Microservices', 'Event-driven design', 'Security'],
    consulting: ['Strategy', 'Operating model design', 'Workshop facilitation', 'Due diligence'],
    founder: ['Fundraising', 'GTM', 'Product vision', 'Team building', 'Unit economics'],
    remote: ['Async communication', 'Customer onboarding', 'Zendesk', 'Churn reduction'],
    'career-change': ['Operations', 'Cross-functional delivery', 'Process mapping', 'Analytics'],
    federal: ['Program management', 'Federal budgeting', 'Stakeholder briefings', 'Policy analysis'],
    nursing: ['ICU care', 'Epic EMR', 'ACLS', 'Patient advocacy', 'Charge nurse duties'],
    hospitality: ['P&L management', 'Guest experience', 'Revenue management', 'Team training'],
    'engineering-lead': ['Team leadership', 'System design', 'Hiring', 'Incident response', 'CI/CD'],
    marketing: ['Brand strategy', 'Demand gen', 'Marketing automation', 'ABM', 'Content'],
    finance: ['FP&A', 'Variance analysis', 'Financial modeling', 'Board decks', 'Excel'],
    campus: ['Java', 'Python', 'Algorithms', 'Git', 'Agile projects'],
    'c-suite': ['Revenue strategy', 'Enterprise sales', 'Board relations', 'Global expansion'],
    bilingual: ['Spanish/English', 'Customer success', 'Escalation management', 'CRM'],
    contractor: ['Client delivery', 'SOW scoping', 'Workshop facilitation', 'Reporting'],
    nonprofit: ['Program management', 'Grant reporting', 'Volunteer coordination', 'Fundraising'],
    research: ['Experimental design', 'MATLAB', 'LaTeX', 'Grant administration', 'Publishing'],
    operations: ['Supply chain', 'Lean process', 'Vendor management', 'KPI dashboards']
  };

  return {
    summary: `${archetype.headline} targeting ${role} roles with measurable outcomes and ${layout.replace(/-/g, ' ')} presentation.`,
    skills: skillSets[layout],
    experienceBullets: [
      `Led ${role.toLowerCase()} initiatives that improved throughput by 24%.`,
      `Partnered with leadership on quarterly planning and cross-functional delivery.`,
      `${layout === 'sales' ? 'Exceeded quota at 128% with $2.4M in new ARR.' : 'Delivered projects on time with documented ROI for stakeholders.'}`
    ],
    educationBullets: layout === 'campus'
      ? ['Dean\'s list', 'CS club president', 'Hackathon winner']
      : ['Relevant coursework and honors', 'Leadership or research distinction'],
    projectBullets: layout === 'designer' || layout === 'technical' || layout === 'data-science'
      ? ['Built portfolio project demonstrating role fit with outcome-focused metrics.', 'Open-source contribution with 400+ stars and production adoption.']
      : ['Selected project demonstrating role fit with outcome-focused bullets.'],
    layoutHint: layoutHints[layout]
  };
}

export function buildResumeArtifact(archetypeId: string): ArtifactDocument | undefined {
  const archetype = resumeArchetypes.find((item) => item.id === archetypeId);
  if (!archetype) return undefined;

  const content = buildContent(archetype);

  return {
    kind: 'resume',
    primaryFormat: 'docx',
    title: `${archetype.name} Resume`,
    audience: archetype.audience,
    tone: archetype.tone,
    executiveSummary: `${archetype.layout.replace(/-/g, ' ')} ${archetype.role} resume for ${archetype.name} with ${content.layoutHint.toLowerCase()}`,
    sections: [{
      heading: 'Layout direction',
      body: content.layoutHint,
      bullets: [`Target role: ${archetype.role}`, 'Use only supplied facts when customizing']
    }],
    resume: {
      name: archetype.name,
      headline: archetype.headline,
      contact: ['you@email.com', 'City, State', 'linkedin.com/in/you'],
      summary: content.summary,
      skills: content.skills,
      experience: [{
        heading: `${archetype.role} | Example Co.`,
        body: '2022 — Present',
        bullets: content.experienceBullets
      }],
      education: [{
        heading: archetype.layout === 'academic' || archetype.layout === 'research'
          ? 'Ph.D. | Research University'
          : 'B.S. | State University',
        body: archetype.layout === 'campus' ? '2026 (expected)' : '2020',
        bullets: content.educationBullets
      }],
      projects: [{
        heading: archetype.layout === 'designer' ? 'Portfolio highlight' : 'Selected project',
        body: archetype.layout === 'contractor' ? 'Client engagement' : 'Capstone or work sample',
        bullets: content.projectBullets
      }]
    },
    citations: [],
    nextQuestions: [],
    design: {
      template: archetype.template,
      headingFontFamily: archetype.headingFont,
      bodyFontFamily: archetype.bodyFont,
      density: archetype.density ?? 'compact',
      visualDirection: content.layoutHint,
      palette: archetype.palette
    },
    assets: []
  };
}

export function buildAllResumeArtifacts(): ArtifactDocument[] {
  return resumeArchetypes
    .map((item) => buildResumeArtifact(item.id))
    .filter((item): item is ArtifactDocument => Boolean(item));
}