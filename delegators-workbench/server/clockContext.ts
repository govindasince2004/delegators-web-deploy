/**
 * Inject authoritative server clock into prompts so the model never guesses
 * "today" from stale web-search publication dates.
 */
export function buildWorkbenchClockContext(now: Date = new Date()): string {
  const utcIso = now.toISOString();
  const dateUtc = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  });
  const timeUtc = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    hour12: false
  });

  return [
    `Current date and time (UTC): ${dateUtc}, ${timeUtc} (${utcIso}).`,
    'For questions about today, now, or the current calendar date, answer from this clock — not from search snippets.',
    'Search-result publication dates describe when an article was written; they are not today\'s date.',
    'Use web_search for external facts (news, prices, laws, events), not to learn what day it is.'
  ].join(' ');
}