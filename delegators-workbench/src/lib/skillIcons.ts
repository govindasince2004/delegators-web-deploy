import type { SkillDefinition } from './skills.js';

export type SkillToolMeta = {
  name: string;
  icon: string;
  accent: string;
};

const tools: Record<'powerpoint' | 'pdf' | 'word' | 'gmail' | 'excel' | 'resume' | 'other', SkillToolMeta> = {
  powerpoint: {
    name: 'PowerPoint',
    icon: '/tools-icons/microsoft-powerpoint.svg',
    accent: '#ef6944'
  },
  pdf: {
    name: 'PDF',
    icon: '/tools-icons/pdf.svg',
    accent: '#ff5148'
  },
  word: {
    name: 'Word',
    icon: '/tools-icons/microsoft-word.svg',
    accent: '#4e91f5'
  },
  gmail: {
    name: 'Gmail',
    icon: '/tools-icons/gmail-2026.svg',
    accent: '#fc5a50'
  },
  excel: {
    name: 'Excel',
    icon: '/tools-icons/microsoft-excel.svg',
    accent: '#4ebd61'
  },
  resume: {
    name: 'Resume',
    icon: '/tools-icons/resume.svg',
    accent: '#8ec5ff'
  },
  other: {
    name: 'Artifact',
    icon: '/tools-icons/others.svg',
    accent: '#c7c2b8'
  }
};

export function toolMetaForSkill(skill: SkillDefinition): SkillToolMeta {
  if (skill.id === 'email') return tools.gmail;
  if (skill.id === 'word') return tools.word;
  if (skill.id === 'resume') return tools.resume;
  if (skill.primaryOutput === 'pptx') return tools.powerpoint;
  if (skill.primaryOutput === 'xlsx') return tools.excel;
  if (skill.primaryOutput === 'pdf') return tools.pdf;
  return tools.other;
}

export function visiblePromptForSkill(text: string, skill: SkillDefinition | undefined): string {
  if (!skill) return text;
  const aliases = skill.aliases
    .map(escapeRegExp)
    .sort((left, right) => right.length - left.length)
    .join('|');
  return text
    .replace(new RegExp(`(^|\\s)(?:${aliases})(?=\\s|$)`, 'i'), '$1')
    .replace(/^\s+/, '')
    .replace(/ {2,}/g, ' ');
}

export function promptWithSkill(skill: SkillDefinition, visibleText: string): string {
  const body = visibleText.trimStart();
  return body ? `${skill.tag} ${body}` : `${skill.tag} `;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
