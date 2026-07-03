import type { ArtifactDocument, ArtifactSection, Slide } from '../src/lib/shared.js';
import type { AudienceProfile } from './artifactAudience.js';

const hypePattern = /\b(?:most consequential|unprecedented|new chapter|strategic analysis|single most|game[- ]changing|paradigm shift|revolutionary|transformative era|landmark moment|defining moment|once[- ]in[- ]a[- ]generation|historic inflection|seismic shift|unmatched|unparalleled|groundbreaking|world[- ]class intelligence|intelligence briefing)\b/gi;

const fakeAuthorityPattern = /\b(?:analysts?,?\s+researchers?,?\s+and\s+technology\s+strategists?|industry experts agree|leading analysts|technology strategists believe|observers note|according to experts(?!\s+S\d)|widely regarded as)\b/gi;

const hypeReplacements: Array<[RegExp, string]> = [
  [/\bmost consequential\b/gi, 'significant'],
  [/\bunprecedented\b/gi, 'notable'],
  [/\bnew chapter\b/gi, 'recent development'],
  [/\bstrategic analysis\b/gi, 'review'],
  [/\bsingle most\b/gi, 'primary'],
  [/\bgame[- ]changing\b/gi, 'material'],
  [/\bparadigm shift\b/gi, 'shift'],
  [/\brevolutionary\b/gi, 'major'],
  [/\btransformative era\b/gi, 'changing landscape'],
  [/\blandmark moment\b/gi, 'notable event'],
  [/\bdefining moment\b/gi, 'important event'],
  [/\bgroundbreaking\b/gi, 'notable'],
  [/\bworld[- ]class intelligence\b/gi, 'research summary'],
  [/\bintelligence briefing\b/gi, 'briefing']
];

export type CredibilityRepairOptions = {
  brief?: string;
  audienceProfile?: AudienceProfile;
  hasResearchSources?: boolean;
  asOfDate?: string;
};

export function repairArtifactCredibility(
  artifact: ArtifactDocument,
  options: CredibilityRepairOptions = {}
): ArtifactDocument {
  const asOf = options.asOfDate ?? currentAsOfLabel();
  const audienceLabel = options.audienceProfile?.label ?? 'General professional';
  const repaired: ArtifactDocument = {
    ...artifact,
    title: sanitizeText(artifact.title),
    audience: sanitizeAudienceField(artifact.audience, audienceLabel),
    tone: sanitizeText(artifact.tone),
    executiveSummary: sanitizeText(artifact.executiveSummary),
    sections: artifact.sections.map((section) => sanitizeSection(section)),
    slides: artifact.slides?.map((slide) => sanitizeSlide(slide))
  };

  if (repaired.kind === 'deck' && repaired.slides?.length) {
    repaired.slides = [
      enrichCoverSlide(repaired.slides[0], repaired, options.brief ?? '', asOf, audienceLabel),
      ...repaired.slides.slice(1)
    ];
  }

  if (repaired.kind === 'report' || repaired.kind === 'assignment') {
    repaired.executiveSummary = ensureExecutiveSummary(repaired, asOf, audienceLabel);
    repaired.sections = ensureDocumentOpener(repaired.sections, repaired, asOf);
  }

  if (options.hasResearchSources || (repaired.citations?.length ?? 0) > 0) {
    repaired.sections = ensureSourceAppendix(repaired.sections, repaired.citations ?? []);
  }

  return repaired;
}

export function sanitizeText(value: string): string {
  let text = value.trim();
  if (!text) return text;
  text = text.replace(fakeAuthorityPattern, 'Source review required');
  for (const [pattern, replacement] of hypeReplacements) {
    text = text.replace(pattern, replacement);
  }
  text = text.replace(hypePattern, '');
  return text.replace(/\s{2,}/g, ' ').replace(/ ,/g, ',').trim();
}

function sanitizeAudienceField(value: string, fallback: string): string {
  const raw = value.trim();
  if (!raw || fakeAuthorityPattern.test(raw) || /\b(?:analysts?|researchers?|strategists?)\b/i.test(raw)) {
    return fallback;
  }
  return sanitizeText(raw);
}

function sanitizeSection(section: ArtifactSection): ArtifactSection {
  return {
    ...section,
    heading: sanitizeText(section.heading),
    body: sanitizeText(section.body),
    bullets: section.bullets.map((bullet) => sanitizeText(bullet)).filter(Boolean)
  };
}

function sanitizeSlide(slide: Slide): Slide {
  return {
    ...slide,
    title: sanitizeText(slide.title),
    subtitle: slide.subtitle ? sanitizeText(slide.subtitle) : slide.subtitle,
    eyebrow: slide.eyebrow ? sanitizeText(slide.eyebrow) : slide.eyebrow,
    takeaway: slide.takeaway ? sanitizeText(slide.takeaway) : slide.takeaway,
    bullets: slide.bullets.map((bullet) => sanitizeText(bullet)).filter(Boolean),
    speakerNotes: slide.speakerNotes ? sanitizeText(slide.speakerNotes) : slide.speakerNotes
  };
}

export function enrichCoverSlide(
  slide: Slide,
  artifact: ArtifactDocument,
  brief: string,
  asOf: string,
  audienceLabel: string
): Slide {
  const topic = artifact.title.trim() || briefTopic(brief) || 'Topic brief';
  const bluf = artifact.executiveSummary.trim() ||
    artifact.sections.find((section) => section.body.trim())?.body.slice(0, 220) ||
    'Scope and key questions for this deliverable.';

  const text = [slide.title, slide.subtitle, ...slide.bullets].filter(Boolean).join(' ');
  const isSparse = text.length < 120 || (slide.bullets.length <= 1 && !slide.subtitle);

  const scopeLine = briefScopeLine(brief) || `Scope: ${topic}`;
  const preparedLine = 'Prepared by Delegators Workbench';
  const audienceLine = `Audience: ${audienceLabel}`;

  const bullets = slide.bullets.length >= 2
    ? slide.bullets
    : [
      scopeLine,
      `As of ${asOf}`,
      preparedLine
    ].filter((line, index, values) => values.indexOf(line) === index);

  return {
    ...slide,
    role: slide.role ?? 'opener',
    layout: 'cover',
    theme: slide.theme ?? 'dark',
    eyebrow: slide.eyebrow ?? eyebrowForAudience(audienceLabel),
    title: slide.title.trim() || topic,
    subtitle: slide.subtitle ?? (isSparse ? bluf.slice(0, 180) : slide.subtitle),
    takeaway: slide.takeaway ?? (bluf.length <= 220 ? bluf : `${bluf.slice(0, 217)}...`),
    bullets: bullets.slice(0, 4),
    speakerNotes: slide.speakerNotes ?? [audienceLine, preparedLine, bluf].join('\n')
  };
}

function ensureExecutiveSummary(artifact: ArtifactDocument, asOf: string, audienceLabel: string): string {
  const summary = sanitizeText(artifact.executiveSummary);
  if (summary.length >= 80) return summary;
  const opener = artifact.sections.find((section) => section.body.trim())?.body ?? '';
  const base = sanitizeText(opener) || `This ${artifact.kind} covers ${artifact.title}.`;
  return `${base} Scope as of ${asOf}. Audience: ${audienceLabel}. Prepared by Delegators Workbench.`;
}

function ensureDocumentOpener(
  sections: ArtifactSection[],
  artifact: ArtifactDocument,
  asOf: string
): ArtifactSection[] {
  if (sections.length === 0) return sections;
  const opener = sections[0];
  const body = opener.body.trim();
  const bullets = opener.bullets;
  if (body.length >= 120 && bullets.length >= 2) return sections;

  const bluf = artifact.executiveSummary.trim() || body || `Overview of ${artifact.title}.`;
  const enriched: ArtifactSection = {
    ...opener,
    body: body || bluf,
    bullets: bullets.length >= 2 ? bullets : [
      `As of ${asOf}`,
      'Prepared by Delegators Workbench',
      bluf.length <= 180 ? bluf : `${bluf.slice(0, 177)}...`
    ].slice(0, 4)
  };
  return [enriched, ...sections.slice(1)];
}

function ensureSourceAppendix(
  sections: ArtifactSection[],
  citations: ArtifactDocument['citations']
): ArtifactSection[] {
  const hasSourcesSection = sections.some((section) =>
    /^(?:sources?|references?|appendix|bibliography|methodology|limitations)\b/i.test(section.heading)
  );
  if (hasSourcesSection || citations.length === 0) return sections;

  const sourceBullets = citations
    .map((citation) => {
      const id = citation.id ? `${citation.id}: ` : '';
      const url = citation.url ? ` (${citation.url})` : '';
      return `${id}${citation.label}${url}`.trim();
    })
    .filter(Boolean);

  return [
    ...sections,
    {
      heading: 'Sources',
      body: 'External references used in this deliverable. Claims without a listed source should be treated as [UNVERIFIED].',
      bullets: sourceBullets.length ? sourceBullets : ['No external sources were attached — verify claims before circulation.']
    },
    {
      heading: 'Methodology & limitations',
      body: 'This deliverable synthesizes user-provided context and captured research. Confidence varies by claim.',
      bullets: [
        'Confirmed — directly supported by a listed source.',
        'Reported — cited secondhand or pending verification.',
        'Likely — reasonable inference, not independently verified.',
        'Unclear / [UNVERIFIED] — needs a source before external use.'
      ]
    }
  ];
}

function eyebrowForAudience(audienceLabel: string): string {
  if (/student/i.test(audienceLabel)) return 'Class deliverable';
  if (/academic/i.test(audienceLabel)) return 'Research brief';
  if (/startup|founder/i.test(audienceLabel)) return 'Founder brief';
  if (/corporate|professional/i.test(audienceLabel)) return 'Working brief';
  if (/investor|board/i.test(audienceLabel)) return 'Decision brief';
  return 'Scope brief';
}

function briefTopic(brief: string): string {
  return brief
    .replace(/^(?:please\s+)?(?:create|make|build|write|prepare|produce|design|generate)\s+(?:a|an)?\s*/i, '')
    .replace(/\b(?:@pdf|@ppt|@pptx|@docx|@word|@xlsx|@assignment|@resume|@email)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

function briefScopeLine(brief: string): string | undefined {
  const match = brief.match(/\b(?:on|about|for|covering|focused on|regarding)\s+(.{8,120})/i);
  return match ? `Scope: ${match[1].replace(/\s+/g, ' ').trim()}` : undefined;
}

function currentAsOfLabel(): string {
  return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}