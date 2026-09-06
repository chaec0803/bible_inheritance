import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authenticate: vi.fn(), ensureSchema: vi.fn(), rows: [] as Record<string, unknown>[], binds: [] as unknown[], first: [] as unknown[], allQueue: [] as unknown[][], batch: vi.fn(), statements: [] as Array<{ sql: string; values: unknown[] }> }));
vi.mock('@/lib/supabase-auth', () => ({ authenticateRequest: mocks.authenticate }));
vi.mock('@/lib/friend-server', () => ({ ensureUserProfile: vi.fn() }));
vi.mock('@/db', () => ({ ensureDbSchema: mocks.ensureSchema, getD1: () => ({ prepare: (sql: string) => ({ bind: (...values: unknown[]) => { const statement = { sql, values }; mocks.statements.push(statement); return { ...statement, first: async () => mocks.first.shift() ?? null, all: async () => { mocks.binds = values; return { results: mocks.allQueue.length ? mocks.allQueue.shift()! : mocks.rows }; } }; } }), batch: mocks.batch }) }));

import { GET, POST } from './route';

describe('이어읽기 프로젝트 목록 API', () => {
  beforeEach(() => { mocks.authenticate.mockReset().mockResolvedValue({ id: 'member-a' }); mocks.ensureSchema.mockReset().mockResolvedValue(undefined); mocks.rows = []; mocks.binds = []; mocks.first = []; mocks.allQueue = []; mocks.batch.mockReset().mockResolvedValue([]); mocks.statements = []; });

  it('비로그인 조회를 차단한다', async () => {
    mocks.authenticate.mockResolvedValue(null);
    expect((await GET(new Request('https://example.test/api/relay-projects'))).status).toBe(401);
  });

  it('소유한 그룹·유효한 범위로 초대와 turn을 한 batch에 생성한다', async () => {
    mocks.first = [{ id: 'g1', member_keys_json: '["member-a","member-b"]' }];
    mocks.allQueue = [[{ friend_key: 'member-b' }]];
    const response = await POST(new Request('https://example.test/api/relay-projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      groupId: 'g1', title: '창세기 이어읽기', scope: { start: { bookCode: '창', chapter: 1, verse: 1 }, end: { bookCode: '창', chapter: 1, verse: 4 } }, bgmId: 'none', bgmVolume: 8, rotation: 2, inviteMessage: '함께 읽어요.',
    }) }));
    expect(response.status).toBe(201);
    expect(mocks.batch).toHaveBeenCalledOnce();
    const sql = mocks.statements.map((item) => item.sql).join('\n');
    expect(sql).toContain('INSERT INTO relay_projects');
    expect(sql).toContain('INSERT INTO relay_participants');
    expect(sql).toContain('INSERT INTO relay_turns');
    expect(await response.json()).toMatchObject({ project: { status: 'pending_invites', totalTurns: 4, currentTurnIndex: null } });
  });

  it('타인 그룹과 친구 관계가 끊긴 멤버로는 제안을 생성하지 않는다', async () => {
    mocks.first = [null];
    const invalidGroup = await POST(new Request('https://example.test/api/relay-projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId: 'other', title: 'x', scope: { start: { bookCode: '창', chapter: 1, verse: 1 }, end: { bookCode: '창', chapter: 1, verse: 2 } }, rotation: 1 }) }));
    expect(invalidGroup.status).toBe(404);
    expect(mocks.batch).not.toHaveBeenCalled();
  });

  it('참여자의 프로젝트만 상태·진행률과 함께 반환한다', async () => {
    mocks.rows = [{ id: 'p1', title: '가족 이어읽기', status: 'in_progress', scope_json: '{"start":{"bookCode":"창","chapter":1,"verse":1},"end":{"bookCode":"창","chapter":1,"verse":10}}', rotation: 2, current_turn_index: 1, created_at: 10, group_name: '우리 가족', my_invite_status: 'accepted', my_position: 0, total_turns: 4, completed_turns: 1, current_member_nickname: '엄마' }];
    const response = await GET(new Request('https://example.test/api/relay-projects'));
    expect(response.status).toBe(200);
    expect(mocks.binds).toEqual(['member-a']);
    expect(await response.json()).toEqual({ projects: [expect.objectContaining({ id: 'p1', status: 'in_progress', totalTurns: 4, completedTurns: 1, currentMemberNickname: '엄마', groupName: '우리 가족' })] });
  });

  it('내부 DB snake_case 필드를 응답에 노출하지 않는다', async () => {
    mocks.rows = [{ id: 'p1', title: 't', status: 'completed', scope_json: '{}', rotation: 1, current_turn_index: 0, created_at: 1, group_name: 'g', my_invite_status: 'accepted', my_position: 0, total_turns: 1, completed_turns: 1, current_member_nickname: null }];
    const payload = await (await GET(new Request('https://example.test/api/relay-projects'))).text();
    expect(payload).not.toContain('scope_json');
    expect(payload).not.toContain('current_turn_index');
  });
});
