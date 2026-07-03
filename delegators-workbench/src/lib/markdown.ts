import type { ArtifactDocument, ArtifactSection } from './shared.js';

export function artifactToMarkdown(artifact: ArtifactDocument): string {
  const lines: string[] = [`# ${artifact.title}`, '', `**Audience:** ${artifact.audience}`, `**Tone:** ${artifact.tone}`, ''];

  if (artifact.executiveSummary) {
    lines.push('## Summary', '', artifact.executiveSummary, '');
  }

  if (artifact.resume) {
    const resume = artifact.resume;
    lines.push('## Resume Profile', '');
    if (resume.name) lines.push(`**Name:** ${resume.name}`);
    if (resume.headline) lines.push(`**Headline:** ${resume.headline}`);
    if (resume.contact.length > 0) lines.push(`**Contact:** ${resume.contact.join(' | ')}`);
    if (resume.summary) lines.push('', resume.summary);
    if (resume.skills.length > 0) lines.push('', `**Skills:** ${resume.skills.join(', ')}`);
    lines.push('');
  }

  for (const section of artifact.sections) {
    pushSection(lines, section);
  }

  if (artifact.slides?.length) {
    lines.push('## Slides', '');
    artifact.slides.forEach((slide, index) => {
      lines.push(`### Slide ${index + 1}: ${slide.title}`);
      if (slide.subtitle) lines.push(slide.subtitle);
      slide.bullets.forEach((bullet) => lines.push(`- ${bullet}`));
      if (slide.sourceIds?.length) lines.push(`Sources: ${slide.sourceIds.join(', ')}`);
      if (slide.speakerNotes) lines.push('', `Speaker notes: ${slide.speakerNotes}`);
      lines.push('');
    });
  }

  if (artifact.citations.length > 0) {
    lines.push('## Citations', '');
    artifact.citations.forEach((citation) => {
      lines.push(`- ${citation.id ? `${citation.id}: ` : ''}${citation.label}${citation.url ? ` — ${citation.url}` : ''}`);
    });
    lines.push('');
  }

  if (artifact.nextQuestions.length > 0) {
    lines.push('## Questions To Finish Cleanly', '');
    artifact.nextQuestions.forEach((question) => lines.push(`- ${question}`));
    lines.push('');
  }

  return lines.join('\n').trim() + '\n';
}

function pushSection(lines: string[], section: ArtifactSection): void {
  lines.push(`## ${section.heading}`, '');
  if (section.body) lines.push(section.body, '');
  section.bullets.forEach((bullet) => lines.push(`- ${bullet}`));
  if (section.bullets.length > 0) lines.push('');
  if (section.sourceIds?.length) lines.push(`Sources: ${section.sourceIds.join(', ')}`, '');

  if (section.table) {
    lines.push(`| ${section.table.columns.join(' | ')} |`);
    lines.push(`| ${section.table.columns.map(() => '---').join(' | ')} |`);
    section.table.rows.forEach((row) => lines.push(`| ${row.join(' | ')} |`));
    lines.push('');
  }
}
