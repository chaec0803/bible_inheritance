import { describe, expect, it } from 'vitest';
import {
  initialRecordingMachineState,
  isRecordingBusy,
  transitionRecordingState,
  type RecordingMachineEvent,
  type RecordingPhase,
} from './recording-machine';

function run(events: RecordingMachineEvent[]) {
  return events.reduce(transitionRecordingState, initialRecordingMachineState);
}

describe('recording machine', () => {
  it('권한 요청부터 저장 완료까지 순서를 강제한다', () => {
    expect(run([
      { type: 'REQUEST_PERMISSION' },
      { type: 'PERMISSION_GRANTED' },
      { type: 'REQUEST_STOP' },
      { type: 'CAPTURE_FINISHED' },
      { type: 'SAVE_SUCCEEDED' },
    ])).toEqual({ phase: 'ready', error: null });
  });

  it('녹음 중 저장 완료처럼 순서를 건너뛰는 이벤트를 무시한다', () => {
    const recording = run([
      { type: 'REQUEST_PERMISSION' },
      { type: 'PERMISSION_GRANTED' },
    ]);
    expect(transitionRecordingState(recording, { type: 'SAVE_SUCCEEDED' })).toBe(recording);
  });

  it('정지 요청은 중복 실행되지 않는다', () => {
    const stopping = run([
      { type: 'REQUEST_PERMISSION' },
      { type: 'PERMISSION_GRANTED' },
      { type: 'REQUEST_STOP' },
    ]);
    expect(transitionRecordingState(stopping, { type: 'REQUEST_STOP' })).toBe(stopping);
  });

  it('저장 실패를 보존하고 재시도 시 안전한 대기 상태로 돌아간다', () => {
    const failed = run([
      { type: 'REQUEST_PERMISSION' },
      { type: 'PERMISSION_GRANTED' },
      { type: 'REQUEST_STOP' },
      { type: 'CAPTURE_FINISHED' },
      { type: 'SAVE_FAILED', message: '저장 실패' },
    ]);
    expect(failed).toEqual({ phase: 'error', error: '저장 실패' });
    expect(transitionRecordingState(failed, { type: 'RETRY' })).toEqual({ phase: 'idle', error: null });
  });

  it('사용자 입력을 막아야 하는 모든 구간을 하나의 규칙으로 판정한다', () => {
    const busy: RecordingPhase[] = ['requesting-permission', 'recording', 'stopping', 'saving'];
    const settled: RecordingPhase[] = ['idle', 'ready', 'error'];
    expect(busy.every(isRecordingBusy)).toBe(true);
    expect(settled.some(isRecordingBusy)).toBe(false);
  });
});
