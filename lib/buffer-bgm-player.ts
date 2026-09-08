import { toAudibleBgmGain } from './audio-volume';

/** BGM shares the voice context: no second HTML media autoplay permission. */
export function createBufferBgmPlayer(context: AudioContext, load: () => Promise<ArrayBuffer>, percent: number) {
  const gain = context.createGain();
  gain.connect(context.destination);
  gain.gain.value = toAudibleBgmGain(percent);
  let buffer: AudioBuffer | null = null;
  let loading: Promise<AudioBuffer> | null = null;
  let source: AudioBufferSourceNode | null = null;
  let offset = 0;
  let startedAt = 0;
  let generation = 0;
  let paused = true;
  let disposed = false;

  const pause = () => {
    generation++;
    paused = true;
    if (source) {
      offset = (offset + context.currentTime - startedAt) % source.buffer!.duration;
      source.stop();
      source.disconnect();
      source = null;
    }
  };
  const play = async () => {
    if (disposed || !paused) return;
    const request = ++generation;
    paused = false;
    // Must run in the tap handler, before fetching/decoding the music.
    const ready = context.resume();
    loading ??= load().then(bytes => context.decodeAudioData(bytes.slice(0))).catch(error => {
      loading = null;
      throw error;
    });
    try {
      const [, decoded] = await Promise.all([ready, loading]);
      if (disposed || request !== generation) return;
      buffer = decoded;
      source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      startedAt = context.currentTime;
      source.start(0, offset % buffer.duration);
    } catch (error) {
      if (disposed || request !== generation) return;
      pause();
      throw error;
    }
  };
  return {
    play, pause,
    get paused() { return paused; },
    setVolume(value: number) { gain.gain.value = toAudibleBgmGain(value); },
    dispose() {
      pause();
      disposed = true;
      gain.disconnect();
      buffer = null;
      loading = null;
    },
  };
}
