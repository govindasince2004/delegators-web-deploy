import { describe, expect, it } from 'vitest';
import {
  buildGenerationBrief,
  buildTemplateHarnessPrompt,
  buildTemplateTurnMessage,
  findWorkbenchTemplate,
  looksLikeSubstantiveBrief,
  resolveActiveTemplate,
  resolveTemplateTurnRouting,
  templateHarnessMetadata,
  templateSessionFromTemplate
} from '../src/lib/templateHarness';
import { resolveTemplateMetadata } from '../src/lib/workbenchTemplates';
import { buildTemplateHarnessRoutingLines, selectTemplateScaffold } from '../server/templateRag';
import { getPeakArtifact } from '../src/lib/peakArtifacts/registry';

describe('template harness', () => {
  it('builds a harness prompt with scaffold, design, and audience metadata', () => {
    const template = resolveTemplateMetadata(findWorkbenchTemplate('wb-midnight-investor')!);
    const harness = buildTemplateHarnessPrompt(template);

    expect(harness).toContain('TEMPLATE SESSION');
    expect(harness).toContain('Midnight Aurora Pitch');
    expect(harness).toContain('bold-pop');
    expect(harness).toContain('Full structure map:');
    expect(harness).toContain('investor-12');
    expect(harness).toContain('Audience:');
    expect(harness).toContain('Composition rules:');
    expect(harness).toContain('Agent contract:');
    expect(harness).toContain('Structure preview:');
  });

  it('routes template turns via shared thread artifact routing, not keyword tables', () => {
    const template = findWorkbenchTemplate('wb-midnight-investor')!;
    const preview = getPeakArtifact(template.peakArtifactId)!;

    expect(resolveTemplateTurnRouting(template, '', [preview])).toBe('chat');
    expect(resolveTemplateTurnRouting(template, 'What is on slide 3?', [preview])).toBe('chat');
    expect(resolveTemplateTurnRouting(template, 'Change slide 3 title to Market opportunity', [preview])).toBe('refine');
    expect(
      resolveTemplateTurnRouting(
        template,
        'Acme Corp — B2B HR platform, $4.2M ARR, 180 customers, raising $8M Series A.',
        [preview]
      )
    ).toBe('generate');
  });

  it('detects substantive briefs without a fixed create-word list', () => {
    expect(looksLikeSubstantiveBrief('What slides are here?')).toBe(false);
    expect(
      looksLikeSubstantiveBrief('Acme Corp — B2B HR platform, $4.2M ARR, 180 customers, raising $8M Series A.')
    ).toBe(true);
  });

  it('composes generation brief as skill tag + harness + user details', () => {
    const template = findWorkbenchTemplate('wb-midnight-investor')!;
    const preview = getPeakArtifact(template.peakArtifactId)!;
    const brief = buildGenerationBrief(template, 'Focus on Q3 expansion risks.', [preview]);

    expect(brief.startsWith('@ppt')).toBe(true);
    expect(brief).toContain('investor-12');
    expect(brief).toContain('bold-pop');
    expect(brief).toContain('Q3 expansion risks');
    expect(brief).toContain('THREAD ROUTING');
    expect(brief).toContain('skeleton');
  });

  it('embeds thread routing lines in template turn messages', () => {
    const template = findWorkbenchTemplate('wb-midnight-investor')!;
    const preview = getPeakArtifact(template.peakArtifactId)!;
    const message = buildTemplateTurnMessage(template, 'Update slide 2 headline', 'refine', [preview]);
    expect(message).toContain('THREAD ROUTING');
    expect(message).toContain('Turn mode: surgical refinement');
  });

  it('resolves active template sessions and server routing metadata', () => {
    const template = findWorkbenchTemplate('wb-research-brief')!;
    const session = templateSessionFromTemplate(template);
    const resolved = resolveActiveTemplate(session);
    const meta = templateHarnessMetadata(template!);

    expect(resolved?.id).toBe('wb-research-brief');
    expect(meta.templateId).toBe('wb-research-brief');
    expect(meta.scaffoldId).toBe('research-brief');

    const routing = buildTemplateHarnessRoutingLines(meta);
    expect(routing.join('\n')).toContain('TEMPLATE HARNESS');
    expect(routing.join('\n')).toContain('Research brief with citations');
    expect(routing.join('\n')).toContain('Research Brief');
    expect(routing.join('\n')).toContain('Agent contract:');
  });

  it('prefers explicit scaffold ids for server-side template selection', () => {
    const scaffold = selectTemplateScaffold('deck', '@ppt Create a deck', 'board-8');
    expect(scaffold?.id).toBe('board-8');
  });
});