import { createRecordingAudioGraph, getSupportedMimeType } from './recording-audio';
import type { CapturedRecording } from './recording-session';

type RecordingGraph = Pick<ReturnType<typeof createRecordingAudioGraph>, 'stream' | 'close'>;

type SegmentedRecordingSessionOptions = {
  constraints?: MediaStreamConstraints;
  mimeType?: string;
  audioBitsPerSecond?: number;
  timeslice?: number;
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createGraph?: (stream: MediaStream) => RecordingGraph;
  createRecorder?: (stream: MediaStream, options: MediaRecorderOptions) => MediaRecorder;
  now?: () => number;
};

export type SegmentedRecordingSession = {
  readonly recording: boolean;
  start: () => void;
  rotate: () => Promise<CapturedRecording>;
  stop: () => Promise<CapturedRecording | null>;
  dispose: () => void;
};

type ActiveSegment = {
  recorder: MediaRecorder;
  startedAt: number;
  chunks: Blob[];
  result: Promise<CapturedRecording>;
  resolve: (capture: CapturedRecording) => void;
  reject: (error: unknown) => void;
};

export async function createSegmentedRecordingSession(
  options: SegmentedRecordingSessionOptions = {},
): Promise<SegmentedRecordingSession> {
  const getUserMedia = options.getUserMedia ?? ((constraints) => navigator.mediaDevices.getUserMedia(constraints));
  const createGraph = options.createGraph ?? createRecordingAudioGraph;
  const createRecorder = options.createRecorder ?? ((stream, recorderOptions) => new MediaRecorder(stream, recorderOptions));
  const now = options.now ?? Date.now;
  const sourceStream = await getUserMedia(options.constraints ?? { audio: true });
  let graph: RecordingGraph;
  try {
    graph = createGraph(sourceStream);
  } catch (error) {
    sourceStream.getTracks().forEach((track) => track.stop());
    throw error;
  }
  const mimeType = options.mimeType ?? getSupportedMimeType();
  const recorderOptions: MediaRecorderOptions = {
    ...(mimeType ? { mimeType } : {}),
    ...(options.audioBitsPerSecond ? { audioBitsPerSecond: options.audioBitsPerSecond } : {}),
  };
  let current: ActiveSegment | null = null;
  let closed = false;
  let cleaned = false;
  const activeRecorders = new Set<MediaRecorder>();

  const cleanup = () => {
    if (cleaned || !closed || activeRecorders.size > 0) return;
    cleaned = true;
    sourceStream.getTracks().forEach((track) => track.stop());
    graph.close();
  };

  const createSegment = () => {
    const recorder = createRecorder(graph.stream, recorderOptions);
    let resolve!: (capture: CapturedRecording) => void;
    let reject!: (error: unknown) => void;
    const result = new Promise<CapturedRecording>((resolveResult, rejectResult) => {
      resolve = resolveResult;
      reject = rejectResult;
    });
    const segment: ActiveSegment = { recorder, startedAt: now(), chunks: [], result, resolve, reject };
    activeRecorders.add(recorder);
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) segment.chunks.push(event.data);
    };
    recorder.onstop = () => {
      activeRecorders.delete(recorder);
      const type = recorder.mimeType || mimeType || 'audio/webm';
      segment.resolve({
        blob: new Blob(segment.chunks, { type }),
        durationMs: Math.max(0, now() - segment.startedAt),
        mimeType: type,
      });
      cleanup();
    };
    recorder.onerror = (event) => {
      activeRecorders.delete(recorder);
      segment.reject(event);
      cleanup();
    };
    return segment;
  };

  const beginSegment = () => {
    if (closed) throw new Error('recording session is closed');
    let segment: ActiveSegment | null = null;
    try {
      segment = createSegment();
      segment.startedAt = now();
      segment.recorder.start(options.timeslice);
      current = segment;
      return segment;
    } catch (error) {
      if (segment) activeRecorders.delete(segment.recorder);
      // A failed rotation must leave the previous segment available to stop.
      // Initial startup failure has no active capture to wait for.
      if (!current) closed = true;
      cleanup();
      throw error;
    }
  };

  return {
    get recording() { return current?.recorder.state === 'recording'; },
    start() {
      if (current || closed) return;
      beginSegment();
    },
    rotate() {
      if (!current || current.recorder.state !== 'recording') return Promise.reject(new Error('recording is not active'));
      const previous = current;
      beginSegment();
      previous.recorder.stop();
      return previous.result;
    },
    stop() {
      if (!current || current.recorder.state !== 'recording') {
        closed = true;
        cleanup();
        return Promise.resolve(null);
      }
      const previous = current;
      current = null;
      closed = true;
      previous.recorder.stop();
      return previous.result;
    },
    dispose() {
      if (closed && cleaned) return;
      closed = true;
      current = null;
      for (const recorder of activeRecorders) {
        if (recorder.state !== 'inactive') recorder.stop();
      }
      cleanup();
    },
  };
}
