import { describe, expect, it, vi } from 'vitest';
import { createRecordingSession } from './recording-session';

function harness() {
  const track = { stop: vi.fn() };
  const sourceStream = { getTracks: () => [track] } as unknown as MediaStream;
  const recordingStream = {} as MediaStream;
  const close = vi.fn();
  const recorder = {
    state: 'inactive' as RecordingState,
    mimeType: 'audio/webm;codecs=opus',
    ondataavailable: null as ((event: BlobEvent) => void) | null,
    onstop: null as (() => void) | null,
    onerror: null as ((event: Event) => void) | null,
    start: vi.fn(function (this: typeof recorder) { this.state = 'recording'; }),
    stop: vi.fn(function (this: typeof recorder) { this.state = 'inactive'; }),
  };
  let now = 1_000;
  return {
    track, sourceStream, recordingStream, close, recorder,
    options: {
      getUserMedia: vi.fn().mockResolvedValue(sourceStream),
      createGraph: vi.fn().mockReturnValue({ context: {}, source: {}, destination: {}, stream: recordingStream, close }),
      createRecorder: vi.fn().mockReturnValue(recorder),
      now: () => now,
    },
    advance: (milliseconds: number) => { now += milliseconds; },
  };
}

describe('recording session', () => {
  it('중복 정지 요청에도 recorder를 한 번만 정지하고 같은 완료를 기다린다', async () => {
    const test = harness();
    const session = await createRecordingSession(test.options);
    session.start();
    const first = session.stop();
    const second = session.stop();
    expect(first).toBe(second);
    expect(test.recorder.stop).toHaveBeenCalledOnce();
    test.recorder.onstop?.();
    await expect(first).resolves.toMatchObject({ mimeType: 'audio/webm;codecs=opus' });
    expect(test.track.stop).toHaveBeenCalledOnce();
    expect(test.close).toHaveBeenCalledOnce();
  });

  it('녹음 조각과 시간을 세션 결과 하나로 반환한다', async () => {
    const test = harness();
    const session = await createRecordingSession(test.options);
    session.start();
    test.recorder.ondataavailable?.({ data: new Blob(['voice']) } as BlobEvent);
    test.advance(1_250);
    const resultPromise = session.stop();
    test.recorder.onstop?.();
    const result = await resultPromise;
    expect(result?.blob.size).toBe(5);
    expect(result?.durationMs).toBe(1_250);
  });

  it('언마운트 정리는 여러 번 호출해도 결과를 버리고 자원을 한 번만 닫는다', async () => {
    const test = harness();
    const session = await createRecordingSession(test.options);
    session.start();
    session.dispose();
    session.dispose();
    expect(test.recorder.stop).toHaveBeenCalledOnce();
    expect(test.track.stop).toHaveBeenCalledOnce();
    expect(test.close).toHaveBeenCalledOnce();
    await expect(session.stop()).resolves.toBeNull();
  });

  it('recorder 생성 실패 시 이미 얻은 마이크와 그래프를 정리한다', async () => {
    const test = harness();
    await expect(createRecordingSession({
      ...test.options,
      createRecorder: () => { throw new Error('recorder failed'); },
    })).rejects.toThrow('recorder failed');
    expect(test.track.stop).toHaveBeenCalledOnce();
    expect(test.close).toHaveBeenCalledOnce();
  });

  it('캡처 완료를 호출자에게 한 번 전달한다', async () => {
    const test = harness();
    const onCaptured = vi.fn();
    const session = await createRecordingSession({ ...test.options, onCaptured });
    session.start();
    void session.stop();
    test.recorder.onstop?.();
    expect(onCaptured).toHaveBeenCalledOnce();
    expect(onCaptured.mock.calls[0][0]).toMatchObject({ durationMs: 0 });
  });

  it('recorder 오류도 자원을 정리하고 이후 정지를 즉시 종료한다', async () => {
    const test = harness();
    const onError = vi.fn();
    const session = await createRecordingSession({ ...test.options, onError });
    session.start();
    test.recorder.onerror?.(new Event('error'));
    expect(session.phase).toBe('error');
    expect(onError).toHaveBeenCalledOnce();
    expect(test.track.stop).toHaveBeenCalledOnce();
    expect(test.close).toHaveBeenCalledOnce();
    await expect(session.stop()).resolves.toBeNull();
  });

  it('recorder 시작이 동기 실패해도 확보한 자원을 남기지 않는다', async () => {
    const test = harness();
    test.recorder.start.mockImplementation(() => { throw new Error('start failed'); });
    const session = await createRecordingSession(test.options);
    expect(() => session.start()).toThrow('start failed');
    expect(session.phase).toBe('error');
    expect(test.track.stop).toHaveBeenCalledOnce();
    expect(test.close).toHaveBeenCalledOnce();
  });
});
