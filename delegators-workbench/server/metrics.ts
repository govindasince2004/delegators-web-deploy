type LabelSet = Record<string, string>;

const counters = new Map<string, number>();
const gauges = new Map<string, number>();

function metricKey(name: string, labels?: LabelSet): string {
  if (!labels || Object.keys(labels).length === 0) return name;
  const parts = Object.entries(labels)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}="${escapeLabel(value)}"`);
  return `${name}{${parts.join(',')}}`;
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

export function incrementCounter(name: string, labels?: LabelSet, amount = 1): void {
  const key = metricKey(name, labels);
  counters.set(key, (counters.get(key) ?? 0) + amount);
}

export function setGauge(name: string, value: number, labels?: LabelSet): void {
  gauges.set(metricKey(name, labels), value);
}

export function renderPrometheusMetrics(): string {
  const lines: string[] = [];
  for (const [key, value] of counters.entries()) {
    lines.push(`# TYPE ${key.split('{')[0]} counter`);
    lines.push(`${key} ${value}`);
  }
  for (const [key, value] of gauges.entries()) {
    lines.push(`# TYPE ${key.split('{')[0]} gauge`);
    lines.push(`${key} ${value}`);
  }
  return `${lines.join('\n')}\n`;
}