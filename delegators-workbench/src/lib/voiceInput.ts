import { workbenchFetch } from './account.js';
import {
  mixWaveformShapes,
  peaksFromTimeDomain,
  pushScrollingSample,
  rmsFromTimeDomain,
  smoothLevels,
  VOICE_WAVEFORM_BAR_COUNT,
} from './voiceWaveform.js';

export type VoiceTranscriptionResult = {
  text: string;
  durationSeconds: number;
  language?: string;
};

export const VOICE_TRANSCRIBE_PATH = '/api/voice/transcribe';
export const TARGET_ASR_SAMPLE_RATE = 16000;
export const MAX_VOICE_RECORDING_SECONDS = 45;

export function buildTranscriptionUrl(endpoint: string): string {
  const base = endpoint.replace(/\/$/, '');
  return base ? `${base}${VOICE_TRANSCRIBE_PATH}` : VOICE_TRANSCRIBE_PATH;
}

export function parseVoiceGatewayError(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback;
  const err = data as {
    error?: { message?: string } | string;
    error_description?: string;
    message?: string;
    details?: string;
  };
  if (typeof err.error === 'string') return err.error;
  if (err.error && typeof err.error === 'object' && err.error.message) return err.error.message;
  if (err.details) return err.details;
  if (err.error_description) return err.error_description;
  if (err.message) return err.message;
  return fallback;
}

/** Same-origin workbench proxy → gateway /v1/audio/transcriptions; metered by audio seconds. */
export async function transcribeVoice(
  audioBase64: string,
  durationSeconds: number,
  signal?: AbortSignal
): Promise<VoiceTranscriptionResult> {
  const response = await workbenchFetch(VOICE_TRANSCRIBE_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio: audioBase64,
      format: 'wav',
      language: 'auto',
      duration_seconds: durationSeconds,
    }),
    signal,
  });
  const data = (await response.json().catch(() => ({}))) as {
    text?: string;
    duration_seconds?: number;
    language?: string;
  };
  if (!response.ok) {
    throw new Error(parseVoiceGatewayError(data, `Voice transcription failed (HTTP ${response.status})`));
  }
  const text = (data.text ?? '').trim();
  if (!text) {
    throw new Error('Voice transcription returned empty text — try speaking closer to the mic.');
  }
  return {
    text,
    durationSeconds: data.duration_seconds ?? durationSeconds,
    language: data.language,
  };
}

export function encodeWavPcm16(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

export function wavDurationSeconds(buffer: ArrayBuffer): number {
  const view = new DataView(buffer);
  if (buffer.byteLength < 44) return 0;
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  if (riff !== 'RIFF' || wave !== 'WAVE') return 0;
  const byteRate = view.getUint32(28, true);
  if (!byteRate) return 0;
  return (buffer.byteLength - 44) / byteRate;
}

export function mergeFloat32Arrays(chunks: Float32Array[]): Float32Array {
  if (chunks.length === 0) return new Float32Array(0);
  if (chunks.length === 1) return chunks[0] ?? new Float32Array(0);
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

export function resampleMono(samples: Float32Array, sourceRate: number, targetRate: number): Float32Array {
  if (sourceRate === targetRate) return samples;
  const ratio = sourceRate / targetRate;
  const length = Math.max(1, Math.round(samples.length / ratio));
  const output = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const position = i * ratio;
    const index = Math.floor(position);
    const frac = position - index;
    const a = samples[index] ?? 0;
    const b = samples[Math.min(index + 1, samples.length - 1)] ?? 0;
    output[i] = a + (b - a) * frac;
  }
  return output;
}

export function pcmToWavBase64(samples: Float32Array, sourceRate: number): { wavBase64: string; durationSeconds: number } {
  const resampled = resampleMono(samples, sourceRate, TARGET_ASR_SAMPLE_RATE);
  const wavBuffer = encodeWavPcm16(resampled, TARGET_ASR_SAMPLE_RATE);
  const wavBase64 = arrayBufferToBase64(wavBuffer);
  return {
    wavBase64,
    durationSeconds: wavDurationSeconds(wavBuffer),
  };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function microphonePermissionMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return 'Allow microphone access when your browser asks — Workbench needs it for voice input.';
    }
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return 'No microphone was found on this device.';
    }
    if (error.name === 'NotReadableError') {
      return 'Your microphone is in use by another app.';
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Could not access the microphone.';
}

/** Triggers the browser permission prompt on first use (must run inside a click handler). */
export async function requestMicrophoneAccess(): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone access is not available in this browser.');
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
  } catch (error) {
    throw new Error(microphonePermissionMessage(error));
  }
}

export class BrowserVoiceRecorder {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private silentGain: GainNode | null = null;
  private pcmChunks: Float32Array[] = [];
  private captureSampleRate = TARGET_ASR_SAMPLE_RATE;
  private startedAt = 0;
  private timeBuffer: Uint8Array | null = null;
  private scrollHistory: number[] = [];
  private smoothedLevels: number[] = [];
  private maxDurationTimer: number | null = null;
  private onMaxDuration: (() => void) | null = null;

  isActive(): boolean {
    return this.processor !== null;
  }

  setMaxDurationHandler(handler: (() => void) | null): void {
    this.onMaxDuration = handler;
  }

  async start(existingStream?: MediaStream): Promise<void> {
    if (this.isActive()) throw new Error('Already recording');

    this.stream = existingStream ?? await requestMicrophoneAccess();

    this.context = new AudioContext();
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    this.captureSampleRate = this.context.sampleRate;
    const source = this.context.createMediaStreamSource(this.stream);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.35;
    source.connect(this.analyser);
    this.timeBuffer = new Uint8Array(this.analyser.fftSize);
    this.scrollHistory = [];
    this.smoothedLevels = Array.from({ length: VOICE_WAVEFORM_BAR_COUNT }, () => 0.06);

    this.pcmChunks = [];
    this.processor = this.context.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      this.pcmChunks.push(new Float32Array(input));
    };
    this.silentGain = this.context.createGain();
    this.silentGain.gain.value = 0;
    source.connect(this.processor);
    this.processor.connect(this.silentGain);
    this.silentGain.connect(this.context.destination);

    this.startedAt = Date.now();
    if (typeof window !== 'undefined') {
      this.maxDurationTimer = window.setTimeout(() => {
        this.onMaxDuration?.();
      }, MAX_VOICE_RECORDING_SECONDS * 1000);
    }
  }

  sampleLevels(barCount = VOICE_WAVEFORM_BAR_COUNT): number[] {
    if (!this.analyser || !this.timeBuffer) {
      return Array.from({ length: barCount }, () => 0.06);
    }
    void this.context?.resume();
    this.analyser.getByteTimeDomainData(this.timeBuffer as Uint8Array<ArrayBuffer>);
    const snapshot = peaksFromTimeDomain(this.timeBuffer, barCount);
    const liveEnergy = rmsFromTimeDomain(this.timeBuffer);
    this.scrollHistory = pushScrollingSample(this.scrollHistory, liveEnergy, barCount);
    const mixed = mixWaveformShapes(this.scrollHistory, snapshot);
    this.smoothedLevels = smoothLevels(this.smoothedLevels, mixed);
    return this.smoothedLevels;
  }

  startedAtMs(): number {
    return this.startedAt;
  }

  cancel(): void {
    this.dispose();
  }

  async stop(): Promise<{ wavBase64: string; durationSeconds: number }> {
    if (!this.isActive()) {
      throw new Error('Not recording');
    }

    const elapsed = (Date.now() - this.startedAt) / 1000;
    const pcm = mergeFloat32Arrays(this.pcmChunks);
    this.dispose();

    if (pcm.length < this.captureSampleRate * 0.15) {
      throw new Error('No audio captured — try speaking closer to the mic.');
    }

    const encoded = pcmToWavBase64(pcm, this.captureSampleRate);
    return {
      wavBase64: encoded.wavBase64,
      durationSeconds: Math.max(encoded.durationSeconds, elapsed),
    };
  }

  private dispose(): void {
    if (this.maxDurationTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
    }
    this.processor?.disconnect();
    this.silentGain?.disconnect();
    this.processor = null;
    this.silentGain = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    void this.context?.close();
    this.context = null;
    this.analyser = null;
    this.timeBuffer = null;
    this.scrollHistory = [];
    this.smoothedLevels = [];
    this.pcmChunks = [];
    this.startedAt = 0;
  }
}