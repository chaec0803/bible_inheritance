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
  await audio.play();
  return 'playing' as const;
}
