import { describe, expect, it } from 'vitest';
import { buildArtifactSkillPack } from '../server/artifactSkills';
import { findSkillById } from '../src/lib/skills';

describe('artifact skill packs', () => {
  it('builds a workspace skill package for presentation work', () => {
    const pack = buildArtifactSkillPack({
      kind: 'deck',
      primaryFormat: 'pptx',
      selectedSkill: findSkillById('ppt')
    });

    expect(pack.guide).toContain('Read uploaded/reference material before drafting');
    expect(pack.guide).toContain('one clear communication job');
    expect(pack.guide).toContain('editable chart');
    expect(pack.guide).toContain('Evidence architecture');
    expect(pack.guide).toContain('FACT');
    expect(pack.seedFiles.map((file) => file.path)).toEqual([
      'skills/active/SKILL.md',
      'skills/active/quality-checklist.md'
    ]);
  });

  it('gives spreadsheets and resumes format-specific quality rules', () => {
    const sheet = buildArtifactSkillPack({ kind: 'sheet', primaryFormat: 'xlsx' });
    const resume = buildArtifactSkillPack({ kind: 'resume', primaryFormat: 'docx' });

    expect(sheet.guide).toMatch(/formula|number format|input/i);
    expect(resume.guide).toMatch(/ATS|invent|evidence/i);
  });
});
