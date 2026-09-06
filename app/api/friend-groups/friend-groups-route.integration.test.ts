import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authenticate: vi.fn(), ensureSchema: vi.fn(), ensureProfile: vi.fn(), all: [] as unknown[][], run: vi.fn(), sql: [] as string[] }));
vi.mock('@/lib/supabase-auth', () => ({ authenticateRequest: mocks.authenticate }));
vi.mock('@/lib/friend-server', () => ({ ensureUserProfile: mocks.ensureProfile }));
vi.mock('@/db', () => ({ ensureDbSchema: mocks.ensureSchema, getD1: () => ({ prepare: (sql: string) => { mocks.sql.push(sql); return { bind: (..._values: unknown[]) => ({ all: async () => ({ results: mocks.all.shift() ?? [] }), run: mocks.run }) }; } }) }));

import { GET, POST } from './route';

function post(body: unknown) { return POST(new Request('https://example.test/api/friend-groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })); }

describe('친구 그룹 API', () => {
  beforeEach(() => { mocks.authenticate.mockReset().mockResolvedValue({ id: 'me', email: 'me@test.com' }); mocks.ensureSchema.mockReset().mockResolvedValue(undefined); mocks.ensureProfile.mockReset().mockResolvedValue(undefined); mocks.all = []; mocks.run.mockReset().mockResolvedValue({ success: true }); mocks.sql = []; });

  it('내가 소유한 그룹과 저장된 순서의 멤버를 조회한다', async () => {
    mocks.all = [[{ id: 'g1', name: '우리 가족', created_at: 1, updated_at: 2 }], [
      { group_id: 'g1', member_key: 'me', nickname: '나', position: 0 },
      { group_id: 'g1', member_key: 'friend-1', nickname: '엄마', position: 1 },
    ]];
    const payload = await (await GET(new Request('https://example.test/api/friend-groups'))).json();
    expect(payload).toEqual({ groups: [{ id: 'g1', name: '우리 가족', createdAt: 1, updatedAt: 2, members: [
      { memberKey: 'me', nickname: '나', position: 0 }, { memberKey: 'friend-1', nickname: '엄마', position: 1 },
    ] }] });
  });

  it('두 명 이상의 accepted friend 그룹을 저장하며 self는 auth id로 확정한다', async () => {
    mocks.all = [[{ friend_key: 'friend-1' }]];
    const response = await post({ name: '우리 가족', memberKeys: ['self', 'friend-1'] });
    expect(response.status).toBe(201);
    expect(mocks.run).toHaveBeenCalledOnce();
    expect(mocks.run.mock.calls[0]).toBeDefined();
    expect(mocks.sql.join('\n')).toContain('INSERT INTO friend_groups');
  });

  it('비친구·중복·자기만 있는 그룹을 저장하지 않는다', async () => {
    expect((await post({ name: 'x', memberKeys: ['self'] })).status).toBe(400);
    expect((await post({ name: 'x', memberKeys: ['self', 'self'] })).status).toBe(400);
    mocks.all = [[]];
    expect((await post({ name: 'x', memberKeys: ['self', 'stranger'] })).status).toBe(403);
    expect(mocks.run).not.toHaveBeenCalled();
  });
});
