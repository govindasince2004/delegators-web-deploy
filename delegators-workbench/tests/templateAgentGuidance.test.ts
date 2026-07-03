import { describe, expect, it } from 'vitest';
import {
  buildTemplateChatSystemLines,
  buildTemplateTurnGuidance,
  buildTemplateWelcomeMessage
} from '../src/lib/templateAgentGuidance';
import { findWorkbenchTemplate } from '../src/lib/templateHarness';

describe('template agent guidance', () => {
  it('builds a structure-aware welcome message', () => {
    const template = findWorkbenchTemplate('wb-midnight-investor')!;
    const welcome = buildTemplateWelcomeMessage(template);
    expect(welcome).toContain('Midnight Aurora Pitch');
    expect(welcome).toContain('Slide 1:');
    expect(welcome).toContain('Paste your story');
  });

  it('adds advisory chat system lines for template sessions', () => {
    const template = findWorkbenchTemplate('wb-executive-board')!;
    const lines = buildTemplateChatSystemLines(template);
    expect(lines.join('\n')).toContain('Active template session');
    expect(lines.join('\n')).toContain('Executive Slate Board');
    expect(lines.join('\n')).toContain('advisory chat');
  });

  it('differentiates turn guidance by mode', () => {
    const template = findWorkbenchTemplate('wb-midnight-investor')!;
    const chat = buildTemplateTurnGuidance('chat', template).join(' ');
    const generate = buildTemplateTurnGuidance('generate', template).join(' ');
    expect(chat).toContain('advisory chat');
    expect(generate).toContain('skeleton');
    expect(chat).not.toContain('fill the loaded template skeleton');
  });
});