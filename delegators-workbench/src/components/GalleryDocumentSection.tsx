import type { ArtifactChart, ArtifactSection } from '../lib/shared';

type Props = {
  section: ArtifactSection;
  index: number;
  showSectionNumbers?: boolean;
};

export function GalleryDocumentSection({ section, index, showSectionNumbers = true }: Props) {
  return (
    <section className="gallery-document-section">
      <header className="gallery-document-section__band">
        {showSectionNumbers ? (
          <span className="gallery-document-section__number" aria-hidden="true">
            {String(index + 1).padStart(2, '0')}
          </span>
        ) : null}
        <h2 className="gallery-document-section__heading">{section.heading}</h2>
      </header>

      <div className="gallery-document-section__body">
        {section.body ? <p className="gallery-document-section__copy">{section.body}</p> : null}
        {section.bullets.length ? (
          <ul className="deck-bullet-list gallery-document-section__bullets">
            {section.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        ) : null}
        {section.table ? <GalleryDocumentTable columns={section.table.columns} rows={section.table.rows} /> : null}
        {section.chart ? <GalleryDocumentMiniChart chart={section.chart} index={index} /> : null}
      </div>
    </section>
  );
}

function GalleryDocumentTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <div className="gallery-document-section__table-wrap">
      <table className="gallery-document-section__table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column, columnIndex) => (
                <td key={`${column}-${columnIndex}`}>{row[columnIndex]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GalleryDocumentMiniChart({ chart, index }: { chart: ArtifactChart; index: number }) {
  const values = chart.series[0]?.values ?? [];
  const max = Math.max(...values.map((value) => Math.abs(value)), 1);
  const chartWidth = 280;
  const chartHeight = 112;
  const padding = { top: 8, right: 8, bottom: 24, left: 8 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const gradientId = `gallery-doc-chart-gradient-${index}`;
  const isLine = chart.type === 'line' || chart.type === 'area';
  const barCount = Math.max(values.length, 1);
  const barGap = 8;
  const barWidth = (plotWidth - barGap * (barCount - 1)) / barCount;

  return (
    <figure className="gallery-document-section__chart">
      {chart.title ? <figcaption className="gallery-document-section__chart-title">{chart.title}</figcaption> : null}
      <svg
        className="gallery-document-section__chart-svg"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        aria-label={chart.title ?? 'Section chart'}
        role="img"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--artifact-accent)" />
            <stop offset="100%" stopColor="color-mix(in srgb, var(--artifact-accent) 44%, var(--artifact-primary))" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((tick) => {
          const y = padding.top + plotHeight * (1 - tick);
          return (
            <line
              key={tick}
              className="gallery-document-section__chart-grid"
              x1={padding.left}
              y1={y}
              x2={chartWidth - padding.right}
              y2={y}
            />
          );
        })}
        <line
          className="gallery-document-section__chart-axis"
          x1={padding.left}
          y1={padding.top + plotHeight}
          x2={chartWidth - padding.right}
          y2={padding.top + plotHeight}
        />
        {isLine
          ? renderLineChart(values, max, padding, plotWidth, plotHeight, gradientId)
          : values.map((value, valueIndex) => {
              const height = Math.max(8, (Math.abs(value) / max) * plotHeight);
              const x = padding.left + valueIndex * (barWidth + barGap);
              const y = padding.top + plotHeight - height;
              const label = chart.labels[valueIndex] ?? '';
              return (
                <g key={`${label}-${valueIndex}`}>
                  <rect
                    className="gallery-document-section__chart-bar"
                    x={x}
                    y={y}
                    width={barWidth}
                    height={height}
                    rx={4}
                    fill={`url(#${gradientId})`}
                  />
                  <text className="gallery-document-section__chart-label" x={x + barWidth / 2} y={chartHeight - 6} textAnchor="middle">
                    {label}
                  </text>
                </g>
              );
            })}
      </svg>
    </figure>
  );
}

function renderLineChart(
  values: number[],
  max: number,
  padding: { top: number; right: number; bottom: number; left: number },
  plotWidth: number,
  plotHeight: number,
  gradientId: string
) {
  const step = plotWidth / Math.max(values.length - 1, 1);
  const points = values.map((value, index) => {
    const x = padding.left + index * step;
    const y = padding.top + plotHeight - (Math.abs(value) / max) * plotHeight;
    return `${x},${y}`;
  });
  const baseline = padding.top + plotHeight;
  const areaPath = `M ${padding.left},${baseline} L ${points.join(' L ')} L ${padding.left + plotWidth},${baseline} Z`;
  const linePath = `M ${points.join(' L ')}`;

  return (
    <>
      <path className="gallery-document-section__chart-area" d={areaPath} fill={`url(#${gradientId})`} opacity={0.3} />
      <path className="gallery-document-section__chart-line" d={linePath} fill="none" stroke="var(--artifact-accent)" strokeWidth={2} />
      {values.map((value, index) => {
        const x = padding.left + index * step;
        const y = padding.top + plotHeight - (Math.abs(value) / max) * plotHeight;
        return <circle key={index} className="gallery-document-section__chart-dot" cx={x} cy={y} r={3.5} fill="var(--artifact-accent)" />;
      })}
    </>
  );
}