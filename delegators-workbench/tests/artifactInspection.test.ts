import { describe, expect, it } from 'vitest';
import {
  buildQualityRevisionMessages,
  fallbackArtifactInspection,
  inspectArtifactLocally,
  mergeArtifactInspections,
  parseProviderInspection,
  type ArtifactInspection
} from '../server/artifactInspection';
import { ArtifactDocumentSchema } from '../src/lib/shared';

const artifact = ArtifactDocumentSchema.parse({
  kind: 'deck',
  primaryFormat: 'pptx',
  title: 'Teaching AI',
  audience: 'Beginners',
  tone: 'clear',
  executiveSummary: 'A practical AI teaching deck.',
  sections: [{ heading: 'Start', body: 'Teach foundations first.', bullets: ['Set expectations'] }],
  slides: [{ title: 'Start', bullets: ['Set expectations'] }],
  citations: [],
  nextQuestions: [],
  design: { visualDirection: 'Refined editorial' }
});

describe('artifact quality inspection', () => {
  it('parses provider inspection output', () => {
    const inspection = parseProviderInspection(JSON.stringify({
      passed: false,
      summary: 'The deck ignored the requested non-generic design direction.',
      issues: ['The visual direction is too generic.', 'Speaker notes are missing.'],
      revisionInstruction: 'Revise the deck with a more editorial visual direction and add speaker notes.'
    }));

    expect(inspection?.source).toBe('provider');
    expect(inspection?.passed).toBe(false);
    expect(inspection?.issues).toHaveLength(2);
    expect(inspection?.revisionInstruction).toContain('editorial');
  });

  it('sanitizes internal implementation terms from inspection text', () => {
    const inspection = parseProviderInspection(JSON.stringify({
      passed: false,
      summary: 'The backend harness JSON schema found a problem.',
      issues: ['Open terminal workspace tool-call details are visible.'],
      revisionInstruction: 'Remove workspace JSON schema wording.'
    }));
    const serialized = JSON.stringify(inspection);

    expect(serialized).not.toMatch(/backend|harness|terminal|workspace|tool-call|json|schema/i);
  });

  it('keeps a passing fallback when provider inspection is unavailable', () => {
    const inspection = fallbackArtifactInspection();

    expect(inspection.passed).toBe(true);
    expect(inspection.source).toBe('fallback');
  });

  it('catches hyphenated slide count requests', () => {
    const weakDeck = ArtifactDocumentSchema.parse({
      ...artifact,
      slides: Array.from({ length: 4 }, (_, index) => ({
        title: `Slide ${index + 1}`,
        bullets: ['Point']
      }))
    });
    const inspection = inspectArtifactLocally({
      artifact: weakDeck,
      sourceBrief: 'Create a premium 12-slide investor deck with charts.',
      expectedKind: 'deck',
      expectedPrimaryFormat: 'pptx'
    });
    expect(inspection.passed).toBe(false);
    expect(inspection.issues.join(' ')).toMatch(/12 slides/i);
  });

  it('catches ignored slide counts and repetitive text-heavy deck structure', () => {
    const weakDeck = ArtifactDocumentSchema.parse({
      ...artifact,
      slides: Array.from({ length: 5 }, (_, index) => ({
        title: `Topic ${index + 1}`,
        bullets: Array.from({ length: 7 }, (_, bullet) => `Long repeated bullet ${bullet + 1} with more detail than a presentation should carry.`),
        layout: 'list' as const
      }))
    });
    const inspection = inspectArtifactLocally({
      artifact: weakDeck,
      sourceBrief: 'Create exactly 7 slides with a premium editorial visual direction.',
      expectedKind: 'deck',
      expectedPrimaryFormat: 'pptx'
    });

    expect(inspection.passed).toBe(false);
    expect(inspection.issues.join(' ')).toMatch(/7 slides/i);
    expect(inspection.issues.join(' ')).toMatch(/visual storytelling|evidence/i);
    expect(inspection.issues.join(' ')).toMatch(/dense/i);
  });

  it('rejects decks that technically vary layouts but still lack visual storytelling', () => {
    const weakDeck = ArtifactDocumentSchema.parse({
      ...artifact,
      slides: [
        { title: 'Opening', subtitle: 'A generic opening', bullets: ['Context'], layout: 'statement' },
        { title: 'Topic two', bullets: ['Point one', 'Point two', 'Point three'], layout: 'list' },
        { title: 'Topic three', subtitle: 'Another generic panel', bullets: ['Point one', 'Point two'], layout: 'split' },
        { title: 'Topic four', bullets: ['Point one', 'Point two', 'Point three'], layout: 'list' },
        { title: 'Topic five', subtitle: 'Another generic panel', bullets: ['Point one', 'Point two'], layout: 'split' },
        { title: 'Close', bullets: ['Thank you'], layout: 'statement' }
      ]
    });

    const inspection = inspectArtifactLocally({
      artifact: weakDeck,
      sourceBrief: 'Create a premium six-slide board presentation.',
      expectedKind: 'deck',
      expectedPrimaryFormat: 'pptx'
    });

    expect(inspection.passed).toBe(false);
    expect(inspection.issues.join(' ')).toMatch(/visual storytelling|evidence/i);
  });

  it('accepts a deck with structured metrics, comparison, process, and evidence visuals', () => {
    const strongDeck = ArtifactDocumentSchema.parse({
      ...artifact,
      slides: [
        { title: 'A decision, not a document', subtitle: 'Board review', bullets: ['Approve the operating model'], layout: 'cover', theme: 'dark' },
        { title: 'Three signals define the decision', layout: 'metric', metrics: [
          { value: '3', label: 'decision signals' },
          { value: '90 days', label: 'first operating horizon' },
          { value: '1 owner', label: 'accountable executive' }
        ] },
        { title: 'The new model removes handoffs', layout: 'comparison', columns: [
          { heading: 'Today', bullets: ['Fragmented ownership', 'Manual status collection'] },
          { heading: 'Target', bullets: ['Single accountable owner', 'Shared scorecard'] }
        ] },
        { title: 'Execution moves through four gates', layout: 'process', bullets: ['Frame', 'Validate', 'Commit', 'Scale'] },
        { title: 'Evidence supports the sequence', layout: 'chart', bullets: ['Adoption rises after owner assignment'], chart: {
          type: 'line', labels: ['Q1', 'Q2', 'Q3'], series: [{ name: 'Adoption', values: [20, 46, 71] }], unit: '%'
        } },
        { title: 'Approve the 90-day launch', layout: 'statement', bullets: ['Name the owner', 'Fund the first wave'] }
      ]
    });

    expect(inspectArtifactLocally({
      artifact: strongDeck,
      sourceBrief: 'Create a premium six-slide board presentation.',
      expectedKind: 'deck',
      expectedPrimaryFormat: 'pptx'
    }).passed).toBe(true);
  });

  it('enforces exact uploaded presentation design evidence when the user asks to match it', () => {
    const profile = {
      sourceName: 'board-template.pptx',
      slideCount: 8,
      slideAspect: 'standard' as const,
      headingFontFamily: 'Georgia',
      bodyFontFamily: 'Garamond',
      themeColors: ['221D15', 'FBF8F1', 'B5562C', '7A715F'],
      usedColors: ['221D15', 'FBF8F1', 'B5562C', '7A715F'],
      layoutRhythm: []
    };
    const mismatched = inspectArtifactLocally({
      artifact,
      sourceBrief: 'Create a new deck matching the uploaded presentation style.',
      referenceDesignProfiles: [profile]
    });
    expect(mismatched.passed).toBe(false);
    expect(mismatched.issues.join(' ')).toMatch(/standard slide aspect/i);
    expect(mismatched.issues.join(' ')).toMatch(/Georgia/i);
    expect(mismatched.issues.join(' ')).toMatch(/theme colors/i);

    const matched = ArtifactDocumentSchema.parse({
      ...artifact,
      design: {
        ...artifact.design,
        slideAspect: 'standard',
        headingFontFamily: 'Georgia',
        bodyFontFamily: 'Garamond',
        palette: {
          background: '#FBF8F1',
          surface: '#7A715F',
          text: '#221D15',
          accent: '#B5562C'
        }
      }
    });
    expect(inspectArtifactLocally({
      artifact: matched,
      sourceBrief: 'Create a new deck matching the uploaded presentation style.',
      referenceDesignProfiles: [profile]
    }).passed).toBe(true);
  });

  it('blocks unsupported business traction invented beyond uploaded evidence', () => {
    const inventedDeck = ArtifactDocumentSchema.parse({
      ...artifact,
      title: 'Delegators Series A',
      executiveSummary: 'Delegators has 12,400 sessions and is raising $4.5M at a $22M pre-money valuation.',
      sections: [{
        heading: 'Traction',
        body: 'The company has 2,800 registered accounts and a 91% artifact completion rate.',
        bullets: ['6,200 Workbench artifacts generated']
      }],
      slides: [{
        title: 'Traction: 12,400 sessions in first 90 days',
        bullets: ['2,800 registered accounts', '$4.5M raise', '$22M pre-money valuation']
      }]
    });
    const inspection = inspectArtifactLocally({
      artifact: inventedDeck,
      sourceBrief: 'Create a VC deck from the uploaded Delegators landing-page screenshots. Do not make AI slop.',
      sourceEvidence: 'Uploaded screenshots say: Build the work. Ship the result. SWE sessions. Workbench. CLI. Office Suite. SWE Ultra costs ₹99.',
      expectedKind: 'deck',
      expectedPrimaryFormat: 'pptx'
    });

    expect(inspection.passed).toBe(false);
    expect(inspection.issues.join(' ')).toMatch(/not present|unsupported/i);
  });

  it('allows researched market stats on informational decks without upload-evidence parity', () => {
    const aiDeck = ArtifactDocumentSchema.parse({
      ...artifact,
      title: 'Latest AI Updates',
      executiveSummary: 'The global AI market is projected to reach $1.8 trillion by 2030 with 37% CAGR.',
      slides: [{
        title: 'Market momentum in 2026',
        bullets: ['Enterprise adoption up 42%', 'Foundation-model releases accelerated in 2025']
      }]
    });
    const inspection = inspectArtifactLocally({
      artifact: aiDeck,
      sourceBrief: 'Create a beautiful ppt on latest AI updates.',
      sourceEvidence: 'Research pack: AI adoption is accelerating across enterprise teams.',
      expectedKind: 'deck',
      expectedPrimaryFormat: 'pptx',
      hasResearchSources: true
    });

    expect(inspection.issues.join(' ')).not.toMatch(/business metrics|unsupported numbers/i);
  });

  it('blocks empty non-template workbooks and shallow comprehensive reports', () => {
    const emptySheet = ArtifactDocumentSchema.parse({
      kind: 'sheet',
      primaryFormat: 'xlsx',
      title: 'Budget',
      audience: 'Finance',
      tone: 'professional',
      sections: [{ heading: 'Budget', body: '', bullets: [] }],
      sheet: { sheets: [{ name: 'Budget', columns: ['Item', 'Amount'], rows: [] }] }
    });
    const shallowReport = ArtifactDocumentSchema.parse({
      kind: 'report',
      primaryFormat: 'pdf',
      title: 'Market report',
      audience: 'Leadership',
      tone: 'executive',
      sections: [{ heading: 'Finding', body: 'The market is changing.', bullets: [] }]
    });

    expect(inspectArtifactLocally({
      artifact: emptySheet,
      sourceBrief: 'Build a populated hiring budget workbook.'
    }).issues.join(' ')).toMatch(/no populated data rows/i);
    expect(inspectArtifactLocally({
      artifact: shallowReport,
      sourceBrief: 'Create a comprehensive deep market report.'
    }).issues.join(' ')).toMatch(/too shallow/i);
  });

  it('rejects documents that cannot plausibly fill the requested page count', () => {
    const shortReport = ArtifactDocumentSchema.parse({
      kind: 'report',
      primaryFormat: 'pdf',
      title: 'Operating review',
      audience: 'Board',
      tone: 'executive',
      executiveSummary: 'A short summary.',
      sections: [{
        heading: 'Finding',
        body: 'Only a small amount of content was produced.',
        bullets: ['One supporting point']
      }]
    });

    const inspection = inspectArtifactLocally({
      artifact: shortReport,
      sourceBrief: 'Create a detailed 6-page board report.'
    });

    expect(inspection.passed).toBe(false);
    expect(inspection.issues.join(' ')).toMatch(/6 pages/i);
  });

  it('merges local publication failures with provider taste feedback', () => {
    const local = inspectArtifactLocally({
      artifact,
      sourceBrief: 'Create exactly 4 slides.'
    });
    const provider: ArtifactInspection = {
      passed: false,
      summary: 'Visual hierarchy needs improvement.',
      issues: ['The visual hierarchy is weak.'],
      revisionInstruction: 'Strengthen hierarchy.',
      source: 'provider'
    };
    const merged = mergeArtifactInspections(local, provider);

    expect(merged.source).toBe('combined');
    expect(merged.issues.join(' ')).toMatch(/4 slides/i);
    expect(merged.issues.join(' ')).toMatch(/hierarchy/i);
  });

  it('builds a full-artifact revision prompt without exposing implementation details', () => {
    const inspection: ArtifactInspection = {
      passed: false,
      summary: 'The artifact missed the requested design direction.',
      issues: ['Slides are too generic.'],
      revisionInstruction: 'Make the design more editorial without inventing facts.',
      source: 'provider'
    };
    const messages = buildQualityRevisionMessages({
      artifact,
      inspection,
      sourceBrief: 'Create a deck with refined editorial design.',
      expectedKind: 'deck',
      expectedPrimaryFormat: 'pptx'
    });
    const serialized = JSON.stringify(messages);

    expect(serialized).toContain('Return only the full corrected artifact JSON');
    expect(serialized).toContain('refined editorial');
    expect(serialized).not.toMatch(/terminal|workspace|tool-call/i);
  });

  it('flags fabricated merger or acquisition claims without supporting evidence', () => {
    const fabricated = ArtifactDocumentSchema.parse({
      ...artifact,
      slides: [{
        title: 'SpaceX acquired Cursor in the largest tech acquisition of 2026',
        bullets: ['$60B merger closes in Q3 2026'],
        layout: 'statement'
      }]
    });
    const inspection = inspectArtifactLocally({
      artifact: fabricated,
      sourceEvidence: 'SpaceX launch statistics and Cursor product changelog only.',
      expectedKind: 'deck',
      expectedPrimaryFormat: 'pptx'
    });
    expect(inspection.passed).toBe(false);
    expect(inspection.issues.some((issue) => /merger|acquisition/i.test(issue))).toBe(true);
  });

  it('allows corporate events and metrics when prior thread conversation supplied them', () => {
    const deck = ArtifactDocumentSchema.parse({
      ...artifact,
      slides: [{
        title: 'SpaceX acquired Anysphere (Cursor) for $60 billion',
        bullets: ['IPO priced at $135/share on June 12', 'Deal expected to close in Q3 2026'],
        layout: 'statement'
      }]
    });
    const threadEvidence = [
      'User: search the internet for latest SpaceX and Cursor news',
      'Assistant: SpaceX priced its IPO at $135/share on June 12 under ticker SPCX.',
      'SpaceX agreed to acquire Anysphere (Cursor) for $60 billion in an all-stock deal, expected to close in Q3 2026.'
    ].join('\n');
    const inspection = inspectArtifactLocally({
      artifact: deck,
      sourceEvidence: threadEvidence,
      expectedKind: 'deck',
      expectedPrimaryFormat: 'pptx'
    });
    expect(inspection.issues.some((issue) => /merger|acquisition|unsupported numbers/i.test(issue))).toBe(false);
  });
});
