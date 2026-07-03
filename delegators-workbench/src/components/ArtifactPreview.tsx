import { FileText, Mail, Presentation, Sheet } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { GalleryDeckSlide } from './GalleryDeckSlide';
import { GalleryDocumentSection } from './GalleryDocumentSection';
import type { ArtifactDocument, ArtifactSection, Slide } from '../lib/shared';

type PreviewVariant = 'default' | 'template-gallery';

type Props = {
  artifact: ArtifactDocument | null;
  variant?: PreviewVariant;
};

type PreviewVars = CSSProperties & Record<`--artifact-${string}`, string>;

export function ArtifactPreview({ artifact, variant = 'default' }: Props) {
  if (!artifact) {
    return (
      <div className="empty-preview">
        <div className="empty-preview-icon" aria-hidden="true"><FileText /></div>
        <h3>No artifact yet</h3>
      </div>
    );
  }

  const style = previewVariables(artifact);
  const galleryClass = variant === 'template-gallery' ? 'artifact-preview--gallery' : '';
  const preview = (() => {
    if (artifact.kind === 'deck') return <DeckPreview artifact={artifact} style={style} variant={variant} />;
    if (artifact.kind === 'sheet') return <SheetPreview artifact={artifact} style={style} variant={variant} />;
    if (artifact.kind === 'resume') return <ResumePreview artifact={artifact} style={style} variant={variant} />;
    if (artifact.kind === 'email') return <EmailPreview artifact={artifact} style={style} variant={variant} />;
    return <DocumentPreview artifact={artifact} style={style} variant={variant} />;
  })();

  return galleryClass ? <div className={galleryClass}>{preview}</div> : preview;
}

function DocumentPreview({ artifact, style, variant }: { artifact: ArtifactDocument; style: PreviewVars; variant: PreviewVariant }) {
  const galleryDoc = variant === 'template-gallery' ? 'document-preview--gallery' : '';
  return (
    <article className={`document-preview ${galleryDoc} ${artifact.design.orientation === 'landscape' ? 'landscape' : ''} ${artifact.design.showSectionNumbers === false ? 'without-section-numbers' : ''}`} style={style}>
      <header className="document-cover">
        <span>{artifact.primaryFormat === 'docx' ? 'Editable document' : artifact.kind}</span>
        <h1>{artifact.title}</h1>
        <p>{artifact.audience}</p>
      </header>
      {artifact.executiveSummary ? (
        <section className="document-summary">
          <small>Summary</small>
          <p>{artifact.executiveSummary}</p>
        </section>
      ) : null}
      <div className="document-sections">
        {artifact.sections.map((section, index) =>
          variant === 'template-gallery' ? (
            <GalleryDocumentSection
              key={`${section.heading}-${index}`}
              section={section}
              index={index}
              showSectionNumbers={artifact.design.showSectionNumbers !== false}
            />
          ) : (
            <PreviewSection key={`${section.heading}-${index}`} artifact={artifact} section={section} index={index} variant={variant} />
          )
        )}
      </div>
      {variant !== 'template-gallery' ? <CitationBlock artifact={artifact} /> : null}
    </article>
  );
}

function ResumePreview({ artifact, style, variant }: { artifact: ArtifactDocument; style: PreviewVars; variant: PreviewVariant }) {
  const resume = artifact.resume;
  if (!resume) return <DocumentPreview artifact={artifact} style={style} variant={variant} />;
  const sections = [
    ...resume.experience.map((section) => ({ ...section, group: 'Experience' })),
    ...resume.projects.map((section) => ({ ...section, group: 'Projects' })),
    ...resume.education.map((section) => ({ ...section, group: 'Education' }))
  ];
  const galleryLayout = variant === 'template-gallery' ? resolveGalleryResumeLayout(artifact.design.visualDirection) : null;
  const galleryResume = variant === 'template-gallery'
    ? `resume-preview--gallery${galleryLayout ? ` resume-preview--gallery-${galleryLayout}` : ''}`
    : '';
  return (
    <article className={`resume-preview ${galleryResume}`} style={style}>
      <header>
        <h1>{resume.name || artifact.title}</h1>
        {resume.headline ? <p>{resume.headline}</p> : null}
        {resume.contact.length ? <small>{resume.contact.join(' · ')}</small> : null}
      </header>
      <div className="resume-preview-grid">
        <aside>
          {resume.summary ? <section><h2>Profile</h2><p>{resume.summary}</p></section> : null}
          {resume.skills.length ? (
            <section>
              <h2>Skills</h2>
              <div className="resume-skills">{resume.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
            </section>
          ) : null}
        </aside>
        <main>
          {sections.length ? sections.map((section, index) => (
            <section key={`${section.group}-${section.heading}-${index}`}>
              <small>{section.group}</small>
              <h2>{section.heading}</h2>
              {section.body ? <p>{section.body}</p> : null}
              <BulletList bullets={section.bullets} variant={variant} />
            </section>
          )) : artifact.sections.map((section, index) => (
            <PreviewSection key={`${section.heading}-${index}`} artifact={artifact} section={section} index={index} variant={variant} />
          ))}
        </main>
      </div>
    </article>
  );
}

function EmailPreview({ artifact, style, variant }: { artifact: ArtifactDocument; style: PreviewVars; variant: PreviewVariant }) {
  return (
    <article className="email-preview" style={style}>
      <header>
        <span className="email-preview-icon"><Mail size={16} aria-hidden="true" /></span>
        <div><small>To</small><strong>{artifact.audience}</strong></div>
      </header>
      <div className="email-subject"><small>Subject</small><h1>{artifact.title}</h1></div>
      <div className="email-body">
        {artifact.executiveSummary ? <p>{artifact.executiveSummary}</p> : null}
        {artifact.sections.map((section, index) => (
          <section key={`${section.heading}-${index}`}>
            {artifact.sections.length > 1 ? <h2>{section.heading}</h2> : null}
            {section.body ? <p>{section.body}</p> : null}
            <BulletList bullets={section.bullets} variant={variant} />
          </section>
        ))}
      </div>
    </article>
  );
}

const GALLERY_DECK_SLIDE_LIMIT = 6;

function DeckPreview({ artifact, style, variant }: { artifact: ArtifactDocument; style: PreviewVars; variant: PreviewVariant }) {
  const slides = artifact.slides ?? [];
  const usePremiumDeck = variant === 'template-gallery' || variant === 'default';
  const gallerySlides = variant === 'template-gallery' ? slides.slice(0, GALLERY_DECK_SLIDE_LIMIT) : slides;
  const hiddenGallerySlides = variant === 'template-gallery' ? Math.max(slides.length - GALLERY_DECK_SLIDE_LIMIT, 0) : 0;
  return (
    <section className={`deck-preview ${usePremiumDeck ? 'deck-preview--gallery' : ''}`} style={style}>
      <div className="deck-preview-label">
        <Presentation size={14} aria-hidden="true" />
        <span>
          {hiddenGallerySlides > 0
            ? `${gallerySlides.length} of ${slides.length} slides`
            : `${slides.length} slides`}
        </span>
      </div>
      {gallerySlides.map((slide, index) =>
        usePremiumDeck ? (
          <GalleryDeckSlide key={`${slide.title}-${index}`} slide={slide} index={index} />
        ) : (
          <SlidePreview key={`${slide.title}-${index}`} artifact={artifact} slide={slide} index={index} variant={variant} />
        )
      )}
    </section>
  );
}

function SlidePreview({ artifact, slide, index, variant }: { artifact: ArtifactDocument; slide: Slide; index: number; variant: PreviewVariant }) {
  const layout = previewSlideLayout(slide);
  const theme = slide.theme ?? 'light';
  const image = variant !== 'template-gallery' && slide.imageAssetId
    ? artifact.assets.find((asset) => asset.id === slide.imageAssetId)
    : undefined;
  const imageLed = Boolean(image && (layout === 'image' || !['metric', 'comparison', 'timeline', 'process', 'quote'].includes(layout)));
  return (
    <article className={`deck-slide layout-${imageLed ? 'image' : layout} theme-${theme}${slide.tone ? ` deck-tone-${slide.tone}` : ''}`}>
      <div className="deck-slide-number">{String(index + 1).padStart(2, '0')}</div>
      {slide.eyebrow ? <small className="deck-eyebrow">{slide.eyebrow}</small> : null}
      <h2>{slide.title}</h2>
      {imageLed && image ? (
        <div className="deck-image-layout">
          <BulletList bullets={slide.bullets} variant={variant} />
          <figure>
            <img src={image.dataUri} alt={image.alt} />
            <figcaption>Source: {image.attribution}</figcaption>
          </figure>
        </div>
      ) : layout === 'cover' || layout === 'statement' ? (
        <div className="deck-statement">
          <strong>{slide.subtitle || slide.bullets[0]}</strong>
          <BulletList bullets={slide.subtitle ? slide.bullets : slide.bullets.slice(1)} variant={variant} />
        </div>
      ) : layout === 'metric' ? (
        <div className="deck-metrics">
          {(slide.metrics ?? []).map((metric) => (
            <div key={`${metric.value}-${metric.label}`} className="deck-metric-card">
              <strong>{metric.value}</strong>
              <b>{metric.label}</b>
              {metric.detail ? <span>{metric.detail}</span> : null}
            </div>
          ))}
        </div>
      ) : layout === 'comparison' && slide.columns?.length === 2 ? (
        <div className="deck-comparison">
          {slide.columns.map((column) => (
            <section key={column.heading}>
              <strong>{column.heading}</strong>
              {column.body ? <p>{column.body}</p> : null}
              <BulletList bullets={column.bullets} variant={variant} />
            </section>
          ))}
        </div>
      ) : layout === 'process' || layout === 'timeline' ? (
        <div className="deck-sequence">
          {slide.bullets.map((item, itemIndex) => (
            <div key={item}>
              <span>{String(itemIndex + 1).padStart(2, '0')}</span>
              <strong>{item}</strong>
            </div>
          ))}
        </div>
      ) : layout === 'quote' && slide.quote ? (
        <blockquote className="deck-quote">
          <p>{slide.quote}</p>
          {slide.quoteAttribution ? <cite>{slide.quoteAttribution}</cite> : null}
        </blockquote>
      ) : layout === 'chart' && slide.chart ? (
        <DeckChartPreview slide={slide} index={index} variant={variant} />
      ) : layout === 'split' ? (
        <div className="deck-split">
          <strong>{slide.subtitle || slide.bullets[0]}</strong>
          <BulletList bullets={slide.bullets} variant={variant} />
        </div>
      ) : layout === 'grid' ? (
        <div
          className="deck-grid"
          style={{
            gridTemplateColumns:
              slide.bullets.length === 3 || slide.bullets.length > 4
                ? 'repeat(3, minmax(0, 1fr))'
                : undefined
          }}
        >
          {slide.bullets.map((bullet) => <div key={bullet}>{bullet}</div>)}
        </div>
      ) : (
        <div className="deck-list">
          {slide.subtitle ? <strong>{slide.subtitle}</strong> : null}
          <BulletList bullets={slide.bullets} variant={variant} />
        </div>
      )}
      {slide.takeaway ? <div className="deck-takeaway">{slide.takeaway}</div> : null}
      {variant !== 'template-gallery' && slide.sourceIds?.length ? (
        <small className="artifact-source-ids">Sources: {slide.sourceIds.join(' · ')}</small>
      ) : null}
    </article>
  );
}

function previewSlideLayout(slide: Slide): NonNullable<Slide['layout']> {
  if (slide.chart) return 'chart';
  if (slide.metrics?.length) return 'metric';
  if (slide.columns?.length === 2) return 'comparison';
  if (slide.quote) return 'quote';
  if (slide.layout) return slide.layout;
  if (slide.imageAssetId) return 'image';
  if (slide.bullets.length <= 2) return 'statement';
  if (slide.subtitle) return 'split';
  if (slide.bullets.length >= 5) return 'grid';
  return 'list';
}

function DeckChartPreview({ slide, index, variant }: { slide: Slide; index: number; variant: PreviewVariant }) {
  const chart = slide.chart!;
  const values = chart.series[0]?.values ?? [];
  const max = Math.max(...values.map((value) => Math.abs(value)), 1);

  if (variant === 'template-gallery') {
    const barCount = Math.max(values.length, 1);
    const chartWidth = 300;
    const chartHeight = 132;
    const padding = { top: 10, right: 10, bottom: 28, left: 10 };
    const plotWidth = chartWidth - padding.left - padding.right;
    const plotHeight = chartHeight - padding.top - padding.bottom;
    const barGap = 10;
    const barWidth = (plotWidth - barGap * (barCount - 1)) / barCount;
    const gradientId = `deck-bar-gradient-${index}`;

    return (
      <div className="deck-chart-preview">
        <BulletList bullets={slide.bullets} variant={variant} />
        <svg className="deck-chart-svg" viewBox={`0 0 ${chartWidth} ${chartHeight}`} aria-label={chart.title ?? 'Chart preview'} role="img">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--artifact-accent)" />
              <stop offset="100%" stopColor="color-mix(in srgb, var(--artifact-accent) 48%, var(--artifact-primary))" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75, 1].map((tick) => {
            const y = padding.top + plotHeight * (1 - tick);
            return (
              <line
                key={tick}
                className="deck-chart-grid-line"
                x1={padding.left}
                y1={y}
                x2={chartWidth - padding.right}
                y2={y}
              />
            );
          })}
          <line
            className="deck-chart-axis"
            x1={padding.left}
            y1={padding.top + plotHeight}
            x2={chartWidth - padding.right}
            y2={padding.top + plotHeight}
          />
          {values.map((value, valueIndex) => {
            const height = Math.max(8, (Math.abs(value) / max) * plotHeight);
            const x = padding.left + valueIndex * (barWidth + barGap);
            const y = padding.top + plotHeight - height;
            const label = chart.labels[valueIndex] ?? '';
            return (
              <g key={`${label}-${valueIndex}`} className="deck-chart-bar-group">
                <rect
                  className="deck-chart-bar"
                  x={x}
                  y={y}
                  width={barWidth}
                  height={height}
                  rx={5}
                  ry={5}
                  fill={`url(#${gradientId})`}
                />
                <text className="deck-chart-label" x={x + barWidth / 2} y={chartHeight - 8} textAnchor="middle">
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  return (
    <div className="deck-chart-preview">
      <BulletList bullets={slide.bullets} variant={variant} />
      <div className="deck-chart-plot" aria-label={chart.title ?? 'Chart preview'}>
        {values.map((value, valueIndex) => (
          <div key={`${chart.labels[valueIndex]}-${valueIndex}`}>
            <span style={{ height: `${Math.max(6, Math.abs(value) / max * 100)}%` }} />
            <small>{chart.labels[valueIndex]}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function sheetStatusClass(value: string): string | undefined {
  const normalized = value.toLowerCase();
  if (['above', 'on track', 'complete', '▲', '●'].some((marker) => normalized.includes(marker))) {
    return 'gallery-sheet-status gallery-sheet-status--good';
  }
  if (['watch', 'monitoring', 'open', '▼'].some((marker) => normalized.includes(marker))) {
    return 'gallery-sheet-status gallery-sheet-status--watch';
  }
  if (['below', 'risk', 'late'].some((marker) => normalized.includes(marker))) {
    return 'gallery-sheet-status gallery-sheet-status--risk';
  }
  return undefined;
}

function SheetPreview({ artifact, style, variant }: { artifact: ArtifactDocument; style: PreviewVars; variant: PreviewVariant }) {
  const sheets = artifact.sheet?.sheets ?? artifact.sections.flatMap((section) => section.table ? [{ name: section.heading, ...section.table }] : []);
  const [active, setActive] = useState(0);
  const sheet = sheets[active];
  if (!sheet) return <DocumentPreview artifact={artifact} style={style} variant={variant} />;
  const gallerySheet = variant === 'template-gallery' ? 'sheet-preview--gallery' : '';
  const galleryMode = variant === 'template-gallery';
  const kpiSummaryRow = galleryMode && firstRowLooksLikeHeaders(sheet.columns, sheet.rows[0]) ? sheet.rows[0] : null;
  const tableRows = kpiSummaryRow ? sheet.rows.slice(1, 81) : sheet.rows.slice(0, 80);
  const formulaClass = galleryMode ? 'formula gallery-formula' : 'formula';

  return (
    <section className={`sheet-preview ${gallerySheet}`} style={style}>
      <header className={galleryMode ? 'gallery-sheet-header' : undefined}>
        <Sheet size={15} aria-hidden="true" />
        <strong>{artifact.title}</strong>
        {galleryMode && sheet.name ? <span className="gallery-sheet-header__sheet">{sheet.name}</span> : null}
      </header>
      {kpiSummaryRow ? (
        <div className="gallery-sheet-kpi-row" role="group" aria-label="KPI summary">
          {kpiSummaryRow.map((cell, cellIndex) => (
            <div key={`${cell}-${cellIndex}`} className="gallery-sheet-kpi-row__cell">
              <span className="gallery-sheet-kpi-row__label">{sheet.columns[cellIndex] ?? `Column ${cellIndex + 1}`}</span>
              <strong>{cell}</strong>
            </div>
          ))}
        </div>
      ) : null}
      <div className="sheet-grid-wrap">
        <table>
          <thead><tr><th aria-label="Row number" />{sheet.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
          <tbody>
            {tableRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th>{rowIndex + 1}</th>
                {sheet.columns.map((column, columnIndex) => {
                  const cell = String(row[columnIndex] ?? '').trim();
                  const statusClass = galleryMode && column.toLowerCase().includes('status')
                    ? sheetStatusClass(cell)
                    : undefined;
                  return (
                    <td
                      key={`${column}-${columnIndex}`}
                      className={[
                        cell.startsWith('=') ? formulaClass : undefined,
                        statusClass
                      ].filter(Boolean).join(' ') || undefined}
                    >
                      {row[columnIndex]}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav className="sheet-tabs" aria-label="Workbook sheets">
        {sheets.map((item, index) => (
          <button key={item.name} type="button" className={active === index ? 'active' : ''} onClick={() => setActive(index)}>{item.name}</button>
        ))}
      </nav>
    </section>
  );
}

function PreviewSection({ artifact, section, index, variant }: { artifact: ArtifactDocument; section: ArtifactSection; index: number; variant: PreviewVariant }) {
  const image = variant !== 'template-gallery' && section.imageAssetId
    ? artifact.assets.find((asset) => asset.id === section.imageAssetId)
    : undefined;
  return (
    <section className="document-section">
      <small>{String(index + 1).padStart(2, '0')}</small>
      <div>
        <h2>{section.heading}</h2>
        {section.body ? <p>{section.body}</p> : null}
        {image ? (
          <figure className="artifact-source-image">
            <img src={image.dataUri} alt={image.alt} />
            <figcaption>{image.alt} · Source: {image.attribution}</figcaption>
          </figure>
        ) : null}
        <BulletList bullets={section.bullets} variant={variant} />
        {section.table ? <ArtifactTable section={section} /> : null}
        {variant !== 'template-gallery' && section.sourceIds?.length ? (
          <small className="artifact-source-ids">Sources: {section.sourceIds.join(', ')}</small>
        ) : null}
      </div>
    </section>
  );
}

function BulletList({ bullets, variant = 'default' }: { bullets: string[]; variant?: PreviewVariant }) {
  if (!bullets.length) return null;
  const listClass = variant === 'template-gallery' ? 'deck-bullet-list' : undefined;
  return <ul className={listClass}>{bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>;
}

function ArtifactTable({ section }: { section: ArtifactSection }) {
  if (!section.table) return null;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{section.table.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>{section.table.rows.map((row, rowIndex) => (
          <tr key={rowIndex}>{section.table?.columns.map((column, columnIndex) => <td key={`${column}-${columnIndex}`}>{row[columnIndex]}</td>)}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function CitationBlock({ artifact }: { artifact: ArtifactDocument }) {
  return artifact.citations.length ? (
    <footer className="document-citations">
      <h2>Sources</h2>
      <ol>{artifact.citations.map((citation) => <li key={`${citation.id ?? ''}-${citation.label}-${citation.url ?? ''}`}>{citation.id ? `${citation.id}: ` : ''}{citation.label}</li>)}</ol>
    </footer>
  ) : null;
}

function previewVariables(artifact: ArtifactDocument): PreviewVars {
  const palette = artifact.design.palette;
  return {
    '--artifact-bg': palette?.background ?? '#f7f7f4',
    '--artifact-surface': palette?.surface ?? '#e8ece8',
    '--artifact-text': palette?.text ?? '#17191d',
    '--artifact-muted': palette?.muted ?? '#69706d',
    '--artifact-primary': palette?.primary ?? '#24594d',
    '--artifact-accent': palette?.accent ?? '#59c3a5',
    '--artifact-primary-text': previewContrast(palette?.primary ?? '#24594d', palette?.background ?? '#f7f7f4', palette?.text ?? '#17191d'),
    '--artifact-accent-text': previewContrast(palette?.accent ?? '#59c3a5', palette?.background ?? '#f7f7f4', palette?.text ?? '#17191d'),
    '--artifact-heading-font': fontStack(artifact.design.headingFontFamily, 'Georgia, serif'),
    '--artifact-body-font': fontStack(artifact.design.bodyFontFamily, 'Arial, sans-serif'),
    '--artifact-slide-ratio': artifact.design.slideAspect === 'standard' ? '4 / 3' : '16 / 9',
    '--artifact-gap': artifact.design.density === 'compact' ? '12px' : artifact.design.density === 'airy' ? '28px' : '20px'
  };
}

function previewContrast(background: string, light: string, dark: string): string {
  const normalized = background.replace(/^#/, '');
  const channels = [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255);
  const luminance = channels.reduce((sum, channel, index) => {
    const linear = channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
  return luminance < 0.42 ? light : dark;
}

function fontStack(value: string | undefined, fallback: string): string {
  const clean = value?.replace(/["'<>]/g, '').trim();
  return clean ? `"${clean}", ${fallback}` : fallback;
}

type GalleryResumeLayout = 'sidebar' | 'two-column' | 'executive';

function resolveGalleryResumeLayout(visualDirection?: string): GalleryResumeLayout | null {
  const hint = (visualDirection ?? '').toLowerCase();
  if (hint.includes('sidebar') || hint.includes('left rail') || hint.includes('skills rail') || hint.includes('left sidebar')) {
    return 'sidebar';
  }
  if (hint.includes('two-column') || hint.includes('two column')) return 'two-column';
  if (
    hint.includes('executive')
    || hint.includes('header band')
    || hint.includes('full-width header')
    || hint.includes('board-ready')
    || hint.includes('c-suite')
  ) {
    return 'executive';
  }
  return null;
}

function firstRowLooksLikeHeaders(columns: string[], row: string[] | undefined): boolean {
  if (!row?.length) return false;
  const normalizedColumns = columns.map((column) => column.trim().toLowerCase());
  const normalizedCells = row.map((cell) => String(cell ?? '').trim().toLowerCase());
  if (normalizedCells.every((cell) => !cell)) return false;
  const overlap = normalizedCells.filter((cell, index) => cell && (cell === normalizedColumns[index] || normalizedColumns.includes(cell))).length;
  return overlap >= Math.max(2, Math.ceil(columns.length * 0.5));
}