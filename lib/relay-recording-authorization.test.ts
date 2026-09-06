import { describe, expect, it } from 'vitest';
import { canMutateRelayRecording, type RelayRecordingAuthorizationState } from './relay-recording-authorization';

const base: RelayRecordingAuthorizationState = {
  projectStatus: 'in_progress',
  currentTurnIndex: 1,
  participant: true,
  turnIndex: 1,
  turnMemberKey: 'member-b',
  turnCompletedAt: null,
  passages: [{ code: '창', name: '창세기', chapter: 1, startVerse: 13, endVerse: 24 }],
};

describe('이어읽기 녹음 mutation 권한', () => {
  it('현재 담당자의 현재 turn 배정 절만 허용한다', () => {
    expect(canMutateRelayRecording(base, 'member-b', { book: '창세기', chapter: 1, verse: 13 })).toBe(true);
    expect(canMutateRelayRecording(base, 'member-b', { book: '창세기', chapter: 1, verse: 24 })).toBe(true);
  });

  it.each(['pending_invites', 'cancelled', 'completed'])('%s 프로젝트는 mutation을 잠근다', (projectStatus) => {
    expect(canMutateRelayRecording({ ...base, projectStatus }, 'member-b', { book: '창세기', chapter: 1, verse: 13 })).toBe(false);
  });

  it('비참여자와 현재 담당자가 아닌 참여자 및 creator를 잠근다', () => {
    const target = { book: '창세기', chapter: 1, verse: 13 };
    expect(canMutateRelayRecording({ ...base, participant: false }, 'member-b', target)).toBe(false);
    expect(canMutateRelayRecording(base, 'member-a', target)).toBe(false);
    expect(canMutateRelayRecording(base, 'creator', target)).toBe(false);
  });

  it('과거와 미래 turn을 모두 잠근다', () => {
    const target = { book: '창세기', chapter: 1, verse: 13 };
    expect(canMutateRelayRecording({ ...base, turnIndex: 0 }, 'member-b', target)).toBe(false);
    expect(canMutateRelayRecording({ ...base, turnIndex: 2 }, 'member-b', target)).toBe(false);
  });

  it('배정 범위 밖 절과 완료된 turn을 잠근다', () => {
    expect(canMutateRelayRecording(base, 'member-b', { book: '창세기', chapter: 1, verse: 12 })).toBe(false);
    expect(canMutateRelayRecording(base, 'member-b', { book: '창세기', chapter: 1, verse: 25 })).toBe(false);
    expect(canMutateRelayRecording({ ...base, turnCompletedAt: 123 }, 'member-b', { book: '창세기', chapter: 1, verse: 13 })).toBe(false);
  });

  it('여러 장 passages에서도 실제 배정된 절만 허용한다', () => {
    const state = { ...base, passages: [
      { code: '창', name: '창세기', chapter: 1, startVerse: 30, endVerse: 31 },
      { code: '창', name: '창세기', chapter: 2, startVerse: 1, endVerse: 2 },
    ] };
    expect(canMutateRelayRecording(state, 'member-b', { book: '창세기', chapter: 2, verse: 1 })).toBe(true);
    expect(canMutateRelayRecording(state, 'member-b', { book: '창세기', chapter: 1, verse: 29 })).toBe(false);
  });
});
