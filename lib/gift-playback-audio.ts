import { createBufferBgmPlayer } from './buffer-bgm-player';
import { loadArrayBufferOnce } from './media-preload';
import { reportRecordingFailure } from './recording-diagnostics';

/** One output context for a gift's voice and music, including preview. */
export function createGiftPlaybackAudio() {
  let context: AudioContext | null = null;
  let sources = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>();
  let music: ReturnType<typeof createBufferBgmPlayer> | null = null;
  let selectedSource = '';
  const cache = new Map<string, Promise<ArrayBuffer>>();
  const stop = () => { music?.dispose(); music = null; selectedSource = ''; };
  const resume = () => Promise.all([context?.resume(), music?.play()]).then(() => undefined).catch(error => { reportRecordingFailure('bgm-play', error); throw error; });
  return {
    start(voice: HTMLAudioElement | null, source: string, volume: number, restart = true) {
      context ??= new AudioContext();
      if (voice && !sources.has(voice)) {
        const node = context.createMediaElementSource(voice);
        node.connect(context.destination);
        sources.set(voice, node);
      }
      // Start unlocking synchronously in the user's tap, before any fetch.
      const ready = context.resume();
      if (restart || source !== selectedSource) {
        stop();
        selectedSource = source;
        if (source) music = createBufferBgmPlayer(context, () => loadArrayBufferOnce(source, cache), volume);
      }
      music?.setVolume(volume);
      return Promise.all([ready, resume()]).then(() => undefined);
    },
    resume, stop,
    pause() { music?.pause(); },
    setVolume(volume: number) { music?.setVolume(volume); },
    dispose() {
      stop();
      if (context) void context.close().catch(() => undefined);
      context = null;
      sources = new WeakMap();
      cache.clear();
    },
  };
}
