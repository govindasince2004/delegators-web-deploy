import type { ArtifactDesign, ArtifactDocument } from '../src/lib/shared.js';
import { detectArtifactAudience } from './artifactAudience.js';
import { inferInvestorDeckTemplate } from './deckComposition.js';
import { inferDocumentTemplate } from './documentComposition.js';

const knownDeckTemplates = new Set([
  'midnight-aurora',
  'executive-slate',
  'consulting-mono',
  'noir-lumina',
  'bold-pop',
  'modern-indigo',
  'editorial-ivory',
  'cobalt-bold',
  'editorial-warm',
  'signal-orange'
]);

const knownDocumentTemplates = new Set([
  'editorial-ivory',
  'executive-slate',
  'consulting-mono',
  'classic-ats',
  'modern-indigo',
  'cobalt-bold',
  'editorial-warm',
  'signal-orange'
]);

export function expectedDesignTemplate(artifact: ArtifactDocument, brief: string): string {
  if (artifact.kind === 'deck') return inferInvestorDeckTemplate(brief).name;
  if (artifact.kind === 'resume') return 'classic-ats';
  return inferDocumentTemplate(brief, artifact.kind).name;
}

export function enforceDesignPreset(artifact: ArtifactDocument, brief: string): ArtifactDocument {
  if (/\b(?:match(?:ing|ed)?|mirror(?:ing|ed)?|uploaded|reference style)\b/i.test(brief)) {
    return artifact;
  }
  const expected = expectedDesignTemplate(artifact, brief);
  const design = artifact.design ?? {};
  const known = artifact.kind === 'deck' ? knownDeckTemplates : knownDocumentTemplates;
  const template = (design.template && known.has(design.template) ? design.template : expected) as ArtifactDesign['template'];
  return {
    ...artifact,
    design: {
      ...design,
      template
    }
  };
}

export function designPresetIssue(artifact: ArtifactDocument, brief: string): string | undefined {
  if (/\b(?:match(?:ing|ed)?|mirror(?:ing|ed)?|uploaded|reference style)\b/i.test(brief)) return undefined;
  const expected = expectedDesignTemplate(artifact, brief);
  const actual = artifact.design?.template;
  if (!actual) return `The artifact is missing design.template; expected "${expected}" for this audience.`;
  const known = artifact.kind === 'deck' ? knownDeckTemplates : knownDocumentTemplates;
  if (!known.has(actual)) {
    return `The artifact uses an unknown design.template "${actual}"; expected a curated preset such as "${expected}".`;
  }
  const audience = detectArtifactAudience(brief, artifact.kind);
  if (artifact.kind === 'deck' && audience.deckTemplate && actual !== audience.deckTemplate && actual !== expected) {
    return `The deck design.template "${actual}" does not match the audience baseline "${audience.deckTemplate}".`;
  }
  return undefined;
}