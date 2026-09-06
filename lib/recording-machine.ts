export type RecordingPhase =
  | 'idle'
  | 'requesting-permission'
  | 'recording'
  | 'stopping'
  | 'saving'
  | 'ready'
  | 'error';

export type RecordingMachineState = {
  phase: RecordingPhase;
  error: string | null;
};

export type RecordingMachineEvent =
  | { type: 'REQUEST_PERMISSION' }
  | { type: 'PERMISSION_GRANTED' }
  | { type: 'PERMISSION_DENIED'; message: string }
  | { type: 'REQUEST_STOP' }
  | { type: 'CAPTURE_FINISHED' }
  | { type: 'SAVE_SUCCEEDED' }
  | { type: 'SAVE_FAILED'; message: string }
  | { type: 'RETRY' }
  | { type: 'RESET' };

export const initialRecordingMachineState: RecordingMachineState = {
  phase: 'idle',
  error: null,
};

const transitions: Record<RecordingPhase, Partial<Record<RecordingMachineEvent['type'], RecordingPhase>>> = {
  idle: { REQUEST_PERMISSION: 'requesting-permission', RESET: 'idle' },
  'requesting-permission': {
    PERMISSION_GRANTED: 'recording',
    PERMISSION_DENIED: 'error',
    RESET: 'idle',
  },
  recording: { REQUEST_STOP: 'stopping', RESET: 'idle' },
  stopping: { CAPTURE_FINISHED: 'saving', RESET: 'idle' },
  saving: { SAVE_SUCCEEDED: 'ready', SAVE_FAILED: 'error', RESET: 'idle' },
  ready: { REQUEST_PERMISSION: 'requesting-permission', RESET: 'idle' },
  error: { RETRY: 'idle', RESET: 'idle' },
};

export function transitionRecordingState(
  state: RecordingMachineState,
  event: RecordingMachineEvent,
): RecordingMachineState {
  const nextPhase = transitions[state.phase][event.type];
  if (!nextPhase) return state;
  const error = event.type === 'PERMISSION_DENIED' || event.type === 'SAVE_FAILED'
    ? event.message
    : null;
  return { phase: nextPhase, error };
}

export function isRecordingBusy(phase: RecordingPhase) {
  return phase === 'requesting-permission'
    || phase === 'recording'
    || phase === 'stopping'
    || phase === 'saving';
}

