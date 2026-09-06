import { describe, expect, it, vi } from 'vitest';
import { createAudioContextCloser, createRecordingAudioGraph, getVoiceRecordingConstraints, VOICE_RECORDING_GAIN } from './recording-audio';

describe('녹음 AudioContext 정리', () => {
  it('여러 종료 경로가 호출돼도 AudioContext를 한 번만 닫는다', () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const closeOnce = createAudioContextCloser({ state: 'running', close });
    closeOnce();
    closeOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it('이미 닫힌 AudioContext는 다시 닫지 않는다', () => {
    const close = vi.fn().mockRejectedValue(new Error('Cannot close a closed AudioContext.'));
    createAudioContextCloser({ state: 'closed', close })();
    expect(close).not.toHaveBeenCalled();
  });
});

describe('모바일 음성 입력 설정', () => {
  it('iPhone에서도 자동 음성 보정을 끄고 원음 입력을 요청한다', () => {
    expect(getVoiceRecordingConstraints()).toEqual({
      audio: {
        autoGainControl: false,
        echoCancellation: false,
        noiseSuppression: false,
        channelCount: { ideal: 1 },
        sampleRate: { ideal: 48_000 },
        sampleSize: { ideal: 16 },
      },
    });
  });

  it('자동 보정 없이 고정 gain으로 작은 마이크 입력만 키운다', () => {
    const source = { connect: vi.fn() };
    const gain = { gain: { value: 0 }, connect: vi.fn() };
    const destination = { stream: {} as MediaStream };
    const context = {
      state: 'running',
      createMediaStreamSource: vi.fn(() => source),
      createGain: vi.fn(() => gain),
      createMediaStreamDestination: vi.fn(() => destination),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as AudioContext;

    const graph = createRecordingAudioGraph({} as MediaStream, () => context);

    expect(gain.gain.value).toBe(VOICE_RECORDING_GAIN);
    expect(source.connect).toHaveBeenCalledWith(gain);
    expect(gain.connect).toHaveBeenCalledWith(destination);
    expect(graph.stream).toBe(destination.stream);
  });
});
