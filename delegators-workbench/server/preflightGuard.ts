import type { WorkbenchQuestionItem } from '../src/lib/shared.js';
import { briefIsExplicit } from './artifactPipeline.js';
import { briefAnswersQuestion } from './userPromptContract.js';

const stockQuestionPattern = /\b(?:what(?:'s| is) the (?:audience|tone|topic|subject|length|color|style)|who is (?:this|the audience)|how (?:long|many slides)|which (?:color|font|template))\b/i;

export function guardPreflightQuestions(
  brief: string,
  questions: WorkbenchQuestionItem[],
  kind?: string
): WorkbenchQuestionItem[] {
  if (briefIsExplicit(brief, kind as never)) return [];
  return questions
    .filter((item) => !stockQuestionPattern.test(item.question))
    .filter((item) => !briefAnswersQuestion(brief, item.question))
    .filter((item) => item.question.trim().length >= 12)
    .slice(0, 2);
}