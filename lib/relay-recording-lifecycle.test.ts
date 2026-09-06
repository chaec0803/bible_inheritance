import { describe, expect, it } from 'vitest';
import { applyRelayTurnCompletion, type RelayCompletionState } from './relay-completion-transition';
import { canMutateRelayRecording, type RelayRecordingAuthorizationState } from './relay-recording-authorization';
import { getRelayRecordingProjectId, inspectRelayTurnRecordings, type RelayRecordingRow } from './relay-recording-completeness';

const passages = [{ code: '창', name: '창세기', chapter: 1, startVerse: 1, endVerse: 2 }];
const target = { book: '창세기', chapter: 1, verse: 1 };

describe('이어읽기 녹음·완료 전체 상태 회귀', () => {
  it('A 완료 후 A는 immutable하고 B의 차례만 열리며 마지막 완료 후 모두 잠긴다', () => {
    let progress: RelayCompletionState = { status: 'in_progress', currentTurnIndex: 0, completedAt: null, turns: [
      { turnIndex: 0, memberKey: 'a', completedAt: null },
      { turnIndex: 1, memberKey: 'b', completedAt: null },
    ] };
    const auth = (userKey: string, turnIndex: number): RelayRecordingAuthorizationState => ({
      projectStatus: progress.status, currentTurnIndex: progress.currentTurnIndex, participant: true,
      turnIndex, turnMemberKey: progress.turns[turnIndex].memberKey,
      turnCompletedAt: progress.turns[turnIndex].completedAt, passages,
    });

    expect(canMutateRelayRecording(auth('a', 0), 'a', target)).toBe(true);
    expect(canMutateRelayRecording(auth('b', 1), 'b', target)).toBe(false);

    const aRecordings: RelayRecordingRow[] = [1, 2].map((verse) => ({ ownerKey: 'a', projectId: getRelayRecordingProjectId('p1', 0), book: '창세기', chapter: 1, verse }));
    expect(inspectRelayTurnRecordings({ projectId: 'p1', turnIndex: 0, memberKey: 'a', passages, recordings: aRecordings }).complete).toBe(true);
    aRecordings.pop();
    expect(inspectRelayTurnRecordings({ projectId: 'p1', turnIndex: 0, memberKey: 'a', passages, recordings: aRecordings }).complete).toBe(false);
    aRecordings.push({ ownerKey: 'a', projectId: getRelayRecordingProjectId('p1', 0), book: '창세기', chapter: 1, verse: 2 });

    progress = applyRelayTurnCompletion(progress, { turnIndex: 0, memberKey: 'a', now: 10 }).state;
    expect(canMutateRelayRecording(auth('a', 0), 'a', target)).toBe(false);
    expect(canMutateRelayRecording(auth('b', 1), 'b', target)).toBe(true);

    progress = applyRelayTurnCompletion(progress, { turnIndex: 1, memberKey: 'b', now: 20 }).state;
    expect(progress.status).toBe('completed');
    expect(canMutateRelayRecording(auth('b', 1), 'b', target)).toBe(false);
  });
});
