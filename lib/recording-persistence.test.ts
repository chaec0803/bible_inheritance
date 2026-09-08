import { describe, expect, it, vi } from 'vitest';
import { trackRecordingPersistence } from './recording-persistence';

describe('recording persistence completion', () => {
  it('중간 절 저장이 먼저 실패하면 마지막 절 저장 성공 후에도 완료를 막는다', async () => {
    const pending = new Set<Promise<void>>();
    const failure = new Error('IndexedDB quota exceeded');
    const first = trackRecordingPersistence(pending, Promise.reject(failure));
    await expect(first).rejects.toBe(failure);
    await trackRecordingPersistence(pending, Promise.resolve());

    const complete = vi.fn();
    await expect(Promise.all(pending).then(complete)).rejects.toBe(failure);
    expect(complete).not.toHaveBeenCalled();
  });

  it('진행 중인 절 저장을 기다리고 모두 성공한 경우에만 완료한다', async () => {
    const pending = new Set<Promise<void>>();
    let finish!: () => void;
    void trackRecordingPersistence(pending, new Promise<void>((resolve) => { finish = resolve; }));
    await trackRecordingPersistence(pending, Promise.resolve());
    const complete = vi.fn();
    const completion = Promise.all(pending).then(complete);
    await Promise.resolve();
    expect(complete).not.toHaveBeenCalled();
    finish();
    await completion;
    expect(complete).toHaveBeenCalledOnce();
    expect(pending.size).toBe(0);
  });

  it('실패한 세션을 초기화하면 다음 정상 녹음을 완료할 수 있다', async () => {
    const pending = new Set<Promise<void>>();
    const failed = trackRecordingPersistence(pending, Promise.reject(new Error('write failed')));
    await expect(failed).rejects.toThrow('write failed');
    pending.clear();
    await trackRecordingPersistence(pending, Promise.resolve());
    await expect(Promise.all(pending)).resolves.toEqual([]);
  });
});
