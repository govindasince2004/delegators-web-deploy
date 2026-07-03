import type {
  ArtifactDocument,
  WorkbenchConversationTurn
} from './shared.js';

type ConversationMessage = {
  role: 'user' | 'assistant';
  text: string;
};

const maxThreadArtifacts = 12;
export const maxPersistedMessages = 120;

export function trimPersistedMessages<T extends { messages: unknown[] }>(thread: T): T {
  if (thread.messages.length <= maxPersistedMessages) return thread;
  return { ...thread, messages: thread.messages.slice(-maxPersistedMessages) };
}

export function recentConversation(
  messages: ConversationMessage[],
  limit = 20
): WorkbenchConversationTurn[] {
  return messages
    .filter((message) => message.text.trim())
    .slice(-limit)
    .map((message) => ({
      role: message.role,
      text: message.text.trim().slice(0, 8000)
    }));
}

export function recentArtifacts(
  artifacts: ArtifactDocument[],
  limit = 6
): ArtifactDocument[] {
  return artifacts.slice(-limit);
}

export function appendArtifactHistory(
  artifacts: ArtifactDocument[],
  artifact: ArtifactDocument
): ArtifactDocument[] {
  const current = artifacts.at(-1);
  if (current && JSON.stringify(current) === JSON.stringify(artifact)) return artifacts;
  return [...artifacts, artifact].slice(-maxThreadArtifacts);
}

export function artifactFormatLabel(artifact: ArtifactDocument): string {
  return (
    artifact.primaryFormat ??
    (artifact.kind === 'deck'
      ? 'pptx'
      : artifact.kind === 'sheet'
        ? 'xlsx'
        : artifact.kind === 'report'
          ? 'pdf'
          : 'docx')
  ).toUpperCase();
}

export function priorArtifactFactsForModel(artifact: ArtifactDocument, index: number): Record<string, unknown> {
  const slideTitles = (artifact.slides ?? []).slice(0, 10).map((slide) => slide.title).filter(Boolean);
  const sectionHeadings = artifact.sections.slice(0, 10).map((section) => section.heading).filter(Boolean);
  const factBullets = [
    ...artifact.sections.flatMap((section) => section.bullets).slice(0, 12),
    ...(artifact.slides ?? []).flatMap((slide) => slide.bullets).slice(0, 8)
  ].filter(Boolean);
  return {
    index: index + 1,
    title: artifact.title,
    kind: artifact.kind,
    format: artifactFormatLabel(artifact),
    audience: artifact.audience,
    executiveSummary: artifact.executiveSummary.slice(0, 600),
    sectionHeadings,
    slideTitles,
    keyFacts: factBullets.slice(0, 16),
    citations: (artifact.citations ?? []).slice(0, 12).map((citation) => ({
      id: citation.id,
      label: citation.label,
      url: citation.url
    })),
    usage: 'Thread memory only — extract verified facts; do not recreate this file layout or duplicate headings verbatim.'
  };
}

export function summarizePriorArtifact(artifact: ArtifactDocument, index: number): string {
  const slideTitles = (artifact.slides ?? []).slice(0, 8).map((slide) => slide.title).filter(Boolean);
  const sectionHeadings = artifact.sections.slice(0, 8).map((section) => section.heading).filter(Boolean);
  const keyFacts = [
    ...artifact.sections.flatMap((section) => [section.body, ...section.bullets]).filter(Boolean),
    ...(artifact.slides ?? []).flatMap((slide) => slide.bullets).filter(Boolean)
  ].map((fact) => fact.trim()).filter(Boolean).slice(0, 6);
  const citationCount = artifact.citations?.length ?? 0;
  return [
    `## Prior artifact ${index + 1}: ${artifact.title}`,
    `Format: ${artifactFormatLabel(artifact)} · Kind: ${artifact.kind}`,
    artifact.executiveSummary ? `Summary: ${artifact.executiveSummary.slice(0, 500)}` : '',
    sectionHeadings.length ? `Section headings: ${sectionHeadings.join(' | ')}` : '',
    slideTitles.length ? `Slide titles: ${slideTitles.join(' | ')}` : '',
    keyFacts.length ? `Key facts: ${keyFacts.join(' | ')}` : '',
    citationCount ? `Captured citations: ${citationCount}` : '',
    'Use verified facts from this artifact as thread memory only — do not recreate this file type or duplicate its structure unless the user is revising it.'
  ].filter(Boolean).join('\n');
}

export function renderThreadContext(
  conversation: WorkbenchConversationTurn[] = [],
  priorArtifacts: ArtifactDocument[] = [],
  routingLines: string[] = []
): string {
  const blocks: string[] = [];
  if (routingLines.length > 0) {
    blocks.push(['# Thread routing', ...routingLines].join('\n'));
  }
  if (conversation.length > 0) {
    blocks.push([
      '# Recent conversation',
      ...conversation.map((turn) => `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.text}`)
    ].join('\n\n'));
  }
  if (priorArtifacts.length > 0) {
    blocks.push([
      '# Prior artifacts in this thread (facts only — not a template to replay)',
      ...priorArtifacts.map((artifact, index) => summarizePriorArtifact(artifact, index))
    ].join('\n\n'));
  }
  return blocks.join('\n\n').trim();
}

export function renderThreadSummary(
  conversation: WorkbenchConversationTurn[] = [],
  priorArtifacts: ArtifactDocument[] = []
): string {
  const lines = [
    ...conversation.slice(-8).map((turn) =>
      `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.text}`
    ),
    ...priorArtifacts.map((artifact, index) =>
      `Prior artifact ${index + 1}: ${artifactFormatLabel(artifact)} · ${artifact.kind} · ${artifact.title}`
    )
  ];
  return lines.join('\n').trim();
}
