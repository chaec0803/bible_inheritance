import { afterEach, expect, it, vi } from 'vitest';
const report = vi.hoisted(() => vi.fn());
vi.mock('./recording-diagnostics', () => ({ reportRecordingFailure: report }));
import { loadArrayBufferOnce } from './media-preload';
import { createBufferBgmPlayer } from './buffer-bgm-player';
afterEach(() => { report.mockClear(); vi.useRealTimers(); });

it('records download HTTP status and track without retaining the URL', async () => {
  await expect(loadArrayBufferOnce('/api/bgm/aeternum?v=3', new Map(), async () => new Response(null, { status: 503 }))).rejects.toThrow();
  expect(report).toHaveBeenCalledWith('bgm-download', expect.any(Error), expect.objectContaining({ status: 503, track: 'aeternum' }));
});

function context() {
  return { state: 'running', resume: vi.fn().mockResolvedValue(undefined), destination: {}, createGain: () => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } }), decodeAudioData: vi.fn().mockRejectedValue(new DOMException('bad bytes', 'EncodingError')) };
}
it('distinguishes decoding failures from download failures and identifies the gift surface', async () => {
  const player = createBufferBgmPlayer(context() as unknown as AudioContext, async () => new ArrayBuffer(3), 30, { surface: 'received-gift', track: 'aeternum' });
  await expect(player.play()).rejects.toThrow('bad bytes');
  expect(report).toHaveBeenCalledWith('bgm-decode', expect.any(DOMException), expect.objectContaining({ surface: 'received-gift', track: 'aeternum', sizeBytes: 3 }));
  player.dispose();
});
it('reports a pending load after 15 seconds without cancelling the user playback', async () => {
  vi.useFakeTimers();
  let finish!: (bytes: ArrayBuffer) => void;
  const player = createBufferBgmPlayer(context() as unknown as AudioContext, () => new Promise(resolve => { finish = resolve; }), 30, { surface: 'gift-preview' });
  const play = player.play();
  await vi.advanceTimersByTimeAsync(15_000);
  expect(report).toHaveBeenCalledWith('bgm-load-stalled', undefined, expect.objectContaining({ elapsedMs: 15_000, surface: 'gift-preview' }));
  player.dispose();
  finish(new ArrayBuffer(1));
  await play;
});
