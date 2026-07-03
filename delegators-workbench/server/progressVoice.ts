const thinkingLeakPattern = /\b(?:let me think|i think|i'll think|thinking about|reasoning through|chain of thought|inner monologue|considering whether|pondering|deliberating)\b/gi;
const metaLeakPattern = /\b(?:as an ai|language model|my training|i cannot browse|i don't have access)\b/gi;

export function toActionStatus(message: string): string {
  const cleaned = message
    .replace(thinkingLeakPattern, '')
    .replace(metaLeakPattern, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!cleaned) return 'Working';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function wrapProgressReporter<T extends { status: (message: string) => void }>(reporter?: T): T | undefined {
  if (!reporter) return undefined;
  return {
    ...reporter,
    status(message: string) {
      reporter.status(toActionStatus(message));
    }
  };
}