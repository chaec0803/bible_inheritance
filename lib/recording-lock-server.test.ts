import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ row: null as null | Record<string, unknown>, binds: [] as unknown[] }));
vi.mock('@/db', () => ({
  getD1: () => ({
    prepare: () => ({
      bind: (...args: unknown[]) => {
        mocks.binds = args;
        return { first: async () => mocks.row };
      },
    }),
  }),
}));

import { canAccessRelayRecording, isRecordingMutationLocked } from './recording-lock-server';

const target = { projectId: 'relay:project-1:turn:1', book: '창세기', chapter: 1, verse: 13 };
const allowed = {
  project_status: 'in_progress', current_turn_index: 1, member_key: 'member-b',
  turn_index: 1, completed_at: null,
  passages_json: JSON.stringify([{ code: '창', name: '창세기', chapter: 1, startVerse: 13, endVerse: 24 }]),
};

describe('녹음 mutation 서버 relay 잠금', () => {
  beforeEach(() => { mocks.row = { ...allowed }; mocks.binds = []; });

  it('participant인 현재 담당자의 배정 절만 잠금을 해제한다', async () => {
    expect(await isRecordingMutationLocked('member-b', target)).toBe(false);
    expect(mocks.binds).toEqual(['member-b', 1, 'project-1']);
  });

  it.each([
    ['비참여자/없는 프로젝트', null],
    ['초대 대기', { ...allowed, project_status: 'pending_invites' }],
    ['취소', { ...allowed, project_status: 'cancelled' }],
    ['프로젝트 완료', { ...allowed, project_status: 'completed' }],
    ['다른 담당자', { ...allowed, member_key: 'member-a' }],
    ['과거/future turn', { ...allowed, current_turn_index: 2 }],
    ['turn 완료', { ...allowed, completed_at: 10 }],
  ])('%s이면 잠근다', async (_name, row) => {
    mocks.row = row;
    expect(await isRecordingMutationLocked('member-b', target)).toBe(true);
  });

  it('배정 범위 밖 말씀은 잠근다', async () => {
    expect(await isRecordingMutationLocked('member-b', { ...target, verse: 12 })).toBe(true);
  });

  it.each(['relay:', 'relay:abc', 'relay:abc:turn:', 'relay:abc:turn:-1', 'relay:abc:turn:foo', 'relay:abc:turn:1:extra'])('%s는 DB 조회 없이 잠근다', async (projectId) => {
    expect(await isRecordingMutationLocked('member-b', { ...target, projectId })).toBe(true);
    expect(mocks.binds).toEqual([]);
  });
});

describe('relay 녹음 읽기 권한', () => {
  beforeEach(() => { mocks.row = { allowed: 1 }; mocks.binds = []; });
  it('진행 중 프로젝트 participant가 현재 turn까지 다른 멤버의 relay 녹음을 들을 수 있다', async () => {
    expect(await canAccessRelayRecording('member-b', 'relay:project-1:turn:0')).toBe(true);
    expect(mocks.binds).toEqual(['member-b', 'project-1', 0]);
  });
  it('완료 프로젝트에서도 동일한 접근 규칙을 사용한다', async () => {
    expect(await canAccessRelayRecording('member-b', 'relay:project-1:turn:3')).toBe(true);
    expect(mocks.binds).toEqual(['member-b', 'project-1', 3]);
  });
  it('비참여자와 malformed context는 차단한다', async () => {
    mocks.row = null;
    expect(await canAccessRelayRecording('stranger', 'relay:project-1:turn:0')).toBe(false);
    expect(await canAccessRelayRecording('member-b', 'relay:bad')).toBe(false);
  });
});
