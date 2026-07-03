import type { WorkbenchStreamEvent } from '../src/lib/shared.js';
import { formatAssistantProse } from '../src/lib/artifactContinuation.js';
import { friendlyRunError } from '../src/lib/runErrors.js';
import { scrubSecrets } from './security.js';
import { toActionStatus } from './progressVoice.js';

const MAX_STATUS = 240;
const MAX_MESSAGE = 2000;
const MAX_ERROR = 500;
const MAX_PLAN_TITLE = 160;

function bounded(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max);
}

export function sanitizeStreamEvent(event: WorkbenchStreamEvent): WorkbenchStreamEvent {
  switch (event.type) {
    case 'status':
      return {
        type: 'status',
        message: bounded(scrubSecrets(toActionStatus(event.message)), MAX_STATUS)
      };
    case 'message': {
      const text = formatAssistantProse(event.text);
      return {
        type: 'message',
        text: bounded(scrubSecrets(text), MAX_MESSAGE)
      };
    }
    case 'error':
      return {
        type: 'error',
        message: bounded(scrubSecrets(friendlyRunError(new Error(event.message))), MAX_ERROR)
      };
    case 'plan':
      return {
        type: 'plan',
        title: bounded(scrubSecrets(event.title), MAX_PLAN_TITLE),
        items: event.items
      };
    case 'checklist':
      return { type: 'checklist', items: event.items };
    case 'question':
      return {
        type: 'question',
        question: bounded(scrubSecrets(event.question), 300),
        ...(event.questions
          ? {
              questions: event.questions.map((item) => ({
                ...item,
                question: bounded(scrubSecrets(item.question), 300),
                options: item.options.map((option) => bounded(scrubSecrets(option), 120))
              }))
            }
          : {})
      };
    case 'artifact':
      return event;
    default:
      return event;
  }
}

export function sanitizeClientError(error: unknown): string {
  return bounded(scrubSecrets(friendlyRunError(error)), MAX_ERROR);
}