import { describe, expect, it, vi } from 'vitest';
import { createSegmentedRecordingSession } from './segmented-recording-session';

function harness() {
  const order: string[] = [];
  const track = { stop: vi.fn() };
  const sourceStream = { getTracks: () => [track] } as unknown as MediaStream;
  const graph = { stream: {} as MediaStream, close: vi.fn() };
  const recorders: Array<MediaRecorder & { emitStop: (voice: string) => void }> = [];
  const createRecorder = vi.fn(() => {
    const index = recorders.length;
    const recorder = {
      state: 'inactive',
      mimeType: 'audio/webm',
      ondataavailable: null,
      onstop: null,
      onerror: null,
      start: vi.fn(function(this: { state: string }) { this.state = 'recording'; order.push(`start-${index}`); }),
      stop: vi.fn(function(this: { state: string }) { this.state = 'inactive'; order.push(`stop-${index}`); }),
      emitStop(voice: string) {
        const mediaRecorder = this as unknown as MediaRecorder;
        mediaRecorder.ondataavailable?.({ data: new Blob([voice], { type: 'audio/webm' }) } as BlobEvent);
        mediaRecorder.onstop?.(new Event('stop'));
      },
    } as unknown as MediaRecorder & { emitStop: (voice: string) => void };
    recorders.push(recorder);
    return recorder;
  });
  return { order, track, sourceStream, graph, recorders, createRecorder };
}

describe('segmented recording session', () => {
  it.each(['constructor', 'start'])('%s 실패 시 dispose를 기다리지 않고 마이크와 context를 정리한다', async (failureAt) => {
    const test = harness();
    const failure = new Error('encoder startup failed');
    const session = await createSegmentedRecordingSession({
      getUserMedia: async () => test.sourceStream,
      createGraph: () => test.graph,
      createRecorder: () => {
        if (failureAt === 'constructor') throw failure;
        const recorder = test.createRecorder();
        recorder.start = vi.fn(() => { throw failure; });
        return recorder;
      },
    });

    expect(() => session.start()).toThrow(failure);
    expect(session.recording).toBe(false);
    expect(test.track.stop).toHaveBeenCalledOnce();
    expect(test.graph.close).toHaveBeenCalledOnce();
    session.dispose();
    await expect(session.stop()).resolves.toBeNull();
    expect(test.track.stop).toHaveBeenCalledOnce();
    expect(test.graph.close).toHaveBeenCalledOnce();
  });

  it('다음 절 시작 실패 후 이전 절을 저장하고 자원을 정리할 수 있다', async () => {
    const test = harness();
    const session = await createSegmentedRecordingSession({
      getUserMedia: async () => test.sourceStream,
      createGraph: () => test.graph,
      createRecorder: () => {
        const recorder = test.createRecorder();
        if (test.recorders.length === 2) recorder.start = vi.fn(() => { throw new Error('start failed'); });
        return recorder;
      },
    });
    session.start();
    expect(() => session.rotate()).toThrow('start failed');
    expect(session.recording).toBe(true);
    expect(test.track.stop).not.toHaveBeenCalled();
    const capture = session.stop();
    test.recorders[0].emitStop('preserved voice');
    expect(await (await capture)?.blob.text()).toBe('preserved voice');
    session.dispose();
    expect(test.track.stop).toHaveBeenCalledOnce();
    expect(test.graph.close).toHaveBeenCalledOnce();
  });

  it('마이크 stream 하나를 유지하며 절마다 별도 원본 Blob을 만든다', async () => {
    const test = harness();
    const getUserMedia = vi.fn(async () => test.sourceStream);
    let now = 0;
    const session = await createSegmentedRecordingSession({
      getUserMedia,
      createGraph: () => test.graph,
      createRecorder: test.createRecorder,
      now: () => now,
    });

    session.start();
    now = 1_000;
    const first = session.rotate();
    test.recorders[0].emitStop('first');
    now = 2_500;
    const last = session.stop();
    test.recorders[1].emitStop('second');

    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(await (await first).blob.text()).toBe('first');
    expect((await first).durationMs).toBe(1_000);
    expect(await (await last)?.blob.text()).toBe('second');
    expect((await last)?.durationMs).toBe(1_500);
  });

  it('rotate시 다음 절 recorder를 먼저 시작하고 이전 절을 종료한다', async () => {
    const test = harness();
    const session = await createSegmentedRecordingSession({
      getUserMedia: async () => test.sourceStream,
      createGraph: () => test.graph,
      createRecorder: test.createRecorder,
    });
    session.start();

    void session.rotate();

    expect(test.order).toEqual(['start-0', 'start-1', 'stop-0']);
  });

  it('마지막 절이 종료되면 stream과 audio graph를 한 번만 정리한다', async () => {
    const test = harness();
    const session = await createSegmentedRecordingSession({
      getUserMedia: async () => test.sourceStream,
      createGraph: () => test.graph,
      createRecorder: test.createRecorder,
    });
    session.start();
    const stopped = session.stop();
    test.recorders[0].emitStop('voice');
    await stopped;
    session.dispose();

    expect(test.track.stop).toHaveBeenCalledOnce();
    expect(test.graph.close).toHaveBeenCalledOnce();
  });
});
