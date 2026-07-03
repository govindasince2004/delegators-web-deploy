import type { ArtifactDesign, ArtifactDocument } from '../src/lib/shared.js';
import { detectArtifactAudience } from './artifactAudience.js';

type DocumentTemplate = {
  name: NonNullable<ArtifactDesign['template']>;
  visualDirection: string;
  headingFont: string;
  bodyFont: string;
  palette: NonNullable<ArtifactDesign['palette']>;
};

const documentTemplates: Record<string, DocumentTemplate> = {
  'editorial-ivory': {
    name: 'editorial-ivory',
    visualDirection: 'Editorial ivory report with restrained hierarchy and sourced evidence blocks.',
    headingFont: 'Georgia',
    bodyFont: 'Calibri',
    palette: {
      background: '#FFFDF7',
      surface: '#F4F1EA',
      text: '#1C1917',
      muted: '#78716C',
      primary: '#1C1917',
      accent: '#B45309'
    }
  },
  'executive-slate': {
    name: 'executive-slate',
    visualDirection: 'Executive board memo with BLUF opening, calm slate palette, and decision-ready sections.',
    headingFont: 'Arial',
    bodyFont: 'Calibri',
    palette: {
      background: '#F8FAFC',
      surface: '#E2E8F0',
      text: '#0F172A',
      muted: '#64748B',
      primary: '#0F172A',
      accent: '#0369A1'
    }
  },
  'consulting-mono': {
    name: 'consulting-mono',
    visualDirection: 'Consulting-grade monochrome document with fact/analysis separation and appendix discipline.',
    headingFont: 'Arial',
    bodyFont: 'Arial',
    palette: {
      background: '#FFFFFF',
      surface: '#F4F4F5',
      text: '#18181B',
      muted: '#71717A',
      primary: '#18181B',
      accent: '#2563EB'
    }
  },
  'classic-ats': {
    name: 'classic-ats',
    visualDirection: 'Clean ATS-friendly resume layout with scannable headings and truthful single-column structure.',
    headingFont: 'Arial',
    bodyFont: 'Calibri',
    palette: {
      background: '#FFFFFF',
      surface: '#F8FAFC',
      text: '#0F172A',
      muted: '#475569',
      primary: '#0F172A',
      accent: '#334155'
    }
  }
};

export function inferDocumentTemplate(brief: string, kind: ArtifactDocument['kind']): DocumentTemplate {
  const clean = brief.toLowerCase();
  if (kind === 'resume') return documentTemplates['classic-ats'];
  const audience = detectArtifactAudience(brief, kind);
  const audienceTemplate = documentTemplates[audience.documentTemplate];
  if (audienceTemplate) return audienceTemplate;
  if (/\b(?:ats|resume|cv|career)\b/.test(clean)) return documentTemplates['classic-ats'];
  if (/\b(?:investor|boardroom|executive|memo|briefing)\b/.test(clean)) return documentTemplates['executive-slate'];
  if (/\b(?:consulting|strategy|thesis|white\s*paper)\b/.test(clean)) return documentTemplates['consulting-mono'];
  if (/\b(?:academic|assignment|college|school|citation)\b/.test(clean)) return documentTemplates['editorial-ivory'];
  if (/\b(?:proposal|client|scope|deliverables)\b/.test(clean)) return documentTemplates['executive-slate'];
  return documentTemplates['editorial-ivory'];
}

export function applyDocumentDesign(artifact: ArtifactDocument, brief = ''): ArtifactDocument {
  if (artifact.kind === 'deck' || artifact.kind === 'sheet') return artifact;
  if (/\b(?:match(?:ing|ed)?|mirror(?:ing|ed)?|uploaded|reference style)\b/i.test(brief)) return artifact;

  const template = inferDocumentTemplate(brief, artifact.kind);
  const design = artifact.design ?? {};
  return {
    ...artifact,
    design: {
      ...design,
      template: design.template ?? template.name,
      visualDirection: design.visualDirection ?? template.visualDirection,
      headingFontFamily: design.headingFontFamily ?? template.headingFont,
      bodyFontFamily: design.bodyFontFamily ?? template.bodyFont,
      pageSize: design.pageSize ?? 'letter',
      orientation: design.orientation ?? 'portrait',
      density: design.density ?? detectArtifactAudience(brief, artifact.kind).density,
      includeTableOfContents: design.includeTableOfContents ?? (artifact.kind === 'report' && artifact.sections.length >= 5),
      includePageNumbers: design.includePageNumbers ?? true,
      palette: {
        background: design.palette?.background ?? template.palette.background,
        surface: design.palette?.surface ?? template.palette.surface,
        text: design.palette?.text ?? template.palette.text,
        muted: design.palette?.muted ?? template.palette.muted,
        primary: design.palette?.primary ?? template.palette.primary,
        accent: design.palette?.accent ?? template.palette.accent
      }
    }
  };
}

const assignmentScaffold = [
  'Abstract',
  'Introduction',
  'Methodology',
  'Findings',
  'Discussion',
  'Conclusion',
  'References'
];

export function stabilizeAssignmentSections(artifact: ArtifactDocument): ArtifactDocument {
  if (artifact.kind !== 'assignment') return artifact;
  const headings = new Set(artifact.sections.map((section) => section.heading.trim().toLowerCase()));
  const missing = assignmentScaffold.filter((heading) => !headings.has(heading.toLowerCase()));
  if (missing.length === 0) return artifact;
  return {
    ...artifact,
    sections: [
      ...artifact.sections,
      ...missing.map((heading) => ({
        heading,
        body: heading === 'References'
          ? 'List only sources actually used in this submission.'
          : '',
        bullets: heading === 'Methodology'
          ? ['Describe method honestly.', 'State limitations and what was not verified.']
          : []
      }))
    ]
  };
}

export function stabilizeArtifactComposition(artifact: ArtifactDocument, brief = ''): ArtifactDocument {
  return stabilizeAssignmentSections(applyDocumentDesign(artifact, brief));
}