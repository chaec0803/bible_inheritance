export type PlayableAudio = Pick<HTMLAudioElement, 'paused' | 'pause' | 'play'>;

export async function toggleAudioPlayback(audio: PlayableAudio, isActive: boolean) {
  if (isActive && !audio.paused) {
    audio.pause();
    return 'paused' as const;
  }
  await audio.play();
  return 'playing' as const;
}
