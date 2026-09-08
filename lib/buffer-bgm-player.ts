import { reportRecordingFailure, type RecordingDiagnostic } from './recording-diagnostics';
import { toAudibleBgmGain } from './audio-volume';

/** BGM shares the voice context: no second HTML media autoplay permission. */
export function createBufferBgmPlayer(context: AudioContext, load: () => Promise<ArrayBuffer>, percent: number, diagnostic: Pick<RecordingDiagnostic, 'track' | 'surface'> = {}) {
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
    const started = Date.now();
    const details = () => ({ ...diagnostic, contextState: context.state, elapsedMs: Date.now() - started });
    const ready = context.resume().catch(error => { reportRecordingFailure('bgm-context', error, details()); throw error; });
    loading ??= load().then(bytes => context.decodeAudioData(bytes.slice(0)).catch(error => {
      reportRecordingFailure('bgm-decode', error, { ...details(), sizeBytes: bytes.byteLength });
      throw error;
    })).catch(error => {
      loading = null;
      throw error;
    });
    const slow = setTimeout(() => {
      if (!disposed && request === generation) reportRecordingFailure('bgm-load-stalled', undefined, details());
    }, 15_000);
    let starting = false;
    try {
      const [, decoded] = await Promise.all([ready, loading]);
      if (disposed || request !== generation) return;
      starting = true;
      buffer = decoded;
      source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      startedAt = context.currentTime;
      source.start(0, offset % buffer.duration);
    } catch (error) {
      if (disposed || request !== generation) return;
      if (starting) reportRecordingFailure('bgm-start', error, details());
      pause();
      throw error;
    } finally { clearTimeout(slow); }
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
