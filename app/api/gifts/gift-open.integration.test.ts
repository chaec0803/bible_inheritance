import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  ensureSchema: vi.fn(),
  gift: { id: 'gift-1', opened_at: null } as { id: string; opened_at: number | null } | null,
  update: vi.fn(),
  statements: [] as Array<{ sql: string; values: unknown[] }>,
}));

vi.mock('@/lib/supabase-auth', () => ({ authenticateRequest: mocks.authenticate }));
vi.mock('@/db', () => ({
  ensureDbSchema: mocks.ensureSchema,
  getD1: () => ({
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => ({
        first: async () => {
          mocks.statements.push({ sql, values });
          return mocks.gift;
        },
        run: mocks.update,
      }),
    }),
  }),
}));

import { PATCH } from './[id]/open/route';

const context = { params: Promise.resolve({ id: 'gift-1' }) };

describe('받은 선물 열기 회귀', () => {
  beforeEach(() => {
    mocks.authenticate.mockReset().mockResolvedValue({ id: 'recipient-1' });
    mocks.ensureSchema.mockReset().mockResolvedValue(undefined);
    mocks.gift = { id: 'gift-1', opened_at: null };
    mocks.update.mockReset().mockResolvedValue({ success: true });
    mocks.statements = [];
  });

  it('수신자가 선물을 열면 개봉 시간을 저장한다', async () => {
    const response = await PATCH(new Request('https://example.test/api/gifts/gift-1/open', { method: 'PATCH' }), context);
    expect(response.status).toBe(200);
    expect(mocks.statements.some(({ sql }) => sql.includes('recipient_key = ?'))).toBe(true);
    expect(mocks.update).toHaveBeenCalledOnce();
  });

  it('이미 연 선물은 다시 열어도 성공하고, 다른 사람의 선물은 열 수 없다', async () => {
    mocks.gift = { id: 'gift-1', opened_at: 123 };
    expect((await PATCH(new Request('https://example.test/api/gifts/gift-1/open', { method: 'PATCH' }), context)).status).toBe(200);
    expect(mocks.update).not.toHaveBeenCalled();

    mocks.gift = null;
    expect((await PATCH(new Request('https://example.test/api/gifts/gift-1/open', { method: 'PATCH' }), context)).status).toBe(404);
  });

  it('로그인하지 않으면 열 수 없다', async () => {
    mocks.authenticate.mockResolvedValue(null);
    expect((await PATCH(new Request('https://example.test/api/gifts/gift-1/open', { method: 'PATCH' }), context)).status).toBe(401);
  });
});
