import { stripSkillTags } from '../src/lib/skills.js';
import type { ArtifactKind } from '../src/lib/shared.js';

export type ArtifactAudience =
  | 'student'
  | 'academic'
  | 'startup'
  | 'corporate'
  | 'investor'
  | 'general';

export type AudienceProfile = {
  audience: ArtifactAudience;
  label: string;
  deckTemplate: string;
  documentTemplate: string;
  tone: string;
  density: 'compact' | 'balanced' | 'airy';
  citationStrictness: 'relaxed' | 'standard' | 'strict';
};

const profiles: Record<ArtifactAudience, AudienceProfile> = {
  student: {
    audience: 'student',
    label: 'Student presentation',
    deckTemplate: 'bold-pop',
    documentTemplate: 'editorial-ivory',
    tone: 'clear and approachable',
    density: 'balanced',
    citationStrictness: 'relaxed'
  },
  academic: {
    audience: 'academic',
    label: 'Academic submission',
    deckTemplate: 'editorial-ivory',
    documentTemplate: 'editorial-ivory',
    tone: 'formal and evidence-led',
    density: 'balanced',
    citationStrictness: 'strict'
  },
  startup: {
    audience: 'startup',
    label: 'Startup pitch',
    deckTemplate: 'modern-indigo',
    documentTemplate: 'executive-slate',
    tone: 'confident and concise',
    density: 'balanced',
    citationStrictness: 'standard'
  },
  corporate: {
    audience: 'corporate',
    label: 'Corporate professional',
    deckTemplate: 'consulting-mono',
    documentTemplate: 'executive-slate',
    tone: 'professional and decision-ready',
    density: 'balanced',
    citationStrictness: 'standard'
  },
  investor: {
    audience: 'investor',
    label: 'Investor / board briefing',
    deckTemplate: 'executive-slate',
    documentTemplate: 'executive-slate',
    tone: 'executive and evidence-backed',
    density: 'airy',
    citationStrictness: 'strict'
  },
  general: {
    audience: 'general',
    label: 'General professional',
    deckTemplate: 'consulting-mono',
    documentTemplate: 'editorial-ivory',
    tone: 'professional',
    density: 'balanced',
    citationStrictness: 'standard'
  }
};

export function detectArtifactAudience(brief: string, kind?: ArtifactKind): AudienceProfile {
  const clean = stripSkillTags(brief).toLowerCase();

  if (kind === 'resume' || /\b(?:@resume|@cv|ats[- ]friendly|curriculum vitae)\b/.test(clean)) {
    return applyAudienceVoiceOverride(brief, { ...profiles.corporate, label: 'Resume / CV', documentTemplate: 'classic-ats' });
  }
  if (
    kind === 'assignment' ||
    /\b(?:@assignment|@project|@synopsis|assignment|homework|viva|synopsis|college project|major project|minor project|capstone|final year|fyp|dissertation|thesis defense|internship report|professor|submission|apa|mla|ieee citation)\b/.test(clean)
  ) {
    return applyAudienceVoiceOverride(brief, profiles.academic);
  }
  if (/\b(?:student|school|class presentation|science fair|high school|undergrad|semester|freshman|sophomore|junior year|senior year)\b/.test(clean)) {
    return applyAudienceVoiceOverride(brief, profiles.student);
  }
  if (/\b(?:college|university|campus|lecture|coursework|course project|mba class|b\.?tech|b\.?com|b\.?sc|m\.?tech)\b/.test(clean) && !/\b(?:investor|boardroom|board|series [a-d]|fundraising)\b/.test(clean)) {
    return applyAudienceVoiceOverride(brief, /\b(?:assignment|synopsis|viva|dissertation|thesis|literature review|research paper|project report)\b/.test(clean)
      ? profiles.academic
      : { ...profiles.student, label: 'College presentation' });
  }
  if (/\b(?:startup|founder|seed|pre[- ]seed|yc demo|product launch|solo founder|first-time founder)\b/.test(clean) && !/\b(?:investor|boardroom|board|series [a-d]|fundraising|a16z|term sheet)\b/.test(clean)) {
    return applyAudienceVoiceOverride(brief, profiles.startup);
  }
  if (/\b(?:investor|boardroom|board|series [a-d]|fundraising|a16z|mckinsey|bloomberg|term sheet|pitch deck)\b/.test(clean)) {
    return applyAudienceVoiceOverride(brief, profiles.investor);
  }
  if (/\b(?:@proposal|client proposal|stakeholder|executive|leadership|operations review|quarterly|enterprise|company|corporate|internal memo|workplace|deliverable|sow|statement of work)\b/.test(clean)) {
    return applyAudienceVoiceOverride(brief, profiles.corporate);
  }
  if (kind === 'email') return applyAudienceVoiceOverride(brief, profiles.corporate);
  if (kind === 'report' && /\b(?:project report|literature review|research paper|white paper)\b/.test(clean)) {
    return applyAudienceVoiceOverride(brief, profiles.academic);
  }
  return applyAudienceVoiceOverride(brief, profiles.general);
}

const voiceOverridePatterns: Array<{ pattern: RegExp; audience: ArtifactAudience; label?: string }> = [
  { pattern: /\b(?:write like a|tone:?\s*|voice:?\s*|sound like a?)\s*(?:high school\s+)?student\b/i, audience: 'student' },
  { pattern: /\b(?:write like a|tone:?\s*|voice:?\s*|sound like a?)\s*(?:college|university|campus)\s*(?:student)?\b/i, audience: 'student', label: 'College presentation' },
  { pattern: /\b(?:write like a|tone:?\s*|voice:?\s*|sound like a?)\s*(?:founder|startup)\b/i, audience: 'startup' },
  { pattern: /\b(?:write like a|tone:?\s*|voice:?\s*|sound like a?)\s*(?:corporate|professional|executive|board)\b/i, audience: 'corporate' },
  { pattern: /\b(?:write like a|tone:?\s*|voice:?\s*|sound like a?)\s*(?:investor|vc|boardroom)\b/i, audience: 'investor' },
  { pattern: /\b(?:write like a|tone:?\s*|voice:?\s*|sound like a?)\s*(?:academic|professor|researcher|thesis)\b/i, audience: 'academic' }
];

export function applyAudienceVoiceOverride(brief: string, profile: AudienceProfile): AudienceProfile {
  for (const candidate of voiceOverridePatterns) {
    if (!candidate.pattern.test(brief)) continue;
    const base = profiles[candidate.audience];
    return {
      ...base,
      label: candidate.label ?? base.label
    };
  }
  return profile;
}

export function audienceCitationsRequired(
  profile: AudienceProfile,
  needsResearch: boolean,
  hasResearchSources: boolean
): boolean {
  if (!needsResearch || !hasResearchSources) return false;
  return profile.citationStrictness !== 'relaxed';
}

export function audienceCraftLines(profile: AudienceProfile, kind: ArtifactKind): string[] {
  const shared = [
    `Audience mode: ${profile.label}.`,
    `Default tone: ${profile.tone}.`,
    `Preferred density: ${profile.density}.`,
    `Citation strictness: ${profile.citationStrictness}.`
  ];

  if (kind === 'deck') {
    return [
      ...shared,
      `Deck template baseline: ${profile.deckTemplate}.`,
      profile.audience === 'student'
        ? 'Student decks: teach one concept per slide, plain language, one visual per slide, no jargon walls.'
        : '',
      profile.audience === 'academic'
        ? 'Academic decks: include methodology, limitations, and honest citations; no fabricated sources.'
        : '',
      profile.audience === 'investor'
        ? 'Investor decks: BLUF opener, sourced metrics, risk section, and appendix with sources.'
        : '',
      profile.audience === 'corporate'
        ? 'Corporate decks: decision-ready titles, owner/timeline on close slide, no hype adjectives.'
        : '',
      profile.audience === 'startup'
        ? 'Startup decks: problem → wedge → traction → plan → ask; only supplied or researched numbers.'
        : '',
      profile.audience === 'general'
        ? 'Professional decks: one argument per slide, plain titles, and evidence before opinion.'
        : ''
    ].filter(Boolean);
  }

  if (kind === 'assignment') {
    return [
      ...shared,
      'Academic documents: section flow abstract → introduction → method → findings → conclusion → references.',
      'Never invent professor names, marks, readings, or required texts.'
    ];
  }

  if (kind === 'resume') {
    return [
      ...shared,
      'Resume mode: ATS-friendly headings, truthful bullets, no invented employers or metrics.',
      `Document template baseline: ${profile.documentTemplate}.`
    ];
  }

  if (kind === 'sheet') {
    return [
      ...shared,
      'Workbook mode: labeled input/calc/output sheets, explicit assumptions, readable number formats.'
    ];
  }

  return [
    ...shared,
    `Document template baseline: ${profile.documentTemplate}.`,
    profile.audience === 'student'
      ? 'Student reports: explain concepts clearly, define terms, use examples before analysis.'
      : '',
    profile.audience === 'academic'
      ? 'Academic reports: cite every non-trivial claim, separate facts from interpretation.'
      : '',
    profile.audience === 'corporate'
      ? 'Corporate reports: BLUF summary, scoped recommendations, named owners and timelines.'
      : ''
  ].filter(Boolean);
}

export function audiencePreflightLine(profile: AudienceProfile, primaryFormat: string): string {
  return `Tailoring this for ${profile.label.toLowerCase()} quality — ${primaryFormat.toUpperCase()} export with ${profile.tone} tone.`;
}

export function preferredDeckTemplate(brief: string, kind?: ArtifactKind): string {
  return detectArtifactAudience(brief, kind).deckTemplate;
}

export function preferredDocumentTemplate(brief: string, kind?: ArtifactKind): string {
  return detectArtifactAudience(brief, kind).documentTemplate;
}