import { reportRecordingFailure } from './recording-diagnostics';
export type PlayableAudio = Pick<HTMLAudioElement, 'paused' | 'pause' | 'play'>;

export const PLAYBACK_AUTO_CLOSE_DELAY_MS = 1_500;

export function isPlaybackPauseInterruption(error: unknown) {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
}

export async function toggleAudioPlayback(audio: PlayableAudio, isActive: boolean) {
  if (isActive && !audio.paused) {
    audio.pause();
    return 'paused' as const;
  }
  try { await audio.play(); } catch (error) {
    reportRecordingFailure('audio-play', error);
    throw error;
  }
  return 'playing' as const;
}
