import { describe, expect, it } from 'vitest';
import { bibleBooks } from '@/app/bible-metadata';
import {
  buildRelayTurns,
  getRelayTurnState,
  respondToRelayInvite,
  type RelayParticipant,
} from './relay-reading';

const participants: RelayParticipant[] = [
  { memberKey: 'a', position: 0, inviteStatus: 'accepted', respondedAt: 1 },
  { memberKey: 'b', position: 1, inviteStatus: 'pending', respondedAt: null },
  { memberKey: 'c', position: 2, inviteStatus: 'pending', respondedAt: null },
];

describe('이어읽기 순서와 말씀 자동 배분', () => {
  it('멤버 순서를 rotation만큼 반복하고 모든 절을 한 번씩 연속 배분한다', () => {
    const turns = buildRelayTurns({
      books: bibleBooks,
      range: {
        start: { bookCode: '창', chapter: 1, verse: 1 },
        end: { bookCode: '창', chapter: 1, verse: 12 },
      },
      memberKeys: ['a', 'b', 'c'],
      rotation: 2,
    });

    expect(turns.map((turn) => turn.memberKey)).toEqual(['a', 'b', 'c', 'a', 'b', 'c']);
    expect(turns.map((turn) => turn.turnIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(turns.map((turn) => turn.verseCount)).toEqual([2, 2, 2, 2, 2, 2]);
    expect(turns.flatMap((turn) => turn.passages)).toEqual([
      { code: '창', name: '창세기', chapter: 1, startVerse: 1, endVerse: 2 },
      { code: '창', name: '창세기', chapter: 1, startVerse: 3, endVerse: 4 },
      { code: '창', name: '창세기', chapter: 1, startVerse: 5, endVerse: 6 },
      { code: '창', name: '창세기', chapter: 1, startVerse: 7, endVerse: 8 },
      { code: '창', name: '창세기', chapter: 1, startVerse: 9, endVerse: 10 },
      { code: '창', name: '창세기', chapter: 1, startVerse: 11, endVerse: 12 },
    ]);
  });

  it('장 경계를 넘더라도 절을 손상시키지 않고 연속된 passage로 보존한다', () => {
    const turns = buildRelayTurns({
      books: bibleBooks,
      range: {
        start: { bookCode: '창', chapter: 1, verse: 30 },
        end: { bookCode: '창', chapter: 2, verse: 4 },
      },
      memberKeys: ['a', 'b'],
      rotation: 1,
    });
    expect(turns[0].passages).toEqual([
      { code: '창', name: '창세기', chapter: 1, startVerse: 30, endVerse: 31 },
      { code: '창', name: '창세기', chapter: 2, startVerse: 1, endVerse: 1 },
    ]);
    expect(turns[1].passages).toEqual([
      { code: '창', name: '창세기', chapter: 2, startVerse: 2, endVerse: 4 },
    ]);
  });

  it('각 turn에 최소 한 절을 줄 수 없으면 제안을 만들지 않는다', () => {
    expect(() => buildRelayTurns({
      books: bibleBooks,
      range: {
        start: { bookCode: '시', chapter: 23, verse: 1 },
        end: { bookCode: '시', chapter: 23, verse: 6 },
      },
      memberKeys: ['a', 'b', 'c'],
      rotation: 3,
    })).toThrow('전체 turn 수보다 말씀 절 수가 적어요.');
  });

  it('중복 멤버나 잘못된 rotation을 허용하지 않는다', () => {
    const base = {
      books: bibleBooks,
      range: {
        start: { bookCode: '창', chapter: 1, verse: 1 },
        end: { bookCode: '창', chapter: 1, verse: 12 },
      },
    };
    expect(() => buildRelayTurns({ ...base, memberKeys: ['a', 'a'], rotation: 1 })).toThrow('참여자가 중복되었어요.');
    expect(() => buildRelayTurns({ ...base, memberKeys: ['a', 'b'], rotation: 0 })).toThrow('rotation이 올바르지 않아요.');
  });
});

describe('이어읽기 초대 상태 전이', () => {
  it('마지막 참여자가 승낙하면 즉시 첫 turn을 시작한다', () => {
    const before = participants.map((participant) => participant.memberKey === 'b'
      ? { ...participant, inviteStatus: 'accepted' as const, respondedAt: 2 }
      : participant);
    const result = respondToRelayInvite({
      projectStatus: 'pending_invites',
      participants: before,
      memberKey: 'c',
      response: 'accepted',
      now: 3,
    });
    expect(result.projectStatus).toBe('in_progress');
    expect(result.currentTurnIndex).toBe(0);
    expect(result.participants.find((item) => item.memberKey === 'c')).toMatchObject({ inviteStatus: 'accepted', respondedAt: 3 });
  });

  it('한 명이 거절하면 프로젝트 전체를 즉시 취소한다', () => {
    const result = respondToRelayInvite({
      projectStatus: 'pending_invites',
      participants,
      memberKey: 'b',
      response: 'declined',
      now: 4,
    });
    expect(result.projectStatus).toBe('cancelled');
    expect(result.currentTurnIndex).toBeNull();
  });

  it('이미 응답했거나 종료된 프로젝트의 응답은 되돌릴 수 없다', () => {
    expect(() => respondToRelayInvite({ projectStatus: 'pending_invites', participants, memberKey: 'a', response: 'declined', now: 4 })).toThrow('이미 응답한 초대예요.');
    expect(() => respondToRelayInvite({ projectStatus: 'cancelled', participants, memberKey: 'b', response: 'accepted', now: 4 })).toThrow('응답할 수 없는 이어읽기예요.');
  });
});

describe('이어읽기 turn 접근 상태', () => {
  it('현재 담당자만 녹음할 수 있고 나머지는 대기한다', () => {
    const project = { status: 'in_progress' as const, currentTurnIndex: 1 };
    const turns = [
      { turnIndex: 0, memberKey: 'a', completedAt: 10 },
      { turnIndex: 1, memberKey: 'b', completedAt: null },
      { turnIndex: 2, memberKey: 'c', completedAt: null },
    ];
    expect(getRelayTurnState(project, turns, 'a')).toMatchObject({ kind: 'waiting', currentMemberKey: 'b' });
    expect(getRelayTurnState(project, turns, 'b')).toMatchObject({ kind: 'recordable', turnIndex: 1 });
    expect(getRelayTurnState(project, turns, 'c')).toMatchObject({ kind: 'waiting', nextOwnTurnIndex: 2 });
  });

  it('초대 대기·취소·완료 프로젝트에는 녹음 권한을 주지 않는다', () => {
    const turns = [{ turnIndex: 0, memberKey: 'a', completedAt: null }];
    expect(getRelayTurnState({ status: 'pending_invites', currentTurnIndex: null }, turns, 'a').kind).toBe('invites_pending');
    expect(getRelayTurnState({ status: 'cancelled', currentTurnIndex: null }, turns, 'a').kind).toBe('cancelled');
    expect(getRelayTurnState({ status: 'completed', currentTurnIndex: 1 }, turns, 'a').kind).toBe('completed');
  });
});
