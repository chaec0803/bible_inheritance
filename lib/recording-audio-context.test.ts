import { describe, expect, it, vi } from 'vitest';
import { createAudioContextCloser } from './recording-audio';

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
