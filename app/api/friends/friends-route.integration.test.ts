import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  ensureUserProfile: vi.fn(),
  firstResults: [] as unknown[],
  allResults: [] as unknown[][],
  statements: [] as Array<{ sql: string; values: unknown[]; operation: 'first' | 'run' | 'all' }>,
}));

vi.mock('@/lib/supabase-auth', () => ({ authenticateRequest: mocks.authenticateRequest }));
vi.mock('@/lib/friend-server', () => ({ ensureUserProfile: mocks.ensureUserProfile }));
vi.mock('@/db', () => ({
  getD1: () => ({
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => ({
        first: async () => {
          mocks.statements.push({ sql, values, operation: 'first' });
          return mocks.firstResults.shift() ?? null;
        },
        run: async () => {
          mocks.statements.push({ sql, values, operation: 'run' });
          return { success: true };
        },
        all: async () => {
          mocks.statements.push({ sql, values, operation: 'all' });
          return { results: mocks.allResults.shift() ?? [] };
        },
      }),
    }),
  }),
}));

import { GET, PATCH, POST } from './route';

function actionRequest(action: string, userId: string) {
  return new Request('https://example.test/api/friends', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, userId }),
  });
}

describe('친구 관계 API 통합 회귀', () => {
  beforeEach(() => {
    mocks.authenticateRequest.mockReset();
    mocks.ensureUserProfile.mockReset();
    mocks.firstResults = [];
    mocks.allResults = [];
    mocks.statements = [];
  });

  it('로그인하지 않은 친구 요청을 거부한다', async () => {
    mocks.authenticateRequest.mockResolvedValue(null);
    expect((await POST(actionRequest('request', 'friend-b'))).status).toBe(401);
  });

  it('새 친구 요청을 pending 관계로 저장한다', async () => {
    mocks.authenticateRequest.mockResolvedValue({ id: 'user-a', email: 'a@example.com' });
    // [target profile, block pair, existing friendship]
    mocks.firstResults = [{ owner_key: 'user-b' }, null, null];

    const response = await POST(actionRequest('request', 'user-b'));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ relationship: 'outgoing' });
    const insert = mocks.statements.find((statement) => statement.operation === 'run');
    expect(insert?.sql).toContain('INSERT INTO friendships');
    expect(insert?.values).toContain('user-a');
    expect(insert?.values).toContain('user-b');
  });

  it('내가 보낸 요청을 내가 수락하지 못하게 막는다', async () => {
    mocks.authenticateRequest.mockResolvedValue({ id: 'user-a', email: 'a@example.com' });
    // [target profile, block pair, existing friendship]
    mocks.firstResults = [{ owner_key: 'user-b' }, null, { id: 'relation-1', requested_by: 'user-a', status: 'pending' }];

    const response = await POST(actionRequest('accept', 'user-b'));

    expect(response.status).toBe(409);
    expect(mocks.statements.filter((statement) => statement.operation === 'run')).toHaveLength(0);
  });

  it('상대가 보낸 요청은 수락해 친구로 만든다', async () => {
    mocks.authenticateRequest.mockResolvedValue({ id: 'user-a', email: 'a@example.com' });
    // [target profile, block pair, existing friendship]
    mocks.firstResults = [{ owner_key: 'user-b' }, null, { id: 'relation-1', requested_by: 'user-b', status: 'pending' }];

    const response = await POST(actionRequest('accept', 'user-b'));

    expect(await response.json()).toEqual({ relationship: 'friend' });
    expect(mocks.statements.find((statement) => statement.operation === 'run')?.sql).toContain("SET status = 'accepted'");
  });

  it('친구 목록과 검색 결과의 이메일을 가려서 반환한다', async () => {
    mocks.authenticateRequest.mockResolvedValue({ id: 'user-a', email: 'a@example.com' });
    mocks.firstResults = [{ owner_key: 'user-a', nickname: '애니', email: 'a@example.com' }];
    // [relationships, hidden (blocked either way), blocked list, search results]
    mocks.allResults = [
      [{ id: 'relation-1', user_a_key: 'user-a', user_b_key: 'user-b', requested_by: 'user-b', status: 'pending', updated_at: 1, other_user_id: 'user-b', nickname: '말씀친구', email: 'friend@example.com' }],
      [],
      [],
      [{ owner_key: 'user-b', nickname: '말씀친구', email: 'friend@example.com' }],
    ];

    const response = await GET(new Request('https://example.test/api/friends?q=말씀'));
    const payload = await response.json() as { incoming: Array<Record<string, unknown>>; results: Array<Record<string, unknown>> };

    expect(payload.incoming[0]).toMatchObject({ nickname: '말씀친구', emailHint: 'fr****@example.com', relationship: 'incoming' });
    expect(payload.results[0]).toMatchObject({ nickname: '말씀친구', emailHint: 'fr****@example.com', relationship: 'incoming' });
  });

  it('유효한 닉네임만 내 프로필에 저장한다', async () => {
    mocks.authenticateRequest.mockResolvedValue({ id: 'user-a', email: 'a@example.com' });
    const invalid = await PATCH(new Request('https://example.test/api/friends', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: 'a' }),
    }));
    expect(invalid.status).toBe(400);

    const valid = await PATCH(new Request('https://example.test/api/friends', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: '말씀 친구' }),
    }));
    expect(valid.status).toBe(200);
    expect(mocks.statements.find((statement) => statement.operation === 'run')?.values).toContain('말씀 친구');
  });
});
