import { describe, expect, it } from 'vitest';
import { applyDocumentDesign, inferDocumentTemplate } from '../server/documentComposition';
import { ArtifactDocumentSchema } from '../src/lib/shared';

describe('document composition', () => {
  it('applies executive templates for investor reports', () => {
    const template = inferDocumentTemplate('boardroom investor executive memo', 'report');
    expect(template.name).toBe('executive-slate');

    const artifact = ArtifactDocumentSchema.parse({
      kind: 'report',
      primaryFormat: 'pdf',
      title: 'Investor memo',
      audience: 'Board',
      tone: 'executive',
      executiveSummary: 'Bottom line up front.',
      sections: [{ heading: 'Thesis', body: 'Supported claim.', bullets: [] }],
      citations: []
    });
    const designed = applyDocumentDesign(artifact, 'investor boardroom briefing');
    expect(designed.design.template).toBe('executive-slate');
    expect(designed.design.includePageNumbers).toBe(true);
  });

  it('applies ATS resume styling for resume artifacts', () => {
    const artifact = ArtifactDocumentSchema.parse({
      kind: 'resume',
      primaryFormat: 'docx',
      title: 'Maya Rao',
      audience: 'Recruiter',
      tone: 'professional',
      executiveSummary: '',
      sections: [{ heading: 'Profile', body: 'Resume body.', bullets: [] }],
      resume: {
        name: 'Maya Rao',
        headline: 'Platform Engineer',
        contact: ['maya@example.com'],
        summary: 'Backend engineer.',
        skills: ['Go'],
        experience: [{ heading: 'Engineer | Acme', body: '2022 - Present', bullets: ['Built APIs.'] }],
        education: [{ heading: 'B.Tech', body: '2020', bullets: [] }]
      },
      citations: []
    });
    const designed = applyDocumentDesign(artifact, '@resume ATS-friendly CV');
    expect(designed.design.template).toBe('classic-ats');
    expect(designed.design.headingFontFamily).toBe('Arial');
  });
});