import { describe, expect, it } from 'vitest';
import {
  availableComposerLanes,
  composerTriggerLabel,
  parseComposerModelSelection,
  resolveComposerModel,
  showComposerThinkingToggle
} from '../src/lib/composerModelLanes';

describe('composerModelLanes', () => {
  const proThinkingPlan = ['dlg-light', 'dlg-pro', 'art-vision'];

  it('exposes fast and pro lanes for a pro-capable workbench plan', () => {
    expect(availableComposerLanes(proThinkingPlan)).toEqual(['lite', 'pro']);
    expect(resolveComposerModel('pro', true, proThinkingPlan)).toBe('dlg-pro');
    expect(resolveComposerModel('pro', false, proThinkingPlan)).toBe('dlg-pro');
  });

  it('labels the trigger with Pro names and thinking mode', () => {
    expect(composerTriggerLabel('lite', false)).toBe('Pro fast');
    expect(composerTriggerLabel('lite', true)).toBe('Pro fast thinking');
    expect(composerTriggerLabel('pro', false)).toBe('Pro');
    expect(composerTriggerLabel('pro', true)).toBe('Pro thinking');
  });

  it('parses the current model back into lane + thinking', () => {
    expect(parseComposerModelSelection('dlg-pro', proThinkingPlan)).toEqual({
      lane: 'pro',
      thinking: true,
      model: 'dlg-pro'
    });
  });

  it('shows the thinking toggle only on lanes with thinking aliases', () => {
    const ultraPlan = [
      'swe-fast',
      'swe-fast-thinking',
      'swe-pro',
      'swe-pro-thinking',
      'dlg-light',
      'dlg-pro',
      'swe-ultra',
      'swe-ultra-thinking',
      'art-vision'
    ];
    const simpleProPlan = ['swe-fast', 'swe-balanced', 'swe-pro', 'art-vision'];

    expect(showComposerThinkingToggle('lite', proThinkingPlan)).toBe(true);
    expect(showComposerThinkingToggle('pro', proThinkingPlan)).toBe(true);
    expect(showComposerThinkingToggle('lite', simpleProPlan)).toBe(false);
    expect(showComposerThinkingToggle('pro', simpleProPlan)).toBe(false);
    expect(showComposerThinkingToggle('max', ultraPlan)).toBe(false);
    expect(showComposerThinkingToggle('lite', ultraPlan)).toBe(true);
  });
});
