import { describe, expect, it } from 'vitest';
import { findSkillById } from '../src/lib/skills';
import { promptWithSkill, toolMetaForSkill, visiblePromptForSkill } from '../src/lib/skillIcons';

describe('artifact tool presentation', () => {
  it('maps every skill to the supplied professional product icon set', () => {
    expect(toolMetaForSkill(findSkillById('ppt')!).icon).toContain('microsoft-powerpoint.svg');
    expect(toolMetaForSkill(findSkillById('pdf')!).icon).toContain('pdf.svg');
    expect(toolMetaForSkill(findSkillById('word')!).icon).toContain('microsoft-word.svg');
    expect(toolMetaForSkill(findSkillById('resume')!).icon).toContain('resume.svg');
    expect(toolMetaForSkill(findSkillById('proposal')!).icon).toContain('others.svg');
    expect(toolMetaForSkill(findSkillById('email')!).icon).toContain('gmail-2026.svg');
    expect(toolMetaForSkill(findSkillById('xlsx')!).icon).toContain('microsoft-excel.svg');
  });

  it('hides only the selected skill token from the visible composer text', () => {
    const skill = findSkillById('ppt')!;
    expect(visiblePromptForSkill('@ppt Build a launch deck for @design reviewers', skill)).toBe(
      'Build a launch deck for @design reviewers'
    );
    expect(visiblePromptForSkill('Please @slides build the deck', skill)).toBe('Please build the deck');
  });

  it('restores the canonical backend tag while the user edits visible text', () => {
    const skill = findSkillById('ppt')!;
    expect(promptWithSkill(skill, 'Build a ten-slide launch deck')).toBe('@ppt Build a ten-slide launch deck');
    expect(promptWithSkill(skill, '')).toBe('@ppt ');
  });
});
