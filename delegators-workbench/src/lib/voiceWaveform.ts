export const VOICE_WAVEFORM_BAR_COUNT = 56;

export function peaksFromTimeDomain(samples: Uint8Array, barCount: number): number[] {
  const slice = Math.max(1, Math.floor(samples.length / barCount));
  const peaks: number[] = [];
  for (let i = 0; i < barCount; i++) {
    let peak = 0;
    const start = i * slice;
    for (let j = start; j < start + slice && j < samples.length; j++) {
      const centered = ((samples[j] ?? 128) - 128) / 128;
      peak = Math.max(peak, Math.abs(centered));
    }
    peaks.push(Math.max(0.05, Math.min(1, peak * 3.4)));
  }
  return peaks;
}

export function smoothLevels(current: number[], target: number[], attack = 0.62, release = 0.28): number[] {
  const next = new Array(target.length);
  for (let i = 0; i < target.length; i++) {
    const prev = current[i] ?? target[i];
    const coeff = (target[i] ?? 0) > prev ? attack : release;
    next[i] = prev + ((target[i] ?? 0) - prev) * coeff;
  }
  return next;
}

export function pushScrollingSample(history: number[], sample: number, barCount = VOICE_WAVEFORM_BAR_COUNT): number[] {
  const next = history.length === barCount ? history.slice(1) : history.slice();
  next.push(Math.max(0.06, Math.min(1, sample)));
  while (next.length < barCount) next.unshift(0.06);
  return next.slice(-barCount);
}

export function mixWaveformShapes(
  scrolling: number[],
  snapshot: number[],
  scrollWeight = 0.72
): number[] {
  const length = Math.max(scrolling.length, snapshot.length);
  const mixed: number[] = [];
  for (let i = 0; i < length; i++) {
    const scroll = scrolling[i] ?? 0.06;
    const snap = snapshot[i] ?? 0.06;
    mixed.push(Math.max(0.06, Math.min(1, scroll * scrollWeight + snap * (1 - scrollWeight))));
  }
  return mixed;
}

export function rmsFromTimeDomain(samples: Uint8Array): number {
  if (samples.length === 0) return 0.06;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const centered = ((samples[i] ?? 128) - 128) / 128;
    sum += centered * centered;
  }
  return Math.max(0.06, Math.min(1, Math.sqrt(sum / samples.length) * 4.2));
}