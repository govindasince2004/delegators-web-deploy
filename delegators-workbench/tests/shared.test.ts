import { describe, expect, it } from 'vitest';
import { artifactToMarkdown } from '../src/lib/markdown';
import { ArtifactDocumentSchema, GenerateArtifactRequestSchema, RefineArtifactRequestSchema } from '../src/lib/shared';
import { resolveSkillFromText, stripSkillTags } from '../src/lib/skills';

const artifact = {
  kind: 'deck',
  title: 'Internship Project Review',
  audience: 'College placement panel',
  tone: 'Professional',
  executiveSummary: 'A concise review of the internship project outcomes.',
  sections: [
    {
      heading: 'Problem',
      body: 'The team needed a faster way to summarize weekly placement activity.',
      bullets: ['Manual reporting took too long', 'Stakeholders needed a clean weekly view']
    }
  ],
  slides: [
    {
      title: 'Problem',
      bullets: ['Manual reporting took too long', 'Weekly visibility was poor'],
      layout: 'statement',
      theme: 'dark'
    }
  ]
};

describe('shared artifact contracts', () => {
  it('accepts a real artifact shape', () => {
    expect(ArtifactDocumentSchema.parse(artifact).title).toBe('Internship Project Review');
  });

  it('accepts user-directed design and primary output settings', () => {
    const parsed = ArtifactDocumentSchema.parse({
      ...artifact,
      primaryFormat: 'pptx',
      design: {
        visualDirection: 'Editorial, high contrast, and spacious',
        headingFontFamily: 'Georgia',
        bodyFontFamily: 'Aptos',
        pageSize: 'letter',
        orientation: 'landscape',
        slideAspect: 'standard',
        density: 'airy',
        includeTableOfContents: false,
        includePageNumbers: false,
        showSectionNumbers: false,
        palette: {
          background: '#FFFDF7',
          surface: '#F1ECDD',
          text: '#171717',
          muted: '#67645E',
          primary: '#183A37',
          accent: '#D4A72C'
        }
      }
    });

    expect(parsed.primaryFormat).toBe('pptx');
    expect(parsed.design.headingFontFamily).toBe('Georgia');
    expect(parsed.design.palette?.accent).toBe('#D4A72C');
    expect(parsed.design.includePageNumbers).toBe(false);
    expect(parsed.slides?.[0]?.layout).toBe('statement');
    expect(parsed.slides?.[0]?.theme).toBe('dark');
  });

  it('accepts server-owned image assets and section or slide placement ids', () => {
    const parsed = ArtifactDocumentSchema.parse({
      ...artifact,
      assets: [{
        id: 'IMG1',
        mimeType: 'image/png',
        dataUri: 'data:image/png;base64,iVBORw0KGgo=',
        sourceUrl: 'https://example.com/image.png',
        sourcePageUrl: 'https://example.com/article',
        alt: 'Product launch image',
        attribution: 'example.com',
        width: 1200,
        height: 675
      }],
      sections: [{ ...artifact.sections[0], imageAssetId: 'IMG1' }],
      slides: [{ ...artifact.slides[0], imageAssetId: 'IMG1' }]
    });

    expect(parsed.assets[0]?.id).toBe('IMG1');
    expect(parsed.slides?.[0]?.imageAssetId).toBe('IMG1');
  });

  it('rejects malformed API keys', () => {
    const result = GenerateArtifactRequestSchema.safeParse({
      endpoint: 'http://127.0.0.1:8080',
      sessionKey: 'malformed_key_123456',
      model: 'swe-pro',
      skill: 'deck',
      style: 'professional',
      brief: 'Create a short deck for the weekly project review.'
    });

    expect(result.success).toBe(false);
  });

  it('accepts direct provider keys for server-side endpoint policy checks', () => {
    const result = GenerateArtifactRequestSchema.safeParse({
      endpoint: 'https://api.xiaomimimo.com',
      sessionKey: 'sk-testdirectproviderkey123456',
      model: 'mimo-v2.5-pro',
      skill: 'deck',
      skillId: 'ppt',
      style: 'professional',
      brief: 'Create a short deck for the weekly project review.'
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.skillId).toBe('ppt');
  });

  it('accepts Workbench wallet session keys', () => {
    const result = GenerateArtifactRequestSchema.safeParse({
      endpoint: 'http://127.0.0.1:8080',
      sessionKey: 'wb_test_workspace_wallet_1234567890',
      model: 'swe-pro',
      skill: 'report',
      style: 'professional',
      brief: 'Create a short report for the weekly project review.'
    });

    expect(result.success).toBe(true);
  });

  it('accepts bounded hidden thread ids on generation and refinement requests', () => {
    const generation = GenerateArtifactRequestSchema.safeParse({
      endpoint: 'http://127.0.0.1:8080',
      sessionKey: 'sess_test_workspace_1234567890',
      threadId: 'thread-123',
      researchApiKey: 'exa_test_key',
      model: 'swe-pro',
      skill: 'deck',
      style: 'professional',
      brief: 'Create a short deck for the weekly project review.',
      conversation: [
        { role: 'user', text: 'First create a report.' },
        { role: 'assistant', text: 'The report is ready.' }
      ],
      priorArtifacts: [artifact]
    });
    const refinement = RefineArtifactRequestSchema.safeParse({
      endpoint: 'http://127.0.0.1:8080',
      sessionKey: 'sess_test_workspace_1234567890',
      threadId: 'thread-123',
      researchApiKey: 'exa_test_key',
      model: 'swe-pro',
      instruction: 'Make the summary more direct.',
      artifact,
      conversation: [{ role: 'user', text: 'Keep the placement panel audience.' }]
    });

    expect(generation.success).toBe(true);
    expect(refinement.success).toBe(true);
    if (generation.success) expect(generation.data.priorArtifacts).toHaveLength(1);
  });

  it('accepts bounded file and URL references on generation requests', () => {
    const result = GenerateArtifactRequestSchema.safeParse({
      endpoint: 'http://127.0.0.1:8080',
      sessionKey: 'sess_test_workspace_1234567890',
      model: 'swe-pro',
      skill: 'report',
      style: 'professional',
      brief: 'Create a report using the attached reference.',
      references: [
        { kind: 'url', url: 'http://127.0.0.1:5174/source', name: 'Source link' },
        { kind: 'file', name: 'notes.txt', mimeType: 'text/plain', size: 12, dataBase64: Buffer.from('hello').toString('base64') }
      ]
    });

    expect(result.success).toBe(true);
  });

  it('rejects incomplete kind-specific artifacts', () => {
    const result = ArtifactDocumentSchema.safeParse({
      kind: 'deck',
      title: 'Deck Without Slides',
      audience: 'Students',
      tone: 'Professional',
      sections: [{ heading: 'Only Section', body: 'A deck needs real slides.' }]
    });

    expect(result.success).toBe(false);
  });

  it('renders markdown without mutating the artifact', () => {
    const parsed = ArtifactDocumentSchema.parse(artifact);
    const markdown = artifactToMarkdown(parsed);

    expect(markdown).toContain('# Internship Project Review');
    expect(markdown).toContain('## Slides');
    expect(parsed.sections).toHaveLength(1);
  });

  it('resolves known @skill tags and aliases', () => {
    expect(resolveSkillFromText('@ppt create a college deck')?.kind).toBe('deck');
    expect(resolveSkillFromText('please make @pdf from these notes')?.kind).toBe('report');
    expect(resolveSkillFromText('@excel clean this table')?.kind).toBe('sheet');
    expect(resolveSkillFromText('@word create an editable policy document')?.primaryOutput).toBe('docx');
  });

  it('strips skill tags without removing user content', () => {
    expect(stripSkillTags('@ppt create a 7 slide deck')).toBe('create a 7 slide deck');
  });
});
