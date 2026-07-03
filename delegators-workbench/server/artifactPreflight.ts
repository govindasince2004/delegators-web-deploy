import { z } from 'zod';
import type { ArtifactKind, ArtifactPrimaryFormat, WorkbenchQuestionItem } from '../src/lib/shared.js';
import {
  buildArtifactPlan,
  type ArtifactPlan
} from './artifactPlan.js';

export type ArtifactPreflight = {
  plan: ArtifactPlan;
  questions: WorkbenchQuestionItem[];
  // Conversational opener shown in the chat transcript BEFORE any questions —
  // the assistant states what it understood and how it will build, in the
  // user's terms (Claude-style reply-first flow).
  reply?: string;
  source: 'provider' | 'fallback';
};

const PreflightQuestionSchema = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  question: z.string().trim().min(1).max(300),
  options: z.array(z.string().trim().min(1).max(120)).max(4).default([]),
  allowCustom: z.boolean().default(true)
});

const PreflightStepSchema = z.object({
  label: z.string().trim().min(1).max(120),
  detail: z.string().trim().max(300).optional()
});

const ProviderPreflightSchema = z.object({
  reply: z.string().trim().max(1200).optional(),
  title: z.string().trim().min(1).max(160).optional(),
  steps: z.array(PreflightStepSchema).min(3).max(6).default([]),
  questions: z.array(PreflightQuestionSchema).max(4).default([])
});

export function fallbackArtifactPreflight(
  kind: ArtifactKind,
  brief: string,
  needsResearch: boolean,
  options: { structured?: boolean } = {}
): ArtifactPreflight {
  // No scripted questions: clarification is the MODEL's judgment call (the
  // provider preflight may return questions when an answer would materially
  // change the artifact). When the provider preflight is unavailable we build
  // silently from the brief instead of interrogating the user with canned
  // audience/scope/visual popups.
  return {
    plan: buildArtifactPlan(kind, brief, needsResearch, options),
    questions: [],
    source: 'fallback'
  };
}

export function parseProviderPreflight(
  content: string,
  options: {
    kind: ArtifactKind;
    primaryFormat: ArtifactPrimaryFormat;
    brief: string;
    needsResearch: boolean;
  }
): ArtifactPreflight | null {
  const parsedJson = safeJson(content);
  const parsed = ProviderPreflightSchema.safeParse(parsedJson);
  if (!parsed.success) return null;

  const fallback = fallbackArtifactPreflight(options.kind, options.brief, options.needsResearch);
  const questions = normalizeQuestions(parsed.data.questions);
  return {
    plan: planFromProviderSteps({
      fallback: fallback.plan,
      title: parsed.data.title,
      steps: parsed.data.steps,
      questions,
      needsResearch: options.needsResearch
    }),
    questions,
    reply: cleanText(parsed.data.reply, '', 1200) || undefined,
    source: 'provider'
  };
}

export function buildPreflightMessages(options: {
  kind: ArtifactKind;
  primaryFormat: ArtifactPrimaryFormat;
  skillLabel: string;
  skillInstruction: string;
  brief: string;
  needsResearch: boolean;
}) {
  return [
    {
      role: 'system',
      content: [
        'You are the Delegators Workbench preflight planner.',
        'Return only compact JSON. Do not return Markdown.',
        'Do not reveal hidden reasoning. Write user-facing working steps only.',
        'Do not mention backend, harness, tools, terminal, workspace, JSON, schema, or implementation details.',
        'Do not echo the raw user prompt as a title or step.',
        'Always include "reply": 2-4 sentences spoken directly to the user, restating what you understood from THEIR brief in THEIR terms and how you will approach it. Reference their specific subject, data, or constraints — never a generic acknowledgment like "I will create your presentation".',
        'If you ask questions, the reply must lead into them naturally (e.g. explain what you will build, then note the one or two decisions you need from them before starting).',
        'Default to asking NOTHING. A brief that already specifies the content, data, audience, or constraints gets zero questions — build immediately.',
        'Ask only when the artifact would be materially WRONG without the answer, never for preferences you can infer.',
        'Never oversmart the user: do not suggest a different topic, format, audience, or scope than they requested.',
        'Never ask stock or template questions (audience? tone? length? color scheme?). Every question must be specific to this brief and impossible to answer from it.',
        'Maximum two questions, ever. Prefer zero.',
        'If you ask questions, provide 2-4 short selectable options and allowCustom true.',
        'Use the user’s requested visual direction and constraints. Do not impose a fixed font, palette, or layout.',
        'JSON shape: { "reply": string, "title"?: string, "steps": [{ "label": string, "detail"?: string }], "questions": [{ "id"?: string, "question": string, "options": string[], "allowCustom": boolean }] }.'
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        `Artifact kind: ${options.kind}`,
        `Primary output: ${options.primaryFormat}`,
        `Skill: ${options.skillLabel}`,
        `Skill guidance: ${options.skillInstruction}`,
        `Needs current research: ${options.needsResearch ? 'yes' : 'no'}`,
        `User brief:\n${options.brief}`
      ].join('\n\n')
    }
  ];
}

function planFromProviderSteps(options: {
  fallback: ArtifactPlan;
  title?: string;
  steps: Array<{ label: string; detail?: string }>;
  questions: WorkbenchQuestionItem[];
  needsResearch: boolean;
}): ArtifactPlan {
  const ids = [
    'shape',
    ...(options.questions.length ? ['clarify'] : []),
    ...(options.needsResearch ? ['sources'] : []),
    'build',
    'finish'
  ];
  const fallbackById = new Map(options.fallback.items.map((item) => [item.id, item]));
  const items = ids.map((id, index) => {
    const providerStep = options.steps[index];
    const fallback = fallbackById.get(id) ?? options.fallback.items[Math.min(index, options.fallback.items.length - 1)];
    return {
      id,
      label: cleanText(providerStep?.label, fallback.label, 120),
      detail: cleanText(providerStep?.detail, fallback.detail ?? '', 300) || undefined,
      status: index === 0 ? 'active' as const : 'pending' as const
    };
  });

  return {
    title: cleanText(options.title, options.fallback.title, 160),
    items
  };
}

function normalizeQuestions(questions: z.infer<typeof PreflightQuestionSchema>[]): WorkbenchQuestionItem[] {
  return questions.slice(0, 4).map((question, index) => ({
    id: slug(question.id || question.question || `question-${index + 1}`),
    question: cleanText(question.question, `Question ${index + 1}`, 300),
    options: question.options.map((option) => cleanText(option, '', 120)).filter(Boolean).slice(0, 4),
    allowCustom: question.allowCustom
  }));
}

function safeJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
}

function cleanText(value: string | undefined, fallback: string, max: number): string {
  const clean = value
    ?.replace(/\b(?:backend|harness|terminal|workspace|tool(?:-| )?call|json|schema)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return (clean || fallback).slice(0, max).trim();
}

function slug(value: string): string {
  const clean = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  return clean || 'question';
}
