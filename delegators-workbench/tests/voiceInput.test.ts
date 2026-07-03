import { describe, expect, it, vi } from 'vitest';
import {
  buildTranscriptionUrl,
  encodeWavPcm16,
  mergeFloat32Arrays,
  microphonePermissionMessage,
  parseVoiceGatewayError,
  pcmToWavBase64,
  transcribeVoice,
  wavDurationSeconds,
} from '../src/lib/voiceInput';

describe('voiceInput', () => {
  it('builds the same-origin workbench transcription URL', () => {
    expect(buildTranscriptionUrl('http://localhost:5175/')).toBe('http://localhost:5175/api/voice/transcribe');
    expect(buildTranscriptionUrl('')).toBe('/api/voice/transcribe');
  });

  it('parses gateway error payloads', () => {
    expect(parseVoiceGatewayError({ error: 'No credits' }, 'fallback')).toBe('No credits');
    expect(parseVoiceGatewayError({ error: { message: 'Budget exhausted' } }, 'fallback')).toBe('Budget exhausted');
    expect(parseVoiceGatewayError({ details: 'No active Delegators session for voice transcription.' }, 'fallback'))
      .toBe('No active Delegators session for voice transcription.');
    expect(parseVoiceGatewayError({}, 'fallback')).toBe('fallback');
  });

  it('transcribes through the same-origin workbench proxy', async () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => 'sess_test_voice_proxy_key_1234567890',
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      expect(url).toContain('/api/voice/transcribe');
      return new Response(JSON.stringify({ text: 'hello world', duration_seconds: 1.2 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));
    await expect(transcribeVoice('ZmFrZQ==', 1.2)).resolves.toMatchObject({
      text: 'hello world',
      durationSeconds: 1.2,
    });
    vi.unstubAllGlobals();
  });

  it('maps microphone permission errors', () => {
    expect(microphonePermissionMessage(new DOMException('denied', 'NotAllowedError')))
      .toContain('Allow microphone access');
  });

  it('encodes a valid wav header and duration', () => {
    const samples = new Float32Array(16000);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(i / 40) * 0.2;
    const wav = encodeWavPcm16(samples, 16000);
    expect(wav.byteLength).toBeGreaterThan(44);
    expect(wavDurationSeconds(wav)).toBeCloseTo(1, 2);
  });

  it('builds ASR wav from captured PCM without decoding webm', () => {
    const chunkA = new Float32Array(1200).fill(0.1);
    const chunkB = new Float32Array(800).fill(-0.1);
    const merged = mergeFloat32Arrays([chunkA, chunkB]);
    expect(merged.length).toBe(2000);
    const encoded = pcmToWavBase64(merged, 16000);
    expect(encoded.wavBase64.length).toBeGreaterThan(100);
    expect(encoded.durationSeconds).toBeCloseTo(0.125, 2);
  });
});