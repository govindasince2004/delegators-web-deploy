import type { Slide } from '../lib/shared';

type Props = {
  slide: Slide;
  index: number;
};

export function DeckChartPreviewGallery({ slide, index }: Props) {
  const chart = slide.chart!;
  const values = chart.series[0]?.values ?? [];
  const max = Math.max(...values.map((value) => Math.abs(value)), 1);
  const barCount = Math.max(values.length, 1);
  const chartWidth = 420;
  const chartHeight = 160;
  const padding = { top: 12, right: 12, bottom: 32, left: 12 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const barGap = 12;
  const barWidth = (plotWidth - barGap * (barCount - 1)) / barCount;
  const gradientId = `gallery-bar-gradient-${index}`;
  const chartType = chart.type;

  return (
    <div className="gallery-deck-chart">
      <div className="gallery-deck-chart__copy">
        {chart.title ? <h3>{chart.title}</h3> : null}
        {slide.bullets.length ? (
          <ul className="gallery-deck-bullets gallery-deck-bullets--compact">
            {slide.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <svg className="gallery-deck-chart__svg" viewBox={`0 0 ${chartWidth} ${chartHeight}`} aria-label={chart.title ?? 'Chart'} role="img">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--artifact-accent)" />
            <stop offset="100%" stopColor="color-mix(in srgb, var(--artifact-accent) 42%, var(--artifact-primary))" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((tick) => {
          const y = padding.top + plotHeight * (1 - tick);
          return (
            <line
              key={tick}
              className="gallery-deck-chart__grid"
              x1={padding.left}
              y1={y}
              x2={chartWidth - padding.right}
              y2={y}
            />
          );
        })}
        <line
          className="gallery-deck-chart__axis"
          x1={padding.left}
          y1={padding.top + plotHeight}
          x2={chartWidth - padding.right}
          y2={padding.top + plotHeight}
        />
        {chartType === 'area'
          ? renderArea(values, max, padding, plotWidth, plotHeight, chartWidth, gradientId)
          : values.map((value, valueIndex) => {
              const height = Math.max(10, (Math.abs(value) / max) * plotHeight);
              const x = padding.left + valueIndex * (barWidth + barGap);
              const y = padding.top + plotHeight - height;
              const label = chart.labels[valueIndex] ?? '';
              return (
                <g key={`${label}-${valueIndex}`}>
                  <rect className="gallery-deck-chart__bar" x={x} y={y} width={barWidth} height={height} rx={6} fill={`url(#${gradientId})`} />
                  <text className="gallery-deck-chart__label" x={x + barWidth / 2} y={chartHeight - 10} textAnchor="middle">
                    {label}
                  </text>
                  <text className="gallery-deck-chart__value" x={x + barWidth / 2} y={y - 4} textAnchor="middle">
                    {value}
                  </text>
                </g>
              );
            })}
      </svg>
    </div>
  );
}

function renderArea(
  values: number[],
  max: number,
  padding: { top: number; right: number; bottom: number; left: number },
  plotWidth: number,
  plotHeight: number,
  chartWidth: number,
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
      <path className="gallery-deck-chart__area" d={areaPath} fill={`url(#${gradientId})`} opacity={0.35} />
      <path className="gallery-deck-chart__line" d={linePath} fill="none" stroke="var(--artifact-accent)" strokeWidth={2.5} />
      {values.map((value, index) => {
        const x = padding.left + index * step;
        const y = padding.top + plotHeight - (Math.abs(value) / max) * plotHeight;
        return <circle key={index} className="gallery-deck-chart__dot" cx={x} cy={y} r={4} fill="var(--artifact-accent)" />;
      })}
    </>
  );
}