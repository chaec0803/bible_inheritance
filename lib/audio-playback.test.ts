import { describe, expect, it, vi } from 'vitest';
import { isPlaybackPauseInterruption, PLAYBACK_AUTO_CLOSE_DELAY_MS, toggleAudioPlayback } from './audio-playback';

describe('연속 재생 완료', () => {
  it('마지막 녹음이 끝난 뒤 완료 상태를 잠시 보여주고 닫는다', () => {
    expect(PLAYBACK_AUTO_CLOSE_DELAY_MS).toBe(1_500);
  });
});

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

describe('연속 재생 일시정지 경합', () => {
  it('play 직후 pause로 발생한 AbortError는 재생 실패로 취급하지 않는다', () => {
    expect(isPlaybackPauseInterruption({ name: 'AbortError' })).toBe(true);
  });

  it('실제 재생 오류는 숨기지 않는다', () => {
    expect(isPlaybackPauseInterruption(new Error('decode failed'))).toBe(false);
  });
});
