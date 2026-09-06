import { toAudibleBgmGain } from './audio-volume';

type BgmAudioNodes = {
  source: MediaElementAudioSourceNode;
  gain: GainNode;
};

export function createBrowserBgmGainController(
  createContext: () => AudioContext = () => new AudioContext(),
) {
  let context: AudioContext | null = null;
  const nodes = new Map<HTMLAudioElement, BgmAudioNodes>();

  const ensureContext = () => {
    if (!context || context.state === 'closed') {
      context = createContext();
      nodes.clear();
    }
    return context;
  };

  const connect = (audio: HTMLAudioElement, percent: number) => {
    const audioContext = ensureContext();
    let entry = nodes.get(audio);
    if (!entry) {
      const source = audioContext.createMediaElementSource(audio);
      const gain = audioContext.createGain();
      source.connect(gain);
      gain.connect(audioContext.destination);
      entry = { source, gain };
      nodes.set(audio, entry);
    }
    // iOS Safari ignores programmatic HTMLMediaElement volume. The media
    // element stays at full volume and the Web Audio gain controls BGM only.
    audio.volume = 1;
    entry.gain.gain.value = toAudibleBgmGain(percent);
    void audioContext.resume();
  };

  const activate = async () => {
    const audioContext = ensureContext();
    if (audioContext.state !== 'running') await audioContext.resume();
  };

  const setVolume = (percent: number) => {
    const value = toAudibleBgmGain(percent);
    nodes.forEach(({ gain }) => {
      gain.gain.value = value;
    });
  };

  const dispose = () => {
    nodes.forEach(({ source, gain }) => {
      source.disconnect();
      gain.disconnect();
    });
    nodes.clear();
    if (context && context.state !== 'closed') void context.close();
    context = null;
  };

  return { activate, connect, setVolume, dispose };
}
