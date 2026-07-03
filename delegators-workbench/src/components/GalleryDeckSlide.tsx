import type { CSSProperties } from 'react';
import type { Slide } from '../lib/shared';
import { DeckChartPreviewGallery } from './GalleryDeckChart';

type Props = {
  slide: Slide;
  index: number;
};

export function GalleryDeckSlide({ slide, index }: Props) {
  const layout = resolveGalleryLayout(slide);
  const toneClass = slide.tone ? `gallery-deck-slide--tone-${slide.tone}` : '';
  const themeClass = slide.theme ? `gallery-deck-slide--theme-${slide.theme}` : '';

  return (
    <article
      className={`gallery-deck-slide gallery-deck-slide--${layout} ${toneClass} ${themeClass}`}
      data-slide-index={index + 1}
      style={{ '--slide-index': index } as CSSProperties}
    >
      <span className="gallery-deck-slide__index" aria-hidden="true">
        {String(index + 1).padStart(2, '0')}
      </span>
      <span className="gallery-deck-slide__ornament" aria-hidden="true" />
      <span className="gallery-deck-slide__ornament gallery-deck-slide__ornament--secondary" aria-hidden="true" />

      <header className="gallery-deck-slide__head">
        {slide.eyebrow ? <small className="gallery-deck-slide__eyebrow">{slide.eyebrow}</small> : null}
        <h2 className="gallery-deck-slide__title">{slide.title}</h2>
        {slide.subtitle && layout !== 'cover' ? (
          <p className="gallery-deck-slide__subtitle">{slide.subtitle}</p>
        ) : null}
      </header>

      <div className="gallery-deck-slide__body">
        {layout === 'cover' ? <CoverBody slide={slide} /> : null}
        {layout === 'statement' ? <StatementBody slide={slide} /> : null}
        {layout === 'list' ? <AgendaBody slide={slide} /> : null}
        {layout === 'grid' ? <BentoBody slide={slide} /> : null}
        {layout === 'metric' ? <MetricBody slide={slide} /> : null}
        {layout === 'chart' && slide.chart ? <DeckChartPreviewGallery slide={slide} index={index} /> : null}
        {layout === 'comparison' ? <ComparisonBody slide={slide} /> : null}
        {layout === 'split' ? <SplitBody slide={slide} /> : null}
        {layout === 'quote' ? <QuoteBody slide={slide} /> : null}
        {layout === 'process' || layout === 'timeline' ? <SequenceBody slide={slide} /> : null}
        {layout === 'default' ? <DefaultBody slide={slide} /> : null}
      </div>

      {slide.takeaway ? <footer className="gallery-deck-slide__takeaway">{slide.takeaway}</footer> : null}
    </article>
  );
}

function resolveGalleryLayout(slide: Slide): string {
  if (slide.layout) return slide.layout;
  if (slide.chart) return 'chart';
  if (slide.metrics?.length) return 'metric';
  if (slide.columns?.length === 2) return 'comparison';
  if (slide.quote) return 'quote';
  if (slide.bullets.length >= 5) return 'list';
  if (slide.bullets.length >= 4) return 'grid';
  if (slide.subtitle) return 'split';
  if (slide.bullets.length <= 2) return 'statement';
  return 'default';
}

function CoverBody({ slide }: { slide: Slide }) {
  return (
    <div className="gallery-deck-cover">
      <div className="gallery-deck-cover__main">
        {slide.subtitle ? <p className="gallery-deck-cover__tagline">{slide.subtitle}</p> : null}
      </div>
      {slide.bullets.length ? (
        <div className="gallery-deck-cover__pills" role="list">
          {slide.bullets.map((item) => (
            <span key={item} className="gallery-deck-cover__pill" role="listitem">
              {item}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StatementBody({ slide }: { slide: Slide }) {
  return (
    <div className="gallery-deck-statement">
      {slide.subtitle ? <strong>{slide.subtitle}</strong> : null}
      {slide.bullets.length ? (
        <ul className="gallery-deck-bullets">
          {slide.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function AgendaBody({ slide }: { slide: Slide }) {
  return (
    <ol className="gallery-deck-agenda">
      {slide.bullets.map((item, itemIndex) => {
        const [num, ...rest] = item.split('·').map((part) => part.trim());
        const hasNum = /^\d{2}/.test(num);
        return (
          <li key={item}>
            <span className="gallery-deck-agenda__num">{hasNum ? num : String(itemIndex + 1).padStart(2, '0')}</span>
            <span className="gallery-deck-agenda__text">{hasNum ? rest.join(' · ') || num : item}</span>
          </li>
        );
      })}
    </ol>
  );
}

function BentoBody({ slide }: { slide: Slide }) {
  const metrics = slide.metrics ?? [];
  if (metrics.length) {
    return (
      <div className="gallery-deck-bento gallery-deck-bento--metrics">
        {metrics.map((metric) => (
          <div key={`${metric.value}-${metric.label}`} className="gallery-deck-bento__cell">
            <strong>{metric.value}</strong>
            <b>{metric.label}</b>
            {metric.detail ? <span>{metric.detail}</span> : null}
          </div>
        ))}
        {slide.bullets.map((bullet) => (
          <div key={bullet} className="gallery-deck-bento__cell gallery-deck-bento__cell--text">
            {bullet}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="gallery-deck-bento">
      {slide.bullets.map((bullet, itemIndex) => (
        <div key={bullet} className="gallery-deck-bento__cell">
          <span className="gallery-deck-bento__cell-num">{String(itemIndex + 1).padStart(2, '0')}</span>
          <span>{bullet}</span>
        </div>
      ))}
    </div>
  );
}

function MetricBody({ slide }: { slide: Slide }) {
  const metrics = slide.metrics ?? [];
  return (
    <div className="gallery-deck-metrics">
      {metrics.map((metric) => (
        <div key={`${metric.value}-${metric.label}`} className="gallery-deck-metrics__card">
          <strong>{metric.value}</strong>
          <b>{metric.label}</b>
          {metric.detail ? <span>{metric.detail}</span> : null}
        </div>
      ))}
      {slide.bullets.length ? (
        <ul className="gallery-deck-bullets gallery-deck-bullets--compact">
          {slide.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ComparisonBody({ slide }: { slide: Slide }) {
  const columns = slide.columns ?? [];
  return (
    <div className="gallery-deck-comparison">
      {columns.map((column) => (
        <section key={column.heading} className="gallery-deck-comparison__col">
          <h3>{column.heading}</h3>
          {column.body ? <p>{column.body}</p> : null}
          <ul>
            {column.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function SplitBody({ slide }: { slide: Slide }) {
  return (
    <div className="gallery-deck-split">
      <aside className="gallery-deck-split__accent">
        <strong>{slide.subtitle || slide.bullets[0]}</strong>
      </aside>
      <div className="gallery-deck-split__content">
        <ul className="gallery-deck-bullets">
          {(slide.subtitle ? slide.bullets : slide.bullets.slice(1)).map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function QuoteBody({ slide }: { slide: Slide }) {
  return (
    <blockquote className="gallery-deck-quote">
      <p>{slide.quote}</p>
      {slide.quoteAttribution ? <cite>{slide.quoteAttribution}</cite> : null}
      {slide.bullets.length ? (
        <ul className="gallery-deck-bullets gallery-deck-bullets--compact">
          {slide.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      ) : null}
    </blockquote>
  );
}

function SequenceBody({ slide }: { slide: Slide }) {
  return (
    <div className="gallery-deck-sequence">
      {slide.bullets.map((item, itemIndex) => (
        <div key={item} className="gallery-deck-sequence__step">
          <span>{String(itemIndex + 1).padStart(2, '0')}</span>
          <strong>{item}</strong>
        </div>
      ))}
    </div>
  );
}

function DefaultBody({ slide }: { slide: Slide }) {
  return (
    <div className="gallery-deck-default">
      {slide.subtitle ? <strong>{slide.subtitle}</strong> : null}
      <ul className="gallery-deck-bullets">
        {slide.bullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
    </div>
  );
}