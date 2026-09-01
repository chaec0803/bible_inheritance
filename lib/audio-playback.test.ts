import { describe, expect, it, vi } from 'vitest';
import { toggleAudioPlayback } from './audio-playback';

describe('절별 녹음 듣기 버튼', () => {
  it('정지 상태면 오디오 재생을 시작한다', async () => {
    const audio = { paused: true, pause: vi.fn(), play: vi.fn().mockResolvedValue(undefined) };
    await expect(toggleAudioPlayback(audio, false)).resolves.toBe('playing');
    expect(audio.play).toHaveBeenCalledOnce();
  });

  it('이미 재생 중이면 일시정지한다', async () => {
    const audio = { paused: false, pause: vi.fn(), play: vi.fn().mockResolvedValue(undefined) };
    await expect(toggleAudioPlayback(audio, true)).resolves.toBe('paused');
    expect(audio.pause).toHaveBeenCalledOnce();
  });

  it('브라우저가 재생을 거부하면 오류를 전달한다', async () => {
    const error = new Error('play rejected');
    const audio = { paused: true, pause: vi.fn(), play: vi.fn().mockRejectedValue(error) };
    await expect(toggleAudioPlayback(audio, false)).rejects.toBe(error);
  });
});
