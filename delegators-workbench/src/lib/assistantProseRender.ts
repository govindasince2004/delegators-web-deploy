import { parseAssistantLabeledLine } from './artifactContinuation.js';

const INLINE_HIGHLIGHT_RE =
  /(?:https?:\/\/[^\s<>,;)\]]+|www\.[^\s<>,;)\]]+)|"[^"\n]{1,140}"|'[^'\n]{1,140}'/gi;

export type AssistantInlineSegment =
  | { kind: 'text'; value: string }
  | { kind: 'link'; value: string; href: string }
  | { kind: 'emphasis'; value: string };

function normalizeLinkHref(value: string): string {
  return value.startsWith('www.') ? `https://${value}` : value;
}

function stripQuoteMarks(value: string): string {
  return value.slice(1, -1);
}

export function splitAssistantInlineSegments(text: string): AssistantInlineSegment[] {
  if (!text) return [];

  const segments: AssistantInlineSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(INLINE_HIGHLIGHT_RE)) {
    const value = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      segments.push({ kind: 'text', value: text.slice(lastIndex, index) });
    }

    if (/^["']/.test(value)) {
      segments.push({ kind: 'emphasis', value: stripQuoteMarks(value) });
    } else {
      segments.push({ kind: 'link', value, href: normalizeLinkHref(value) });
    }

    lastIndex = index + value.length;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: 'text', value: text.slice(lastIndex) });
  }

  return segments.length ? segments : [{ kind: 'text', value: text }];
}

export function renderAssistantLineParts(line: string): {
  labeled: { label: string; detail: string } | null;
  segments: AssistantInlineSegment[];
} {
  const labeled = parseAssistantLabeledLine(line);
  if (labeled) {
    return {
      labeled,
      segments: splitAssistantInlineSegments(labeled.detail)
    };
  }

  return {
    labeled: null,
    segments: splitAssistantInlineSegments(line)
  };
}