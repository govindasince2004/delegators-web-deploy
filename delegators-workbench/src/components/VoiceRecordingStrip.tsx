import type { CSSProperties } from 'react';
import { VOICE_WAVEFORM_BAR_COUNT } from '../lib/voiceWaveform';

type VoiceRecordingStripProps = {
  levels: number[];
  phase: 'listening' | 'transcribing';
};

export function VoiceRecordingStrip({ levels, phase }: VoiceRecordingStripProps) {
  const bars = levels.length === VOICE_WAVEFORM_BAR_COUNT
    ? levels
    : Array.from({ length: VOICE_WAVEFORM_BAR_COUNT }, (_, index) => levels[index] ?? 0.06);

  return (
    <div
      className={`voice-recording-strip ${phase}`}
      role="status"
      aria-live="polite"
      aria-label={phase === 'listening' ? 'Recording voice input' : 'Transcribing voice input'}
    >
      <div className="voice-recording-wave" aria-hidden="true">
        {bars.map((level, index) => (
          <span
            key={index}
            className="voice-recording-bar"
            style={{ '--voice-level': level.toFixed(3) } as CSSProperties}
          />
        ))}
      </div>
      {phase === 'transcribing' ? (
        <span className="voice-transcribing-label">Transcribing</span>
      ) : null}
    </div>
  );
}