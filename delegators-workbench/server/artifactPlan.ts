import type { ArtifactKind, WorkbenchProgressItem } from '../src/lib/shared.js';
import { stripSkillTags } from '../src/lib/skills.js';

export type ArtifactPlan = {
  title: string;
  items: WorkbenchProgressItem[];
};

const kindNames: Record<ArtifactKind, string> = {
  resume: 'resume',
  deck: 'presentation',
  report: 'report',
  assignment: 'assignment',
  email: 'message',
  sheet: 'workbook'
};

export function buildArtifactPlan(
  kind: ArtifactKind,
  brief: string,
  needsResearch: boolean,
  options: { structured?: boolean } = {}
): ArtifactPlan {
  const intent = summarizeIntent(kind, brief);
  const structured = options.structured ?? false;
  const items: WorkbenchProgressItem[] = [
    {
      id: 'shape',
      label: 'Read brief · lock intent',
      detail: intent,
      status: 'active'
    },
    ...(needsResearch ? [{
      id: 'sources',
      label: 'Research · ground sources',
      detail: 'Parallel source capture with traceable citations.',
      status: 'pending' as const
    }] : []),
    ...(structured ? [{
      id: 'outline',
      label: 'Outline · narrative arc',
      detail: 'Lock slide/section roles and evidence map before writing.',
      status: 'pending' as const
    }] : []),
    {
      id: 'build',
      label: structured ? 'Compose · production artifact' : 'Compose · artifact body',
      detail: 'Write final JSON from the settled brief and outline.',
      status: 'pending'
    },
    {
      id: 'finish',
      label: `Inspect & export · ${kindNames[kind]}`,
      detail: 'Quality gate, format lock, native downloadable file.',
      status: 'pending'
    }
  ];
  return { title: 'Working through the artifact brief', items };
}

export function buildRefinementPlan(kind: ArtifactKind, instruction: string): ArtifactPlan {
  const topic = planTopic(instruction);
  return {
    title: `Revising ${topic}`,
    items: [
      { id: 'revise', label: 'Interpret the revision request', detail: `Change requested: ${topic}`, status: 'active' },
      {
        id: 'finish',
        label: `Package and inspect the updated ${kindNames[kind]}`,
        detail: 'Check the revision and generate the new downloadable version.',
        status: 'pending'
      }
    ]
  };
}

export function advanceArtifactPlan(plan: ArtifactPlan, activeIndex: number): ArtifactPlan {
  return {
    ...plan,
    items: plan.items.map((item, index) => ({
      ...item,
      status: index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending'
    }))
  };
}

export function completeArtifactPlan(plan: ArtifactPlan): ArtifactPlan {
  return {
    ...plan,
    items: plan.items.map((item) => ({ ...item, status: 'done' }))
  };
}

export function requiresToolHarness(kind: ArtifactKind, brief: string): boolean {
  if (kind !== 'email') return true;
  return /\b(calculate|calculation|formula|forecast|projection|dataset|csv|spreadsheet|chart data|parse|transform|convert|statistical|financial model)\b/i.test(
    stripSkillTags(brief)
  );
}

function planTopic(brief: string): string {
  const explicitTopic = normalizedBrief(brief).match(/\btopic\s+(?:is|:|=)\s+(.+)$/i)?.[1];
  const clean = (explicitTopic ?? normalizedBrief(brief))
    .replace(/^(please\s+)?(can you\s+|could you\s+|i want you to\s+)?/i, '')
    .replace(/^(create|make|build|write|prepare|generate|design)\s+(me\s+)?(a|an|the)?\s*/i, '')
    .replace(/^(beautiful|professional|detailed|concise|aesthetic|typographed)\s+/i, '')
    .replace(/^(ppt|powerpoint|presentation|pdf|report|document|docx|spreadsheet|xlsx)\s+(about|on|for|regarding)?\s*/i, '')
    .replace(/^regarding\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?]+$/, '');
  const topic = clean || 'your artifact';
  return topic.length > 76 ? `${topic.slice(0, 73).trimEnd()}...` : topic;
}

function summarizeIntent(kind: ArtifactKind, brief: string): string {
  const topic = planTopic(brief);
  const clean = normalizedBrief(brief);
  const signals = [
    `Format: ${kindNames[kind]}`,
    topic === 'your artifact' ? '' : `Topic: ${topic}`,
    designSignal(clean),
    hasAudience(clean) ? '' : 'Missing: target audience',
    hasScope(clean) ? '' : 'Missing: depth or length'
  ].filter(Boolean);
  return signals.join(' · ');
}

function normalizedBrief(brief: string): string {
  return stripSkillTags(brief).replace(/\s+/g, ' ').trim();
}

function hasAudience(brief: string): boolean {
  return /\b(audience|for\s+(beginners|students|teachers|executives|leadership|clients|customers|engineers|developers|professionals|team|class|school|college)|non-technical|technical|beginner|advanced|intermediate)\b/i.test(brief);
}

function hasScope(brief: string): boolean {
  return /\b(\d+\s*(slides?|pages?|words?|sections?)|one[-\s]?page|short|brief|concise|detailed|deep|comprehensive|workshop|a4|letter|executive summary)\b/i.test(brief);
}

function designSignal(brief: string): string {
  if (/\b(no generic|not generic|no neon|cheap)\b/i.test(brief)) return 'Design: refined, non-generic direction requested';
  if (/\b(editorial|minimal|premium|consulting|academic|monochrome|calm)\b/i.test(brief)) return 'Design: user-specified visual direction';
  return '';
}
