import { describe, expect, it, vi } from 'vitest';
import { createBufferBgmPlayer } from './buffer-bgm-player';

function fixture() {
  const sources: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; buffer: AudioBuffer | null; loop: boolean; connect: ReturnType<typeof vi.fn> }[] = [];
  const gain = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
  const context = {
    currentTime: 0, destination: {}, resume: vi.fn().mockResolvedValue(undefined),
    createGain: () => gain,
    decodeAudioData: vi.fn().mockResolvedValue({ duration: 100 }),
    createBufferSource: () => {
      const source = { start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), connect: vi.fn(), buffer: null, loop: false };
      sources.push(source); return source;
    },
  };
  return { context, gain, sources, audioContext: context as unknown as AudioContext };
}

describe('shared-context BGM', () => {
  it('unlocks in the tap before loading; loops and resumes at the paused offset', async () => {
    const f = fixture();
    const load = vi.fn(async () => {
      expect(f.context.resume).toHaveBeenCalled();
      return new ArrayBuffer(1);
    });
    const player = createBufferBgmPlayer(f.audioContext, load, 30);
    await player.play();
    expect(f.sources[0].loop).toBe(true);
    expect(f.gain.gain.value).toBeCloseTo(0.09);
    f.context.currentTime = 12;
    player.pause();
    expect(f.sources[0].disconnect).toHaveBeenCalledOnce();
    await player.play();
    expect(f.sources[1].start).toHaveBeenCalledWith(0, 12);
    expect(load).toHaveBeenCalledOnce();
    player.setVolume(0);
    expect(f.gain.gain.value).toBe(0);
    player.dispose();
    expect(f.sources[1].stop).toHaveBeenCalledOnce();
    expect(f.gain.disconnect).toHaveBeenCalledOnce();
  });

  it.each(['pause', 'dispose'] as const)('does not start delayed music after %s', async action => {
    const f = fixture();
    let finish!: (bytes: ArrayBuffer) => void;
    const player = createBufferBgmPlayer(f.audioContext, () => new Promise(resolve => { finish = resolve; }), 30);
    const pending = player.play();
    player[action]();
    finish(new ArrayBuffer(1));
    await pending;
    expect(f.sources).toHaveLength(0);
  });

  it('can retry a failed load', async () => {
    const f = fixture();
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(new ArrayBuffer(1));
    const player = createBufferBgmPlayer(f.audioContext, load, 30);
    await expect(player.play()).rejects.toThrow('offline');
    expect(player.paused).toBe(true);
    await player.play();
    expect(f.sources).toHaveLength(1);
  });
});
