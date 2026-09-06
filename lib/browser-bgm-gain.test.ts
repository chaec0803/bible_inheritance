import { describe, expect, it, vi } from 'vitest';
import { createBrowserBgmGainController } from './browser-bgm-gain';

describe('iOS BGM gain controller', () => {
  it('HTML audio volume 대신 전용 GainNode로 BGM 음량을 조절한다', () => {
    const source = { connect: vi.fn(), disconnect: vi.fn() };
    const gain = { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } };
    const context = {
      state: 'running',
      destination: {},
      createMediaElementSource: vi.fn(() => source),
      createGain: vi.fn(() => gain),
      resume: vi.fn(() => Promise.resolve()),
      close: vi.fn(() => Promise.resolve()),
    };
    const audio = { volume: 0 } as HTMLAudioElement;
    const controller = createBrowserBgmGainController(() => context as unknown as AudioContext);

    controller.connect(audio, 12);
    expect(audio.volume).toBe(1);
    expect(source.connect).toHaveBeenCalledWith(gain);
    expect(gain.gain.value).toBeCloseTo(0.12);

    controller.setVolume(2);
    expect(gain.gain.value).toBeCloseTo(0.02);
  });

  it('같은 audio를 다시 연결하지 않고 기존 gain만 갱신한다', () => {
    const source = { connect: vi.fn(), disconnect: vi.fn() };
    const gain = { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } };
    const context = {
      state: 'running', destination: {},
      createMediaElementSource: vi.fn(() => source),
      createGain: vi.fn(() => gain),
      resume: vi.fn(() => Promise.resolve()),
      close: vi.fn(() => Promise.resolve()),
    };
    const audio = { volume: 0 } as HTMLAudioElement;
    const controller = createBrowserBgmGainController(() => context as unknown as AudioContext);

    controller.connect(audio, 10);
    controller.connect(audio, 30);
    expect(context.createMediaElementSource).toHaveBeenCalledTimes(1);
    expect(gain.gain.value).toBeCloseTo(0.3);
  });
});
