import { describe, expect, it } from 'vitest';
import {
  fallbackArtifactPreflight,
  parseProviderPreflight
} from '../server/artifactPreflight';

const brief = 'create a good ppt with great design no generic color and the topic is how to teach ai';

describe('artifact provider preflight', () => {
  it('normalizes provider-authored plan and clarification questions', () => {
    const preflight = parseProviderPreflight(JSON.stringify({
      title: 'Planning the teaching deck',
      steps: [
        { label: 'Frame the teaching outcome', detail: 'Identify learner level and the practical promise.' },
        { label: 'Ask for missing audience choices', detail: 'Only pause for choices that change the deck.' },
        { label: 'Draft the learning sequence', detail: 'Build a clear progression with examples.' },
        { label: 'Inspect and package the presentation', detail: 'Check pacing, exports, and speaker notes.' }
      ],
      questions: [{
        id: 'learner-level',
        question: 'Who is learning AI from this deck?',
        options: ['Absolute beginners', 'College students', 'Working professionals'],
        allowCustom: true
      }]
    }), {
      kind: 'deck',
      primaryFormat: 'pptx',
      brief,
      needsResearch: false
    });

    expect(preflight?.source).toBe('provider');
    expect(preflight?.plan.title).toBe('Planning the teaching deck');
    expect(preflight?.plan.items.map((item) => item.id)).toEqual(['shape', 'clarify', 'build', 'finish']);
    expect(preflight?.plan.items[1]?.label).toContain('Ask for missing');
    expect(preflight?.questions[0]?.question).toBe('Who is learning AI from this deck?');
  });

  it('strips internal implementation words from provider steps', () => {
    const preflight = parseProviderPreflight(JSON.stringify({
      steps: [
        { label: 'Use backend harness JSON schema', detail: 'Open terminal workspace tools.' },
        { label: 'Compose the artifact', detail: 'Write the useful content.' },
        { label: 'Inspect the export', detail: 'Check the final file.' }
      ],
      questions: []
    }), {
      kind: 'report',
      primaryFormat: 'pdf',
      brief: 'write a short report about onboarding',
      needsResearch: false
    });

    const serialized = JSON.stringify(preflight?.plan);
    expect(serialized).not.toMatch(/backend|harness|terminal|workspace|json|schema/i);
  });

  it('keeps the deterministic fallback available when provider preflight fails', () => {
    const preflight = fallbackArtifactPreflight('deck', brief, false);

    expect(preflight.source).toBe('fallback');
    expect(preflight.plan.title).toBe('Working through the artifact brief');
    // Scripted clarification popups are gone: the fallback builds silently and
    // only the model (provider preflight) may ask questions.
    expect(preflight.questions).toEqual([]);
  });
});
