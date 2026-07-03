import { describe, expect, it } from 'vitest';
import {
  mixWaveformShapes,
  peaksFromTimeDomain,
  pushScrollingSample,
  rmsFromTimeDomain,
} from '../src/lib/voiceWaveform';

describe('voiceWaveform', () => {
  it('derives live peaks from time-domain microphone samples', () => {
    const samples = new Uint8Array(128);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = 128 + Math.round(Math.sin(i / 3) * 40);
    }
    const peaks = peaksFromTimeDomain(samples, 16);
    expect(peaks.some((level) => level > 0.2)).toBe(true);
    expect(peaks.every((level) => level >= 0.05 && level <= 1)).toBe(true);
  });

  it('scrolls new energy through the recording strip', () => {
    const first = pushScrollingSample([], 0.2, 4);
    const second = pushScrollingSample(first, 0.8, 4);
    expect(second).toEqual([0.06, 0.06, 0.2, 0.8]);
  });

  it('mixes scrolling history with the current snapshot', () => {
    const mixed = mixWaveformShapes([0.1, 0.2, 0.3], [0.9, 0.4, 0.2]);
    expect(mixed[0]).toBeGreaterThan(0.1);
    expect(mixed[2]).toBeLessThan(0.3);
  });

  it('computes rms loudness from silence and speech-like input', () => {
    const silent = new Uint8Array(64).fill(128);
    const loud = new Uint8Array(64);
    for (let i = 0; i < loud.length; i++) loud[i] = 128 + (i % 2 === 0 ? 50 : -50);
    expect(rmsFromTimeDomain(silent)).toBeLessThan(0.12);
    expect(rmsFromTimeDomain(loud)).toBeGreaterThan(0.2);
  });
});