import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authenticate: vi.fn(), first: vi.fn(), run: vi.fn(), statements: [] as Array<{ sql: string; values: unknown[] }> }));
vi.mock('@/lib/supabase-auth', () => ({ authenticateRequest: mocks.authenticate }));
vi.mock('@/db', () => ({
  ensureDbSchema: vi.fn(),
  getD1: () => ({ prepare: (sql: string) => ({ bind: (...values: unknown[]) => ({
    first: async () => { mocks.statements.push({ sql, values }); return mocks.first(); },
    run: async () => { mocks.statements.push({ sql, values }); return mocks.run(); },
  }) }) }),
}));
import { PATCH } from './route';

const request = new Request('https://example.test/api/gifts/gift-1/letter/open', { method: 'PATCH' });
const context = { params: Promise.resolve({ id: 'gift-1' }) };

describe('선물 쪽지 열기 API', () => {
  beforeEach(() => { mocks.authenticate.mockResolvedValue({ id: 'recipient-1' }); mocks.first.mockReset(); mocks.run.mockReset().mockResolvedValue({ success: true }); mocks.statements = []; });

  it('수신자가 직접 열었을 때만 텍스트 내용과 개봉 시각을 반환한다', async () => {
    mocks.first.mockResolvedValue({ letter_type: 'text', letter_text: '늘 응원해요.', letter_mime_type: null, letter_duration_seconds: null, letter_opened_at: null });
    const response = await PATCH(request, context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ letter: { type: 'text', text: '늘 응원해요.' } });
    expect(mocks.statements.some((statement) => statement.sql.includes('UPDATE gifts SET letter_opened_at'))).toBe(true);
    expect(mocks.statements[0].values).toContain('recipient-1');
  });

  it('타인의 선물이나 편지가 없는 선물은 열 수 없다', async () => {
    mocks.first.mockResolvedValueOnce(null);
    expect((await PATCH(request, context)).status).toBe(404);
    mocks.first.mockResolvedValueOnce({ letter_type: null, letter_text: null, letter_opened_at: null });
    expect((await PATCH(request, context)).status).toBe(404);
  });
});
