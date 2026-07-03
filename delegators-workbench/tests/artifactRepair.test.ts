import { describe, expect, it } from 'vitest';
import {
  artifactContainsInternalExecutionLeak,
  parseArtifactCandidate,
  parseArtifactJson
} from '../server/artifactRepair';

describe('artifact repair normalizer', () => {
  it('adds structured resume data from section-only model output', () => {
    const parsed = parseArtifactCandidate({
      kind: 'resume',
      title: 'Backend Engineer Resume',
      audience: 'Recruiter',
      tone: 'professional',
      executiveSummary: 'Candidate profile.',
      nextQuestions: ['phone?', 'email?', 'links?', 'dates?', 'marks?', 'location?', 'extra?'],
      sections: [
        { title: 'Summary', content: 'Backend engineer focused on APIs.' },
        { title: 'Skills', bullets: ['Go', 'Postgres', 'Redis'] },
        { title: 'Projects', bullets: ['Built a metered API gateway'] }
      ]
    }, { expectedKind: 'resume' });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.resume).toBeDefined();
    expect(parsed.data.resume?.skills).toEqual(['Go', 'Postgres', 'Redis']);
    expect(parsed.data.nextQuestions).toHaveLength(6);
  });

  it('repairs deck sections that use title instead of heading', () => {
    const parsed = parseArtifactCandidate({
      kind: 'deck',
      title: 'Launch Review',
      audience: 'Founders',
      tone: 'executive',
      sections: [{ title: 'Problem', content: 'The old funnel is slow.' }],
      slides: [{
        heading: 'Problem',
        points: ['Slow funnel', 'High support load'],
        composition: 'split',
        colorTreatment: 'accent'
      }]
    }, { expectedKind: 'deck' });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.sections[0]?.heading).toBe('Problem');
    expect(parsed.data.slides?.[0]?.title).toBe('Problem');
    expect(parsed.data.slides?.[0]?.layout).toBe('split');
    expect(parsed.data.slides?.[0]?.theme).toBe('accent');
  });

  it('repairs malformed model JSON with an unquoted heading value', () => {
    const parsed = parseArtifactJson(`\`\`\`json
      {
        "kind": "deck",
        "title": "Board deck",
        "sections": [{"heading":The credentials moat,"body":"Defensible access","bullets":[]}]
      }
    \`\`\``) as { sections: Array<{ heading: string }> };

    expect(parsed.sections[0]?.heading).toBe('The credentials moat');
  });

  it('builds sheet.sheets from flat workbook fields', () => {
    const parsed = parseArtifactCandidate({
      kind: 'sheet',
      title: 'Budget Sheet',
      audience: 'Ops',
      tone: 'minimal',
      sections: [{ heading: 'Budget', body: 'Monthly budget.' }],
      columns: ['Item', 'Cost'],
      rows: [['Server', '1200'], ['API', '800']]
    }, { expectedKind: 'sheet' });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.sheet?.sheets[0]?.columns).toEqual(['Item', 'Cost']);
  });

  it('rejects unresolved template placeholders so the model repair path runs', () => {
    const parsed = parseArtifactCandidate({
      kind: 'email',
      title: 'Maintenance notice',
      audience: 'Engineering team',
      tone: 'professional',
      sections: [{
        heading: 'Email',
        body: 'Thanks,\n[Project Lead Name]',
        bullets: []
      }]
    }, { expectedKind: 'email' });

    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.message).toContain('template placeholders');
  });

  it('allows ordinary business language while detecting actual internal tool identifiers', () => {
    const ordinaryArtifact = {
      kind: 'deck' as const,
      title: 'Forming a Product Team',
      audience: 'Founders',
      tone: 'professional',
      executiveSummary: 'Create a productive team workspace with the right collaboration tools.',
      sections: [{
        heading: 'Operating model',
        body: 'Give the team a shared workspace and a practical tool selection process.',
        bullets: ['Choose collaboration tools based on team needs.']
      }],
      citations: [],
      nextQuestions: []
    };

    expect(artifactContainsInternalExecutionLeak(ordinaryArtifact)).toBe(false);
    expect(artifactContainsInternalExecutionLeak({
      ...ordinaryArtifact,
      sections: [{ ...ordinaryArtifact.sections[0], body: 'I called terminal_run and read workspace/input/brief.md.' }]
    })).toBe(true);
  });

  it('forces @skill primary format over model pdf output for decks', () => {
    const parsed = parseArtifactCandidate({
      kind: 'report',
      primaryFormat: 'pdf',
      title: 'Investor deck',
      audience: 'Board',
      tone: 'executive',
      sections: [{ heading: 'Thesis', body: 'Opening insight.', bullets: [] }],
      slides: [{ title: 'Cover', bullets: ['One message'], layout: 'statement' }]
    }, { expectedKind: 'deck', expectedPrimaryFormat: 'pptx' });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.kind).toBe('deck');
    expect(parsed.data.primaryFormat).toBe('pptx');
  });

  it('normalizes design aliases without replacing explicit user choices', () => {
    const parsed = parseArtifactCandidate({
      kind: 'report',
      title: 'Brand Guide',
      audience: 'Design team',
      tone: 'editorial',
      primaryFormat: 'docx',
      design: {
        font: 'Garamond',
        headingFont: 'Futura',
        paperSize: 'letter',
        orientation: 'landscape',
        colors: { primary: '#112233', accent: '#DDBB44' }
      },
      sections: [{ heading: 'Direction', body: 'Use the supplied brand system.', bullets: [] }]
    }, { expectedKind: 'report' });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.primaryFormat).toBe('docx');
    expect(parsed.data.design.bodyFontFamily).toBe('Garamond');
    expect(parsed.data.design.headingFontFamily).toBe('Futura');
    expect(parsed.data.design.pageSize).toBe('letter');
    expect(parsed.data.design.palette?.primary).toBe('#112233');
  });
});
