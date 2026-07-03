import type { ArtifactDocument } from '../shared.js';

const resumeVariants = [
  { id: 'engineer', name: 'Maya Rao', headline: 'Platform Engineer', role: 'Big Data Engineer' },
  { id: 'marketing', name: 'Jordan Lee', headline: 'Social Media Manager', role: 'Growth Marketing Lead' },
  { id: 'finance', name: 'Alex Morgan', headline: 'Finance Analyst', role: 'FP&A Manager' },
  { id: 'campus', name: 'Priya Shah', headline: 'CS Graduate', role: 'Software Engineer Intern' },
  { id: 'executive', name: 'Elena Brooks', headline: 'VP Operations', role: 'Chief Operating Officer' },
  { id: 'designer', name: 'Sam Ortiz', headline: 'Product Designer', role: 'Senior UX Designer' },
  { id: 'pm', name: 'Riley Kim', headline: 'Technical Program Manager', role: 'TPM' }
];

export function buildAtsResumeArtifact(variantId: string): ArtifactDocument | undefined {
  const variant = resumeVariants.find((item) => item.id === variantId);
  if (!variant) return undefined;
  return {
    kind: 'resume',
    primaryFormat: 'docx',
    title: `${variant.name} Resume`,
    audience: 'Hiring managers and recruiters',
    tone: 'professional',
    executiveSummary: `ATS-friendly ${variant.role} resume with measurable outcomes and clean hierarchy.`,
    sections: [{ heading: 'Role target', body: variant.role, bullets: ['Use only supplied facts when customizing'] }],
    resume: {
      name: variant.name,
      headline: variant.headline,
      contact: ['you@email.com', 'City, State', 'linkedin.com/in/you'],
      summary: `${variant.headline} with a track record of shipping measurable outcomes in cross-functional teams.`,
      skills: ['Stakeholder communication', 'Data analysis', 'Project delivery', 'Process design'],
      experience: [{
        heading: `${variant.role} | Example Co.`,
        body: '2022 — Present',
        bullets: ['Led initiatives that improved throughput by 24%.', 'Partnered with leadership on quarterly planning and reporting.']
      }],
      education: [{ heading: 'B.S. | State University', body: '2020', bullets: ['Dean\'s list'] }],
      projects: [{
        heading: 'Portfolio highlight',
        body: 'Selected project',
        bullets: ['Demonstrates role fit with outcome-focused bullets.']
      }]
    },
    citations: [],
    nextQuestions: [],
    design: {
      template: 'classic-ats',
      headingFontFamily: 'Cambria',
      bodyFontFamily: 'Cambria',
      density: 'compact',
      palette: {
        background: '#FFFFFF',
        surface: '#F5F5F2',
        text: '#111111',
        muted: '#555555',
        primary: '#111111',
        accent: '#1F4E79'
      }
    },
    assets: []
  };
}

export const atsResumeVariants = resumeVariants;