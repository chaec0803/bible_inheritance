import { afterEach, expect, it, vi } from 'vitest';
const report = vi.hoisted(() => vi.fn());
vi.mock('./recording-diagnostics', () => ({ reportRecordingFailure: report }));
import { createRecordingSession } from './recording-session';
import { createSegmentedRecordingSession } from './segmented-recording-session';
afterEach(() => report.mockClear());
it.each([createRecordingSession, createSegmentedRecordingSession])('identifies microphone permission failures before creating the recorder', async create => {
  const failure = new DOMException('denied', 'NotAllowedError');
  await expect(create({ getUserMedia: async () => { throw failure; } })).rejects.toBe(failure);
  expect(report).toHaveBeenCalledWith('microphone', failure);
});
it('records an asynchronous segmented encoder error immediately', async () => {
  const recorder = { state: 'inactive', start: vi.fn(), stop: vi.fn() } as unknown as MediaRecorder;
  const session = await createSegmentedRecordingSession({
    getUserMedia: async () => ({ getTracks: () => [] }) as unknown as MediaStream,
    createGraph: () => ({ stream: {} as MediaStream, close: vi.fn() }),
    createRecorder: () => recorder,
    mimeType: 'audio/webm',
  });
  session.start();
  const failure = new Event('error') as ErrorEvent;
  recorder.onerror?.(failure);
  await Promise.resolve();
  expect(report).toHaveBeenCalledWith('recorder-runtime', failure);
  session.dispose();
});
