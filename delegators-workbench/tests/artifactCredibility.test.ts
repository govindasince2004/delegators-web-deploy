import { describe, expect, it } from 'vitest';
import { ArtifactDocumentSchema } from '../src/lib/shared';
import {
  countHypeSignals,
  inspectCoverAndOpenerDesign,
  inspectCredibilityApparatus,
  inspectCredibilityTone
} from '../server/artifactCredibility';
import { isBlockingPublishIssue } from '../server/artifactPipeline';

const hypeArtifact = ArtifactDocumentSchema.parse({
  kind: 'report',
  primaryFormat: 'pdf',
  title: 'AI Brief',
  audience: 'Leaders',
  tone: 'Executive',
  executiveSummary: 'This is the most consequential strategic analysis of an unprecedented new chapter in technology.',
  sections: [
    { heading: 'Overview', body: 'Analysts, researchers, and technology strategists agree this is a defining moment.', bullets: [] }
  ]
});

describe('artifact credibility gates', () => {
  it('flags hype and fake authority voice', () => {
    const issues: string[] = [];
    inspectCredibilityTone(hypeArtifact, issues);
    expect(issues.join(' ')).toMatch(/institutional hype/i);
    expect(issues.join(' ')).toMatch(/anonymous authority/i);
    expect(countHypeSignals(hypeArtifact)).toBeGreaterThan(0);
    expect(isBlockingPublishIssue(issues[0] ?? '')).toBe(true);
  });

  it('requires citation apparatus for researched deliverables', () => {
    const issues: string[] = [];
    inspectCredibilityApparatus(hypeArtifact, {
      needsResearch: true,
      hasSources: true,
      citationsRequired: true
    }, issues);
    expect(issues.join(' ')).toMatch(/citations/i);
    expect(issues.join(' ')).toMatch(/appendix|confidence/i);
  });

  it('flags underdesigned deck covers', () => {
    const deck = ArtifactDocumentSchema.parse({
      kind: 'deck',
      primaryFormat: 'pptx',
      title: 'Brief',
      audience: 'Leaders',
      tone: 'Executive',
      executiveSummary: '',
      sections: [{ heading: 'Open', body: '', bullets: [] }],
      slides: [{ title: 'A new chapter', bullets: ['Most consequential event.'] }]
    });
    const issues: string[] = [];
    inspectCoverAndOpenerDesign(deck, issues);
    expect(issues.length).toBeGreaterThan(0);
  });
});