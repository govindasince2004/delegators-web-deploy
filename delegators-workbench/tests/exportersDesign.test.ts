import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildExport, pdfSafeText } from '../server/exporters';
import { ArtifactDocumentSchema } from '../src/lib/shared';

const artifact = ArtifactDocumentSchema.parse({
  kind: 'deck',
  primaryFormat: 'pptx',
  title: 'Custom Design Review',
  audience: 'Design leadership',
  tone: 'editorial',
  executiveSummary: 'A concise review using the requested document system.',
  sections: [{
    heading: 'Evidence',
    body: 'The artifact keeps user-selected typography and page setup.',
    bullets: ['Verified rendering', 'Editable output'],
    table: {
      columns: ['Metric', 'Value'],
      rows: [['Coverage', '100'], ['Formula', '=1+1']]
    }
  }],
  slides: [{
    title: 'Evidence',
    subtitle: 'User direction',
    bullets: ['Verified rendering', 'Editable output'],
    layout: 'split',
    theme: 'dark'
  }],
  sheet: {
    sheets: [{
      name: 'Metrics',
      columns: ['Metric', 'Value'],
      rows: [['Coverage', '100'], ['Formula', '=1+1']]
    }]
  },
  citations: [],
  nextQuestions: ['This belongs in chat, not in the exported artifact.'],
  design: {
    headingFontFamily: 'Georgia',
    bodyFontFamily: 'Garamond',
    pageSize: 'letter',
    orientation: 'landscape',
    slideAspect: 'standard',
    density: 'airy',
    includeTableOfContents: false,
    includePageNumbers: false,
    showSectionNumbers: false,
    palette: {
      background: '#f4f1e8',
      surface: '#dce7e3',
      text: '#17211f',
      muted: '#5f6c68',
      primary: '#174f45',
      accent: '#d85f3f'
    }
  }
});

describe('artifact export design fidelity', () => {
  it('preserves user typography, palette, and page setup in DOCX', async () => {
    const exported = await buildExport(artifact, 'docx');
    const zip = await JSZip.loadAsync(exported.body);
    const styles = await zip.file('word/styles.xml')!.async('string');
    const document = await zip.file('word/document.xml')!.async('string');

    expect(styles).toContain('Georgia');
    expect(styles).toContain('Garamond');
    expect(styles).toContain('174F45');
    expect(document).toMatch(/w:orient="landscape"/);
    expect(document).not.toContain('w:footerReference');
    expect(document).not.toContain('This belongs in chat');
  });

  it('exports structured resume experience, projects, and education to DOCX', async () => {
    const resume = ArtifactDocumentSchema.parse({
      ...artifact,
      kind: 'resume',
      primaryFormat: 'docx',
      slides: undefined,
      title: 'Maya Rao',
      executiveSummary: '',
      sections: [{ heading: 'Profile', body: 'Structured resume data follows.', bullets: [] }],
      resume: {
        name: 'Maya Rao',
        headline: 'AI Product Leader',
        contact: ['maya@example.com'],
        summary: 'Enterprise product leader with measurable operating impact.',
        skills: ['AI product strategy', 'Platform APIs'],
        experience: [{ heading: 'Director of Product | Northstar Systems', body: '2022 - Present', bullets: ['Delivered $12M in annualized customer value.'] }],
        projects: [{ heading: 'Evaluation Playbook', body: '2025', bullets: ['Used by six product teams.'] }],
        education: [{ heading: 'MBA | Indian School of Business', body: '2015', bullets: [] }]
      }
    });
    const exported = await buildExport(resume, 'docx');
    const zip = await JSZip.loadAsync(exported.body);
    const document = await zip.file('word/document.xml')!.async('string');

    expect(document).toContain('Director of Product | Northstar Systems');
    expect(document).toContain('Delivered $12M in annualized customer value.');
    expect(document).toContain('Evaluation Playbook');
    expect(document).toContain('MBA | Indian School of Business');
    expect(document).not.toContain('Resume Profile');
  });

  it('uses the requested 4:3 layout, fonts, and palette in PPTX', async () => {
    const exported = await buildExport(artifact, 'pptx');
    const zip = await JSZip.loadAsync(exported.body);
    const presentation = await zip.file('ppt/presentation.xml')!.async('string');
    const theme = await zip.file('ppt/theme/theme1.xml')!.async('string');
    const firstSlide = await zip.file('ppt/slides/slide1.xml')!.async('string');
    const slideFiles = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));

    expect(slideFiles).toHaveLength(artifact.slides?.length ?? 0);
    expect(presentation).toContain('cx="9144000"');
    expect(presentation).toContain('cy="6858000"');
    expect(theme).toContain('Georgia');
    expect(theme).toContain('Garamond');
    expect(firstSlide).toContain('174F45');
  });

  it('renders traceable source IDs and appends dedicated sources appendix slides', async () => {
    const researched = ArtifactDocumentSchema.parse({
      ...artifact,
      sections: [{
        ...artifact.sections[0],
        sourceIds: ['S1']
      }],
      slides: [{
        ...artifact.slides![0],
        sourceIds: ['S1']
      }],
      citations: [{
        id: 'S1',
        label: 'Official research report',
        url: 'https://example.com/research'
      }]
    });

    const exported = await buildExport(researched, 'pptx');
    const zip = await JSZip.loadAsync(exported.body);
    const slideFiles = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
    expect(slideFiles).toHaveLength(3);
    const firstSlide = await zip.file('ppt/slides/slide1.xml')!.async('string');
    const sourcesSlide = await zip.file('ppt/slides/slide2.xml')!.async('string');
    expect(firstSlide).toContain('Sources: S1');
    expect(sourcesSlide).toContain('Sources');
    expect(sourcesSlide).toContain('S1:');
    const notes = await zip.file('ppt/notesSlides/notesSlide1.xml')!.async('string');
    expect(notes).toContain('Official research report');
    expect(notes).toContain('https://example.com/research');
  });

  it('uses model-selected slide themes instead of an index-based color sequence', async () => {
    const themed = ArtifactDocumentSchema.parse({
      ...artifact,
      slides: [
        { title: 'Opening', bullets: ['One clear statement'], layout: 'statement', theme: 'light' },
        { title: 'Evidence', bullets: ['Signal one', 'Signal two', 'Signal three'], layout: 'list', theme: 'accent' },
        { title: 'Decision', subtitle: 'Choose the operating model', bullets: ['Option A', 'Option B'], layout: 'split', theme: 'dark' }
      ]
    });
    const exported = await buildExport(themed, 'pptx');
    const zip = await JSZip.loadAsync(exported.body);
    const lightSlide = await zip.file('ppt/slides/slide1.xml')!.async('string');
    const accentSlide = await zip.file('ppt/slides/slide2.xml')!.async('string');
    const darkSlide = await zip.file('ppt/slides/slide3.xml')!.async('string');

    expect(lightSlide).toContain('F4F1E8');
    expect(accentSlide).toContain('D85F3F');
    expect(darkSlide).toContain('174F45');
  });

  it('treats the first statement slide as a cover and emits native bullet paragraphs', async () => {
    const deck = ArtifactDocumentSchema.parse({
      ...artifact,
      slides: [
        {
          title: 'Operating model',
          subtitle: 'From pilots to a compounding portfolio',
          bullets: ['Decision framework for the next 18 months'],
          layout: 'statement',
          theme: 'dark'
        },
        {
          title: 'The evidence',
          bullets: ['Weekly adoption is concentrated', 'Shared services lower launch cost'],
          layout: 'list',
          theme: 'light'
        }
      ]
    });
    const exported = await buildExport(deck, 'pptx');
    const zip = await JSZip.loadAsync(exported.body);
    const cover = await zip.file('ppt/slides/slide1.xml')!.async('string');
    const evidence = await zip.file('ppt/slides/slide2.xml')!.async('string');

    expect(cover).not.toContain('<a:t>01</a:t>');
    expect(cover).not.toContain('<a:t>- Decision framework');
    expect(evidence).toContain('<a:buChar char="&#x2022;"/>');
    expect(evidence).not.toContain('<a:t>- Weekly adoption');
  });

  it('separates leading metrics from their card labels', async () => {
    const deck = ArtifactDocumentSchema.parse({
      ...artifact,
      slides: [{
        title: 'Portfolio signals',
        bullets: ['$18M annualized value pool', '90-day workflow release cycle', 'One portfolio scorecard'],
        layout: 'grid',
        theme: 'accent'
      }]
    });
    const exported = await buildExport(deck, 'pptx');
    const zip = await JSZip.loadAsync(exported.body);
    const slide = await zip.file('ppt/slides/slide1.xml')!.async('string');

    expect(slide).toContain('<a:t>$18M</a:t>');
    expect(slide).toContain('<a:t>annualized value pool</a:t>');
    expect(slide).not.toContain('<a:t>$18M annualized value pool</a:t>');
  });

  it('renders structured metric, comparison, process, and quote slides as native PowerPoint content', async () => {
    const deck = ArtifactDocumentSchema.parse({
      ...artifact,
      slides: [
        {
          title: 'Operating leverage is visible',
          layout: 'metric',
          metrics: [
            { value: '38%', label: 'cycle-time reduction', detail: 'after workflow consolidation' },
            { value: '2.4x', label: 'review throughput' }
          ],
          takeaway: 'The operating model improves both speed and control.'
        },
        {
          title: 'The target model removes coordination debt',
          layout: 'comparison',
          columns: [
            { heading: 'Before', body: 'Fragmented execution', bullets: ['Four owners', 'Manual reporting'] },
            { heading: 'After', body: 'Governed execution', bullets: ['One owner', 'Live scorecard'] }
          ]
        },
        {
          title: 'Move through four deliberate gates',
          layout: 'process',
          bullets: ['Frame the decision', 'Validate evidence', 'Commit resources', 'Scale the winner']
        },
        {
          title: 'The governing principle',
          layout: 'quote',
          quote: 'Speed without control is merely faster drift.',
          quoteAttribution: 'Operating review'
        }
      ]
    });
    const exported = await buildExport(deck, 'pptx');
    const zip = await JSZip.loadAsync(exported.body);
    const xml = await Promise.all(
      [1, 2, 3, 4].map((index) => zip.file(`ppt/slides/slide${index}.xml`)!.async('string'))
    );

    expect(xml[0]).toContain('<a:t>38%</a:t>');
    expect(xml[0]).toContain('<a:t>cycle-time reduction</a:t>');
    expect(xml[1]).toContain('<a:t>Before</a:t>');
    expect(xml[1]).toContain('<a:t>After</a:t>');
    expect(xml[2]).toContain('<a:t>01</a:t>');
    expect(xml[2]).toContain('<a:t>Scale the winner</a:t>');
    expect(xml[3]).toContain('Speed without control is merely faster drift.');
  });

  it('embeds attributed research images in PPTX and slide-shaped PDF exports', async () => {
    const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKAQMAAAC3/F3+AAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAAGUExURf8AAP///0EdNBEAAAABYktHRAH/Ai3eAAAAB3RJTUUH6gYOETEOKJXzJQAAAAtJREFUCNdjYMAHAAAeAAFuhUcyAAAAAElFTkSuQmCC';
    const visual = ArtifactDocumentSchema.parse({
      ...artifact,
      assets: [{
        id: 'IMG1',
        mimeType: 'image/png',
        dataUri,
        sourceUrl: 'https://example.com/launch.png',
        sourcePageUrl: 'https://example.com/news/launch',
        alt: 'Launch stage',
        attribution: 'example.com',
        width: 1200,
        height: 675
      }],
      slides: [{
        title: 'Evidence',
        bullets: ['Official launch visual', 'Source-attributed media'],
        imageAssetId: 'IMG1'
      }]
    });

    const pptx = await buildExport(visual, 'pptx');
    const zip = await JSZip.loadAsync(pptx.body);
    expect(Object.keys(zip.files).some((name) => /^ppt\/media\/image[^/]*\.png$/.test(name))).toBe(true);
    expect(await zip.file('ppt/slides/slide1.xml')!.async('string')).toContain('example.com');

    const pdf = await buildExport(visual, 'pdf');
    expect(pdf.body.toString('latin1')).toContain('/Subtype /Image');
  });

  it('exports presentations to slide-shaped PDF pages instead of a report layout', async () => {
    const deck = ArtifactDocumentSchema.parse({
      ...artifact,
      design: { ...artifact.design, slideAspect: 'wide' },
      slides: [
        { title: 'Opening', bullets: ['One clear statement'], layout: 'statement', theme: 'dark' },
        { title: 'Evidence', bullets: ['Signal one', 'Signal two', 'Signal three'], layout: 'list', theme: 'light' },
        { title: 'Decision', bullets: ['Option A', 'Option B', 'Option C', 'Option D'], layout: 'grid', theme: 'accent' }
      ]
    });
    const exported = await buildExport(deck, 'pdf');
    const pdf = exported.body.toString('latin1');

    expect((pdf.match(/\/Type \/Page\b/g) ?? [])).toHaveLength(3);
    expect(pdf).toMatch(/\/MediaBox \[0 0 960\.? 540\.?\]/);
  });

  it('exports long reports as real multi-page PDFs', async () => {
    const report = ArtifactDocumentSchema.parse({
      ...artifact,
      kind: 'report',
      primaryFormat: 'pdf',
      slides: undefined,
      title: 'Multi-page operating review',
      design: { ...artifact.design, pageSize: 'a4', orientation: 'portrait', includePageNumbers: true },
      sections: Array.from({ length: 8 }, (_, index) => ({
        heading: `Section ${index + 1}`,
        body: Array.from({ length: 12 }, () =>
          `This section preserves detailed evidence, implications, ownership, and decisions for workstream ${index + 1}.`
        ).join(' '),
        bullets: Array.from({ length: 5 }, (_, bullet) => `Decision point ${bullet + 1} for section ${index + 1}.`)
      }))
    });

    const exported = await buildExport(report, 'pdf');
    const pdf = exported.body.toString('latin1');
    expect((pdf.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('keeps slide tables in deck PDF exports', async () => {
    const deck = ArtifactDocumentSchema.parse({
      ...artifact,
      slides: [{
        title: 'Decisions',
        subtitle: 'Approve the next 90 days',
        bullets: ['Name the portfolio owner'],
        layout: 'list',
        table: {
          columns: ['Decision', 'Owner'],
          rows: [['Portfolio charter', 'COO']]
        }
      }]
    });
    const exported = await buildExport(deck, 'pdf');
    const pdf = exported.body.toString('latin1');

    expect(pdf).toContain('(Portfolio charter)');
    expect(pdf).toContain('(COO)');
  });

  it('normalizes symbols unsupported by the built-in PDF fonts', () => {
    expect(pdfSafeText('₹25 crore, ≥120% NRR, ≤2% churn → approved ✓')).toBe(
      'INR 25 crore, >=120% NRR, <=2% churn -> approved yes'
    );
  });

  it('preserves requested spreadsheet fonts and colors in XLSX', async () => {
    const exported = await buildExport(artifact, 'xlsx');
    const zip = await JSZip.loadAsync(exported.body);
    const styles = await zip.file('xl/styles.xml')!.async('string');

    expect(styles).toContain('Georgia');
    expect(styles).toContain('Garamond');
    expect(styles).toContain('FF174F45');
    expect(styles).toContain('FF17211F');
  });

  it('formats spreadsheets as working models with clear inputs, formulas, and print setup', async () => {
    const model = ArtifactDocumentSchema.parse({
      ...artifact,
      kind: 'sheet',
      primaryFormat: 'xlsx',
      slides: undefined,
      sheet: {
        sheets: [{
          name: 'Plan',
          columns: ['Item', 'Owner', 'Users', 'Cost USD', 'Growth %', 'Decision', 'Net value USD'],
          rows: [['Workflow A', 'Finance', '420', '120000', '18', 'Scale', '=C2*D2']]
        }]
      }
    });
    const exported = await buildExport(model, 'xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(exported.body as unknown as ArrayBuffer);
    const worksheet = workbook.getWorksheet('Plan')!;

    expect(worksheet.getCell('C2').font.color?.argb).toBe('FF0000FF');
    expect(worksheet.getCell('G2').font.color?.argb).toBe('FF000000');
    expect(worksheet.pageSetup.orientation).toBe('landscape');
    expect(worksheet.pageSetup.fitToPage).toBe(true);
    expect(worksheet.headerFooter.oddHeader).toContain('Plan');
  });
});
