import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  ensureUserProfile: vi.fn(),
  targetProfile: { owner_key: 'user-b' } as Record<string, unknown> | null,
  selfProfile: { owner_key: 'user-a', nickname: '나', email: 'a@example.com' } as Record<string, unknown> | null,
  blockRow: null as Record<string, unknown> | null,
  friendship: null as Record<string, unknown> | null,
  relationshipRows: [] as Array<Record<string, unknown>>,
  hiddenRows: [] as Array<Record<string, unknown>>,
  blockedRows: [] as Array<Record<string, unknown>>,
  searchRows: [] as Array<Record<string, unknown>>,
  statements: [] as Array<{ sql: string; values: unknown[]; operation: 'first' | 'run' | 'all' }>,
}));

vi.mock('@/lib/supabase-auth', () => ({ authenticateRequest: mocks.authenticateRequest }));
vi.mock('@/lib/friend-server', () => ({ ensureUserProfile: mocks.ensureUserProfile }));
vi.mock('@/db', () => ({
  ensureDbSchema: async () => undefined,
  getD1: () => ({
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => ({
        sql,
        values,
        first: async () => {
          mocks.statements.push({ sql, values, operation: 'first' });
          if (sql.includes('FROM friend_blocks')) return mocks.blockRow;
          if (sql.includes('FROM friendships')) return mocks.friendship;
          if (sql.includes('owner_key, nickname, email')) return mocks.selfProfile;
          return mocks.targetProfile;
        },
        run: async () => {
          mocks.statements.push({ sql, values, operation: 'run' });
          return { success: true };
        },
        all: async () => {
          mocks.statements.push({ sql, values, operation: 'all' });
          if (sql.includes('UNION')) return { results: mocks.hiddenRows };
          if (sql.includes('FROM friend_blocks')) return { results: mocks.blockedRows };
          if (sql.includes('FROM friendships')) return { results: mocks.relationshipRows };
          return { results: mocks.searchRows };
        },
      }),
    }),
  }),
}));

import { GET, POST } from './route';

function actionRequest(action: string, userId: string) {
  return new Request('https://example.test/api/friends', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, userId }),
  });
}

function ranSql(fragment: string) {
  return mocks.statements.filter((statement) => statement.sql.includes(fragment));
}

describe('친구 차단 API 통합 회귀', () => {
  beforeEach(() => {
    mocks.authenticateRequest.mockReset().mockResolvedValue({ id: 'user-a', email: 'a@example.com' });
    mocks.ensureUserProfile.mockReset().mockResolvedValue(undefined);
    mocks.targetProfile = { owner_key: 'user-b' };
    mocks.selfProfile = { owner_key: 'user-a', nickname: '나', email: 'a@example.com' };
    mocks.blockRow = null;
    mocks.friendship = null;
    mocks.relationshipRows = [];
    mocks.hiddenRows = [];
    mocks.blockedRows = [];
    mocks.searchRows = [];
    mocks.statements = [];
  });

  it('로그인하지 않으면 차단하거나 차단을 해제할 수 없다', async () => {
    mocks.authenticateRequest.mockResolvedValue(null);
    expect((await POST(actionRequest('block', 'user-b'))).status).toBe(401);
    expect((await POST(actionRequest('unblock', 'user-b'))).status).toBe(401);
  });

  it('자기 자신은 차단할 수 없다', async () => {
    const response = await POST(actionRequest('block', 'user-a'));
    expect(response.status).toBe(400);
    expect(ranSql('INSERT INTO friend_blocks')).toHaveLength(0);
  });

  it('차단하면 기존 친구 관계와 양방향 대기 요청을 함께 지운다', async () => {
    const response = await POST(actionRequest('block', 'user-b'));
    expect(response.status).toBe(200);
    const deleted = ranSql('DELETE FROM friendships');
    expect(deleted).toHaveLength(1);
    expect(deleted[0].values).toEqual(expect.arrayContaining(['user-a', 'user-b']));
    const inserted = ranSql('INSERT INTO friend_blocks');
    expect(inserted).toHaveLength(1);
    expect(inserted[0].values).toEqual(expect.arrayContaining(['user-a', 'user-b']));
  });

  it('차단을 해제해도 친구 관계는 자동으로 복구하지 않는다', async () => {
    const response = await POST(actionRequest('unblock', 'user-b'));
    expect(response.status).toBe(200);
    const removed = ranSql('DELETE FROM friend_blocks');
    expect(removed).toHaveLength(1);
    expect(removed[0].values).toEqual(expect.arrayContaining(['user-a', 'user-b']));
    expect(ranSql('INSERT INTO friendships')).toHaveLength(0);
    expect(ranSql("UPDATE friendships SET status = 'accepted'")).toHaveLength(0);
  });

  it('차단한 사이에는 친구 요청도 수락도 할 수 없다', async () => {
    mocks.blockRow = { id: 'block-1' };
    expect((await POST(actionRequest('request', 'user-b'))).status).toBe(403);
    expect((await POST(actionRequest('accept', 'user-b'))).status).toBe(403);
    expect(ranSql('INSERT INTO friendships')).toHaveLength(0);
  });

  it('차단한 사용자와 나를 차단한 사용자를 목록과 검색 결과에서 모두 제외한다', async () => {
    mocks.relationshipRows = [
      { id: 'f1', requested_by: 'user-a', status: 'accepted', other_user_id: 'user-b', nickname: '비', email: 'b@example.com' },
      { id: 'f2', requested_by: 'user-c', status: 'pending', other_user_id: 'user-c', nickname: '씨', email: 'c@example.com' },
    ];
    mocks.hiddenRows = [{ other_user_id: 'user-b' }, { other_user_id: 'user-c' }];
    mocks.searchRows = [{ owner_key: 'user-b', nickname: '비', email: 'b@example.com' }];

    const response = await GET(new Request('https://example.test/api/friends?q=비'));
    expect(response.status).toBe(200);
    const payload = await response.json() as { friends: unknown[]; incoming: unknown[]; outgoing: unknown[]; results: unknown[] };
    expect(payload.friends).toHaveLength(0);
    expect(payload.incoming).toHaveLength(0);
    expect(payload.outgoing).toHaveLength(0);
    expect(payload.results).toHaveLength(0);
  });

  it('차단한 사용자 목록을 별도로 돌려준다', async () => {
    mocks.blockedRows = [{ other_user_id: 'user-b', nickname: '비', email: 'blocked@example.com' }];
    const response = await GET(new Request('https://example.test/api/friends'));
    const payload = await response.json() as { blocked: Array<{ userId: string; nickname: string; emailHint: string }> };
    expect(payload.blocked).toHaveLength(1);
    expect(payload.blocked[0]).toMatchObject({ userId: 'user-b', nickname: '비' });
    expect(payload.blocked[0].emailHint).not.toBe('blocked@example.com');
  });
});
