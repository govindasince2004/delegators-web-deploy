import {
  ArtifactDocumentSchema,
  type ArtifactKind,
  type ArtifactPrimaryFormat
} from '../src/lib/shared.js';
import { jsonrepair } from 'jsonrepair';

type JsonRecord = Record<string, unknown>;

type NormalizeOptions = {
  expectedKind?: ArtifactKind;
  expectedPrimaryFormat?: ArtifactPrimaryFormat;
  fallbackTone?: string;
};

export function normalizeArtifactCandidate(value: unknown, options: NormalizeOptions = {}): unknown {
  const source = asRecord(value);
  if (!source) return value;

  const kind = normalizeKind(source.kind, options.expectedKind);
  const sections = normalizeSections(source.sections);
  const slides = normalizeSlides(source.slides ?? source.deck ?? source.presentation);
  const sheet = normalizeSheet(source.sheet ?? source.workbook ?? source.spreadsheet ?? source);

  const normalized: JsonRecord = {
    ...source,
    kind,
    primaryFormat: normalizePrimaryFormat(source.primaryFormat ?? source.outputFormat ?? source.format, options.expectedPrimaryFormat, kind),
    title: text(source.title ?? source.name ?? source.subject, 'Untitled artifact'),
    audience: text(source.audience ?? source.recipient ?? source.reader, 'User'),
    tone: text(source.tone ?? options.fallbackTone, 'professional'),
    executiveSummary: text(source.executiveSummary ?? source.summary ?? source.overview, ''),
    sections: sections.length > 0 ? sections : sectionsFromSlidesOrBody(slides, source),
    assets: [],
    citations: normalizeCitations(source.citations ?? source.sources),
    nextQuestions: stringArray(source.nextQuestions ?? source.questions).slice(0, 6),
    design: normalizeDesign(source.design ?? source.visualDesign ?? source.styling)
  };

  if (kind === 'resume') {
    normalized.resume = normalizeResume(source.resume ?? source.profile ?? source.cv, normalized.sections as JsonRecord[], source);
  } else if (source.resume) {
    normalized.resume = normalizeResume(source.resume, normalized.sections as JsonRecord[], source);
  }

  if (kind === 'deck' || slides.length > 0) {
    normalized.slides = slides.length > 0 ? slides : slidesFromSections(normalized.sections as JsonRecord[]);
  }

  if (kind === 'sheet' || sheet) {
    normalized.sheet = sheet ?? sheetFromSections(normalized.sections as JsonRecord[]);
  }

  return normalized;
}

export function parseArtifactCandidate(value: unknown, options: NormalizeOptions = {}) {
  return ArtifactDocumentSchema.safeParse(normalizeArtifactCandidate(value, options));
}

export function parseArtifactJson(content: string): unknown {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const candidates = [
    cleaned,
    start >= 0 && end > start ? cleaned.slice(start, end + 1) : ''
  ].filter((candidate, index, values) => candidate && values.indexOf(candidate) === index);

  let lastError: unknown = new Error('Model did not return JSON.');
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error;
    }
    try {
      return JSON.parse(jsonrepair(candidate));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export function artifactContainsInternalExecutionLeak(value: unknown): boolean {
  const serialized = JSON.stringify(value);
  return /\b(?:terminal_run|workspace_(?:read|write|list|delete|checkpoint)|artifact_(?:validate|export)|web_(?:search|fetch)|tool_call_id)\b|(?:^|[\s"'`])(?:input|drafts|research|versions|exports)\/[a-z0-9_.\/-]+/i.test(
    serialized
  );
}

function normalizeKind(value: unknown, fallback?: ArtifactKind): ArtifactKind {
  // @skill / request kind is authoritative — models often emit "report" for deck briefs.
  if (fallback) return fallback;
  const raw = String(value ?? 'report').trim().toLowerCase();
  if (raw === 'resume' || raw === 'deck' || raw === 'report' || raw === 'assignment' || raw === 'email' || raw === 'sheet') {
    return raw;
  }
  return 'report';
}

function normalizePrimaryFormat(
  value: unknown,
  fallback: ArtifactPrimaryFormat | undefined,
  kind: ArtifactKind
): ArtifactPrimaryFormat {
  // @ppt → pptx must win even when the model returns primaryFormat: "pdf".
  if (fallback) return fallback;
  const raw = String(value ?? '').trim().toLowerCase().replace(/^\./, '');
  if (raw === 'pdf' || raw === 'docx' || raw === 'pptx' || raw === 'xlsx') return raw;
  if (kind === 'deck') return 'pptx';
  if (kind === 'sheet') return 'xlsx';
  return kind === 'report' ? 'pdf' : 'docx';
}

function normalizeDesign(value: unknown): JsonRecord {
  const record = asRecord(value) ?? {};
  const colors = asRecord(record.palette ?? record.colors) ?? {};
  return {
    template: normalizedEnum(record.template ?? record.designTemplate ?? record.designSystem, [
      'executive-slate',
      'editorial-ivory',
      'consulting-mono',
      'modern-indigo',
      'midnight-aurora',
      'bold-pop',
      'cobalt-bold',
      'noir-lumina',
      'editorial-warm',
      'signal-orange',
      'classic-ats'
    ]),
    visualDirection: optionalText(record.visualDirection ?? record.direction ?? record.style),
    headingFontFamily: optionalText(record.headingFontFamily ?? record.headingFont ?? record.titleFont),
    bodyFontFamily: optionalText(record.bodyFontFamily ?? record.bodyFont ?? record.fontFamily ?? record.font),
    pageSize: normalizedEnum(record.pageSize ?? record.paperSize, ['a4', 'letter', 'legal']),
    orientation: normalizedEnum(record.orientation, ['portrait', 'landscape']),
    slideAspect: normalizeSlideAspect(record.slideAspect ?? record.aspectRatio),
    density: normalizedEnum(record.density ?? record.spacing, ['compact', 'balanced', 'airy']),
    includeTableOfContents: optionalBoolean(record.includeTableOfContents ?? record.tableOfContents ?? record.toc),
    includePageNumbers: optionalBoolean(record.includePageNumbers ?? record.pageNumbers),
    showSectionNumbers: optionalBoolean(record.showSectionNumbers ?? record.sectionNumbers),
    palette: compactRecord({
      background: normalizedHex(colors.background ?? colors.bg),
      surface: normalizedHex(colors.surface ?? colors.card),
      text: normalizedHex(colors.text ?? colors.foreground),
      muted: normalizedHex(colors.muted ?? colors.secondaryText),
      primary: normalizedHex(colors.primary ?? colors.brand),
      accent: normalizedHex(colors.accent ?? colors.highlight)
    })
  };
}

function normalizedEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return allowed.includes(normalized as T) ? normalized as T : undefined;
}

function normalizeSlideAspect(value: unknown): 'wide' | 'standard' | undefined {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'wide' || normalized === '16:9' || normalized === 'widescreen') return 'wide';
  if (normalized === 'standard' || normalized === '4:3') return 'standard';
  return undefined;
}

function normalizedHex(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(normalized)) return normalized.toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(normalized)) return `#${normalized.toUpperCase()}`;
  return undefined;
}

function optionalAssetId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return /^[A-Za-z0-9_-]{1,40}$/.test(normalized) ? normalized : undefined;
}

function compactRecord(value: JsonRecord): JsonRecord | undefined {
  const entries = Object.entries(value).filter(([, child]) => child !== undefined);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function normalizeSections(value: unknown): JsonRecord[] {
  const rawSections = array(value);
  return rawSections.map((raw, index) => normalizeSection(raw, index)).filter(Boolean) as JsonRecord[];
}

function normalizeSection(value: unknown, index: number): JsonRecord | null {
  const record = asRecord(value);
  if (!record) {
    const body = text(value, '');
    return body ? { heading: `Section ${index + 1}`, body, bullets: [] } : null;
  }

  const table = normalizeTable(record.table ?? record.data);
  const chart = normalizeChart(record.chart ?? record.graph ?? record.visualization);
  const section: JsonRecord = {
    heading: text(record.heading ?? record.title ?? record.name ?? record.label, `Section ${index + 1}`),
    body: text(record.body ?? record.content ?? record.summary ?? record.text ?? record.description, ''),
    bullets: stringArray(record.bullets ?? record.points ?? record.keyPoints ?? record.items).slice(0, 24),
    sourceIds: normalizeSourceIds(record.sourceIds ?? record.sources ?? record.citations)
  };
  if (table) section.table = table;
  if (chart) section.chart = chart;
  const imageAssetId = optionalAssetId(record.imageAssetId ?? record.imageId ?? record.assetId);
  if (imageAssetId) section.imageAssetId = imageAssetId;
  return section;
}

function normalizeSlides(value: unknown): JsonRecord[] {
  return array(value).map((raw, index) => {
    const record = asRecord(raw);
    if (!record) {
      return { title: `Slide ${index + 1}`, bullets: [text(raw, '')].filter(Boolean) };
    }
    const chart = normalizeChart(record.chart ?? record.graph ?? record.visualization);
    const table = normalizeTable(record.table ?? record.data);
    const metrics = normalizeSlideMetrics(record.metrics ?? record.stats ?? record.kpis);
    const columns = normalizeSlideColumns(record.columns ?? record.comparison);
    const slide: JsonRecord = {
      title: text(record.title ?? record.heading ?? record.name, `Slide ${index + 1}`),
      role: normalizedEnum(record.role ?? record.narrativeRole ?? record.job, [
        'opener', 'context', 'tension', 'evidence', 'insight', 'solution', 'plan', 'proof', 'close'
      ]),
      eyebrow: optionalText(record.eyebrow ?? record.sectionLabel),
      subtitle: optionalText(record.subtitle ?? record.kicker),
      bullets: stringArray(record.bullets ?? record.points ?? record.items ?? record.takeaways).slice(0, 8),
      sourceIds: normalizeSourceIds(record.sourceIds ?? record.sources ?? record.citations),
      speakerNotes: optionalText(record.speakerNotes ?? record.notes),
      layout: normalizedEnum(record.layout ?? record.composition, [
        'cover',
        'statement',
        'split',
        'grid',
        'list',
        'chart',
        'metric',
        'comparison',
        'timeline',
        'process',
        'quote',
        'image'
      ]),
      theme: normalizedEnum(record.theme ?? record.colorTreatment, ['light', 'dark', 'accent'])
    };
    const takeaway = optionalText(record.takeaway ?? record.keyMessage);
    const quote = optionalText(record.quote ?? record.pullQuote);
    const quoteAttribution = optionalText(record.quoteAttribution ?? record.attribution);
    if (takeaway) slide.takeaway = takeaway;
    if (metrics) slide.metrics = metrics;
    if (columns) slide.columns = columns;
    if (quote) slide.quote = quote;
    if (quoteAttribution) slide.quoteAttribution = quoteAttribution;
    const imageAssetId = optionalAssetId(record.imageAssetId ?? record.imageId ?? record.assetId);
    if (imageAssetId) slide.imageAssetId = imageAssetId;
    if (chart) slide.chart = chart;
    if (table) slide.table = table;
    return slide;
  }).filter((slide) =>
    (slide.bullets as string[]).length > 0 ||
    Boolean(slide.subtitle || slide.imageAssetId || slide.takeaway || slide.quote || slide.table || slide.chart || slide.metrics || slide.columns)
  );
}

function normalizeSlideMetrics(value: unknown): JsonRecord[] | undefined {
  const metrics = array(value).map((raw) => {
    const record = asRecord(raw);
    if (!record) return null;
    const valueText = optionalText(record.value ?? record.metric ?? record.number);
    const label = optionalText(record.label ?? record.name ?? record.title);
    if (!valueText || !label) return null;
    return compactRecord({
      value: valueText,
      label,
      detail: optionalText(record.detail ?? record.description ?? record.context)
    });
  }).filter(Boolean).slice(0, 4) as JsonRecord[];
  return metrics.length ? metrics : undefined;
}

function normalizeSlideColumns(value: unknown): JsonRecord[] | undefined {
  const columns = array(value).map((raw) => {
    const record = asRecord(raw);
    if (!record) return null;
    const heading = optionalText(record.heading ?? record.title ?? record.name ?? record.label);
    if (!heading) return null;
    return {
      heading,
      body: optionalText(record.body ?? record.summary ?? record.description),
      bullets: stringArray(record.bullets ?? record.points ?? record.items).slice(0, 5)
    };
  }).filter(Boolean).slice(0, 3) as JsonRecord[];
  return columns.length >= 2 ? columns : undefined;
}

function normalizeSourceIds(value: unknown): string[] {
  return stringArray(value)
    .map((item) => item.toUpperCase())
    .filter((item) => /^S\d+$/.test(item))
    .filter((item, index, values) => values.indexOf(item) === index)
    .slice(0, 8);
}

// Charts survive normalization: { type, title?, labels[], series[{name, values:number[]}], unit? }.
// Numeric strings are coerced; series lacking real numbers are dropped.
function normalizeChart(value: unknown): JsonRecord | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const rawType = String(record.type ?? record.chartType ?? '').trim().toLowerCase();
  const type = rawType === 'doughnut' ? 'donut' : rawType;
  if (!['bar', 'column', 'line', 'area', 'pie', 'donut'].includes(type)) return undefined;
  const labels = stringArray(record.labels ?? record.categories ?? record.x).slice(0, 24);
  if (labels.length === 0) return undefined;
  const series = array(record.series ?? record.datasets ?? record.data)
    .map((raw) => {
      const item = asRecord(raw);
      if (!item) return null;
      const values = array(item.values ?? item.data ?? item.y)
        .map((cell) => (typeof cell === 'number' ? cell : Number(String(cell).replace(/[^\d.+-]/g, ''))))
        .filter((cell) => Number.isFinite(cell))
        .slice(0, 24);
      if (values.length === 0) return null;
      return { name: text(item.name ?? item.label, 'Series'), values };
    })
    .filter(Boolean)
    .slice(0, 6) as JsonRecord[];
  if (series.length === 0) return undefined;
  return {
    type,
    title: optionalText(record.title ?? record.caption),
    labels,
    series,
    unit: optionalText(record.unit ?? record.valueUnit)
  };
}

function slidesFromSections(sections: JsonRecord[]): JsonRecord[] {
  return sections.slice(0, 12).map((section, index) => ({
    title: text(section.heading, `Slide ${index + 1}`),
    bullets: stringArray(section.bullets).length > 0
      ? stringArray(section.bullets).slice(0, 6)
      : [text(section.body, 'Review this section.').slice(0, 220)]
  }));
}

function sectionsFromSlidesOrBody(slides: JsonRecord[], source: JsonRecord): JsonRecord[] {
  if (slides.length > 0) {
    return slides.map((slide, index) => ({
      heading: text(slide.title, `Slide ${index + 1}`),
      body: text(slide.speakerNotes ?? slide.subtitle, ''),
      bullets: stringArray(slide.bullets).slice(0, 8)
    }));
  }
  const body = text(source.body ?? source.content ?? source.email ?? source.answer, '');
  return [{ heading: 'Draft', body, bullets: [] }];
}

function normalizeResume(value: unknown, sections: JsonRecord[], source: JsonRecord): JsonRecord {
  const record = asRecord(value) ?? {};
  const sectionBy = (pattern: RegExp) => sections.filter((section) => pattern.test(text(section.heading, '').toLowerCase()));
  const skillSections = sectionBy(/skill|technology|tool/);
  const skills = stringArray(record.skills ?? source.skills);
  const summarySection = sectionBy(/summary|profile|objective/)[0];

  return {
    name: optionalText(record.name ?? source.name),
    headline: optionalText(record.headline ?? record.title ?? source.headline),
    contact: stringArray(record.contact ?? source.contact).slice(0, 8),
    summary: optionalText(record.summary ?? summarySection?.body ?? source.summary),
    skills: skills.length > 0 ? skills : skillSections.flatMap((section) => stringArray(section.bullets)).slice(0, 40),
    experience: normalizeSections(record.experience).concat(sectionBy(/experience|work|employment/)).slice(0, 12),
    education: normalizeSections(record.education).concat(sectionBy(/education|degree|college|school/)).slice(0, 8),
    projects: normalizeSections(record.projects).concat(sectionBy(/project|portfolio/)).slice(0, 12)
  };
}

function normalizeSheet(value: unknown): JsonRecord | null {
  const record = asRecord(value);
  if (!record) return null;
  const rawSheets = array(record.sheets).length > 0 ? array(record.sheets) : [record];
  const sheets = rawSheets.map((raw, index) => {
    const sheet = asRecord(raw);
    if (!sheet) return null;
    const columns = stringArray(sheet.columns ?? sheet.headers).slice(0, 30);
    const rows = normalizeRows(sheet.rows ?? sheet.data, columns.length).slice(0, 500);
    if (columns.length === 0 || rows.length === 0) return null;
    return {
      name: text(sheet.name ?? sheet.title, `Sheet ${index + 1}`).slice(0, 31),
      columns,
      rows
    };
  }).filter(Boolean) as JsonRecord[];
  return sheets.length > 0 ? { sheets: sheets.slice(0, 6) } : null;
}

function sheetFromSections(sections: JsonRecord[]): JsonRecord | undefined {
  const sheets = sections.flatMap((section, index) => {
    const table = asRecord(section.table);
    if (!table) return [];
    const columns = stringArray(table.columns);
    const rows = normalizeRows(table.rows, columns.length);
    return columns.length && rows.length
      ? [{ name: text(section.heading, `Sheet ${index + 1}`).slice(0, 31), columns, rows }]
      : [];
  });
  return sheets.length > 0 ? { sheets: sheets.slice(0, 6) } : undefined;
}

function normalizeTable(value: unknown): JsonRecord | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const columns = stringArray(record.columns ?? record.headers).slice(0, 16);
  const rows = normalizeRows(record.rows ?? record.data, columns.length).slice(0, 80);
  return columns.length && rows.length ? { columns, rows } : undefined;
}

function normalizeRows(value: unknown, width: number): string[][] {
  return array(value).map((row) => {
    if (Array.isArray(row)) return row.slice(0, width || 30).map((cell) => text(cell, ''));
    const record = asRecord(row);
    if (!record) return [text(row, '')].filter(Boolean);
    const keys = Object.keys(record).slice(0, width || 30);
    return keys.map((key) => text(record[key], ''));
  }).filter((row) => row.length > 0);
}

function normalizeCitations(value: unknown): JsonRecord[] {
  return array(value).flatMap((raw): JsonRecord[] => {
    const record = asRecord(raw);
    if (!record) {
      const label = text(raw, '');
      return label ? [{ label }] : [];
    }
    const citation = compactRecord({
      id: normalizeSourceIds([record.id ?? record.sourceId])[0],
      label: text(record.label ?? record.title ?? record.name, ''),
      url: optionalText(record.url ?? record.href)
    });
    return citation && text(citation.label, '') ? [citation] : [];
  }).slice(0, 20);
}

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item, '')).filter(Boolean);
}

function optionalText(value: unknown): string | undefined {
  const out = text(value, '');
  return out || undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (['true', 'yes', 'include', 'show', 'on'].includes(normalized)) return true;
  if (['false', 'no', 'exclude', 'hide', 'off'].includes(normalized)) return false;
  return undefined;
}

function text(value: unknown, fallback: string): string {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}
