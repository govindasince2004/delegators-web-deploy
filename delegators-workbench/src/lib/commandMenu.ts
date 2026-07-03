// Pure logic for the composer's "@" command menu (ChatGPT/Claude-style slash
// menu). Kept separate from React so it is unit-testable: detecting when the
// caret is inside an "@token", filtering the skill catalog, and rewriting the
// text when a skill is chosen.

import { skillCatalog, type SkillDefinition } from './skills.js';

export interface AtQuery {
  active: boolean;
  /** The text typed after "@" (without the @), lowercased. */
  query: string;
  /** Index of the "@" in the source string. */
  start: number;
}

// Detect an "@token" that ends exactly at the caret. The token must start at the
// beginning of input or after whitespace, and contain only tag characters — so
// an email like "a@b" mid-word never triggers the menu.
export function detectAtQuery(text: string, caret: number): AtQuery {
  const upto = text.slice(0, caret);
  const match = upto.match(/(^|\s)@([a-zA-Z0-9-]*)$/);
  if (!match) {
    return { active: false, query: '', start: -1 };
  }
  const token = match[2] ?? '';
  const start = caret - token.length - 1; // position of "@"
  return { active: true, query: token.toLowerCase(), start };
}

// Rank skills for a query: a blank query shows the full catalog; otherwise match
// the tag, aliases, label, category, or description, preferring prefix hits on
// the tag/label so "@p" surfaces ppt/pdf/project first.
export function filterSkills(query: string): SkillDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...skillCatalog];

  const scored = skillCatalog
    .map((skill) => ({ skill, score: scoreSkill(skill, q) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map((entry) => entry.skill);
}

function scoreSkill(skill: SkillDefinition, q: string): number {
  const tag = skill.tag.replace(/^@/, '').toLowerCase();
  const label = skill.label.toLowerCase();
  if (tag === q) return 100;
  if (tag.startsWith(q)) return 80;
  if (skill.aliases.some((alias) => alias.replace(/^@/, '').toLowerCase().startsWith(q))) return 60;
  if (label.startsWith(q)) return 50;
  if (label.includes(q)) return 30;
  if (skill.category.toLowerCase().includes(q)) return 20;
  if (skill.description.toLowerCase().includes(q)) return 10;
  return 0;
}

export interface SkillSelection {
  text: string;
  caret: number;
}

// Replace the "@token" at the caret with the chosen skill's canonical tag plus a
// trailing space, returning the new text and caret position.
export function applySkillSelection(
  text: string,
  query: AtQuery,
  skill: SkillDefinition,
  caret: number
): SkillSelection {
  if (!query.active) return { text, caret };
  const before = text.slice(0, query.start);
  const after = text.slice(caret);
  const insert = `${skill.tag} `;
  const nextText = `${before}${insert}${after}`;
  return { text: nextText, caret: before.length + insert.length };
}
