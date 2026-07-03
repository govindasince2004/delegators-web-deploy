import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { parseArtifactCandidate } from '../server/artifactRepair';
import { buildExport } from '../server/exporters';
import { applyDocumentDesign } from '../server/documentComposition';
import { stabilizeDeckComposition } from '../server/deckComposition';
import {
  briefIsExplicit,
  outlineSchemaForKind,
  shouldUseStructuredPipeline
} from '../server/artifactPipeline';
import { buildArtifactPlan } from '../server/artifactPlan';
import { skillCatalog } from '../src/lib/skills';
import { ArtifactDocumentSchema } from '../src/lib/shared';

function baseArtifact(kind: string, primaryFormat: string) {
  return {
    kind,
    primaryFormat,
    title: 'Production Artifact',
    audience: 'Stakeholders',
    tone: 'professional',
    executiveSummary: 'A concise executive summary with one clear bottom line.',
    sections: [{
      heading: 'Core insight',
      body: 'Evidence-backed analysis with calibrated claims.',
      bullets: ['One supported point', 'One implication']
    }],
    citations: [{ id: 'S1', label: 'Official source', url: 'https://example.com/source' }],
    nextQuestions: []
  };
}

const skillFixtures: Record<string, Record<string, unknown>> = {
  ppt: {
    ...baseArtifact('deck', 'pptx'),
    slides: [
      { title: 'Thesis in one line', bullets: ['Bottom line up front'], layout: 'cover', theme: 'dark', role: 'opener' },
      { title: 'Evidence changes the decision', bullets: ['Metric one', 'Metric two'], layout: 'metric', theme: 'light', role: 'evidence', metrics: [{ value: '38%', label: 'improvement' }] },
      { title: 'Approve the next move', bullets: ['Named owner', '90-day plan'], layout: 'statement', theme: 'dark', role: 'close' }
    ]
  },
  pdf: baseArtifact('report', 'pdf'),
  word: baseArtifact('report', 'docx'),
  resume: {
    ...baseArtifact('resume', 'docx'),
    resume: {
      name: 'Maya Rao',
      headline: 'Platform Engineer',
      contact: ['maya@example.com'],
      summary: 'Backend engineer with API platform experience.',
      skills: ['Go', 'Postgres'],
      experience: [{ heading: 'Platform Engineer | Acme', body: '2022 - Present', bullets: ['Built metered APIs.'] }],
      education: [{ heading: 'B.Tech | State University', body: '2020', bullets: [] }]
    }
  },
  'cover-letter': {
    ...baseArtifact('resume', 'docx'),
    title: 'Cover Letter',
    resume: {
      name: 'Maya Rao',
      headline: 'Application for Platform Engineer',
      contact: ['maya@example.com'],
      summary: 'I am applying for the Platform Engineer role using only supplied facts.',
      skills: [],
      experience: [],
      education: []
    }
  },
  assignment: baseArtifact('assignment', 'docx'),
  project: baseArtifact('report', 'pdf'),
  email: {
    ...baseArtifact('email', 'docx'),
    title: 'Maintenance notice',
    sections: [{ heading: 'Email', body: 'Planned maintenance this weekend.', bullets: ['Window: Saturday 2am-4am'] }]
  },
  xlsx: {
    ...baseArtifact('sheet', 'xlsx'),
    sheet: {
      sheets: [{
        name: 'Forecast',
        columns: ['Month', 'Revenue'],
        rows: [['Jan', '1200'], ['Feb', '1400']]
      }]
    }
  },
  proposal: baseArtifact('report', 'docx'),
  sop: baseArtifact('report', 'docx')
};

describe('artifact catalog — every @skill', () => {
  it('maps every skill to the correct kind and primary output', () => {
    expect(skillCatalog).toHaveLength(11);
    for (const skill of skillCatalog) {
      expect(skill.primaryOutput).toBeTruthy();
      expect(skill.outputs).toContain(skill.primaryOutput);
    }
    expect(skillCatalog.find((skill) => skill.id === 'ppt')?.primaryOutput).toBe('pptx');
    expect(skillCatalog.find((skill) => skill.id === 'xlsx')?.primaryOutput).toBe('xlsx');
    expect(skillCatalog.find((skill) => skill.id === 'pdf')?.primaryOutput).toBe('pdf');
  });

  it('locks each skill primary format even when the model returns the wrong one', () => {
    for (const skill of skillCatalog) {
      const wrongFormat = skill.primaryOutput === 'pdf' ? 'docx' : 'pdf';
      const parsed = parseArtifactCandidate({
        ...skillFixtures[skill.id],
        kind: skill.kind === 'deck' ? 'report' : skill.kind,
        primaryFormat: wrongFormat
      }, {
        expectedKind: skill.kind,
        expectedPrimaryFormat: skill.primaryOutput
      });
      expect(parsed.success, `${skill.tag} should parse`).toBe(true);
      if (!parsed.success) continue;
      expect(parsed.data.kind).toBe(skill.kind);
      expect(parsed.data.primaryFormat).toBe(skill.primaryOutput);
    }
  });

  it('exports a native primary file for every skill fixture', async () => {
    for (const skill of skillCatalog) {
      const raw = skillFixtures[skill.id];
      const artifact = ArtifactDocumentSchema.parse({
        ...raw,
        kind: skill.kind,
        primaryFormat: skill.primaryOutput
      });
      const stabilized = skill.kind === 'deck'
        ? stabilizeDeckComposition(artifact, `${skill.tag} investor briefing`)
        : applyDocumentDesign(artifact, `${skill.tag} production document`);

      const exported = await buildExport(stabilized, skill.primaryOutput);
      expect(exported.filename.endsWith(`.${skill.primaryOutput}`), `${skill.tag} filename`).toBe(true);
      expect(exported.body.byteLength, `${skill.tag} body`).toBeGreaterThan(120);

      if (skill.primaryOutput === 'pptx') {
        const zip = await JSZip.loadAsync(exported.body);
        const slides = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
        expect(slides.length).toBeGreaterThan(0);
      }
      if (skill.primaryOutput === 'xlsx') {
        const workbook = new ExcelJS.Workbook();
        // ExcelJS types target an older Buffer shape; @types/node v24's generic
        // Buffer<ArrayBufferLike> is a runtime-valid buffer but not structurally
        // assignable to it (Symbol.toStringTag invariance). Cast at the boundary.
        await workbook.xlsx.load(exported.body as unknown as Parameters<typeof workbook.xlsx.load>[0]);
        expect(workbook.worksheets.length).toBeGreaterThan(0);
      }
      if (skill.primaryOutput === 'docx') {
        const zip = await JSZip.loadAsync(exported.body);
        expect(zip.file('word/document.xml')).toBeTruthy();
      }
      if (skill.primaryOutput === 'pdf') {
        expect(exported.body.toString('latin1')).toContain('%PDF');
      }
    }
  });

  it('routes production kinds through the phased structured pipeline', () => {
    expect(shouldUseStructuredPipeline('deck', '@ppt 12-slide investor deck')).toBe(true);
    expect(shouldUseStructuredPipeline('report', '@pdf quarterly operations review')).toBe(true);
    expect(shouldUseStructuredPipeline('sheet', '@xlsx hiring budget workbook')).toBe(true);
    expect(shouldUseStructuredPipeline('resume', '@resume Maya Rao experience education skills projects')).toBe(true);
    expect(shouldUseStructuredPipeline('email', 'thanks')).toBe(false);
    expect(shouldUseStructuredPipeline('sheet', '@xlsx calculate forecast from this CSV dataset')).toBe(false);
  });

  it('builds phased plans with outline and inspect/export stages', () => {
    const deckPlan = buildArtifactPlan('deck', '12-slide investor deck', true, { structured: true });
    expect(deckPlan.items.map((item) => item.id)).toEqual(['shape', 'sources', 'outline', 'build', 'finish']);
    expect(deckPlan.items[2]?.label).toContain('Outline');
    expect(deckPlan.items.at(-1)?.label).toContain('Inspect & export');
  });

  it('provides kind-specific outline schemas for every production artifact type', () => {
    expect(outlineSchemaForKind('deck')).toContain('slides');
    expect(outlineSchemaForKind('sheet')).toContain('sheets');
    expect(outlineSchemaForKind('resume')).toContain('resumePlan');
    expect(outlineSchemaForKind('email')).toContain('emailPlan');
    expect(outlineSchemaForKind('report')).toContain('sections');
  });

  it('treats explicit multi-rule briefs as pipeline-fast-path eligible', () => {
    const brief = [
      'Create a 12-slide investor deck.',
      'Hard rules:',
      '1. Use latest web research.',
      '2. Every claim needs a source.',
      '3. Use real images.',
      '4. Export PPTX.'
    ].join('\n');
    expect(briefIsExplicit(brief, 'deck')).toBe(true);
  });
});