import { reportRecordingFailure } from './recording-diagnostics';
import { createRecordingAudioGraph, getSupportedMimeType } from './recording-audio';
import {
  initialRecordingMachineState,
  transitionRecordingState,
  type RecordingMachineState,
} from './recording-machine';

type RecordingGraph = ReturnType<typeof createRecordingAudioGraph>;

export type CapturedRecording = {
  blob: Blob;
  durationMs: number;
  mimeType: string;
};

export type RecordingSession = {
  readonly recorder: MediaRecorder;
  readonly phase: RecordingMachineState['phase'];
  start: () => void;
  stop: () => Promise<CapturedRecording | null>;
  dispose: () => void;
};

type RecordingSessionOptions = {
  constraints?: MediaStreamConstraints;
  mimeType?: string;
  audioBitsPerSecond?: number;
  timeslice?: number;
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createGraph?: (stream: MediaStream) => RecordingGraph;
  createRecorder?: (stream: MediaStream, options: MediaRecorderOptions) => MediaRecorder;
  now?: () => number;
  onCaptured?: (result: CapturedRecording | null) => void | Promise<void>;
  onError?: (error: unknown) => void;
};

export async function createRecordingSession(options: RecordingSessionOptions = {}): Promise<RecordingSession> {
  const getUserMedia = options.getUserMedia ?? ((constraints) => navigator.mediaDevices.getUserMedia(constraints));
  const createGraph = options.createGraph ?? createRecordingAudioGraph;
  const createRecorder = options.createRecorder ?? ((stream, recorderOptions) => new MediaRecorder(stream, recorderOptions));
  const now = options.now ?? Date.now;
  const sourceStream = await getUserMedia(options.constraints ?? { audio: true }).catch(error => {
    reportRecordingFailure('microphone', error);
    throw error;
  });
  let graph: RecordingGraph | null = null;
  let recorder: MediaRecorder;

  try {
    graph = createGraph(sourceStream);
    const mimeType = options.mimeType ?? getSupportedMimeType();
    recorder = createRecorder(graph.stream, {
      ...(mimeType ? { mimeType } : {}),
      ...(options.audioBitsPerSecond ? { audioBitsPerSecond: options.audioBitsPerSecond } : {}),
    });
  } catch (error) {
    reportRecordingFailure(graph ? 'recorder-create' : 'audio-graph', error);
    graph?.close();
    sourceStream.getTracks().forEach((track) => track.stop());
    throw error;
  }

  let machine = initialRecordingMachineState;
  let chunks: Blob[] = [];
  let startedAt = 0;
  let disposed = false;
  let cleaned = false;
  let discardResult = false;
  let stopPromise: Promise<CapturedRecording | null> | null = null;
  let resolveStop: ((result: CapturedRecording | null) => void) | null = null;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    sourceStream.getTracks().forEach((track) => track.stop());
    graph?.close();
  };

  recorder.ondataavailable = (event) => {
    if (!discardResult && event.data.size > 0) chunks.push(event.data);
  };
  recorder.onstop = () => {
    machine = transitionRecordingState(machine, { type: 'CAPTURE_FINISHED' });
    const mimeType = recorder.mimeType || options.mimeType || 'audio/webm';
    const result = discardResult
      ? null
      : { blob: new Blob(chunks, { type: mimeType }), durationMs: Math.max(0, now() - startedAt), mimeType };
    chunks = [];
    cleanup();
    resolveStop?.(result);
    resolveStop = null;
    void options.onCaptured?.(result);
  };
  recorder.onerror = (event) => {
    reportRecordingFailure('recorder-runtime', event);
    discardResult = true;
    disposed = true;
    machine = transitionRecordingState(machine, { type: 'REQUEST_STOP' });
    machine = transitionRecordingState(machine, { type: 'CAPTURE_FINISHED' });
    machine = transitionRecordingState(machine, { type: 'SAVE_FAILED', message: 'recording failed' });
    cleanup();
    resolveStop?.(null);
    resolveStop = null;
    options.onError?.(event);
  };

  return {
    recorder,
    get phase() { return machine.phase; },
    start() {
      if (disposed || machine.phase !== 'idle') return;
      machine = transitionRecordingState(machine, { type: 'REQUEST_PERMISSION' });
      machine = transitionRecordingState(machine, { type: 'PERMISSION_GRANTED' });
      startedAt = now();
      try {
        recorder.start(options.timeslice);
      } catch (error) {
        reportRecordingFailure('recorder-start', error);
        disposed = true;
        discardResult = true;
        machine = transitionRecordingState(machine, { type: 'REQUEST_STOP' });
        machine = transitionRecordingState(machine, { type: 'CAPTURE_FINISHED' });
        machine = transitionRecordingState(machine, { type: 'SAVE_FAILED', message: 'recording failed' });
        cleanup();
        options.onError?.(error);
        throw error;
      }
    },
    stop() {
      if (stopPromise) return stopPromise;
      stopPromise = new Promise((resolve) => { resolveStop = resolve; });
      if (disposed || machine.phase !== 'recording' || recorder.state === 'inactive') {
        cleanup();
        resolveStop?.(null);
        resolveStop = null;
        return stopPromise;
      }
      machine = transitionRecordingState(machine, { type: 'REQUEST_STOP' });
      recorder.stop();
      return stopPromise;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      discardResult = true;
      if (recorder.state !== 'inactive') recorder.stop();
      cleanup();
      resolveStop?.(null);
      resolveStop = null;
    },
  };
}
