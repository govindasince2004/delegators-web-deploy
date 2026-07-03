import { describe, expect, it } from 'vitest';
import { detectAtQuery, filterSkills, applySkillSelection } from '../src/lib/commandMenu';
import { findSkillById } from '../src/lib/skills';

describe('composer @ command menu', () => {
  it('activates when an @token ends at the caret', () => {
    const q = detectAtQuery('@pp', 3);
    expect(q.active).toBe(true);
    expect(q.query).toBe('pp');
    expect(q.start).toBe(0);
  });

  it('activates after whitespace mid-text', () => {
    const text = 'make a deck @re';
    const q = detectAtQuery(text, text.length);
    expect(q.active).toBe(true);
    expect(q.query).toBe('re');
  });

  it('does NOT trigger on an email-like @ inside a word', () => {
    const text = 'mail me at user@host';
    expect(detectAtQuery(text, text.length).active).toBe(false);
  });

  it('blank query lists the whole catalog', () => {
    expect(filterSkills('').length).toBeGreaterThanOrEqual(10);
  });

  it('ranks an exact tag first and supports prefix/alias matching', () => {
    expect(filterSkills('ppt')[0].id).toBe('ppt');
    expect(filterSkills('slides')[0].id).toBe('ppt'); // alias
    expect(filterSkills('p').map((s) => s.id)).toContain('pdf');
  });

  it('replaces the @token with the chosen skill tag and a trailing space', () => {
    const text = 'do @re now';
    const caret = 6; // right after "@re"
    const q = detectAtQuery(text, caret);
    const resume = findSkillById('resume')!;
    const out = applySkillSelection(text, q, resume, caret);
    expect(out.text).toBe('do @resume  now');
    expect(out.caret).toBe('do @resume '.length);
  });
});
