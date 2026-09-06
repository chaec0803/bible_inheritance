import { describe, expect, it } from 'vitest';
import { getRelayProgress, getRelayProjectView, relayErrorMessage } from './relay-ui';

const base = { status: 'in_progress', canRecord: false, currentTurnIndex: 1, myPosition: 0, turns: [
  { turnIndex: 0, memberKey: 'me', completedAt: 1, passages: [] },
  { turnIndex: 1, memberKey: 'b', completedAt: null, passages: [] },
  { turnIndex: 2, memberKey: 'me', completedAt: null, passages: [] },
] };

describe('이어읽기 UI는 서버 상태를 그대로 반영한다', () => {
  it('현재 rotation 회차와 그룹 안의 내 순서를 분리해서 계산한다', () => {
    expect(getRelayProgress({ currentTurnIndex: 0, participantCount: 3, rotation: 2, myPosition: 1 })).toEqual({
      currentRound: 1,
      totalRounds: 2,
      myTurn: 2,
      totalParticipants: 3,
    });
    expect(getRelayProgress({ currentTurnIndex: 4, participantCount: 3, rotation: 2, myPosition: 1 })).toMatchObject({ currentRound: 2, myTurn: 2 });
  });
  it.each([
    ['pending_invites', 'invites_pending'], ['cancelled', 'cancelled'], ['completed', 'completed'],
  ])('%s 상태', (status, kind) => expect(getRelayProjectView({ ...base, status })).toMatchObject({ kind }));
  it('canRecord=false면 대기하고 다음 내 turn을 보여준다', () => expect(getRelayProjectView(base)).toMatchObject({ kind: 'waiting', nextOwnTurnIndex: 2 }));
  it('canRecord=true라는 서버 응답일 때만 녹음 CTA를 연다', () => expect(getRelayProjectView({ ...base, canRecord: true })).toMatchObject({ kind: 'recordable', turnIndex: 1 }));
  it.each([
    ['NOT_CURRENT_TURN', '이미 다음 차례로 넘어갔어요.'],
    ['RECORDINGS_INCOMPLETE', '아직 녹음하지 않은 말씀이 있어요.'],
    ['PROJECT_CANCELLED', '이 이어읽기는 취소되었어요.'],
    ['PROJECT_COMPLETED', '이미 완성된 이어읽기예요.'],
  ])('서버 %s를 사용자 문구로 바꾼다', (code, message) => expect(relayErrorMessage(code)).toBe(message));
});
