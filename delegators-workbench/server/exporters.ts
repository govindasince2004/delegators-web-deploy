import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType
} from 'docx';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import * as PptxGenJSImport from 'pptxgenjs';
import { artifactToMarkdown } from '../src/lib/markdown.js';
import { buildDocumentHtml, htmlRendererAvailable, renderHtmlPdf } from './htmlRenderer.js';
import {
  addPptxSourcesSlides,
  enrichArtifactForExport,
  exportClaimText,
  formattedCitationLine,
  methodologyBody,
  methodologyBullets,
  orderedCitationsForExport
} from './citationExport.js';
import type {
  ArtifactAsset,
  ArtifactChart,
  ArtifactDesign,
  ArtifactDocument,
  ArtifactExportFormat,
  ArtifactSection,
  Slide
} from '../src/lib/shared.js';

type PptxSlide = {
  background?: { color: string };
  addText: (text: string | Array<{ text: string; options?: Record<string, unknown> }>, options: Record<string, unknown>) => void;
  addShape: (shape: string, options: Record<string, unknown>) => void;
  addImage: (options: Record<string, unknown>) => void;
  addChart: (type: string, data: Array<{ name: string; labels: string[]; values: number[] }>, options: Record<string, unknown>) => void;
  addTable: (rows: unknown[][], options: Record<string, unknown>) => void;
  addNotes: (notes: string) => void;
};

type PptxPresentation = {
  layout: string;
  author: string;
  subject: string;
  title: string;
  company: string;
  theme: Record<string, string>;
  ShapeType: { line: string; rect: string; roundRect: string; ellipse: string };
  ChartType: { bar: string; line: string; area: string; pie: string; doughnut: string };
  addSlide: () => PptxSlide;
  write: (options: { outputType: 'nodebuffer' }) => Promise<Buffer | Uint8Array | ArrayBuffer | string>;
};

const PptxGenJS = resolvePptxConstructor();

type ExportedFile = {
  filename: string;
  contentType: string;
  body: Buffer;
};

type ResolvedDesign = {
  headingFont: string;
  bodyFont: string;
  pageSize: 'a4' | 'letter' | 'legal';
  orientation: 'portrait' | 'landscape';
  slideAspect: 'wide' | 'standard';
  density: 'compact' | 'balanced' | 'airy';
  includeTableOfContents: boolean;
  includePageNumbers: boolean;
  showSectionNumbers: boolean;
  background: string;
  surface: string;
  text: string;
  muted: string;
  primary: string;
  accent: string;
};

function resolvePptxConstructor(): new () => PptxPresentation {
  const moduleValue = PptxGenJSImport as unknown as {
    default?: unknown;
  };
  const nestedDefault = moduleValue.default && typeof moduleValue.default === 'object'
    ? (moduleValue.default as { default?: unknown }).default
    : undefined;
  for (const candidate of [moduleValue.default, nestedDefault, PptxGenJSImport]) {
    if (typeof candidate === 'function') {
      return candidate as new () => PptxPresentation;
    }
  }
  throw new Error('PptxGenJS constructor is unavailable.');
}

export async function buildExport(artifact: ArtifactDocument, format: ArtifactExportFormat): Promise<ExportedFile> {
  const exportArtifact = enrichArtifactForExport(artifact);
  if (format === 'pdf') {
    return file(exportArtifact, 'pdf', 'application/pdf', await buildBestPdfBuffer(exportArtifact));
  }
  if (format === 'docx') {
    return file(
      exportArtifact,
      'docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      await buildDocxBuffer(exportArtifact)
    );
  }
  if (format === 'pptx') {
    if (exportArtifact.kind !== 'deck' && !exportArtifact.slides?.length) {
      throw new Error('PPTX export is only available for deck artifacts or artifacts with slides.');
    }
    return file(
      exportArtifact,
      'pptx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      await buildPptxBuffer(exportArtifact)
    );
  }
  if (format === 'xlsx') {
    if (!hasTabularData(exportArtifact)) {
      throw new Error('XLSX export is only available for spreadsheet artifacts.');
    }
    return file(
      artifact,
      'xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      await buildXlsxBuffer(artifact)
    );
  }

  return file(artifact, 'zip', 'application/zip', await buildZipBuffer(artifact));
}

async function file(
  artifact: ArtifactDocument,
  extension: string,
  contentType: string,
  body: Buffer
): Promise<ExportedFile> {
  await validateExportBuffer(extension as ArtifactExportFormat, body);
  return {
    filename: `${fileBase(artifact)}.${extension}`,
    contentType,
    body
  };
}

export async function validateExportBuffer(format: ArtifactExportFormat, body: Buffer): Promise<void> {
  if (body.byteLength < 100) throw new Error(`${format.toUpperCase()} export is unexpectedly small.`);
  if (format === 'pdf') {
    if (body.subarray(0, 5).toString('utf8') !== '%PDF-') {
      throw new Error('PDF export has an invalid file signature.');
    }
    return;
  }

  const zip = await JSZip.loadAsync(body).catch(() => null);
  if (!zip) throw new Error(`${format.toUpperCase()} export is not a valid ZIP container.`);
  const requiredEntries: Record<Exclude<ArtifactExportFormat, 'pdf'>, string[]> = {
    docx: ['[Content_Types].xml', 'word/document.xml'],
    pptx: ['[Content_Types].xml', 'ppt/presentation.xml', 'ppt/slides/slide1.xml'],
    xlsx: ['[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml'],
    zip: []
  };
  const missing = requiredEntries[format as Exclude<ArtifactExportFormat, 'pdf'>]
    .filter((entry) => !zip.file(entry));
  if (missing.length > 0) {
    throw new Error(`${format.toUpperCase()} export is missing ${missing.join(', ')}.`);
  }
}

// Document PDFs (report/assignment/email/resume) go through the Chromium HTML
// renderer when a browser is available — real typography and layout, the level
// the peak references set. Decks keep the native slide renderer, and any
// renderer failure falls back to the jsPDF path so exports never hard-fail.
async function buildBestPdfBuffer(artifact: ArtifactDocument): Promise<Buffer> {
  const htmlKinds: ArtifactDocument['kind'][] = ['report', 'assignment', 'email', 'resume'];
  if (!artifact.slides?.length && htmlKinds.includes(artifact.kind) && htmlRendererAvailable()) {
    try {
      const design = resolveDesign(artifact.design);
      return await renderHtmlPdf(buildDocumentHtml(artifact, design), design);
    } catch (error) {
      console.error('[workbench] HTML PDF renderer failed; falling back to vector renderer', error instanceof Error ? error.message : error);
    }
  }
  return buildPdfBuffer(artifact);
}

function buildPdfBuffer(artifact: ArtifactDocument): Buffer {
  if (artifact.slides?.length) return buildDeckPdfBuffer(artifact);
  const design = resolveDesign(artifact.design);
  const doc = new jsPDF({ unit: 'pt', format: design.pageSize, orientation: design.orientation });
  const margin = design.density === 'compact' ? 38 : design.density === 'airy' ? 58 : 48;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  let y = margin;

  doc.setTextColor(design.text);
  doc.setFont(pdfFont(design.headingFont), 'bold');
  doc.setFontSize(20);
  y = writeWrapped(doc, artifact.title, margin, y, width, 24);

  doc.setTextColor(design.muted);
  doc.setFont(pdfFont(design.bodyFont), 'normal');
  doc.setFontSize(10);
  y = writeWrapped(doc, `${artifact.audience} | ${artifact.tone}`, margin, y + 8, width, 14);
  doc.setTextColor(design.text);

  if (artifact.resume) {
    y = writeHeading(doc, 'Resume Profile', margin, y + 18, design);
    if (artifact.resume.name) y = writeWrapped(doc, artifact.resume.name, margin, y, width, 14);
    if (artifact.resume.headline) y = writeWrapped(doc, artifact.resume.headline, margin, y, width, 14);
    if (artifact.resume.contact.length) y = writeWrapped(doc, artifact.resume.contact.join(' | '), margin, y, width, 14);
    if (artifact.resume.summary) y = writeWrapped(doc, artifact.resume.summary, margin, y + 4, width, 14);
    if (artifact.resume.skills.length) y = writeWrapped(doc, `Skills: ${artifact.resume.skills.join(', ')}`, margin, y + 4, width, 14);
  }

  if (artifact.executiveSummary) {
    y = writeHeading(doc, 'Summary', margin, y + 18, design);
    y = writeWrapped(doc, artifact.executiveSummary, margin, y, width, 14);
  }

  for (const section of artifact.sections) {
    y = ensureRoom(doc, y, 100, margin);
    y = writeHeading(doc, section.heading, margin, y + 16, design);
    if (section.body) y = writeWrapped(doc, section.body, margin, y, width, 14);
    const sectionImage = assetById(artifact, section.imageAssetId);
    if (sectionImage) {
      y = ensureRoom(doc, y, 240, margin);
      if (addPdfImage(doc, sectionImage, margin, y + 8, width, 205)) {
        y += 218;
        doc.setFont(pdfFont(design.bodyFont), 'normal');
        doc.setFontSize(7);
        doc.setTextColor(design.muted);
        y = writeWrapped(doc, `Source: ${sectionImage.attribution}`, margin, y, width, 10);
        doc.setTextColor(design.text);
      }
    }
    for (const bullet of section.bullets) {
      y = writeWrapped(doc, `- ${bullet}`, margin + 10, y + 4, width - 10, 14);
    }
    if (section.table) {
      y = writePdfTable(doc, section.table, margin, y + 10, width, design);
    }
    if (section.chart) {
      const chartHeight = 190;
      y = ensureRoom(doc, y, chartHeight + 24, margin);
      drawPdfChart(doc, section.chart, margin, y + 8, width, chartHeight, design, design.text);
      y += chartHeight + 18;
    }
    if (section.sourceIds?.length) {
      doc.setFontSize(7);
      doc.setTextColor(design.muted);
      y = writeWrapped(doc, `Sources: ${section.sourceIds.join(', ')}`, margin, y + 4, width, 10);
      doc.setTextColor(design.text);
    }
  }

  const exportCitations = orderedCitationsForExport(artifact);
  if (exportCitations.length > 0) {
    y = ensureRoom(doc, y, 120, margin);
    y = writeHeading(doc, 'Methodology & limitations', margin, y + 16, design);
    y = writeWrapped(doc, methodologyBody(), margin, y, width, 14);
    for (const bullet of methodologyBullets()) {
      y = writeWrapped(doc, `- ${bullet}`, margin + 10, y + 4, width - 10, 14);
    }
    y = writeHeading(doc, 'Sources', margin, y + 16, design);
    for (const citation of exportCitations) {
      y = writeWrapped(doc, `- ${formattedCitationLine(citation)}`, margin + 10, y + 4, width - 10, 14);
    }
  }

  if (design.includePageNumbers) {
    const pageCount = doc.getNumberOfPages();
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      doc.setPage(pageNumber);
      doc.setFont(pdfFont(design.bodyFont), 'normal');
      doc.setFontSize(8);
      doc.setTextColor(design.muted);
      doc.text(String(pageNumber), doc.internal.pageSize.getWidth() - margin, doc.internal.pageSize.getHeight() - margin / 2, { align: 'right' });
    }
  }

  return Buffer.from(doc.output('arraybuffer'));
}

function buildDeckPdfBuffer(artifact: ArtifactDocument): Buffer {
  const design = resolveDesign(artifact.design);
  const format: [number, number] = design.slideAspect === 'standard' ? [720, 540] : [960, 540];
  const doc = new jsPDF({ unit: 'pt', format, orientation: 'landscape' });
  const slides = artifact.slides ?? [];

  slides.forEach((slide, index) => {
    if (index > 0) doc.addPage(format, 'landscape');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const theme = slide.theme ?? 'light';
    const background = theme === 'dark' ? design.primary : theme === 'accent' ? design.accent : design.background;
    const text = theme === 'light' ? design.text : contrastHex(background, design.background, design.text);
    const surface = theme === 'light' ? design.surface : mixHex(background, text, 0.14);
    const highlight = theme === 'light' ? design.primary : text;
    const layout = resolveSlideLayout(slide);
    const cover = index === 0 && (layout === 'cover' || layout === 'statement');
    const imageAsset = assetById(artifact, slide.imageAssetId);

    doc.setFillColor(`#${background}`);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    if (cover) {
      doc.setFillColor(`#${design.accent}`);
      doc.circle(pageWidth - 60, -26, 132, 'F');
      doc.rect(58, 54, 42, 4, 'F');
    } else {
      doc.setFont(pdfFont(design.bodyFont), 'bold');
      doc.setFontSize(9);
      doc.setTextColor(`#${theme === 'light' ? design.accent : text}`);
      doc.text(String(index + 1).padStart(2, '0'), pageWidth - 46, 34, { align: 'right' });

      doc.setFont(pdfFont(design.headingFont), 'bold');
      doc.setFontSize(design.density === 'compact' ? 24 : design.density === 'airy' ? 31 : 28);
      doc.setTextColor(`#${text}`);
      writePdfBlock(doc, slide.title, 46, 50, pageWidth - 120, 70, 32);
    }

    if (imageAsset && (layout === 'image' || !richLayout(layout)) && drawDeckPdfImage(doc, imageAsset, slide, pageWidth, design, text)) {
      // Image-led layout is rendered by drawDeckPdfImage.
    } else if (layout === 'cover' || layout === 'statement') {
      const lead = slide.subtitle || slide.bullets[0] || '';
      doc.setFont(pdfFont(design.headingFont), 'bold');
      doc.setFontSize(cover ? (design.density === 'compact' ? 35 : design.density === 'airy' ? 50 : 44) : design.density === 'compact' ? 29 : design.density === 'airy' ? 42 : 36);
      doc.setTextColor(`#${cover ? text : highlight}`);
      writePdfBlock(doc, cover ? slide.title : lead, 58, cover ? 126 : 164, cover ? pageWidth - 155 : pageWidth - 116, cover ? 160 : 150, cover ? 49 : 42);
      if (cover && lead) {
        doc.setFont(pdfFont(design.bodyFont), 'normal');
        doc.setFontSize(design.density === 'airy' ? 24 : 21);
        doc.setTextColor(`#${mixHex(text, background, 0.34)}`);
        writePdfBlock(doc, lead, 60, 310, pageWidth - 250, 72, 29);
      }
      const remaining = slide.subtitle ? slide.bullets : slide.bullets.slice(1);
      drawPdfBulletList(doc, remaining, 66, cover ? 430 : 352, cover ? pageWidth - 300 : pageWidth - 132, cover ? 62 : 125, design, text);
    } else if (layout === 'metric') {
      drawPdfMetrics(doc, slide, pageWidth, design, text, surface, highlight);
    } else if (layout === 'comparison' && slide.columns?.length === 2) {
      drawPdfComparison(doc, slide, pageWidth, design, text, surface, highlight);
    } else if (layout === 'process' || layout === 'timeline') {
      drawPdfSequence(doc, slide, pageWidth, design, text, surface, highlight, layout);
    } else if (layout === 'quote' && slide.quote) {
      drawPdfQuote(doc, slide, pageWidth, design, text, highlight);
    } else if (layout === 'split') {
      const panelWidth = Math.max(210, pageWidth * 0.31);
      doc.setFillColor(`#${surface}`);
      doc.roundedRect(52, 150, panelWidth, 320, 8, 8, 'F');
      doc.setFont(pdfFont(design.headingFont), 'bold');
      doc.setFontSize(23);
      doc.setTextColor(`#${highlight}`);
      writePdfBlock(doc, slide.subtitle || slide.bullets[0] || '', 76, 190, panelWidth - 48, 220, 29);
      drawPdfBulletList(doc, slide.subtitle ? slide.bullets : slide.bullets.slice(1), panelWidth + 90, 170, pageWidth - panelWidth - 140, 285, design, text);
    } else if (layout === 'grid') {
      const items = slide.bullets.slice(0, 6);
      const columns = items.length === 3 || items.length > 4 ? 3 : 2;
      const gap = 14;
      const cardWidth = (pageWidth - 104 - gap * (columns - 1)) / columns;
      const rows = Math.ceil(items.length / columns);
      const cardHeight = (330 - gap * (rows - 1)) / rows;
      items.forEach((bullet, itemIndex) => {
        const column = itemIndex % columns;
        const row = Math.floor(itemIndex / columns);
        const x = 52 + column * (cardWidth + gap);
        const y = 150 + row * (cardHeight + gap);
        doc.setFillColor(`#${surface}`);
        doc.roundedRect(x, y, cardWidth, cardHeight, 7, 7, 'F');
        doc.setFillColor(`#${theme === 'light' ? design.accent : text}`);
        doc.rect(x + 18, y + 18, 30, 3, 'F');
        const metric = splitLeadingMetric(bullet);
        if (metric) {
          doc.setFont(pdfFont(design.headingFont), 'bold');
          doc.setFontSize(24);
          doc.setTextColor(`#${highlight}`);
          writePdfBlock(doc, metric.value, x + 18, y + 54, cardWidth - 36, 54, 28);
          doc.setFont(pdfFont(design.bodyFont), 'normal');
          doc.setFontSize(12);
          doc.setTextColor(`#${text}`);
          writePdfBlock(doc, metric.label, x + 18, y + cardHeight * 0.62, cardWidth - 36, cardHeight * 0.24, 16);
        } else {
          doc.setFont(pdfFont(design.bodyFont), itemIndex === 0 ? 'bold' : 'normal');
          doc.setFontSize(15);
          doc.setTextColor(`#${itemIndex === 0 ? highlight : text}`);
          writePdfBlock(doc, bullet, x + 18, y + 42, cardWidth - 36, cardHeight - 56, 21);
        }
      });
    } else if (layout === 'chart' && slide.chart) {
      const hasRail = slide.bullets.length > 0;
      const railWidth = hasRail ? Math.max(220, pageWidth * 0.3) : 0;
      if (hasRail) {
        drawPdfBulletList(doc, slide.bullets, 58, 175, railWidth - 26, 300, design, text);
        doc.setDrawColor(`#${mixHex(surface, text, 0.25)}`);
        doc.setLineWidth(0.8);
        doc.line(railWidth + 44, 165, railWidth + 44, 470);
      }
      drawPdfChart(
        doc,
        slide.chart,
        hasRail ? railWidth + 66 : 64,
        158,
        hasRail ? pageWidth - railWidth - 128 : pageWidth - 128,
        330,
        design,
        text
      );
    } else {
      if (slide.subtitle) {
        doc.setFont(pdfFont(design.headingFont), 'bold');
        doc.setFontSize(21);
        doc.setTextColor(`#${highlight}`);
        writePdfBlock(doc, slide.subtitle, 58, 150, pageWidth - 116, 60, 27);
      }
      const hasTable = Boolean(slide.table);
      drawPdfBulletList(doc, slide.bullets, 72, slide.subtitle ? 230 : 170, pageWidth - 144, hasTable ? 82 : 280, design, text);
      if (slide.table) {
        drawDeckPdfTable(doc, slide.table, 58, slide.subtitle ? 320 : 286, pageWidth - 116, 174, design, text, background);
      }
    }
    if (slide.takeaway) {
      doc.setFillColor(`#${theme === 'light' ? mixHex(design.background, design.accent, 0.12) : surface}`);
      doc.roundedRect(58, pageHeight - 48, pageWidth - 116, 26, 5, 5, 'F');
      doc.setFont(pdfFont(design.bodyFont), 'bold');
      doc.setFontSize(10);
      doc.setTextColor(`#${text}`);
      writePdfBlock(doc, slide.takeaway, 72, pageHeight - 39, pageWidth - 144, 15, 11);
    }
  });

  return Buffer.from(doc.output('arraybuffer'));
}

function drawPdfMetrics(
  doc: jsPDF,
  slide: Slide,
  pageWidth: number,
  design: ResolvedDesign,
  text: string,
  surface: string,
  highlight: string
): void {
  const metrics = slide.metrics?.length
    ? slide.metrics
    : slide.bullets.map(splitLeadingMetric).filter((metric): metric is NonNullable<typeof metric> => Boolean(metric))
      .map((metric) => ({ value: metric.value, label: metric.label }));
  const count = Math.min(4, metrics.length);
  const gap = 14;
  const cardWidth = (pageWidth - 104 - gap * (count - 1)) / count;
  metrics.slice(0, count).forEach((metric, index) => {
    const x = 52 + index * (cardWidth + gap);
    doc.setFillColor(`#${surface}`);
    doc.roundedRect(x, 150, cardWidth, 284, 7, 7, 'F');
    doc.setFont(pdfFont(design.headingFont), 'bold');
    doc.setFontSize(count <= 2 ? 38 : 31);
    doc.setTextColor(`#${highlight}`);
    writePdfBlock(doc, metric.value, x + 18, 188, cardWidth - 36, 70, count <= 2 ? 44 : 36);
    doc.setFontSize(count <= 2 ? 18 : 15);
    doc.setTextColor(`#${text}`);
    writePdfBlock(doc, metric.label, x + 18, 282, cardWidth - 36, 58, count <= 2 ? 23 : 20);
    const detail = 'detail' in metric && typeof metric.detail === 'string' ? metric.detail : undefined;
    if (detail) {
      doc.setFont(pdfFont(design.bodyFont), 'normal');
      doc.setFontSize(10);
      writePdfBlock(doc, detail, x + 18, 356, cardWidth - 36, 50, 14);
    }
  });
}

function drawPdfComparison(
  doc: jsPDF,
  slide: Slide,
  pageWidth: number,
  design: ResolvedDesign,
  text: string,
  surface: string,
  highlight: string
): void {
  const gap = 18;
  const columnWidth = (pageWidth - 104 - gap) / 2;
  slide.columns!.forEach((column, index) => {
    const x = 52 + index * (columnWidth + gap);
    const panelColor = index === 1 ? mixHex(design.background, design.accent, 0.12) : surface;
    doc.setFillColor(`#${panelColor}`);
    doc.roundedRect(x, 145, columnWidth, 338, 8, 8, 'F');
    doc.setFont(pdfFont(design.headingFont), 'bold');
    doc.setFontSize(22);
    doc.setTextColor(`#${index === 1 ? contrastHex(panelColor, design.background, design.primary) : highlight}`);
    writePdfBlock(doc, column.heading, x + 22, 175, columnWidth - 44, 45, 27);
    let bulletY = 236;
    if (column.body) {
      doc.setFont(pdfFont(design.bodyFont), 'normal');
      doc.setFontSize(12);
      doc.setTextColor(`#${text}`);
      writePdfBlock(doc, column.body, x + 22, 224, columnWidth - 44, 58, 17);
      bulletY = 294;
    }
    drawPdfBulletList(doc, column.bullets, x + 26, bulletY, columnWidth - 52, 150, design, text);
  });
}

function drawPdfSequence(
  doc: jsPDF,
  slide: Slide,
  pageWidth: number,
  design: ResolvedDesign,
  text: string,
  surface: string,
  highlight: string,
  layout: 'process' | 'timeline'
): void {
  const items = slide.bullets.slice(0, 6);
  const gap = 10;
  const itemWidth = (pageWidth - 104 - gap * (items.length - 1)) / items.length;
  const lineY = layout === 'timeline' ? 290 : 322;
  doc.setDrawColor(`#${highlight}`);
  doc.setLineWidth(2);
  doc.line(72, lineY, pageWidth - 72, lineY);
  items.forEach((item, index) => {
    const x = 52 + index * (itemWidth + gap);
    const boxY = index % 2 === 0 ? 155 : 342;
    doc.setFillColor(`#${surface}`);
    doc.roundedRect(x, boxY, itemWidth, 104, 6, 6, 'F');
    doc.setFont(pdfFont(design.headingFont), 'bold');
    doc.setFontSize(items.length > 4 ? 11 : 13);
    doc.setTextColor(`#${text}`);
    writePdfBlock(doc, item, x + 12, boxY + 22, itemWidth - 24, 66, 16);
    doc.setFillColor(`#${highlight}`);
    doc.circle(x + itemWidth / 2, lineY, 13, 'F');
    doc.setFont(pdfFont(design.bodyFont), 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(`#${contrastHex(highlight, design.background, design.primary)}`);
    doc.text(String(index + 1).padStart(2, '0'), x + itemWidth / 2, lineY + 2.5, { align: 'center' });
  });
}

function drawPdfQuote(
  doc: jsPDF,
  slide: Slide,
  pageWidth: number,
  design: ResolvedDesign,
  text: string,
  highlight: string
): void {
  doc.setFont(pdfFont(design.headingFont), 'bold');
  doc.setFontSize(68);
  doc.setTextColor(`#${highlight}`);
  doc.text('"', 56, 190);
  doc.setFont(pdfFont(design.headingFont), 'italic');
  doc.setFontSize(30);
  doc.setTextColor(`#${text}`);
  writePdfBlock(doc, slide.quote!, 102, 182, pageWidth - 170, 210, 39);
  if (slide.quoteAttribution) {
    doc.setFont(pdfFont(design.bodyFont), 'bold');
    doc.setFontSize(11);
    doc.text(slide.quoteAttribution, 104, 420);
  }
}

// Crisp vector data-viz for PDF exports (no rasterized images): bar/column,
// line/area with gridlines and axis labels, pie/donut with legend.
function drawPdfChart(
  doc: jsPDF,
  chart: ArtifactChart,
  x: number,
  y: number,
  w: number,
  h: number,
  design: ResolvedDesign,
  textColor: string
): void {
  const seriesColors = [design.accent, design.primary, mixHex(design.accent, design.text, 0.45), design.muted, mixHex(design.primary, design.background, 0.45), mixHex(design.accent, design.background, 0.45)];
  const titleHeight = chart.title ? 18 : 0;
  if (chart.title) {
    doc.setFont(pdfFont(design.headingFont), 'bold');
    doc.setFontSize(11);
    doc.setTextColor(`#${textColor}`);
    doc.text(pdfSafeText(chart.title), x, y + 10);
  }
  const legendHeight = chart.series.length > 1 || chart.type === 'pie' || chart.type === 'donut' ? 16 : 0;
  const plotX = x + 34;
  const plotY = y + titleHeight + 4;
  const plotW = w - 40;
  const plotH = h - titleHeight - legendHeight - 22;

  if (chart.type === 'pie' || chart.type === 'donut') {
    const values = chart.series[0]?.values.slice(0, chart.labels.length) ?? [];
    const total = values.reduce((sum, value) => sum + Math.max(0, value), 0) || 1;
    const cx = x + w / 2;
    const cy = plotY + plotH / 2 + 6;
    const radius = Math.min(plotW, plotH) / 2.2;
    let angle = -Math.PI / 2;
    values.forEach((value, index) => {
      const share = Math.max(0, value) / total;
      const sweep = share * Math.PI * 2;
      const steps = Math.max(2, Math.ceil(sweep / 0.08));
      doc.setFillColor(`#${seriesColors[index % seriesColors.length]}`);
      // Approximate the wedge with a triangle fan (jsPDF has no arc fill API).
      for (let step = 0; step < steps; step += 1) {
        const a0 = angle + (sweep * step) / steps;
        const a1 = angle + (sweep * (step + 1)) / steps;
        doc.triangle(cx, cy, cx + radius * Math.cos(a0), cy + radius * Math.sin(a0), cx + radius * Math.cos(a1), cy + radius * Math.sin(a1), 'F');
      }
      angle += sweep;
    });
    if (chart.type === 'donut') {
      doc.setFillColor(`#${design.background}`);
      doc.circle(cx, cy, radius * 0.55, 'F');
    }
    drawPdfChartLegend(doc, chart.labels, seriesColors, x, y + h - 10, w, design, textColor);
    return;
  }

  const allValues = chart.series.flatMap((series) => series.values.slice(0, chart.labels.length));
  const maxValue = Math.max(...allValues, 0);
  const minValue = Math.min(...allValues, 0);
  const range = maxValue - minValue || 1;
  const valueToY = (value: number) => plotY + plotH - ((value - minValue) / range) * plotH;

  // Gridlines + value labels (4 ticks).
  doc.setDrawColor(`#${mixHex(design.muted, design.background, 0.6)}`);
  doc.setLineWidth(0.5);
  doc.setFont(pdfFont(design.bodyFont), 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(`#${design.muted}`);
  for (let tick = 0; tick <= 4; tick += 1) {
    const tickValue = minValue + (range * tick) / 4;
    const tickY = valueToY(tickValue);
    doc.line(plotX, tickY, plotX + plotW, tickY);
    doc.text(compactNumber(tickValue), plotX - 4, tickY + 2, { align: 'right' });
  }
  if (chart.unit) doc.text(pdfSafeText(chart.unit), plotX - 4, plotY - 6, { align: 'right' });

  const slotWidth = plotW / chart.labels.length;
  if (chart.type === 'bar' || chart.type === 'column') {
    const seriesCount = chart.series.length;
    const barWidth = Math.min(26, (slotWidth * 0.66) / seriesCount);
    chart.series.forEach((series, seriesIndex) => {
      doc.setFillColor(`#${seriesColors[seriesIndex % seriesColors.length]}`);
      series.values.slice(0, chart.labels.length).forEach((value, index) => {
        const groupCenter = plotX + slotWidth * index + slotWidth / 2;
        const barX = groupCenter - (barWidth * seriesCount) / 2 + barWidth * seriesIndex;
        const zeroY = valueToY(Math.max(0, minValue));
        const topY = valueToY(value);
        doc.rect(barX, Math.min(topY, zeroY), barWidth, Math.abs(zeroY - topY) || 0.8, 'F');
      });
    });
  } else {
    chart.series.forEach((series, seriesIndex) => {
      const color = seriesColors[seriesIndex % seriesColors.length];
      const points = series.values.slice(0, chart.labels.length).map((value, index) => ({
        px: plotX + slotWidth * index + slotWidth / 2,
        py: valueToY(value)
      }));
      if (chart.type === 'area' && points.length > 1) {
        const base = valueToY(Math.max(0, minValue));
        doc.setFillColor(`#${mixHex(color, design.background, 0.72)}`);
        points.slice(0, -1).forEach((point, index) => {
          const next = points[index + 1];
          // Two triangles fill each trapezoid segment under the line.
          doc.triangle(point.px, point.py, next.px, next.py, point.px, base, 'F');
          doc.triangle(next.px, next.py, next.px, base, point.px, base, 'F');
        });
      }
      doc.setDrawColor(`#${color}`);
      doc.setLineWidth(1.6);
      points.slice(0, -1).forEach((point, index) => {
        const next = points[index + 1];
        doc.line(point.px, point.py, next.px, next.py);
      });
      doc.setFillColor(`#${color}`);
      points.forEach((point) => doc.circle(point.px, point.py, 1.8, 'F'));
    });
  }

  // Category labels.
  doc.setFont(pdfFont(design.bodyFont), 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(`#${design.muted}`);
  const labelStep = Math.ceil(chart.labels.length / Math.max(1, Math.floor(plotW / 52)));
  chart.labels.forEach((label, index) => {
    if (index % labelStep !== 0) return;
    doc.text(pdfSafeText(label.slice(0, 12)), plotX + slotWidth * index + slotWidth / 2, plotY + plotH + 11, { align: 'center' });
  });

  if (chart.series.length > 1) {
    drawPdfChartLegend(doc, chart.series.map((series) => series.name), seriesColors, x, y + h - 8, w, design, textColor);
  }
}

function drawPdfChartLegend(
  doc: jsPDF,
  labels: string[],
  colors: string[],
  x: number,
  y: number,
  w: number,
  design: ResolvedDesign,
  textColor: string
): void {
  doc.setFont(pdfFont(design.bodyFont), 'normal');
  doc.setFontSize(8);
  let cursor = x;
  labels.slice(0, 6).forEach((label, index) => {
    doc.setFillColor(`#${colors[index % colors.length]}`);
    doc.rect(cursor, y - 6, 7, 7, 'F');
    doc.setTextColor(`#${textColor}`);
    const text = pdfSafeText(label.slice(0, 22));
    doc.text(text, cursor + 10, y);
    cursor += 14 + doc.getTextWidth(text);
    if (cursor > x + w - 60) cursor = x;
  });
}

function compactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_00_00_000) return `${(value / 1_00_00_000).toFixed(1)}Cr`;
  if (abs >= 1_00_000) return `${(value / 1_00_000).toFixed(1)}L`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value * 100) / 100);
}

function drawPdfBulletList(
  doc: jsPDF,
  bullets: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  design: ResolvedDesign,
  color: string
): void {
  if (bullets.length === 0) return;
  const lineHeight = design.density === 'compact' ? 18 : design.density === 'airy' ? 25 : 21;
  const fontSize = design.density === 'compact' ? 13 : design.density === 'airy' ? 17 : 15;
  const maxLines = Math.max(1, Math.floor(height / lineHeight));
  doc.setFont(pdfFont(design.bodyFont), 'normal');
  doc.setFontSize(fontSize);
  doc.setTextColor(`#${color}`);
  let cursorY = y;
  let usedLines = 0;
  for (const bullet of bullets) {
    const lines = doc.splitTextToSize(pdfSafeText(bullet), width - 18) as string[];
    if (usedLines + lines.length > maxLines) break;
    doc.setFillColor(`#${design.accent}`);
    doc.circle(x + 3, cursorY - fontSize * 0.24, 2.2, 'F');
    doc.setTextColor(`#${color}`);
    doc.text(lines, x + 16, cursorY, { lineHeightFactor: lineHeight / fontSize });
    cursorY += lines.length * lineHeight + 5;
    usedLines += lines.length;
  }
}

function drawDeckPdfTable(
  doc: jsPDF,
  table: NonNullable<Slide['table']>,
  x: number,
  y: number,
  width: number,
  height: number,
  design: ResolvedDesign,
  textColor: string,
  background: string
): void {
  const rows = [table.columns, ...table.rows.slice(0, 6)];
  const columnWidth = width / table.columns.length;
  const rowHeight = Math.min(30, height / rows.length);
  rows.forEach((row, rowIndex) => {
    row.slice(0, table.columns.length).forEach((value, columnIndex) => {
      const cellX = x + columnIndex * columnWidth;
      const cellY = y + rowIndex * rowHeight;
      const header = rowIndex === 0;
      const fill = header
        ? design.primary
        : rowIndex % 2 === 0
          ? mixHex(background, textColor, 0.06)
          : background;
      doc.setFillColor(`#${fill}`);
      doc.setDrawColor(`#${mixHex(background, textColor, 0.2)}`);
      doc.setLineWidth(0.45);
      doc.rect(cellX, cellY, columnWidth, rowHeight, 'FD');
      doc.setFont(pdfFont(header ? design.headingFont : design.bodyFont), header ? 'bold' : 'normal');
      doc.setFontSize(header ? 9 : 8.5);
      doc.setTextColor(`#${header ? contrastHex(fill, design.background, design.text) : textColor}`);
      const lines = doc.splitTextToSize(pdfSafeText(value ?? ''), columnWidth - 12) as string[];
      doc.text(lines.slice(0, 2), cellX + 6, cellY + 12, { lineHeightFactor: 1.05 });
    });
  });
}

function writePdfBlock(
  doc: jsPDF,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  lineHeight: number
): void {
  const lines = doc.splitTextToSize(pdfSafeText(value), width) as string[];
  doc.text(lines.slice(0, Math.max(1, Math.floor(height / lineHeight))), x, y, {
    lineHeightFactor: lineHeight / Math.max(1, doc.getFontSize())
  });
}

// jsPDF's built-in fonts are WinAnsi-only. Normalize common business symbols
// instead of allowing them to become unrelated glyphs in exported decks.
export function pdfSafeText(value: string): string {
  return value
    .replace(/₹\s*/g, 'INR ')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/↑/g, 'up ')
    .replace(/↓/g, 'down ')
    .replace(/✓/g, 'yes')
    .replace(/•/g, '-');
}

async function buildDocxBuffer(artifact: ArtifactDocument): Promise<Buffer> {
  const design = resolveDesign(artifact.design);
  const children: Array<Paragraph | Table> = [];

  if (artifact.resume) {
    const resume = artifact.resume;
    children.push(new Paragraph({ text: resume.name || artifact.title, heading: HeadingLevel.TITLE }));
    if (resume.headline) {
      children.push(new Paragraph({ children: [new TextRun({ text: resume.headline, color: design.muted, size: 24 })] }));
    }
    if (resume.contact.length) {
      children.push(new Paragraph({ children: [new TextRun({ text: resume.contact.join(' | '), color: design.muted, size: 19 })] }));
    }
    if (resume.summary) {
      children.push(new Paragraph({ text: 'Summary', heading: HeadingLevel.HEADING_1 }));
      children.push(new Paragraph(resume.summary));
    }
    pushResumeDocxEntries(children, 'Experience', resume.experience);
    pushResumeDocxEntries(children, 'Projects', resume.projects);
    pushResumeDocxEntries(children, 'Education', resume.education);
    if (resume.skills.length) {
      children.push(new Paragraph({ text: 'Skills', heading: HeadingLevel.HEADING_1 }));
      children.push(new Paragraph(resume.skills.join(' | ')));
    }
  } else {
    children.push(
      new Paragraph({ text: artifact.title, heading: HeadingLevel.TITLE }),
      new Paragraph({ children: [new TextRun({ text: `${artifact.audience} | ${artifact.tone}`, italics: true })] })
    );
  }

  if (design.includeTableOfContents && (artifact.kind === 'report' || artifact.kind === 'assignment') && artifact.sections.length >= 4) {
    children.push(new Paragraph({ text: 'Contents', heading: HeadingLevel.HEADING_1 }));
    children.push(new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-3' }) as unknown as Paragraph);
  }

  if (!artifact.resume && artifact.executiveSummary) {
    children.push(new Paragraph({ text: 'Summary', heading: HeadingLevel.HEADING_1 }));
    children.push(new Paragraph(artifact.executiveSummary));
  }

  if (!artifact.resume) {
    for (const section of artifact.sections) {
      pushDocxSection(children, section, design);
      if (section.sourceIds?.length) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `Sources: ${section.sourceIds.join(', ')}`, italics: true, color: design.muted })],
          spacing: { after: 100 }
        }));
      }
    }
  }

  const exportCitations = orderedCitationsForExport(artifact);
  if (exportCitations.length > 0) {
    children.push(new Paragraph({ text: 'Methodology & limitations', heading: HeadingLevel.HEADING_1 }));
    children.push(new Paragraph(methodologyBody()));
    methodologyBullets().forEach((bullet) => children.push(new Paragraph({
      text: bullet,
      numbering: { reference: 'artifact-bullets', level: 0 },
      spacing: { after: 70 }
    })));
    children.push(new Paragraph({ text: 'Sources', heading: HeadingLevel.HEADING_1 }));
    exportCitations.forEach((citation) =>
      children.push(new Paragraph({ text: formattedCitationLine(citation), bullet: { level: 0 } }))
    );
  }

  const doc = new Document({
    creator: 'Delegators Workbench',
    title: artifact.title,
    description: artifact.executiveSummary,
    styles: {
      default: {
        document: { run: { font: design.bodyFont, size: 22, color: design.text } }
      },
      paragraphStyles: [
        {
          id: 'Title',
          name: 'Title',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: design.headingFont, size: 40, bold: true, color: design.primary },
          paragraph: { spacing: { after: 280 } }
        },
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: design.headingFont, size: 30, bold: true, color: design.primary },
          paragraph: { spacing: { before: 300, after: 140 }, outlineLevel: 0 }
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: design.headingFont, size: 25, bold: true, color: design.text },
          paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 1 }
        }
      ]
    },
    numbering: {
      config: [{
        reference: 'artifact-bullets',
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: '•',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      }]
    },
    sections: [{
      properties: {
        page: {
          size: docxPageSize(design.pageSize, design.orientation),
          margin: docxMargins(design.density)
        }
      },
      ...(design.includePageNumbers ? {
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ children: ['Page ', PageNumber.CURRENT], color: design.muted, size: 18 })]
              })
            ]
          })
        }
      } : {}),
      children
    }]
  });

  return Packer.toBuffer(doc);
}

function pushResumeDocxEntries(
  children: Array<Paragraph | Table>,
  label: string,
  entries: ArtifactSection[]
): void {
  if (!entries.length) return;
  children.push(new Paragraph({ text: label, heading: HeadingLevel.HEADING_1 }));
  entries.forEach((entry) => {
    children.push(new Paragraph({ text: entry.heading, heading: HeadingLevel.HEADING_2 }));
    if (entry.body) {
      children.push(new Paragraph({ children: [new TextRun({ text: entry.body, italics: true })] }));
    }
    entry.bullets.forEach((bullet) => children.push(new Paragraph({
      text: bullet,
      numbering: { reference: 'artifact-bullets', level: 0 },
      spacing: { after: 70 }
    })));
  });
}

async function buildPptxBuffer(artifact: ArtifactDocument): Promise<Buffer> {
  const design = resolveDesign(artifact.design);
  const pptx = new PptxGenJS();
  pptx.layout = design.slideAspect === 'standard' ? 'LAYOUT_4x3' : 'LAYOUT_WIDE';
  pptx.author = 'Delegators Workbench';
  pptx.subject = artifact.audience;
  pptx.title = artifact.title;
  pptx.company = 'Delegators';
  pptx.theme = {
    headFontFace: design.headingFont,
    bodyFontFace: design.bodyFont,
    lang: 'en-US'
  };

  for (const [index, slide] of slidesForArtifact(artifact).entries()) {
    addContentSlide(pptx, slide, index, design, artifact.assets, artifact.citations);
  }
  addPptxSourcesSlides(pptx, artifact, design);

  const output = await pptx.write({ outputType: 'nodebuffer' });
  return Buffer.from(output as Buffer);
}

async function buildXlsxBuffer(artifact: ArtifactDocument): Promise<Buffer> {
  const design = resolveDesign(artifact.design);
  const sheets = sheetsForArtifact(artifact);
  if (!sheets.length) {
    throw new Error('XLSX export requires a workbook sheet or section table data.');
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Delegators Workbench';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  sheets.forEach((source, sheetIndex) => {
    const worksheet = workbook.addWorksheet(uniqueSheetName(source.name, sheetIndex), {
      properties: { tabColor: { argb: `FF${design.primary}` } }
    });
    worksheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }];
    worksheet.pageSetup = {
      orientation: source.columns.length > 6 ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.35, right: 0.35, top: 0.6, bottom: 0.55, header: 0.2, footer: 0.2 },
      printTitlesRow: '1:1',
      printArea: `A1:${excelColumnName(source.columns.length)}${Math.max(1, source.rows.length + 1)}`
    };
    worksheet.headerFooter = {
      oddHeader: `&L&"${design.headingFont},Bold"&12${source.name}&R&9${artifact.title}`,
      oddFooter: '&LDelegators Workbench&RPage &P of &N'
    };
    worksheet.columns = source.columns.map((column, columnIndex) => ({
      header: column,
      key: `c${columnIndex + 1}`,
      width: Math.max(12, Math.min(42, Math.max(
        column.length + 3,
        ...source.rows.slice(0, 100).map((row) => String(row[columnIndex] ?? '').length + 2)
      )))
    }));

    const header = worksheet.getRow(1);
    header.height = design.density === 'compact' ? 22 : design.density === 'airy' ? 31 : 26;
    header.font = { name: design.headingFont, bold: true, size: 11, color: { argb: `FF${design.background}` } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${design.primary}` } };
    header.alignment = { vertical: 'middle' };

    const numericFormat = source.columns.map((column, columnIndex) =>
      columnNumberFormat(column, source.rows.map((row) => row[columnIndex] ?? ''))
    );
    const stripe = mixHex(design.surface, design.background, 0.45);
    const totalFill = mixHex(design.primary, design.background, 0.12);

    source.rows.forEach((row, rowIndex) => {
      const excelRow = worksheet.addRow(source.columns.map((_, columnIndex) => excelCellValue(row[columnIndex] ?? '')));
      // Total/subtotal rows read as anchors: bold, tinted band, strong top rule —
      // the Microsoft-template look the reference sheets share.
      const isTotalRow = /^(?:grand\s+)?(?:total|subtotal|net|sum|balance)\b/i.test((row[0] ?? '').trim());
      if (rowIndex % 2 === 1 && !isTotalRow) {
        excelRow.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${stripe}` } };
        });
      }
      excelRow.eachCell((cell, columnNumber) => {
        const isFormula = typeof cell.value === 'object' && cell.value !== null && 'formula' in cell.value;
        const formula = isFormula ? String((cell.value as { formula: string }).formula) : '';
        const formulaColor = /\[[^\]]+\.(?:xlsx?|xlsm|csv)\]/i.test(formula)
          ? 'FF0000'
          : formula.includes('!')
            ? '008000'
            : '000000';
        const hardcodedNumber = typeof cell.value === 'number';
        cell.font = {
          name: design.bodyFont,
          bold: isTotalRow,
          color: { argb: `FF${isFormula ? formulaColor : hardcodedNumber ? '0000FF' : design.text}` }
        };
        const format = numericFormat[columnNumber - 1];
        if (format && (isFormula || typeof cell.value === 'number')) cell.numFmt = format;
        cell.alignment = {
          vertical: 'top',
          wrapText: true,
          horizontal: isFormula || typeof cell.value === 'number' ? 'right' : undefined
        };
        cell.border = isTotalRow
          ? {
              top: { style: 'medium', color: { argb: `FF${design.primary}` } },
              bottom: { style: 'hair', color: { argb: `FF${design.surface}` } }
            }
          : { bottom: { style: 'hair', color: { argb: `FF${design.surface}` } } };
      });
      if (isTotalRow) {
        excelRow.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${totalFill}` } };
        });
      }
    });
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, worksheet.rowCount), column: source.columns.length }
    };
    const statusColumns = source.columns
      .map((column, index) => (/decision|status|stage|recommendation/i.test(column) ? index + 1 : 0))
      .filter(Boolean);
    statusColumns.forEach((columnNumber) => {
      const range = `${excelColumnName(columnNumber)}2:${excelColumnName(columnNumber)}${Math.max(2, worksheet.rowCount)}`;
      worksheet.addConditionalFormatting({
        ref: range,
        rules: [
          { type: 'containsText', operator: 'containsText', text: 'Scale', priority: 1, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFDDF4E4' }, fgColor: { argb: 'FFDDF4E4' } }, font: { color: { argb: 'FF17633B' }, bold: true } } },
          { type: 'containsText', operator: 'containsText', text: 'Pilot', priority: 2, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFF0C2' }, fgColor: { argb: 'FFFFF0C2' } }, font: { color: { argb: 'FF795500' }, bold: true } } },
          { type: 'containsText', operator: 'containsText', text: 'Retire', priority: 3, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFBE0E0' }, fgColor: { argb: 'FFFBE0E0' } }, font: { color: { argb: 'FF9C2525' }, bold: true } } }
        ]
      });
    });
  });

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

async function buildZipBuffer(artifact: ArtifactDocument): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(`${fileBase(artifact)}.json`, JSON.stringify(artifact, null, 2));
  zip.file(`${fileBase(artifact)}.md`, artifactToMarkdown(artifact));
  zip.file(`${fileBase(artifact)}.pdf`, await buildBestPdfBuffer(artifact));
  zip.file(`${fileBase(artifact)}.docx`, await buildDocxBuffer(artifact));

  if (artifact.kind === 'deck' || artifact.slides?.length) {
    zip.file(`${fileBase(artifact)}.pptx`, await buildPptxBuffer(artifact));
  }
  if (hasTabularData(artifact)) {
    zip.file(`${fileBase(artifact)}.xlsx`, await buildXlsxBuffer(artifact));
  }

  return zip.generateAsync({ type: 'nodebuffer' });
}

function pushDocxSection(children: Array<Paragraph | Table>, section: ArtifactSection, design: ResolvedDesign): void {
  children.push(new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_1 }));
  if (section.body) children.push(new Paragraph(exportClaimText(section.body, section.sourceIds)));
  section.bullets.forEach((bullet) => children.push(new Paragraph({
    text: exportClaimText(bullet, section.sourceIds),
    numbering: { reference: 'artifact-bullets', level: 0 },
    spacing: { after: 80 }
  })));

  // DOCX has no portable native-chart path: present chart data as a clean
  // labelled table so the document still carries the numbers.
  const chartAsTable = section.chart
    ? {
        columns: ['', ...section.chart.labels],
        rows: section.chart.series.map((series) => [series.name, ...series.values.map((value) => String(value))])
      }
    : undefined;
  const dataTable = section.table ?? chartAsTable;
  if (dataTable && section.chart?.title && !section.table) {
    children.push(new Paragraph({ children: [new TextRun({ text: section.chart.title, bold: true, font: design.headingFont })] }));
  }
  if (dataTable) {
    const contentWidth = 9638;
    const columnWidth = Math.floor(contentWidth / dataTable.columns.length);
    children.push(
      new Table({
        width: { size: contentWidth, type: WidthType.DXA },
        columnWidths: dataTable.columns.map(() => columnWidth),
        rows: [
          new TableRow({
            tableHeader: true,
            children: dataTable.columns.map((column) => new TableCell({
              width: { size: columnWidth, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: design.primary },
              verticalAlign: VerticalAlign.CENTER,
              borders: tableBorders(),
              children: [new Paragraph({
                children: [new TextRun({ text: column, bold: true, color: design.background, font: design.headingFont })]
              })]
            }))
          }),
          ...dataTable.rows.map(
            (row) =>
              new TableRow({
                children: dataTable.columns.map((_, index) => new TableCell({
                  width: { size: columnWidth, type: WidthType.DXA },
                  verticalAlign: VerticalAlign.CENTER,
                  borders: tableBorders(),
                  children: [new Paragraph({ children: [new TextRun({ text: row[index] ?? '', font: design.bodyFont })] })]
                }))
              })
          )
        ]
      })
    );
  }
}

function slidesForArtifact(artifact: ArtifactDocument): Slide[] {
  if (artifact.slides?.length) return artifact.slides;
  return artifact.sections.slice(0, 14).map((section) => ({
    title: section.heading,
    bullets: section.bullets.length ? section.bullets.slice(0, 6) : splitSentences(section.body).slice(0, 5),
    speakerNotes: section.body
  }));
}

function addContentSlide(
  pptx: PptxPresentation,
  slide: Slide,
  index: number,
  design: ResolvedDesign,
  assets: ArtifactAsset[],
  citations: ArtifactDocument['citations']
): void {
  const page = pptx.addSlide();
  const slideWidth = design.slideAspect === 'standard' ? 10 : 13.333;
  const theme = slide.theme ?? 'light';
  const background = theme === 'dark' ? design.primary : theme === 'accent' ? design.accent : design.background;
  const text = theme === 'light' ? design.text : contrastHex(background, design.background, design.text);
  const muted = theme === 'light' ? design.muted : mixHex(text, background, 0.38);
  const surface = theme === 'light' ? design.surface : mixHex(background, text, 0.14);
  const compact = design.density === 'compact';
  const airy = design.density === 'airy';
  const layout = resolveSlideLayout(slide);
  const cover = index === 0 && (layout === 'cover' || layout === 'statement');
  page.background = { color: background };
  if (cover) {
    page.addShape(pptx.ShapeType.ellipse, {
      x: slideWidth - 3.35, y: -1.05, w: 4.2, h: 4.2,
      fill: { color: design.accent, transparency: 12 },
      line: { color: design.accent, transparency: 100 }
    });
    page.addShape(pptx.ShapeType.rect, {
      x: 0.72, y: 0.82, w: 0.58, h: 0.06,
      fill: { color: design.accent },
      line: { color: design.accent, transparency: 100 }
    });
  } else {
    page.addText(String(index + 1).padStart(2, '0'), {
      x: slideWidth - 1.35, y: 0.42, w: 0.75, h: 0.35,
      fontFace: design.bodyFont, fontSize: 10, bold: true, color: theme === 'light' ? design.accent : text, align: 'right'
    });
    if (slide.eyebrow) {
      page.addText(slide.eyebrow.toUpperCase(), {
        x: 0.62, y: 0.34, w: slideWidth - 2.2, h: 0.24,
        fontFace: design.bodyFont, fontSize: 8.5, bold: true, charSpacing: 1.8,
        color: theme === 'light' ? design.accent : text, margin: 0
      });
    }
    page.addText(slide.title, {
      x: 0.62,
      y: slide.eyebrow ? 0.67 : 0.58,
      w: slideWidth - 2.2,
      h: 0.85,
      fontFace: design.headingFont,
      fontSize: compact ? 25 : airy ? 30 : 27,
      bold: true,
      color: text,
      fit: 'shrink',
      margin: 0
    });
  }

  const imageAsset = assets.find((asset) => asset.id === slide.imageAssetId);
  if (imageAsset && (layout === 'image' || !richLayout(layout))) {
    const frame = {
      x: slideWidth * 0.52,
      y: 1.55,
      w: slideWidth * 0.42,
      h: 4.75
    };
    page.addShape(pptx.ShapeType.roundRect, {
      x: frame.x - 0.08, y: frame.y - 0.08, w: frame.w + 0.16, h: frame.h + 0.16,
      rectRadius: 0.03,
      fill: { color: surface },
      line: { color: mixHex(surface, text, 0.12), width: 1 }
    });
    const fitted = containFrame(imageAsset, frame);
    page.addImage({ data: imageAsset.dataUri, ...fitted });
    addPptxBulletList(page, slide.bullets, {
      x: 0.72,
      y: 1.78,
      w: slideWidth * 0.43,
      h: 4.35,
      fontFace: design.bodyFont,
      fontSize: compact ? 13 : airy ? 17 : 15,
      color: text,
      fit: 'shrink',
      valign: 'mid',
      breakLine: false
    });
    page.addText(`Source: ${imageAsset.attribution}`, {
      x: frame.x,
      y: 6.38,
      w: frame.w,
      h: 0.24,
      fontFace: design.bodyFont,
      fontSize: 7.5,
      color: muted,
      align: 'right',
      fit: 'shrink'
    });
  } else if (layout === 'cover' || layout === 'statement') {
    const lead = slide.subtitle || slide.bullets[0] || '';
    if (cover) {
      page.addText(slide.title, {
        x: 0.72, y: 1.35, w: slideWidth - 2.05, h: 1.3,
        fontFace: design.headingFont,
        fontSize: compact ? 34 : airy ? 48 : 42,
        bold: true, color: text, fit: 'shrink', margin: 0
      });
    }
    page.addText(lead, {
      x: 0.74, y: cover ? 3.05 : 1.75, w: cover ? slideWidth - 3.0 : slideWidth - 1.45, h: cover ? 1.1 : 1.65,
      fontFace: design.headingFont,
      fontSize: cover ? (compact ? 20 : airy ? 27 : 24) : (compact ? 26 : airy ? 38 : 32),
      bold: !cover, color: cover ? muted : theme === 'light' ? design.primary : text,
      fit: 'shrink', valign: 'mid', margin: 0
    });
    const remaining = slide.subtitle ? slide.bullets : slide.bullets.slice(1);
    if (remaining.length) {
      addPptxBulletList(page, remaining, {
        x: 0.78, y: cover ? 4.65 : 3.75, w: cover ? slideWidth - 4.2 : slideWidth - 1.6, h: cover ? 1.3 : 2.2,
        fontFace: design.bodyFont,
        fontSize: compact ? 15 : 17,
        color: text, fit: 'shrink', breakLine: false
      });
    }
  } else if (layout === 'metric') {
    addPptxMetrics(page, slide, slideWidth, design, theme, text, surface);
  } else if (layout === 'comparison' && slide.columns?.length === 2) {
    addPptxComparison(page, slide, slideWidth, design, theme, text, surface);
  } else if (layout === 'process' || layout === 'timeline') {
    addPptxSequence(pptx, page, slide, slideWidth, design, theme, text, surface, layout);
  } else if (layout === 'quote' && slide.quote) {
    addPptxQuote(page, slide, slideWidth, design, theme, text);
  } else if (layout === 'split') {
    const panelWidth = Math.max(2.6, slideWidth * 0.29);
    page.addShape(pptx.ShapeType.roundRect, {
      x: 0.68, y: 1.72, w: panelWidth, h: 4.65,
      rectRadius: 0.06,
      fill: { color: surface },
      line: { color: mixHex(surface, text, 0.12), width: 1 }
    });
    page.addText(slide.subtitle || slide.bullets[0] || '', {
      x: 0.98, y: 2.08, w: panelWidth - 0.6, h: 2.45,
      fontFace: design.headingFont,
      fontSize: compact ? 18 : 22, bold: true,
      color: theme === 'light' ? design.primary : text,
      fit: 'shrink', valign: 'mid'
    });
    addPptxBulletList(page, slide.subtitle ? slide.bullets : slide.bullets.slice(1), {
      x: panelWidth + 1.18, y: 1.82, w: slideWidth - panelWidth - 1.85, h: 4.5,
      fontFace: design.bodyFont,
      fontSize: compact ? 14 : 16,
      color: text, fit: 'shrink', valign: 'mid', breakLine: false
    });
  } else if (layout === 'grid') {
    const items = slide.bullets.slice(0, 6);
    const columns = items.length === 3 || items.length > 4 ? 3 : 2;
    const gap = 0.22;
    const cardWidth = (slideWidth - 1.4 - gap * (columns - 1)) / columns;
    const rows = Math.ceil(items.length / columns);
    const cardHeight = Math.min(2.05, (4.72 - gap * (rows - 1)) / rows);
    items.forEach((bullet, itemIndex) => {
      const column = itemIndex % columns;
      const row = Math.floor(itemIndex / columns);
      const x = 0.7 + column * (cardWidth + gap);
      const y = 1.72 + row * (cardHeight + gap);
      page.addShape(pptx.ShapeType.roundRect, {
        x, y, w: cardWidth, h: cardHeight,
        rectRadius: 0.04,
        fill: { color: surface },
        line: { color: mixHex(surface, text, 0.1), width: 1 }
      });
      page.addShape(pptx.ShapeType.rect, {
        x: x + 0.2, y: y + 0.18, w: 0.42, h: 0.045,
        fill: { color: theme === 'light' ? design.accent : text },
        line: { color: theme === 'light' ? design.accent : text, transparency: 100 }
      });
      const metric = splitLeadingMetric(bullet);
      if (metric) {
        page.addText(metric.value, {
          x: x + 0.22, y: y + 0.35, w: cardWidth - 0.44, h: cardHeight * 0.43,
          fontFace: design.headingFont,
          fontSize: compact ? 23 : 28, bold: true,
          color: theme === 'light' ? design.primary : text,
          fit: 'shrink', margin: 0
        });
        page.addText(metric.label, {
          x: x + 0.22, y: y + cardHeight * 0.54, w: cardWidth - 0.44, h: cardHeight * 0.3,
          fontFace: design.bodyFont,
          fontSize: compact ? 10.5 : 12, color: text,
          fit: 'shrink', margin: 0
        });
      } else {
        page.addText(bullet, {
          x: x + 0.22, y: y + 0.35, w: cardWidth - 0.44, h: cardHeight - 0.55,
          fontFace: design.bodyFont,
          fontSize: compact ? 12 : 14, bold: itemIndex === 0,
          color: itemIndex === 0 ? (theme === 'light' ? design.primary : text) : text,
          fit: 'shrink', valign: 'mid', margin: 0
        });
      }
    });
  } else if (layout === 'chart' && slide.chart) {
    // Data slide: native chart carries the argument; bullets become takeaways
    // in a side rail when present.
    const hasRail = slide.bullets.length > 0;
    const railWidth = hasRail ? Math.max(2.9, slideWidth * 0.3) : 0;
    if (hasRail) {
      addPptxBulletList(page, slide.bullets, {
        x: 0.72, y: 1.85, w: railWidth - 0.3, h: 4.4,
        fontFace: design.bodyFont,
        fontSize: compact ? 12.5 : 14,
        color: text, fit: 'shrink', valign: 'top', breakLine: false
      });
      page.addShape(pptx.ShapeType.line, {
        x: railWidth + 0.55, y: 1.9, w: 0, h: 4.2,
        line: { color: mixHex(surface, text, 0.25), width: 1 }
      });
    }
    addPptxChart(pptx, page, slide.chart, {
      x: hasRail ? railWidth + 0.85 : 0.8,
      y: 1.7,
      w: hasRail ? slideWidth - railWidth - 1.6 : slideWidth - 1.6,
      h: 4.7
    }, design, text);
  } else {
    if (slide.subtitle) {
      page.addText(slide.subtitle, {
        x: 0.72, y: 1.62, w: slideWidth - 1.45, h: 0.65,
        fontFace: design.headingFont,
        fontSize: compact ? 17 : 20,
        bold: true,
        color: theme === 'light' ? design.primary : text,
        fit: 'shrink'
      });
    }
    const hasTable = Boolean(slide.table);
    addPptxBulletList(page, slide.bullets, {
      x: 0.82,
      y: slide.subtitle ? 2.45 : 1.78,
      w: slideWidth - 1.65,
      h: hasTable ? 1.5 : slide.subtitle ? 3.75 : 4.45,
      fontFace: design.bodyFont,
      fontSize: compact ? 15 : airy ? 19 : 17,
      color: text,
      fit: 'shrink',
      valign: hasTable ? 'top' : 'mid',
      breakLine: false
    });
    if (slide.table) {
      addPptxTable(page, slide.table, {
        x: 0.72,
        y: slide.subtitle ? 3.6 : 3.3,
        w: slideWidth - 1.44,
        h: 3.0
      }, design);
    }
  }
  if (slide.takeaway) {
    page.addShape(pptx.ShapeType.roundRect, {
      x: 0.72, y: 6.82, w: slideWidth - 1.44, h: 0.34,
      rectRadius: 0.03,
      fill: { color: theme === 'light' ? mixHex(design.background, design.accent, 0.12) : surface },
      line: { color: theme === 'light' ? mixHex(design.background, design.accent, 0.12) : surface, transparency: 100 }
    });
    page.addText(slide.takeaway, {
      x: 0.9, y: 6.9, w: slideWidth - 1.8, h: 0.16,
      fontFace: design.bodyFont, fontSize: 9.5, bold: true, color: text,
      fit: 'shrink', margin: 0
    });
  }
  if (slide.sourceIds?.length) {
    const labels = slide.sourceIds
      .filter((id) => citations.some((citation) => citation.id === id))
      .join(' · ');
    if (labels) {
      page.addText(`Sources: ${labels}`, {
        x: 0.72, y: 7.2, w: slideWidth - 1.44, h: 0.14,
        fontFace: design.bodyFont, fontSize: 6.8, color: muted,
        align: 'right', fit: 'shrink', margin: 0
      });
    }
  }
  const sourceNotes = (slide.sourceIds ?? []).flatMap((id) => {
    const citation = citations.find((item) => item.id === id);
    return citation ? [`${id}: ${citation.label}${citation.url ? ` - ${citation.url}` : ''}`] : [];
  });
  const notes = [
    slide.speakerNotes,
    sourceNotes.length ? `Sources:\n${sourceNotes.join('\n')}` : ''
  ].filter(Boolean).join('\n\n');
  if (notes) page.addNotes(notes);
}

function addPptxMetrics(
  page: PptxSlide,
  slide: Slide,
  slideWidth: number,
  design: ResolvedDesign,
  theme: Slide['theme'],
  text: string,
  surface: string
): void {
  const metrics = slide.metrics?.length
    ? slide.metrics
    : slide.bullets.map(splitLeadingMetric).filter((metric): metric is NonNullable<typeof metric> => Boolean(metric))
      .map((metric) => ({ value: metric.value, label: metric.label }));
  const count = Math.min(4, metrics.length);
  const gap = 0.22;
  const cardWidth = (slideWidth - 1.44 - gap * (count - 1)) / count;
  metrics.slice(0, count).forEach((metric, index) => {
    const x = 0.72 + index * (cardWidth + gap);
    page.addShape('rect', {
      x, y: 1.82, w: cardWidth, h: 3.95,
      fill: { color: surface },
      line: { color: mixHex(surface, text, 0.12), width: 1 }
    });
    page.addText(metric.value, {
      x: x + 0.24, y: 2.2, w: cardWidth - 0.48, h: 1.05,
      fontFace: design.headingFont, fontSize: count <= 2 ? 42 : 34, bold: true,
      color: theme === 'light' ? design.primary : text, fit: 'shrink', margin: 0
    });
    page.addText(metric.label, {
      x: x + 0.24, y: 3.42, w: cardWidth - 0.48, h: 0.72,
      fontFace: design.headingFont, fontSize: count <= 2 ? 18 : 15, bold: true,
      color: text, fit: 'shrink', margin: 0
    });
    const detail = 'detail' in metric && typeof metric.detail === 'string' ? metric.detail : undefined;
    if (detail) {
      page.addText(detail, {
        x: x + 0.24, y: 4.45, w: cardWidth - 0.48, h: 0.72,
        fontFace: design.bodyFont, fontSize: 11, color: theme === 'light' ? design.muted : text,
        fit: 'shrink', margin: 0
      });
    }
  });
}

function addPptxComparison(
  page: PptxSlide,
  slide: Slide,
  slideWidth: number,
  design: ResolvedDesign,
  theme: Slide['theme'],
  text: string,
  surface: string
): void {
  const gap = 0.28;
  const columnWidth = (slideWidth - 1.44 - gap) / 2;
  slide.columns!.forEach((column, index) => {
    const x = 0.72 + index * (columnWidth + gap);
    const panelColor = index === 1 && theme === 'light'
      ? mixHex(design.background, design.accent, 0.12)
      : surface;
    page.addShape('rect', {
      x, y: 1.7, w: columnWidth, h: 4.78,
      fill: { color: panelColor },
      line: { color: mixHex(panelColor, text, 0.14), width: 1 }
    });
    page.addText(column.heading, {
      x: x + 0.3, y: 2.02, w: columnWidth - 0.6, h: 0.55,
      fontFace: design.headingFont, fontSize: 22, bold: true,
      color: index === 1 && theme === 'light'
        ? contrastHex(panelColor, design.background, design.primary)
        : text,
      margin: 0,
      fit: 'shrink'
    });
    if (column.body) {
      page.addText(column.body, {
        x: x + 0.3, y: 2.72, w: columnWidth - 0.6, h: 0.72,
        fontFace: design.bodyFont, fontSize: 13, color: text, margin: 0, fit: 'shrink'
      });
    }
    addPptxBulletList(page, column.bullets, {
      x: x + 0.34, y: column.body ? 3.65 : 2.95, w: columnWidth - 0.68, h: column.body ? 2.35 : 3.05,
      fontFace: design.bodyFont, fontSize: 14, color: text, fit: 'shrink', breakLine: false
    });
  });
}

function addPptxSequence(
  pptx: PptxPresentation,
  page: PptxSlide,
  slide: Slide,
  slideWidth: number,
  design: ResolvedDesign,
  theme: Slide['theme'],
  text: string,
  surface: string,
  layout: 'process' | 'timeline'
): void {
  const items = slide.bullets.slice(0, 6);
  const gap = 0.16;
  const itemWidth = (slideWidth - 1.44 - gap * (items.length - 1)) / items.length;
  const lineY = layout === 'timeline' ? 3.72 : 4.08;
  page.addShape(pptx.ShapeType.line, {
    x: 0.96, y: lineY, w: slideWidth - 1.92, h: 0,
    line: { color: theme === 'light' ? design.accent : text, width: 2 }
  });
  items.forEach((item, index) => {
    const x = 0.72 + index * (itemWidth + gap);
    const circleX = x + itemWidth / 2 - 0.23;
    page.addShape(pptx.ShapeType.ellipse, {
      x: circleX, y: lineY - 0.23, w: 0.46, h: 0.46,
      fill: { color: theme === 'light' ? design.accent : text },
      line: { color: theme === 'light' ? design.accent : text, transparency: 100 }
    });
    page.addText(String(index + 1).padStart(2, '0'), {
      x: circleX, y: lineY - 0.13, w: 0.46, h: 0.16,
      fontFace: design.bodyFont, fontSize: 8.5, bold: true,
      color: contrastHex(theme === 'light' ? design.accent : text, design.background, design.primary),
      align: 'center',
      margin: 0
    });
    page.addShape('rect', {
      x, y: index % 2 === 0 ? 1.9 : 4.38, w: itemWidth, h: 1.35,
      fill: { color: surface },
      line: { color: mixHex(surface, text, 0.12), width: 1 }
    });
    page.addText(item, {
      x: x + 0.16, y: index % 2 === 0 ? 2.2 : 4.68, w: itemWidth - 0.32, h: 0.78,
      fontFace: design.headingFont, fontSize: items.length > 4 ? 12 : 14, bold: true,
      color: text, fit: 'shrink', valign: 'mid', align: 'center', margin: 0
    });
  });
}

function addPptxQuote(
  page: PptxSlide,
  slide: Slide,
  slideWidth: number,
  design: ResolvedDesign,
  theme: Slide['theme'],
  text: string
): void {
  page.addText('“', {
    x: 0.72, y: 1.58, w: 0.9, h: 1.0,
    fontFace: design.headingFont, fontSize: 72, bold: true,
    color: theme === 'light' ? design.accent : text, margin: 0
  });
  page.addText(slide.quote!, {
    x: 1.45, y: 2.0, w: slideWidth - 2.5, h: 2.65,
    fontFace: design.headingFont, fontSize: 30, italic: true,
    color: text, fit: 'shrink', valign: 'mid', margin: 0
  });
  if (slide.quoteAttribution) {
    page.addText(slide.quoteAttribution, {
      x: 1.48, y: 5.15, w: slideWidth - 2.6, h: 0.4,
      fontFace: design.bodyFont, fontSize: 12, bold: true,
      color: theme === 'light' ? design.muted : text, margin: 0
    });
  }
}

function addPptxBulletList(page: PptxSlide, bullets: string[], options: Record<string, unknown>): void {
  if (!bullets.length) return;
  page.addText(bullets.map((bullet, index) => ({
    text: bullet,
    options: {
      bullet: { indent: 16 },
      breakLine: index < bullets.length - 1,
      paraSpaceAfter: 8
    }
  })), { margin: 0, ...options });
}

function splitLeadingMetric(value: string): { value: string; label: string } | null {
  const match = value.trim().match(/^((?:[$€£₹]\s*)?\d+(?:[.,]\d+)?(?:[kKmMbB%]|[xX])?(?:[- ](?:day|week|month|year)s?)?|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)\s+(.+)$/);
  return match ? { value: match[1], label: match[2] } : null;
}

function drawDeckPdfImage(
  doc: jsPDF,
  asset: ArtifactAsset,
  slide: Slide,
  pageWidth: number,
  design: ResolvedDesign,
  textColor: string
): boolean {
  const frame = {
    x: pageWidth * 0.52,
    y: 145,
    w: pageWidth * 0.42,
    h: 315
  };
  if (!addPdfImage(doc, asset, frame.x, frame.y, frame.w, frame.h)) return false;
  drawPdfBulletList(doc, slide.bullets, 58, 170, pageWidth * 0.4, 275, design, textColor);
  doc.setFont(pdfFont(design.bodyFont), 'normal');
  doc.setFontSize(7);
  doc.setTextColor(`#${design.muted}`);
  doc.text(`Source: ${pdfSafeText(asset.attribution)}`, frame.x + frame.w, 478, { align: 'right' });
  return true;
}

function addPdfImage(
  doc: jsPDF,
  asset: ArtifactAsset,
  x: number,
  y: number,
  w: number,
  h: number
): boolean {
  try {
    const frame = containFrame(asset, { x, y, w, h });
    doc.addImage(asset.dataUri, asset.mimeType === 'image/png' ? 'PNG' : 'JPEG', frame.x, frame.y, frame.w, frame.h);
    return true;
  } catch {
    return false;
  }
}

function containFrame(
  asset: Pick<ArtifactAsset, 'width' | 'height'>,
  frame: { x: number; y: number; w: number; h: number }
): { x: number; y: number; w: number; h: number } {
  const scale = Math.min(frame.w / asset.width, frame.h / asset.height);
  const width = asset.width * scale;
  const height = asset.height * scale;
  return {
    x: frame.x + (frame.w - width) / 2,
    y: frame.y + (frame.h - height) / 2,
    w: width,
    h: height
  };
}

function assetById(artifact: ArtifactDocument, id: string | undefined): ArtifactAsset | undefined {
  return id ? artifact.assets.find((asset) => asset.id === id) : undefined;
}

function resolveSlideLayout(slide: Slide): NonNullable<Slide['layout']> {
  if (slide.chart) return 'chart';
  if (slide.metrics?.length) return 'metric';
  if (slide.columns?.length === 2) return 'comparison';
  if (slide.quote) return 'quote';
  if (slide.layout) return slide.layout;
  if (slide.table) return 'list';
  if (slide.imageAssetId) return 'image';
  if (slide.bullets.length <= 2) return 'statement';
  if (slide.subtitle) return 'split';
  if (slide.bullets.length >= 5) return 'grid';
  return 'list';
}

function richLayout(layout: NonNullable<Slide['layout']>): boolean {
  return ['metric', 'comparison', 'timeline', 'process', 'quote'].includes(layout);
}

// Native, editable PowerPoint chart (not an image) — series colored from the
// design system so the data viz matches the deck.
function addPptxChart(
  pptx: PptxPresentation,
  page: PptxSlide,
  chart: ArtifactChart,
  frame: { x: number; y: number; w: number; h: number },
  design: ResolvedDesign,
  textColor: string
): void {
  const typeMap: Record<ArtifactChart['type'], string> = {
    bar: pptx.ChartType.bar,
    column: pptx.ChartType.bar,
    line: pptx.ChartType.line,
    area: pptx.ChartType.area,
    pie: pptx.ChartType.pie,
    donut: pptx.ChartType.doughnut
  };
  const seriesColors = [design.accent, design.primary, mixHex(design.accent, design.text, 0.45), design.muted, mixHex(design.primary, design.background, 0.45), mixHex(design.accent, design.background, 0.45)];
  const data = chart.series.map((series) => ({
    name: series.name,
    labels: chart.labels,
    values: series.values.slice(0, chart.labels.length)
  }));
  page.addChart(typeMap[chart.type], data, {
    ...frame,
    barDir: chart.type === 'bar' ? 'bar' : 'col',
    chartColors: seriesColors.slice(0, Math.max(chart.series.length, chart.type === 'pie' || chart.type === 'donut' ? chart.labels.length : 1)),
    showLegend: chart.series.length > 1 || chart.type === 'pie' || chart.type === 'donut',
    legendPos: 'b',
    legendFontSize: 10,
    legendColor: textColor,
    showTitle: Boolean(chart.title),
    title: chart.title ?? '',
    titleColor: textColor,
    titleFontSize: 13,
    titleFontFace: design.headingFont,
    catAxisLabelColor: textColor,
    catAxisLabelFontSize: 10,
    valAxisLabelColor: textColor,
    valAxisLabelFontSize: 10,
    valGridLine: { style: 'solid', size: 0.5, color: mixHex(design.muted, design.background, 0.55) },
    catGridLine: { style: 'none' },
    dataLabelColor: textColor,
    dataLabelFontSize: 9,
    showValue: chart.labels.length <= 8 && chart.series.length === 1 && chart.type !== 'line' && chart.type !== 'area',
    holeSize: chart.type === 'donut' ? 60 : undefined,
    valAxisTitle: chart.unit,
    showValAxisTitle: Boolean(chart.unit),
    chartColorsOpacity: 100,
    fontFace: design.bodyFont
  });
}

function addPptxTable(page: PptxSlide, table: NonNullable<Slide['table']>, frame: { x: number; y: number; w: number; h: number }, design: ResolvedDesign): void {
  const headerRow = table.columns.map((column) => ({
    text: column,
    options: { bold: true, color: design.background, fill: { color: design.primary }, fontFace: design.headingFont, fontSize: 11 }
  }));
  const bodyRows = table.rows.slice(0, 12).map((row, rowIndex) =>
    table.columns.map((_, columnIndex) => ({
      text: row[columnIndex] ?? '',
      options: {
        color: design.text,
        fontFace: design.bodyFont,
        fontSize: 10.5,
        fill: { color: rowIndex % 2 === 0 ? design.background : mixHex(design.surface, design.background, 0.5) }
      }
    }))
  );
  page.addTable([headerRow, ...bodyRows], {
    ...frame,
    border: { type: 'solid', color: mixHex(design.muted, design.background, 0.6), pt: 0.5 },
    autoPage: false,
    valign: 'middle',
    rowH: 0.32
  });
}

// Picks an Excel number format from the column header (units live there per the
// sheet contract) and the shape of the data, so currency/percent columns render
// like a finished Microsoft template rather than raw digits.
function columnNumberFormat(header: string, cells: string[]): string | undefined {
  if (/%|percent|\bpct\b|margin\b|growth|change|yoy|mom/i.test(header)) return '0.0"%";[Red](0.0"%");-';
  if (/\$|\busd\b/i.test(header)) return '$#,##0;[Red]($#,##0);-';
  if (/₹|\b(?:inr|rs\.?)\b|paise|lakh|crore/i.test(header)) return '₹#,##0;[Red](₹#,##0);-';
  if (/€|\beur\b/i.test(header)) return '€#,##0;[Red](€#,##0);-';
  if (/£|\bgbp\b/i.test(header)) return '£#,##0;[Red](£#,##0);-';
  if (/price|cost|revenue|budget|amount|salary|spend|fee|value/i.test(header)) {
    return '#,##0;[Red](#,##0);-';
  }
  const numeric = cells.filter((cell) => /^-?\d+(?:\.\d+)?$/.test(cell.trim()));
  if (numeric.length === 0) return undefined;
  return numeric.some((cell) => cell.includes('.')) ? '#,##0.00;[Red](#,##0.00);-' : '#,##0;[Red](#,##0);-';
}

function excelColumnName(columnNumber: number): string {
  let value = columnNumber;
  let name = '';
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name || 'A';
}

function excelCellValue(value: string): ExcelJS.CellValue {
  const trimmed = value.trim();
  if (trimmed.startsWith('=')) {
    const formula = trimmed.slice(1);
    if (!formula || /#(?:REF!|DIV\/0!|VALUE!|N\/A|NAME\?)/i.test(formula)) {
      throw new Error('Spreadsheet contains an invalid formula.');
    }
    return { formula };
  }
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return value;
}

function uniqueSheetName(name: string, index: number): string {
  const safe = safeSheetName(name);
  return index === 0 ? safe : `${safe.slice(0, 27)} ${index + 1}`.slice(0, 31);
}

function tableBorders() {
  const border = { style: BorderStyle.SINGLE, color: 'D9DDE1', size: 1 };
  return { top: border, right: border, bottom: border, left: border };
}

function hasTabularData(artifact: ArtifactDocument): boolean {
  return Boolean(artifact.sheet) || artifact.sections.some((section) => Boolean(section.table));
}

function safeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/*?:[\]]/g, ' ').trim().slice(0, 31);
  return cleaned || 'Artifact';
}

function sheetsForArtifact(artifact: ArtifactDocument): Array<{ name: string; columns: string[]; rows: string[][] }> {
  if (artifact.sheet) {
    return artifact.sheet.sheets.map((sheet) => ({
      name: safeSheetName(sheet.name),
      columns: sheet.columns,
      rows: sheet.rows
    }));
  }

  return artifact.sections
    .filter((section) => section.table)
    .map((section) => ({
      name: safeSheetName(section.heading),
      columns: section.table!.columns,
      rows: section.table!.rows
    }));
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function writeHeading(doc: jsPDF, text: string, x: number, y: number, design: ResolvedDesign): number {
  doc.setTextColor(design.primary);
  doc.setFont(pdfFont(design.headingFont), 'bold');
  doc.setFontSize(14);
  const nextY = writeWrapped(doc, text, x, y, doc.internal.pageSize.getWidth() - x * 2, 18);
  doc.setTextColor(design.text);
  doc.setFont(pdfFont(design.bodyFont), 'normal');
  doc.setFontSize(10);
  return nextY + 2;
}

function writeWrapped(doc: jsPDF, text: string, x: number, y: number, width: number, lineHeight: number): number {
  const lines = doc.splitTextToSize(text, width) as string[];
  for (const line of lines) {
    y = ensureRoom(doc, y, lineHeight + 8, x);
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

function writePdfTable(
  doc: jsPDF,
  table: NonNullable<ArtifactSection['table']>,
  x: number,
  y: number,
  width: number,
  design: ResolvedDesign
): number {
  const columnWidth = width / table.columns.length;
  const padding = 6;
  const lineHeight = 11;
  const bottom = () => doc.internal.pageSize.getHeight() - x;

  const drawRow = (values: string[], header: boolean): number => {
    doc.setFont(pdfFont(header ? design.headingFont : design.bodyFont), header ? 'bold' : 'normal');
    doc.setFontSize(header ? 9 : 8.5);
    const lines = table.columns.map((_, index) => doc.splitTextToSize(values[index] ?? '', columnWidth - padding * 2) as string[]);
    const rowHeight = Math.max(24, ...lines.map((cellLines) => cellLines.length * lineHeight + padding * 2));
    if (y + rowHeight > bottom()) {
      doc.addPage();
      y = x;
      if (!header) drawRow(table.columns, true);
    }

    values.slice(0, table.columns.length).forEach((_, index) => {
      const cellX = x + index * columnWidth;
      doc.setDrawColor(design.surface);
      doc.setLineWidth(0.6);
      if (header) {
        doc.setFillColor(design.primary);
        doc.rect(cellX, y, columnWidth, rowHeight, 'FD');
        doc.setTextColor(design.background);
      } else {
        doc.setFillColor(index % 2 === 0 ? design.background : mixHex(design.background, design.surface, 0.35));
        doc.rect(cellX, y, columnWidth, rowHeight, 'FD');
        doc.setTextColor(design.text);
      }
      doc.text(lines[index], cellX + padding, y + padding + 8);
    });
    y += rowHeight;
    return rowHeight;
  };

  drawRow(table.columns, true);
  table.rows.slice(0, 80).forEach((row) => drawRow(row, false));
  doc.setTextColor(design.text);
  return y + 4;
}

function ensureRoom(doc: jsPDF, y: number, needed: number, margin: number): number {
  const bottom = doc.internal.pageSize.getHeight() - margin;
  if (y + needed <= bottom) return y;
  doc.addPage();
  return margin;
}

// Curated design systems. Each is a complete, coherent token set the model can
// select via design.template; explicit palette/font overrides still win so the
// user's stated direction always beats the preset.
const designTemplates: Record<string, { headingFont: string; bodyFont: string; background: string; surface: string; text: string; muted: string; primary: string; accent: string }> = {
  'executive-slate': {
    headingFont: 'Aptos Display', bodyFont: 'Aptos',
    background: 'F8FAFC', surface: 'E7EDF4', text: '0F172A', muted: '64748B', primary: '1E293B', accent: '2563EB'
  },
  'editorial-ivory': {
    headingFont: 'Georgia', bodyFont: 'Georgia',
    background: 'FBF8F1', surface: 'F0E9DB', text: '221D15', muted: '7A715F', primary: '433A2B', accent: 'B5562C'
  },
  'consulting-mono': {
    headingFont: 'Arial', bodyFont: 'Arial',
    background: 'FFFFFF', surface: 'F2F2F1', text: '121212', muted: '6B6B6B', primary: '1A1A1A', accent: 'C8102E'
  },
  'modern-indigo': {
    headingFont: 'Aptos Display', bodyFont: 'Aptos',
    background: 'FFFFFF', surface: 'EEF2FF', text: '111827', muted: '6B7280', primary: '312E81', accent: '4F46E5'
  },
  'midnight-aurora': {
    headingFont: 'Aptos Display', bodyFont: 'Aptos',
    background: '0B1220', surface: '16203A', text: 'E6EAF2', muted: '8B94A8', primary: '101A30', accent: '2DD4BF'
  },
  // Extracted from the 2026 peak-reference boards: electric color-block startup
  // decks, cobalt enterprise decks, dark glow keynotes, warm editorial photo
  // decks, branded guides, and ATS-grade resumes.
  'bold-pop': {
    headingFont: 'Aptos Display', bodyFont: 'Aptos',
    background: 'FFFFFF', surface: 'F3EFFF', text: '14101F', muted: '6E6781', primary: '5B2EFF', accent: 'FF5C00'
  },
  'cobalt-bold': {
    headingFont: 'Aptos Display', bodyFont: 'Aptos',
    background: 'FFFFFF', surface: 'E8EDFB', text: '0A1633', muted: '5A6685', primary: '1D3FD8', accent: '4D6FFF'
  },
  'noir-lumina': {
    headingFont: 'Aptos Display', bodyFont: 'Aptos',
    background: '0A0A0C', surface: '17171C', text: 'F2EFE9', muted: '9A958C', primary: '141419', accent: 'E8A33D'
  },
  'editorial-warm': {
    headingFont: 'Georgia', bodyFont: 'Aptos',
    background: 'F7F3EC', surface: 'EDE5D8', text: '262220', muted: '857B6E', primary: '3E372F', accent: 'C96F4A'
  },
  'signal-orange': {
    headingFont: 'Aptos Display', bodyFont: 'Aptos',
    background: 'FFFFFF', surface: 'FFF1E8', text: '23234B', muted: '6F6F95', primary: 'FF5A1F', accent: '32327A'
  },
  'classic-ats': {
    headingFont: 'Cambria', bodyFont: 'Cambria',
    background: 'FFFFFF', surface: 'F5F5F2', text: '111111', muted: '555555', primary: '111111', accent: '1F4E79'
  }
};

function resolveDesign(design: ArtifactDesign | undefined): ResolvedDesign {
  const palette = design?.palette;
  const preset = design?.template ? designTemplates[design.template] : undefined;
  return {
    headingFont: cleanFontName(design?.headingFontFamily) || preset?.headingFont || 'Aptos Display',
    bodyFont: cleanFontName(design?.bodyFontFamily) || preset?.bodyFont || 'Aptos',
    pageSize: design?.pageSize ?? 'a4',
    orientation: design?.orientation ?? 'portrait',
    slideAspect: design?.slideAspect ?? 'wide',
    density: design?.density ?? 'balanced',
    includeTableOfContents: design?.includeTableOfContents ?? false,
    includePageNumbers: design?.includePageNumbers ?? true,
    showSectionNumbers: design?.showSectionNumbers ?? true,
    background: cleanHex(palette?.background, preset?.background ?? 'F7F7F4'),
    surface: cleanHex(palette?.surface, preset?.surface ?? 'E8ECE8'),
    text: cleanHex(palette?.text, preset?.text ?? '17191D'),
    muted: cleanHex(palette?.muted, preset?.muted ?? '69706D'),
    primary: cleanHex(palette?.primary, preset?.primary ?? '24594D'),
    accent: cleanHex(palette?.accent, preset?.accent ?? '59C3A5')
  };
}

function cleanFontName(value: string | undefined): string | undefined {
  const cleaned = value?.replace(/[<>"']/g, '').trim().slice(0, 80);
  return cleaned || undefined;
}

function cleanHex(value: string | undefined, fallback: string): string {
  const normalized = value?.replace(/^#/, '').toUpperCase();
  return normalized && /^[0-9A-F]{6}$/.test(normalized) ? normalized : fallback;
}

function pdfFont(font: string): 'helvetica' | 'times' | 'courier' {
  if (/mono|courier|consolas|code/i.test(font)) return 'courier';
  if (/serif|times|georgia|garamond|cambria|palatino|baskerville/i.test(font)) return 'times';
  return 'helvetica';
}

function docxPageSize(
  pageSize: ResolvedDesign['pageSize'],
  orientation: ResolvedDesign['orientation']
) {
  const dimensions = pageSize === 'letter'
    ? { width: 12240, height: 15840 }
    : pageSize === 'legal'
      ? { width: 12240, height: 20160 }
      : { width: 11906, height: 16838 };
  return orientation === 'landscape'
    ? { ...dimensions, orientation: PageOrientation.LANDSCAPE }
    : dimensions;
}

function docxMargins(density: ResolvedDesign['density']) {
  const value = density === 'compact' ? 864 : density === 'airy' ? 1440 : 1134;
  return { top: value, right: value, bottom: value, left: value };
}

function mixHex(base: string, overlay: string, overlayWeight: number): string {
  const weight = Math.max(0, Math.min(1, overlayWeight));
  const channels = [0, 2, 4].map((offset) => {
    const baseChannel = Number.parseInt(base.slice(offset, offset + 2), 16);
    const overlayChannel = Number.parseInt(overlay.slice(offset, offset + 2), 16);
    return Math.round(baseChannel * (1 - weight) + overlayChannel * weight)
      .toString(16)
      .padStart(2, '0');
  });
  return channels.join('').toUpperCase();
}

function contrastHex(background: string, light: string, dark: string): string {
  const channels = [0, 2, 4].map((offset) => Number.parseInt(background.slice(offset, offset + 2), 16) / 255);
  const luminance = channels.reduce((sum, channel, index) => {
    const linear = channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
  return luminance < 0.42 ? light : dark;
}

function fileBase(artifact: ArtifactDocument): string {
  const clean = artifact.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return clean || 'delegators-artifact';
}
