import type { WorkbenchRunStatus } from './shared.js';

export const artifactChatRecoveryNotice =
  'That response entered chat mode and no file was published. The Workbench will resume the saved artifact request when you send "continue".';

const continuationPatterns = [
  /^(?:please\s+)?(?:continue|resume|retry|restart|proceed|carry\s+on|keep\s+going)\b/i,
  /^(?:please\s+)?(?:finish|complete|rebuild|build|create|make|deliver)\s+(?:it|this|the\s+(?:file|artifact|deck|presentation|pptx?|report|document|sheet|resume))\b/i,
  /^(?:please\s+)?(?:try|do)\s+(?:it\s+)?again\b/i,
  /^(?:please\s+)?pick\s+(?:it\s+)?up\s+(?:where|from)\b/i
];

export function isArtifactContinuation(text: string): boolean {
  const normalized = text.trim().replace(/\s+/g, ' ');
  return normalized.length > 0 && continuationPatterns.some((pattern) => pattern.test(normalized));
}

export function canRestartSavedArtifact(
  hasPendingRequest: boolean,
  runStatus?: WorkbenchRunStatus,
  _runId?: string
): boolean {
  if (!hasPendingRequest) return false;
  return runStatus !== 'queued' &&
    runStatus !== 'running' &&
    runStatus !== 'waiting_input' &&
    runStatus !== 'cancelling';
}

const EMBEDDED_TOOL_MARKERS_RE = /<tool_call\b|<\/?function(?:=|\s+name=)|<parameter(?:=|\s+name=)/i;

export function looksLikeRawToolCallPayload(text: string): boolean {
  return EMBEDDED_TOOL_MARKERS_RE.test(text.trim());
}

export function stripRawToolCallPayload(text: string): string {
  const withoutBlocks = text
    .replace(/<tool_call\b[^>]*>[\s\S]*?<\/tool_call>/gi, '')
    .replace(/<function(?:=[^\s>/]+|\s+name=["'][^"']+["'])[^>]*>[\s\S]*?<\/function>/gi, '');
  return withoutBlocks.replace(/\n{3,}/g, '\n\n').trim();
}

export function looksLikeRawArtifactPayload(text: string): boolean {
  const value = text.trim();
  if (value.length < 120) return false;

  const hasArtifactKind = /"kind"\s*:\s*"(?:deck|report|sheet|resume|email|assignment|project)"/i.test(value);
  const hasFormat = /"primaryFormat"\s*:\s*"(?:pptx|pdf|docx|xlsx|html|zip)"/i.test(value);
  const hasArtifactBody = /"(?:slides|sections|sheet|resume|email)"\s*:/i.test(value);
  const isJsonPresentation = /```json\b/i.test(value) || /^\s*\{/.test(value);

  return hasArtifactKind && hasFormat && hasArtifactBody && isJsonPresentation;
}

// Decorative pictographic emoji ranges (emoticons, symbols & pictographs,
// transport, dingbats, misc symbols, stars/arrows-as-decoration, flags). We do
// NOT touch ™ © ® or structural markdown — only the cheap clutter the owner
// explicitly banned ("no cheap emojis").
const DECORATIVE_EMOJI =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]/gu;

/**
 * Deterministic anti-slop pass for chat replies: strip decorative emoji and
 * tidy the whitespace they leave behind. The Workbench is a professional
 * artifact studio; this guarantees clean output regardless of what the model
 * emits. Structural formatting (over-bolding, headings) is steered by the
 * system prompt — here we only remove pictographic clutter, which is safe.
 */
const DECORATION_ONLY_LINE = /^[\s*•·\-_~`|#]+$/;
const CATEGORY_LINE = /^([A-Za-z][A-Za-z &/]+)\s*[-–—:]\s*(.+)$/;
const LABELED_LINE = /^[A-Za-z][A-Za-z &/]{0,48}:\s+\S/;
const BULLET_LINE = /^\s*(?:[-*•]|\d+[.)])\s+/;
function isDecorationOnlyLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length > 0 && (
    DECORATION_ONLY_LINE.test(trimmed)
    || /^-{2,}$/.test(trimmed)
    || /^\*{2,}$/.test(trimmed)
    || /^_{2,}$/.test(trimmed)
  );
}

export function stripDecorativeSlop(text: string): string {
  return text
    .replace(DECORATIVE_EMOJI, '')
    .split('\n')
    .map((line) => line
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/ +([,.!?;:])/g, '$1')
      .replace(/[ \t]+$/, '')
      .trimEnd())
    .filter((line) => !isDecorationOnlyLine(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Final presentation pass for assistant prose: anti-slop plus light structural
 * normalization so category lines ("Code — debugging") align consistently.
 */
export function unwrapChatMarkdownEmphasis(text: string): string {
  return text
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1');
}

function normalizeCategoryLine(line: string): string {
  const category = line.match(CATEGORY_LINE);
  if (!category) return line;
  return `${category[1].trim()}: ${category[2].trim()}`;
}

function isLabeledLine(line: string): boolean {
  return LABELED_LINE.test(line) || CATEGORY_LINE.test(line);
}

export function parseAssistantLabeledLine(line: string): { label: string; detail: string } | null {
  const normalized = normalizeCategoryLine(line.trim());
  if (!isLabeledLine(normalized)) return null;

  const match = normalized.match(/^([A-Za-z][A-Za-z &/]{0,48}):\s+(.+)$/);
  if (!match) return null;

  return {
    label: match[1].trim(),
    detail: match[2].trim()
  };
}

function flattenBulletLine(line: string): string {
  return line
    .replace(BULLET_LINE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function stripChatMarkdownNoise(text: string): string {
  return unwrapChatMarkdownEmphasis(text)
    .split('\n')
    .map((line) => {
      if (isDecorationOnlyLine(line)) return '';
      return line
        .replace(/^\s{0,3}#{1,6}\s+/, '')
        .replace(BULLET_LINE, '')
        .replace(/^\s*>\s+/, '')
        .replace(/\s+$/g, '')
        .trimEnd();
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function coalesceAssistantParagraphs(text: string): string {
  return text
    .split(/\n\n+/)
    .map((stanza) => {
      const lines = stanza
        .split('\n')
        .map((line) => normalizeCategoryLine(flattenBulletLine(line.trim())))
        .filter(Boolean);

      const merged: string[] = [];
      let proseBuffer = '';

      for (const line of lines) {
        if (isLabeledLine(line)) {
          if (proseBuffer) {
            merged.push(proseBuffer);
            proseBuffer = '';
          }
          merged.push(line);
          continue;
        }

        proseBuffer = proseBuffer ? `${proseBuffer} ${line}` : line;
      }

      if (proseBuffer) merged.push(proseBuffer);
      return merged.join('\n');
    })
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

export function formatAssistantProse(text: string): string {
  const cleaned = stripChatMarkdownNoise(sanitizeChatReply(text));
  return coalesceAssistantParagraphs(
    cleaned
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return '';
        return normalizeCategoryLine(flattenBulletLine(trimmed));
      })
      .join('\n')
  );
}

export function splitAssistantParagraphs(text: string): string[] {
  const formatted = formatAssistantProse(text);
  if (!formatted) return [];
  return formatted.split(/\n\n+/).map((block) => block.trim()).filter(Boolean);
}

export function sanitizeChatReply(text: string): string {
  if (looksLikeRawArtifactPayload(text)) return artifactChatRecoveryNotice;
  const withoutToolXml = looksLikeRawToolCallPayload(text)
    ? stripRawToolCallPayload(text)
    : text;
  return stripDecorativeSlop(unwrapChatMarkdownEmphasis(withoutToolXml));
}
