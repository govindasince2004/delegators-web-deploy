import type { ArtifactDocument, ArtifactKind } from '../src/lib/shared.js';
import type { AudienceProfile } from './artifactAudience.js';

const hypePattern = /\b(?:most consequential|unprecedented|new chapter|strategic analysis|single most|game[- ]changing|paradigm shift|revolutionary|transformative era|landmark moment|defining moment|once[- ]in[- ]a[- ]generation|historic inflection|seismic shift|unmatched|unparalleled|groundbreaking|world[- ]class intelligence|intelligence briefing)\b/i;

const fakeAuthorityPattern = /\b(?:analysts?,?\s+researchers?,?\s+and\s+technology\s+strategists?|industry experts agree|leading analysts|technology strategists believe|observers note|sources say(?!\s+S\d)|according to experts(?!\s+S\d)|widely regarded as)\b/i;

const confidenceLabelPattern = /\b(?:high confidence|medium confidence|low confidence|unverified|confirmed|reported|likely|unclear|as of \d{4}|as of [A-Z][a-z]+ \d{4})\b/i;

export function credibilityPromptLines(profile: AudienceProfile, kind: ArtifactKind, options: {
  needsResearch: boolean;
  hasSources: boolean;
}): string[] {
  const lines = [
    'CREDIBILITY SYSTEM (mandatory — no theatrical analyst voice):',
    'Banned hype phrases unless directly quoted from a named source: consequential, unprecedented, new chapter, strategic analysis, paradigm shift, game-changing, landmark, defining moment.',
    'Write plain professional prose — student-clear, founder-direct, or board-sober depending on audience. Never simulate a premium intelligence briefing tone without sources.',
    'Every non-trivial external claim needs sourceIds OR an inline [UNVERIFIED] / [LOW CONFIDENCE] label.',
    'Include citations[] entries, a Sources appendix section, Methodology note, Limitations note, and an as-of date when research was used.',
    'Author line must be honest: "Prepared by Delegators Workbench" or the user-supplied author — never "Analysts, researchers, and technology strategists".',
    'Openers and cover slides must be designed — title, subtitle, as-of date, scope line, and either a sourced BLUF or an honest scope statement. No empty template cover with one hype paragraph.'
  ];

  if (profile.audience === 'student') {
    lines.push('Student mode: teach clearly, define terms, cite simply, no faux-Wall Street voice.');
  }
  if (profile.audience === 'startup') {
    lines.push('Founder mode: problem → wedge → proof → plan. Plain language, no investor-theatre adjectives without data.');
  }
  if (profile.audience === 'corporate') {
    lines.push('Corporate mode: BLUF, owners, timelines, sourced metrics — memo tone, not marketing manifesto.');
  }
  if (profile.audience === 'investor') {
    lines.push('Investor mode: sourced metrics and explicit risks — never fake precision or anonymous authority.');
  }
  if (profile.audience === 'academic') {
    lines.push('Academic mode: method, limitations, numbered references — no anonymous expert voice.');
  }

  if (options.needsResearch && options.hasSources) {
    lines.push('Research was captured — footnote major claims with sourceIds and include a source appendix. Missing citation apparatus is a publication failure.');
  }

  if (/college presentation/i.test(profile.label)) {
    lines.push('College mode: clear teaching flow, honest scope, no fake analyst voice — cite when research is used.');
  }

  if (kind === 'deck') {
    lines.push('Deck cover slide: bold but complete — title, scoped subtitle, as-of or scope line, and optional sourced kicker; not a half-empty template panel.');
  }

  return lines;
}

export function inspectCredibilityTone(artifact: ArtifactDocument, issues: string[]): void {
  const units = artifactTextUnits(artifact);
  const hypeHits = units.filter((unit) => hypePattern.test(unit));
  if (hypeHits.length >= 2) {
    issues.push('The language uses institutional hype phrasing (for example “most consequential”, “unprecedented”, “new chapter”) without visible sourcing — rewrite in plain, evidence-backed prose.');
  }
  if (units.some((unit) => fakeAuthorityPattern.test(unit))) {
    issues.push('The artifact uses generic anonymous authority voice (for example “analysts, researchers, and technology strategists”) — name real sources, use sourceIds, or remove the faux-byline.');
  }
}

export function inspectCredibilityApparatus(
  artifact: ArtifactDocument,
  options: { needsResearch: boolean; hasSources: boolean; citationsRequired: boolean },
  issues: string[]
): void {
  if (!options.needsResearch && !options.citationsRequired) return;

  const text = artifactTextUnits(artifact).join('\n');
  const hasCitations = (artifact.citations?.length ?? 0) > 0;
  const hasSourcesSection = artifact.sections.some((section) =>
    /^(?:sources?|references?|appendix|bibliography|methodology|limitations)\b/i.test(section.heading)
  );
  const hasConfidence = confidenceLabelPattern.test(text) ||
    artifact.sections.some((section) => section.bullets.some((bullet) => confidenceLabelPattern.test(bullet)));

  if (options.hasSources && !hasCitations) {
    issues.push('The artifact lacks a citations[] apparatus even though research sources were available — add source-linked citations and a sources appendix.');
  }
  if (options.hasSources && !hasSourcesSection) {
    issues.push('The artifact is missing a Sources / Methodology / Limitations appendix for a researched deliverable.');
  }
  if (options.hasSources && !hasConfidence) {
    issues.push('Researched artifacts must label claim confidence (confirmed, reported, likely, unclear, or UNVERIFIED) — not one flat authoritative voice.');
  }
}

export function inspectCoverAndOpenerDesign(artifact: ArtifactDocument, issues: string[]): void {
  if (artifact.kind === 'deck') {
    const opener = artifact.slides?.[0];
    if (!opener) return;
    const text = [opener.title, opener.subtitle, ...opener.bullets, opener.speakerNotes].filter(Boolean).join(' ');
    const hasStructure = Boolean(opener.subtitle || opener.eyebrow || opener.takeaway || (opener.bullets.length >= 2));
    const isSparse = text.length < 80 || (opener.bullets.length <= 1 && !opener.subtitle);
    if (isSparse && !hasStructure) {
      issues.push('The opening slide looks like an underdesigned template cover — add a scoped subtitle, as-of/scope line, and a sourced BLUF instead of one hype paragraph in empty space.');
    }
    if (hypePattern.test(text) && text.length < 220) {
      issues.push('The cover slide relies on hype language without evidence blocks — replace theatrical phrasing with a sourced scope statement.');
    }
    return;
  }

  if (artifact.kind === 'report' || artifact.kind === 'assignment') {
    const opener = artifact.sections[0];
    const summary = artifact.executiveSummary.trim();
    if (summary.length > 0 && hypePattern.test(summary) && summary.length < 260) {
      issues.push('The executive summary sounds like marketing copy, not a sourced briefing — open with BLUF and calibrated language.');
    }
    if (opener && opener.body.trim().length < 120 && opener.bullets.length <= 1 && !summary) {
      issues.push('The opening section is too empty for a professional document — add a complete BLUF, scope, and as-of line.');
    }
  }
}

function artifactTextUnits(artifact: ArtifactDocument): string[] {
  const units: string[] = [
    artifact.title,
    artifact.audience,
    artifact.tone,
    artifact.executiveSummary,
    ...artifact.sections.flatMap((section) => [section.heading, section.body, ...section.bullets]),
    ...(artifact.slides ?? []).flatMap((slide) => [slide.title, slide.subtitle ?? '', ...slide.bullets, slide.speakerNotes ?? ''])
  ];
  return units.filter((unit) => unit.trim().length > 0);
}

export function countHypeSignals(artifact: ArtifactDocument): number {
  return artifactTextUnits(artifact).filter((unit) => hypePattern.test(unit)).length;
}