import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  ensureSchema: vi.fn(),
  rows: [] as Array<Record<string, unknown>>,
  statements: [] as Array<{ sql: string; values: unknown[] }>,
  run: vi.fn(),
}));

vi.mock('@/lib/supabase-auth', () => ({ authenticateRequest: mocks.authenticate }));
vi.mock('@/db', () => ({
  ensureDbSchema: mocks.ensureSchema,
  getD1: () => ({
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => ({
        all: async () => {
          mocks.statements.push({ sql, values });
          return { results: mocks.rows };
        },
        run: async () => {
          mocks.statements.push({ sql, values });
          return mocks.run();
        },
      }),
    }),
  }),
}));

import { GET, PATCH } from './route';

describe('말씀 선물 도착 API', () => {
  beforeEach(() => {
    mocks.authenticate.mockReset().mockResolvedValue({ id: 'recipient-1' });
    mocks.ensureSchema.mockReset().mockResolvedValue(undefined);
    mocks.rows = [];
    mocks.statements = [];
    mocks.run.mockReset().mockResolvedValue({ success: true });
  });

  it('아직 도착 안내를 확인하거나 열지 않은 선물만 묶어 반환한다', async () => {
    mocks.rows = [{ id: 'gift-1', sender_nickname: '은혜', created_at: 123 }];
    const response = await GET(new Request('https://example.test/api/gifts/arrivals'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ arrivals: [{ id: 'gift-1', senderNickname: '은혜', createdAt: 123 }] });
    expect(mocks.statements[0].sql).toContain('arrival_seen_at IS NULL');
    expect(mocks.statements[0].sql).toContain('opened_at IS NULL');
  });

  it('전달받은 선물들만 현재 수신자의 도착 확인 상태로 바꾼다', async () => {
    const response = await PATCH(new Request('https://example.test/api/gifts/arrivals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ giftIds: ['gift-1', 'gift-2', 'gift-1'] }),
    }));
    expect(response.status).toBe(200);
    expect(mocks.statements[0].sql).toContain('UPDATE gifts SET arrival_seen_at');
    expect(mocks.statements[0].sql).toContain('recipient_key = ?');
    expect(mocks.statements[0].values.slice(1, 3)).toEqual(['gift-1', 'gift-2']);
    expect(mocks.statements[0].values.at(-1)).toBe('recipient-1');
  });

  it('로그인하지 않은 사용자는 조회하거나 확인할 수 없다', async () => {
    mocks.authenticate.mockResolvedValue(null);
    expect((await GET(new Request('https://example.test/api/gifts/arrivals'))).status).toBe(401);
    expect((await PATCH(new Request('https://example.test/api/gifts/arrivals', { method: 'PATCH' }))).status).toBe(401);
  });
});
