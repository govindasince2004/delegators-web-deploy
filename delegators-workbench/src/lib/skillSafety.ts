// Skill-catalog safety guard.
//
// Skills are data-only: each contributes a plain-text instruction that is sent to
// the model. They are NOT executable and never loaded from a remote source. This
// guard makes that contract enforceable — it rejects any skill whose text looks
// like it is trying to smuggle in a link, script, or injection (phishing /
// malware vector), or that declares an unknown artifact kind. It runs as a unit
// test so a bad skill fails CI instead of shipping.

import { skillCatalog, type SkillDefinition } from './skills.js';

// The only artifact kinds the exporters know how to render. A skill claiming any
// other kind would silently fail downstream.
const ALLOWED_KINDS = new Set(['deck', 'report', 'resume', 'assignment', 'email', 'sheet']);

// Patterns that must never appear in skill text. URLs/protocols are the main
// phishing vector; the script/handler patterns block prompt-embedded code.
const FORBIDDEN_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /https?:\/\//i, reason: 'embedded URL' },
  { re: /\bwww\./i, reason: 'embedded domain' },
  { re: /javascript:/i, reason: 'javascript: URI' },
  { re: /data:[^,\s]*;base64/i, reason: 'base64 data URI' },
  { re: /<\s*script/i, reason: '<script> tag' },
  { re: /\bon(?:click|error|load)\s*=/i, reason: 'inline event handler' },
  { re: /\beval\s*\(/i, reason: 'eval() call' },
  { re: /\b(?:powershell|curl|wget|chmod|rm\s+-rf)\b/i, reason: 'shell command' }
];

const TAG_RE = /^@[a-z][a-z0-9-]*$/;

export interface SkillSafetyIssue {
  skillId: string;
  problem: string;
}

// Validate the whole catalog. Returns a list of problems (empty == safe) so it
// can be asserted in tests and, if ever needed, at boot.
export function validateSkillCatalog(catalog: readonly SkillDefinition[] = skillCatalog): SkillSafetyIssue[] {
  const issues: SkillSafetyIssue[] = [];
  const seenTags = new Set<string>();

  for (const skill of catalog) {
    const id = skill.id || '(no id)';

    if (!TAG_RE.test(skill.tag)) {
      issues.push({ skillId: id, problem: `tag "${skill.tag}" is not a safe @tag` });
    }
    for (const alias of skill.aliases) {
      if (!TAG_RE.test(alias)) {
        issues.push({ skillId: id, problem: `alias "${alias}" is not a safe @tag` });
      }
      if (seenTags.has(alias)) {
        issues.push({ skillId: id, problem: `alias "${alias}" collides with another skill` });
      }
      seenTags.add(alias);
    }

    if (!ALLOWED_KINDS.has(skill.kind)) {
      issues.push({ skillId: id, problem: `unknown artifact kind "${skill.kind}"` });
    }

    for (const field of ['label', 'description', 'instruction'] as const) {
      const value = String(skill[field] ?? '');
      for (const { re, reason } of FORBIDDEN_PATTERNS) {
        if (re.test(value)) {
          issues.push({ skillId: id, problem: `${field} contains a ${reason}` });
        }
      }
    }
  }

  return issues;
}
