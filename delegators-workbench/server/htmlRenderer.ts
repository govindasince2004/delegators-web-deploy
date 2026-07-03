import fs from 'node:fs';
import puppeteer, { type Browser } from 'puppeteer-core';
import type { ArtifactChart, ArtifactDocument, ArtifactSection } from '../src/lib/shared.js';
import {
  formattedCitationLine,
  htmlClaimText,
  methodologyBody,
  methodologyBullets,
  orderedCitationsForExport
} from './citationExport.js';

// HTML → PDF rendering through headless Chromium: real typography, real layout
// (grid/flex covers, stat cards, chapter numerals, conic-gradient donuts),
// which vector-primitive jsPDF can never reach. Used for document-shaped PDFs
// (report, assignment, email, resume); decks keep the native slide renderer.
// Best-effort by contract: every caller falls back to jsPDF when Chromium is
// unavailable, so dev hosts and tests never require a browser install.

export type RendererDesign = {
  headingFont: string;
  bodyFont: string;
  pageSize: 'a4' | 'letter' | 'legal';
  orientation: 'portrait' | 'landscape';
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

const chromiumCandidates = [
  process.env.WORKBENCH_CHROMIUM_PATH ?? '',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/snap/bin/chromium'
].filter(Boolean);

let browserPromise: Promise<Browser> | null = null;

function chromiumExecutable(): string | null {
  for (const candidate of chromiumCandidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // Ignore probe errors; fall through to the next candidate.
    }
  }
  return null;
}

export function htmlRendererAvailable(): boolean {
  return chromiumExecutable() !== null;
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const executablePath = chromiumExecutable();
    if (!executablePath) throw new Error('No Chromium executable available for PDF rendering.');
    browserPromise = puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=none']
    }).then((browser) => {
      browser.once('disconnected', () => {
        browserPromise = null;
      });
      return browser;
    }).catch((error) => {
      browserPromise = null;
      throw error;
    });
  }
  return browserPromise;
}

export async function renderHtmlPdf(html: string, design: RendererDesign): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // Everything is inline (no network fetches) and the chart canvases draw
    // synchronously during parse, so 'load' is a complete render barrier.
    await page.setContent(html, { waitUntil: 'load', timeout: 30_000 });
    const footer = design.includePageNumbers
      ? {
          displayHeaderFooter: true,
          headerTemplate: '<span></span>',
          footerTemplate: [
            `<div style="width:100%;font-size:8px;color:#${design.muted};padding:0 48px;display:flex;justify-content:flex-end;font-family:Helvetica,Arial,sans-serif;">`,
            '<span class="pageNumber"></span><span style="margin:0 2px;">/</span><span class="totalPages"></span>',
            '</div>'
          ].join('')
        }
      : { displayHeaderFooter: false };
    const pdf = await page.pdf({
      format: design.pageSize === 'a4' ? 'A4' : design.pageSize === 'letter' ? 'Letter' : 'Legal',
      landscape: design.orientation === 'landscape',
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: '0', bottom: design.includePageNumbers ? '36px' : '0', left: '0', right: '0' },
      ...footer,
      timeout: 30_000
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => undefined);
  }
}

export function buildDocumentHtml(artifact: ArtifactDocument, design: RendererDesign): string {
  if (artifact.kind === 'resume' && artifact.resume) {
    return resumeHtml(artifact, design);
  }
  return reportHtml(artifact, design);
}

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fontStacks(design: RendererDesign): { heading: string; body: string } {
  const serifHint = /serif|georgia|times|garamond|cambria|palatino|baskerville|playfair|ivory/i;
  const serifStack = `'Noto Serif', Georgia, 'Times New Roman', 'DejaVu Serif', serif`;
  const sansStack = `Inter, 'Noto Sans', 'Segoe UI', Helvetica, 'DejaVu Sans', Arial, sans-serif`;
  return {
    heading: serifHint.test(design.headingFont) ? serifStack : sansStack,
    body: serifHint.test(design.bodyFont) ? serifStack : sansStack
  };
}

function isDark(hex: string): boolean {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 110;
}

function paragraphs(body: string): string {
  return body
    .split(/\n{2,}|\n(?=[-•])/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${esc(part)}</p>`)
    .join('');
}

function paragraphsFromClaims(body: string, sourceIds?: string[]): string {
  return htmlClaimText(body, sourceIds)
    .split(/\n{2,}|\n(?=[-•])/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${part}</p>`)
    .join('');
}

function tableHtml(table: NonNullable<ArtifactSection['table']>): string {
  const head = table.columns.map((column) => `<th>${esc(column)}</th>`).join('');
  const body = table.rows
    .map((row) => {
      const cells = table.columns
        .map((_, index) => {
          const cell = row[index] ?? '';
          const numeric = /^-?[\d,.]+%?$/.test(cell.trim());
          return `<td${numeric ? ' class="num"' : ''}>${esc(cell)}</td>`;
        })
        .join('');
      const isTotal = /^(?:grand\s+)?(?:total|subtotal|net|sum)\b/i.test((row[0] ?? '').trim());
      return `<tr${isTotal ? ' class="total"' : ''}>${cells}</tr>`;
    })
    .join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

let chartSeq = 0;

function chartHtml(chart: ArtifactChart, design: RendererDesign): string {
  const series = chart.series.slice(0, 6);
  if (!series.length || !chart.labels.length) return '';
  const palette = [design.accent, design.primary, mix(design.accent, design.text, 0.45), mix(design.primary, design.background, 0.35), design.muted, mix(design.accent, design.background, 0.5)];
  const title = chart.title ? `<div class="chart-title">${esc(chart.title)}${chart.unit ? ` <span class="chart-unit">(${esc(chart.unit)})</span>` : ''}</div>` : '';
  const legend = series.length > 1 || chart.type === 'pie' || chart.type === 'donut'
    ? `<div class="chart-legend">${(chart.type === 'pie' || chart.type === 'donut' ? chart.labels : series.map((s) => s.name))
        .map((name, index) => `<span><i style="background:#${palette[index % palette.length]}"></i>${esc(name)}</span>`)
        .join('')}</div>`
    : '';

  if (chart.type === 'pie' || chart.type === 'donut') {
    const values = series[0].values.slice(0, chart.labels.length).map((value) => Math.max(0, value));
    const total = values.reduce((sum, value) => sum + value, 0) || 1;
    let angle = 0;
    const stops = values.map((value, index) => {
      const start = angle;
      angle += (value / total) * 360;
      return `#${palette[index % palette.length]} ${start.toFixed(2)}deg ${angle.toFixed(2)}deg`;
    });
    const hole = chart.type === 'donut'
      ? `<div class="donut-hole" style="background:#${design.background}"></div>`
      : '';
    return `<figure class="chart">${title}<div class="pie-wrap"><div class="pie" style="background:conic-gradient(${stops.join(',')})">${hole}</div>${legend}</div></figure>`;
  }

  if (chart.type === 'line' || chart.type === 'area') {
    const id = `chart-canvas-${++chartSeq}`;
    const payload = JSON.stringify({
      labels: chart.labels,
      series: series.map((s, index) => ({ name: s.name, values: s.values, color: `#${palette[index % palette.length]}` })),
      area: chart.type === 'area',
      text: `#${design.muted}`,
      grid: `#${mix(design.muted, design.background, 0.75)}`
    }).replace(/</g, '\\u003c');
    return [
      `<figure class="chart">${title}`,
      `<canvas id="${id}" width="1280" height="520" style="width:100%;height:auto;"></canvas>`,
      `<script>drawLineChart(${JSON.stringify(id)}, ${payload});</script>`,
      `${legend}</figure>`
    ].join('');
  }

  // bar / column as pure CSS — crisp at print resolution, no images.
  const max = Math.max(...series.flatMap((s) => s.values.map((value) => Math.abs(value))), 1);
  if (chart.type === 'bar') {
    const rows = chart.labels.map((label, labelIndex) => {
      const bars = series.map((s, seriesIndex) => {
        const value = s.values[labelIndex] ?? 0;
        return `<div class="hbar" style="width:${((Math.abs(value) / max) * 100).toFixed(1)}%;background:#${palette[seriesIndex % palette.length]}"><span>${formatNumber(value)}</span></div>`;
      }).join('');
      return `<div class="hbar-row"><div class="hbar-label">${esc(label)}</div><div class="hbar-track">${bars}</div></div>`;
    }).join('');
    return `<figure class="chart">${title}<div class="hbar-chart">${rows}</div>${legend}</figure>`;
  }

  const groups = chart.labels.map((label, labelIndex) => {
    const bars = series.map((s, seriesIndex) => {
      const value = s.values[labelIndex] ?? 0;
      return `<div class="vbar" style="height:${((Math.abs(value) / max) * 100).toFixed(1)}%;background:#${palette[seriesIndex % palette.length]}"><span>${formatNumber(value)}</span></div>`;
    }).join('');
    return `<div class="vbar-group"><div class="vbar-stack">${bars}</div><div class="vbar-label">${esc(label)}</div></div>`;
  }).join('');
  return `<figure class="chart">${title}<div class="vbar-chart">${groups}</div>${legend}</figure>`;
}

function formatNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 10_000_000) return `${(value / 10_000_000).toFixed(1).replace(/\.0$/, '')}Cr`;
  if (abs >= 100_000) return `${(value / 100_000).toFixed(1).replace(/\.0$/, '')}L`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${Math.round(value * 100) / 100}`;
}

function mix(a: string, b: string, t: number): string {
  const channel = (offset: number) => {
    const x = parseInt(a.slice(offset, offset + 2), 16);
    const y = parseInt(b.slice(offset, offset + 2), 16);
    return Math.round(x + (y - x) * t).toString(16).padStart(2, '0').toUpperCase();
  };
  return `${channel(0)}${channel(2)}${channel(4)}`;
}

const lineChartScript = `
function drawLineChart(id, data) {
  var canvas = document.getElementById(id);
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  var padL = 90, padR = 30, padT = 28, padB = 64;
  var all = [];
  data.series.forEach(function (s) { s.values.forEach(function (v) { all.push(v); }); });
  var max = Math.max.apply(null, all.concat([0]));
  var min = Math.min.apply(null, all.concat([0]));
  if (max === min) { max = min + 1; }
  var span = max - min;
  var rawMin = min;
  max += span * 0.08; min -= span * 0.08;
  if (rawMin >= 0 && min < 0) { min = 0; }
  var n = data.labels.length;
  function px(i) { return padL + (n <= 1 ? 0 : (W - padL - padR) * i / (n - 1)); }
  function py(v) { return padT + (H - padT - padB) * (1 - (v - min) / (max - min)); }
  ctx.strokeStyle = data.grid; ctx.lineWidth = 1.5; ctx.font = '20px sans-serif'; ctx.fillStyle = data.text;
  for (var g = 0; g <= 4; g++) {
    var gv = min + (max - min) * g / 4, gy = py(gv);
    ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(W - padR, gy); ctx.stroke();
    ctx.textAlign = 'right'; ctx.fillText(Math.round(gv * 100) / 100 + '', padL - 12, gy + 7);
  }
  ctx.textAlign = 'center';
  var step = Math.max(1, Math.ceil(n / 8));
  for (var i = 0; i < n; i += step) { ctx.fillText(data.labels[i], px(i), H - padB + 34); }
  data.series.forEach(function (s) {
    if (data.area) {
      ctx.beginPath(); ctx.moveTo(px(0), py(Math.max(min, 0)));
      s.values.forEach(function (v, i) { ctx.lineTo(px(i), py(v)); });
      ctx.lineTo(px(s.values.length - 1), py(Math.max(min, 0))); ctx.closePath();
      ctx.globalAlpha = 0.16; ctx.fillStyle = s.color; ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.beginPath(); ctx.strokeStyle = s.color; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    s.values.forEach(function (v, i) { if (i === 0) { ctx.moveTo(px(i), py(v)); } else { ctx.lineTo(px(i), py(v)); } });
    ctx.stroke();
    ctx.fillStyle = s.color;
    s.values.forEach(function (v, i) { ctx.beginPath(); ctx.arc(px(i), py(v), 6, 0, Math.PI * 2); ctx.fill(); });
  });
}
`;

function baseCss(design: RendererDesign, fonts: { heading: string; body: string }): string {
  const margin = design.density === 'compact' ? '13mm' : design.density === 'airy' ? '20mm' : '16mm';
  return `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: ${fonts.body}; color: #${design.text}; background: #${design.background}; font-size: 10.5pt; line-height: 1.55; }
  .page { padding: ${margin} ${margin}; }
  h1, h2, h3 { font-family: ${fonts.heading}; line-height: 1.15; }
  p { margin: 0 0 7pt; }
  .chart { margin: 12pt 0 14pt; page-break-inside: avoid; }
  .chart-title { font-weight: 600; font-size: 9.5pt; margin-bottom: 7pt; color: #${design.text}; }
  .chart-unit { color: #${design.muted}; font-weight: 400; }
  .chart-legend { display: flex; flex-wrap: wrap; gap: 4pt 12pt; margin-top: 7pt; font-size: 8pt; color: #${design.muted}; }
  .chart-legend i { display: inline-block; width: 8pt; height: 8pt; border-radius: 2pt; margin-right: 4pt; vertical-align: -1pt; }
  .vbar-chart { display: flex; align-items: flex-end; gap: 10pt; height: 150pt; border-bottom: 1.2pt solid #${mix(design.muted, design.background, 0.6)}; }
  .vbar-group { flex: 1; display: flex; flex-direction: column; height: 100%; min-width: 0; }
  .vbar-stack { flex: 1; display: flex; align-items: flex-end; justify-content: center; gap: 3pt; }
  .vbar { width: 100%; max-width: 26pt; border-radius: 2.5pt 2.5pt 0 0; position: relative; min-height: 2pt; }
  .vbar span { position: absolute; top: -12pt; left: 50%; transform: translateX(-50%); font-size: 7pt; color: #${design.muted}; white-space: nowrap; }
  .vbar-label { text-align: center; font-size: 7.5pt; color: #${design.muted}; padding-top: 5pt; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hbar-chart { display: flex; flex-direction: column; gap: 7pt; }
  .hbar-row { display: flex; align-items: center; gap: 8pt; }
  .hbar-label { width: 90pt; font-size: 8pt; color: #${design.muted}; text-align: right; flex-shrink: 0; }
  .hbar-track { flex: 1; display: flex; flex-direction: column; gap: 2pt; }
  .hbar { height: 11pt; border-radius: 0 2.5pt 2.5pt 0; position: relative; min-width: 2pt; }
  .hbar span { position: absolute; right: -4pt; transform: translateX(100%); top: 0.5pt; font-size: 7pt; color: #${design.muted}; }
  .pie-wrap { display: flex; align-items: center; gap: 18pt; }
  .pie { width: 130pt; height: 130pt; border-radius: 50%; position: relative; flex-shrink: 0; }
  .donut-hole { position: absolute; inset: 26%; border-radius: 50%; }
  .pie-wrap .chart-legend { flex-direction: column; gap: 5pt; margin-top: 0; }
  table { width: 100%; border-collapse: collapse; margin: 10pt 0 12pt; font-size: 9pt; page-break-inside: avoid; }
  th { text-align: left; font-size: 8pt; letter-spacing: 0.06em; text-transform: uppercase; color: #${design.background}; background: #${design.primary}; padding: 6pt 8pt; }
  td { padding: 5.5pt 8pt; border-bottom: 0.6pt solid #${mix(design.muted, design.background, 0.72)}; vertical-align: top; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tbody tr:nth-child(even) td { background: #${mix(design.surface, design.background, 0.45)}; }
  tr.total td { font-weight: 700; border-top: 1.6pt solid #${design.primary}; background: #${mix(design.primary, design.background, 0.92)}; }
  ul { margin: 2pt 0 9pt 0; padding-left: 0; list-style: none; }
  ul li { padding: 2.5pt 0 2.5pt 14pt; position: relative; }
  ul li::before { content: ''; position: absolute; left: 0; top: 8.5pt; width: 6pt; height: 2.2pt; border-radius: 1pt; background: #${design.accent}; }
  `;
}

// ---------------------------------------------------------------------------
// Report / assignment / email document
// ---------------------------------------------------------------------------

function reportHtml(artifact: ArtifactDocument, design: RendererDesign): string {
  chartSeq = 0;
  const fonts = fontStacks(design);
  const darkCover = isDark(design.background) ? design.background : design.primary;
  const coverText = isDark(darkCover) ? 'FFFFFF' : design.background;
  const date = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  const isLetter = artifact.kind === 'email';

  const cover = isLetter ? '' : `
  <section class="cover">
    <div class="cover-rule"></div>
    <div class="cover-kicker">${esc(artifact.audience || 'Prepared report')}</div>
    <h1>${esc(artifact.title)}</h1>
    ${artifact.executiveSummary ? `<p class="cover-summary">${esc(firstSentences(artifact.executiveSummary, 2))}</p>` : ''}
    <div class="cover-meta">${esc(date)}</div>
  </section>`;

  const wantsToc = !isLetter && (design.includeTableOfContents || artifact.sections.length > 5);
  const toc = wantsToc ? `
  <section class="page toc-page">
    <h2 class="toc-heading">Contents</h2>
    <ol class="toc">
      ${artifact.sections.map((section, index) => `<li><span class="toc-num">${String(index + 1).padStart(2, '0')}</span><span class="toc-label">${esc(section.heading)}</span></li>`).join('')}
    </ol>
  </section>` : '';

  const summary = !isLetter && artifact.executiveSummary ? `
    <div class="exec-summary">
      <div class="exec-kicker">Executive summary</div>
      ${paragraphs(artifact.executiveSummary)}
    </div>` : '';

  const sections = artifact.sections.map((section, index) => {
    const image = section.imageAssetId
      ? artifact.assets.find((asset) => asset.id === section.imageAssetId)
      : undefined;
    return `
    <section class="doc-section">
      <header class="section-header">
        ${design.showSectionNumbers && !isLetter ? `<div class="section-num">${String(index + 1).padStart(2, '0')}</div>` : ''}
        <h2>${esc(section.heading)}</h2>
      </header>
      ${section.body ? paragraphsFromClaims(section.body, section.sourceIds) : ''}
      ${image ? `<figure class="source-image"><img src="${esc(image.dataUri)}" alt="${esc(image.alt)}"><figcaption>${esc(image.alt)} · Source: ${esc(image.attribution)}</figcaption></figure>` : ''}
      ${section.bullets.length ? `<ul>${section.bullets.map((bullet) => `<li>${htmlClaimText(bullet, section.sourceIds)}</li>`).join('')}</ul>` : ''}
      ${section.chart ? chartHtml(section.chart, design) : ''}
      ${section.table ? tableHtml(section.table) : ''}
    </section>`;
  }).join('');

  const exportCitations = orderedCitationsForExport(artifact);
  const citations = exportCitations.length ? `
    <section class="doc-section methodology">
      <header class="section-header"><h2>Methodology &amp; limitations</h2></header>
      <p>${esc(methodologyBody())}</p>
      <ul>${methodologyBullets().map((bullet) => `<li>${esc(bullet)}</li>`).join('')}</ul>
    </section>
    <section class="doc-section sources">
      <header class="section-header"><h2>Sources</h2></header>
      <ol class="citation-list">
        ${exportCitations.map((citation) => `<li>${esc(formattedCitationLine(citation))}</li>`).join('')}
      </ol>
    </section>` : '';

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
${baseCss(design, fonts)}
.cover { height: 100vh; background: #${darkCover}; color: #${coverText}; padding: 22mm 18mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
.cover-rule { width: 52pt; height: 4.5pt; background: #${design.accent}; border-radius: 2pt; margin-bottom: 22pt; }
.cover-kicker { font-size: 10pt; letter-spacing: 0.18em; text-transform: uppercase; opacity: 0.74; margin-bottom: 14pt; }
.cover h1 { font-size: 33pt; font-weight: 800; letter-spacing: -0.015em; max-width: 88%; margin-bottom: 18pt; }
.cover-summary { font-size: 12pt; line-height: 1.6; opacity: 0.86; max-width: 80%; }
.cover-meta { margin-top: auto; font-size: 9.5pt; opacity: 0.6; }
.toc-page { page-break-after: always; padding-top: 26mm; }
.toc-heading { font-size: 19pt; margin-bottom: 18pt; }
.toc { list-style: none; counter-reset: none; }
.toc li { display: flex; align-items: baseline; gap: 12pt; padding: 7pt 0; border-bottom: 0.6pt solid #${mix(design.muted, design.background, 0.74)}; }
.toc-num { font-weight: 700; color: #${design.accent}; font-size: 10.5pt; font-variant-numeric: tabular-nums; }
.toc-label { font-size: 11pt; }
.exec-summary { background: #${mix(design.surface, design.background, 0.35)}; border-left: 3.5pt solid #${design.accent}; padding: 12pt 14pt; margin: 0 0 18pt; border-radius: 0 4pt 4pt 0; }
.source-ids { margin-top: 7pt; color: #${design.muted}; font-size: 7.5pt; letter-spacing: 0.02em; }
.exec-kicker { font-size: 8pt; letter-spacing: 0.14em; text-transform: uppercase; color: #${design.muted}; font-weight: 700; margin-bottom: 6pt; }
.doc-section { margin-bottom: 17pt; }
.source-image { margin: 10pt 0 13pt; page-break-inside: avoid; }
.source-image img { display: block; width: 100%; max-height: 260pt; object-fit: contain; border-radius: 4pt; background: #${mix(design.surface, design.background, 0.35)}; }
.source-image figcaption { margin-top: 4pt; color: #${design.muted}; font-size: 7.5pt; text-align: right; }
.section-header { display: flex; align-items: baseline; gap: 10pt; margin-bottom: 8pt; padding-bottom: 5pt; border-bottom: 1.4pt solid #${mix(design.primary, design.background, 0.78)}; }
.section-num { font-size: 17pt; font-weight: 800; color: #${design.accent}; font-variant-numeric: tabular-nums; }
.section-header h2 { font-size: 14.5pt; font-weight: 750; letter-spacing: -0.01em; }
.citation-list { padding-left: 14pt; font-size: 9pt; }
.citation-list li { padding: 2.5pt 0; }
.citation-url { color: #${design.accent}; word-break: break-all; }
.cite-ref { font-size: 0.72em; vertical-align: super; color: #${design.accent}; font-weight: 700; margin-left: 1pt; }
.methodology ul { margin-top: 8pt; padding-left: 14pt; font-size: 9.5pt; }
</style><script>${lineChartScript}</script></head>
<body>
${cover}
${toc}
<main class="page">
${isLetter ? `<h1 style="font-size:17pt;margin-bottom:11pt;">${esc(artifact.title)}</h1>` : ''}
${summary}
${sections}
${citations}
</main>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Resume — classic ATS single column, or accent two-column for modern systems
// ---------------------------------------------------------------------------

function resumeHtml(artifact: ArtifactDocument, design: RendererDesign): string {
  const resume = artifact.resume!;
  const fonts = fontStacks(design);
  const classic = (artifact.design?.template ?? 'classic-ats') === 'classic-ats';
  const name = resume.name || artifact.title;
  const entryHtml = (entry: ArtifactSection) => `
    <div class="entry">
      <div class="entry-head">
        <span class="entry-title">${esc(entry.heading)}</span>
        ${entryDate(entry) ? `<span class="entry-date">${esc(entryDate(entry)!)}</span>` : ''}
      </div>
      ${entry.body && !entryDate(entry) ? `<div class="entry-sub">${esc(entry.body)}</div>` : ''}
      ${entry.bullets.length ? `<ul>${entry.bullets.map((bullet) => `<li>${esc(bullet)}</li>`).join('')}</ul>` : ''}
    </div>`;

  const block = (label: string, entries: ArtifactSection[]) => entries.length
    ? `<section class="rblock"><h2>${esc(label)}</h2>${entries.map(entryHtml).join('')}</section>`
    : '';

  const skillsHtml = resume.skills.length
    ? `<section class="rblock"><h2>Skills</h2><div class="skills">${resume.skills.map((skill) => `<span>${esc(skill)}</span>`).join('')}</div></section>`
    : '';

  const summaryHtml = resume.summary
    ? `<section class="rblock"><h2>Summary</h2><p>${esc(resume.summary)}</p></section>`
    : '';

  const contact = resume.contact.map((item) => esc(item)).join('<span class="dot">•</span>');

  const shared = `
  ${baseCss(design, fonts)}
  body { font-size: ${classic ? '10pt' : '9.8pt'}; }
  .rblock { margin-bottom: 12pt; }
  .rblock h2 { font-size: 10.2pt; letter-spacing: 0.13em; text-transform: uppercase; color: #${classic ? design.text : design.primary};
    border-bottom: ${classic ? `0.9pt solid #${design.text}` : `1.4pt solid #${mix(design.primary, design.background, 0.6)}`}; padding-bottom: 2.5pt; margin-bottom: 7pt; }
  .entry { margin-bottom: 8pt; page-break-inside: avoid; }
  .entry-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10pt; }
  .entry-title { font-weight: 700; font-size: 10.3pt; }
  .entry-date { color: #${design.muted}; font-size: 8.8pt; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .entry-sub { font-style: italic; color: #${design.muted}; font-size: 9.2pt; margin: 1pt 0 2pt; }
  ul li { padding: 1.6pt 0 1.6pt 12pt; }
  ul { margin-bottom: 3pt; }
  .skills { display: flex; flex-wrap: wrap; gap: 4pt; }
  .skills span { background: #${mix(design.surface, design.background, classic ? 0.2 : 0.0)}; border: 0.6pt solid #${mix(design.muted, design.background, 0.6)};
    padding: 2pt 7pt; border-radius: 3pt; font-size: 8.6pt; }
  .dot { margin: 0 5pt; color: #${design.muted}; }
  `;

  if (classic) {
    return `<!doctype html>
<html><head><meta charset="utf-8"><style>
${shared}
.head { text-align: center; margin-bottom: 13pt; }
.head h1 { font-size: 21pt; font-weight: 800; letter-spacing: 0.01em; }
.headline { color: #${design.muted}; font-size: 10.5pt; margin-top: 2pt; }
.contact { font-size: 8.8pt; color: #${design.muted}; margin-top: 4pt; }
</style></head><body><main class="page">
<header class="head">
  <h1>${esc(name)}</h1>
  ${resume.headline ? `<div class="headline">${esc(resume.headline)}</div>` : ''}
  ${contact ? `<div class="contact">${contact}</div>` : ''}
</header>
${summaryHtml}
${block('Experience', resume.experience)}
${block('Projects', resume.projects)}
${block('Education', resume.education)}
${skillsHtml}
</main></body></html>`;
  }

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
${shared}
body { background: #${design.background}; }
.layout { display: grid; grid-template-columns: 1fr 58mm; min-height: 100vh; }
.main { padding: 14mm 10mm 14mm 14mm; }
.side { background: #${mix(design.surface, design.background, 0.25)}; padding: 14mm 10mm; border-left: 0.7pt solid #${mix(design.muted, design.background, 0.7)}; }
.name-band { margin-bottom: 13pt; }
.name-band h1 { font-size: 20pt; font-weight: 800; color: #${design.primary}; letter-spacing: -0.01em; }
.headline { color: #${design.muted}; font-size: 10.4pt; margin-top: 2pt; }
.side .rblock h2 { font-size: 9pt; }
.side ul li { font-size: 9pt; }
.side .entry-head { display: block; }
.side .entry-date { display: block; margin-top: 1pt; }
.contact-list { list-style: none; font-size: 8.8pt; }
.contact-list li { padding: 2pt 0; padding-left: 0; }
.contact-list li::before { content: none; }
</style></head><body><div class="layout">
<div class="main">
  <header class="name-band">
    <h1>${esc(name)}</h1>
    ${resume.headline ? `<div class="headline">${esc(resume.headline)}</div>` : ''}
  </header>
  ${summaryHtml}
  ${block('Experience', resume.experience)}
  ${block('Projects', resume.projects)}
</div>
<aside class="side">
  ${contact ? `<section class="rblock"><h2>Contact</h2><ul class="contact-list">${resume.contact.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></section>` : ''}
  ${skillsHtml}
  ${block('Education', resume.education)}
</aside>
</div></body></html>`;
}

function entryDate(entry: ArtifactSection): string | null {
  const body = entry.body?.trim() ?? '';
  // Resume entry bodies are often just the date range; surface those on the
  // heading line the way the ATS reference templates do.
  return body && body.length <= 44 && /\d{4}|present|current/i.test(body) ? body : null;
}

function firstSentences(text: string, count: number): string {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  return sentences.slice(0, count).join(' ');
}
