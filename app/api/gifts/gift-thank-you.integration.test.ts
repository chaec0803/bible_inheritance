import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  ensureSchema: vi.fn(),
  gift: { id: 'gift-1', opened_at: 100, recipient_deleted_at: null } as Record<string, unknown> | null,
  update: vi.fn(),
}));

vi.mock('@/lib/supabase-auth', () => ({ authenticateRequest: mocks.authenticate }));
vi.mock('@/db', () => ({
  ensureDbSchema: mocks.ensureSchema,
  getD1: () => ({
    prepare: () => ({
      bind: () => ({ first: async () => mocks.gift, run: mocks.update }),
    }),
  }),
}));

import { POST } from './[id]/thank-you/route';

const context = { params: Promise.resolve({ id: 'gift-1' }) };

describe('선물 감사 인사 API', () => {
  beforeEach(() => {
    mocks.authenticate.mockReset().mockResolvedValue({ id: 'recipient-1' });
    mocks.ensureSchema.mockReset().mockResolvedValue(undefined);
    mocks.gift = { id: 'gift-1', opened_at: 100, recipient_deleted_at: null };
    mocks.update.mockReset().mockResolvedValue({ success: true });
  });

  it('선물을 연 수신자가 감사 인사를 저장한다', async () => {
    const response = await POST(new Request('https://example.test/api/gifts/gift-1/thank-you', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: '목소리 선물 고마워요!' }),
    }), context);
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledOnce();
    expect(await response.json()).toEqual({ thankYou: expect.objectContaining({ note: '목소리 선물 고마워요!' }) });
  });

  it('열지 않은 선물, 다른 사람의 선물, 잘못된 문구는 거절한다', async () => {
    mocks.gift = { id: 'gift-1', opened_at: null, recipient_deleted_at: null };
    expect((await POST(new Request('https://example.test/api/gifts/gift-1/thank-you', { method: 'POST', body: JSON.stringify({ note: '고마워요' }) }), context)).status).toBe(409);
    mocks.gift = null;
    expect((await POST(new Request('https://example.test/api/gifts/gift-1/thank-you', { method: 'POST', body: JSON.stringify({ note: '고마워요' }) }), context)).status).toBe(404);
    expect((await POST(new Request('https://example.test/api/gifts/gift-1/thank-you', { method: 'POST', body: JSON.stringify({ note: '' }) }), context)).status).toBe(400);
  });
});
