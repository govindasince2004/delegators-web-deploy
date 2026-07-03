import { describe, expect, it } from 'vitest';
import { applyInvestorDeckDesign } from '../server/deckComposition';
import { applyDocumentDesign } from '../server/documentComposition';
import {
  audienceCitationsRequired,
  audienceCraftLines,
  detectArtifactAudience
} from '../server/artifactAudience';
import { ArtifactDocumentSchema } from '../src/lib/shared';

describe('artifact audience routing', () => {
  it('detects student, academic, startup, corporate, and investor modes', () => {
    expect(detectArtifactAudience('school class presentation for students').audience).toBe('student');
    expect(detectArtifactAudience('university campus lecture slides').label).toBe('College presentation');
    expect(detectArtifactAudience('college assignment project report', 'assignment').audience).toBe('academic');
    expect(detectArtifactAudience('@assignment college project viva synopsis', 'assignment').audience).toBe('academic');
    expect(detectArtifactAudience('@project capstone final year report', 'report').audience).toBe('academic');
    expect(detectArtifactAudience('startup founder seed pitch deck').audience).toBe('startup');
    expect(detectArtifactAudience('quarterly operations review for leadership').audience).toBe('corporate');
    expect(detectArtifactAudience('12-slide investor boardroom briefing').audience).toBe('investor');
    expect(detectArtifactAudience('@proposal client deliverable sow').audience).toBe('corporate');
  });

  it('relaxes citation requirements for student decks but keeps them for academic work', () => {
    const student = detectArtifactAudience('school class presentation for students');
    const academic = detectArtifactAudience('@project capstone report', 'report');
    expect(audienceCitationsRequired(student, true, true)).toBe(false);
    expect(audienceCitationsRequired(academic, true, true)).toBe(true);
    expect(audienceCitationsRequired(academic, false, true)).toBe(false);
  });

  it('maps audiences to different deck and document templates', () => {
    expect(detectArtifactAudience('science fair student slides').deckTemplate).toBe('bold-pop');
    expect(detectArtifactAudience('college assignment report', 'assignment').documentTemplate).toBe('editorial-ivory');
    expect(detectArtifactAudience('startup pitch deck').deckTemplate).toBe('modern-indigo');
    expect(detectArtifactAudience('client proposal for enterprise team').deckTemplate).toBe('consulting-mono');
    expect(detectArtifactAudience('investor board deck').deckTemplate).toBe('executive-slate');
  });

  it('honors explicit voice override instructions in the brief', () => {
    expect(detectArtifactAudience('Write like a founder about our wedge').audience).toBe('startup');
    expect(detectArtifactAudience('Tone: college student explainer on quantum basics').label).toBe('College presentation');
    expect(detectArtifactAudience('Sound like a board memo on cost controls').audience).toBe('corporate');
  });

  it('injects audience-specific craft lines into outline and compose prompts', () => {
    const student = audienceCraftLines(detectArtifactAudience('student class presentation'), 'deck');
    const investor = audienceCraftLines(detectArtifactAudience('investor board deck'), 'deck');
    expect(student.join(' ')).toMatch(/Student decks/i);
    expect(investor.join(' ')).toMatch(/Investor decks/i);
  });

  it('applies student and academic styling through composition stabilizers', () => {
    const deck = ArtifactDocumentSchema.parse({
      kind: 'deck',
      primaryFormat: 'pptx',
      title: 'Class deck',
      audience: 'Students',
      tone: 'clear',
      executiveSummary: 'Teaching deck.',
      sections: [{ heading: 'Intro', body: 'Overview.', bullets: [] }],
      slides: [{ title: 'Intro', bullets: ['Point'], layout: 'statement' }],
      citations: []
    });
    const studentDeck = applyInvestorDeckDesign(deck, 'school class presentation for students');
    expect(studentDeck.design.template).toBe('bold-pop');

    const report = ArtifactDocumentSchema.parse({
      kind: 'assignment',
      primaryFormat: 'docx',
      title: 'College project',
      audience: 'Professor',
      tone: 'formal',
      executiveSummary: 'Project report.',
      sections: [{ heading: 'Abstract', body: 'Summary.', bullets: [] }],
      citations: []
    });
    const academicDoc = applyDocumentDesign(report, '@assignment college project submission');
    expect(academicDoc.design.template).toBe('editorial-ivory');
  });
});