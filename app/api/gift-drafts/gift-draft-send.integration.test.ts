import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  ensureSchema: vi.fn(),
  ensureProfile: vi.fn(),
  draft: null as Record<string, unknown> | null,
  itemRows: [] as Array<Record<string, unknown>>,
  friendship: { id: 'friendship-1' } as { id: string } | null,
  block: null as { id: string } | null,
  unopenedGift: null as { id: string } | null,
  statements: [] as Array<{ sql: string; values: unknown[] }>,
  batch: vi.fn(),
  r2Put: vi.fn(),
  r2Get: vi.fn(),
  r2Delete: vi.fn(),
}));

vi.mock('cloudflare:workers', () => ({ env: { FILES: { put: mocks.r2Put, get: mocks.r2Get, delete: mocks.r2Delete } } }));
vi.mock('@/lib/supabase-auth', () => ({ authenticateRequest: mocks.authenticate }));
vi.mock('@/lib/friend-server', () => ({ ensureUserProfile: mocks.ensureProfile }));
vi.mock('@/db', () => ({
  ensureDbSchema: mocks.ensureSchema,
  getD1: () => ({
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => ({
        sql,
        values,
        first: async () => {
          mocks.statements.push({ sql, values });
          if (sql.includes('FROM gift_drafts')) return mocks.draft;
          if (sql.includes('FROM friend_blocks')) return mocks.block;
          if (sql.includes('FROM friendships')) return mocks.friendship;
          if (sql.includes('opened_at IS NULL')) return mocks.unopenedGift;
          return null;
        },
        all: async () => {
          mocks.statements.push({ sql, values });
          if (sql.includes('FROM gift_draft_items')) return { results: mocks.itemRows };
          return { results: [] };
        },
        run: async () => {
          mocks.statements.push({ sql, values });
          return { success: true };
        },
      }),
    }),
    batch: mocks.batch,
  }),
}));

import { POST } from './[id]/send/route';

const context = { params: Promise.resolve({ id: 'draft-1' }) };

function sendRequest(letter?: unknown) {
  return new Request('https://example.test/api/gift-drafts/draft-1/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ letter }) });
}

function batchedStatements() {
  return mocks.batch.mock.calls.flatMap((call) => call[0] as Array<{ sql: string; values: unknown[] }>);
}

describe('선물 초안 바로 보내기 API 통합 회귀', () => {
  beforeEach(() => {
    mocks.authenticate.mockReset().mockResolvedValue({ id: 'sender-1', email: 'sender@example.com' });
    mocks.ensureSchema.mockReset().mockResolvedValue(undefined);
    mocks.ensureProfile.mockReset().mockResolvedValue(undefined);
    mocks.draft = { id: 'draft-1', recipient_keys_json: '["friend-2"]', title: '시편 23편 1–2절', bgm_id: 'still-waters', bgm_volume: 22 };
    mocks.itemRows = [
      { id: 'item-1', position: 0, book: '시편', chapter: 23, verse: 1, verse_text: '첫 절', source_recording_id: null, object_key: 'sender-1/gift-drafts/draft-1/item-1', mime_type: 'audio/wav', size_bytes: 10, duration_seconds: 3 },
      { id: 'item-2', position: 1, book: '시편', chapter: 23, verse: 2, verse_text: '둘째 절', source_recording_id: 'r-9', object_key: null, mime_type: 'audio/wav', size_bytes: 20, duration_seconds: 4 },
    ];
    mocks.friendship = { id: 'friendship-1' };
    mocks.block = null;
    mocks.unopenedGift = null;
    mocks.statements = [];
    mocks.batch.mockReset().mockImplementation(async (statements: unknown[]) => statements.map(() => ({ success: true })));
    mocks.r2Put.mockReset().mockResolvedValue(undefined);
    mocks.r2Get.mockReset().mockResolvedValue({ arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer });
    mocks.r2Delete.mockReset().mockResolvedValue(undefined);
  });

  it('녹음을 마친 초안을 선물로 만들고 초안 음원을 독립 저장한다', async () => {
    const response = await POST(sendRequest(), context);
    expect(response.status).toBe(201);
    const payload = await response.json() as { gift: { id: string; title: string; recordingCount: number } };
    expect(payload.gift).toMatchObject({ title: '시편 23편 1–2절', recordingCount: 2 });

    const statements = batchedStatements();
    const gift = statements.find((statement) => statement.sql.includes('INSERT INTO gifts'));
    expect(gift?.sql).not.toContain('recording_count');
    expect(gift?.sql).not.toContain('total_size_bytes');
    expect(gift?.values).toContain('still-waters');
    expect(gift?.values).toContain(22);
    expect(gift?.values).toContain('friend-2');

    const giftRecordings = statements.filter((statement) => statement.sql.includes('INSERT INTO gift_recordings'));
    expect(giftRecordings).toHaveLength(2);
    expect(giftRecordings[0].values.some((value) => typeof value === 'string' && value.includes('/gifts/'))).toBe(true);
    expect(giftRecordings[1].values).toContain('r-9');
    expect(mocks.r2Put).toHaveBeenCalledOnce();
    expect(mocks.r2Delete).toHaveBeenCalledWith(['sender-1/gift-drafts/draft-1/item-1']);
  });

  it('선택한 각 친구에게 독립 선물과 독립 초안 음원을 만든다', async () => {
    mocks.draft = { ...mocks.draft, recipient_keys_json: JSON.stringify(['friend-2', 'friend-3']) };
    const response = await POST(sendRequest(), context);
    expect(response.status).toBe(201);
    const payload = await response.json() as { gifts: Array<{ id: string; recipientUserId: string }> };
    expect(payload.gifts.map((gift) => gift.recipientUserId)).toEqual(['friend-2', 'friend-3']);
    const statements = batchedStatements();
    expect(statements.filter((statement) => statement.sql.includes('INSERT INTO gifts'))).toHaveLength(2);
    const ownedKeys = statements.filter((statement) => statement.sql.includes('INSERT INTO gift_recordings')).map((statement) => statement.values[8]).filter(Boolean);
    expect(new Set(ownedKeys).size).toBe(2);
    expect(mocks.r2Put).toHaveBeenCalledTimes(2);
  });

  it('보낸 뒤에는 초안 절 목록을 정리하고 초안을 보낸 선물과 연결한다', async () => {
    await POST(sendRequest(), context);
    const statements = batchedStatements();
    expect(statements.some((statement) => statement.sql.includes('DELETE FROM gift_draft_items'))).toBe(true);
    const link = statements.find((statement) => statement.sql.includes('UPDATE gift_drafts SET sent_gift_id'));
    expect(link).toBeDefined();
    expect(link?.values).toContain('draft-1');
  });

  it('선물 스튜디오에서도 텍스트 또는 음성 편지를 함께 보낸다', async () => {
    await POST(sendRequest({ type: 'text', text: '기도하는 마음으로 보내요.' }), context);
    let gift = batchedStatements().find((statement) => statement.sql.includes('INSERT INTO gifts'))!;
    expect(gift.values).toContain('text');
    expect(gift.values).toContain('기도하는 마음으로 보내요.');

    mocks.batch.mockClear(); mocks.r2Put.mockClear(); mocks.statements = [];
    await POST(sendRequest({ type: 'voice', dataUrl: 'data:audio/webm;base64,AQID', mimeType: 'audio/webm', sizeBytes: 3, durationSeconds: 3 }), context);
    expect(mocks.r2Put).toHaveBeenCalledTimes(2);
    gift = batchedStatements().find((statement) => statement.sql.includes('INSERT INTO gifts'))!;
    expect(gift.values).toContain('voice');
  });

  it('모든 절을 녹음하기 전에는 보낼 수 없다', async () => {
    mocks.itemRows = [mocks.itemRows[0], { ...mocks.itemRows[1], source_recording_id: null, object_key: null }];
    const response = await POST(sendRequest(), context);
    expect(response.status).toBe(409);
    expect((await response.json() as { error: string }).error).toContain('절');
    expect(mocks.batch).not.toHaveBeenCalled();
  });

  it('친구 관계가 끊겼으면 보내지 않는다', async () => {
    mocks.friendship = null;
    expect((await POST(sendRequest(), context)).status).toBe(403);
    expect(mocks.batch).not.toHaveBeenCalled();
  });

  it('친구가 이전 선물을 열지 않았으면 보내지 않는다', async () => {
    mocks.unopenedGift = { id: 'gift-pending' };
    const response = await POST(sendRequest(), context);
    expect(response.status).toBe(409);
    expect((await response.json() as { error: string }).error).toContain('아직 열지 않았어요');
    expect(mocks.batch).not.toHaveBeenCalled();
  });

  it('차단한 사이에는 초안을 전송할 수 없다', async () => {
    mocks.block = { id: 'block-1' };
    const response = await POST(sendRequest(), context);
    expect(response.status).toBe(403);
    expect(mocks.batch).not.toHaveBeenCalled();
  });

  it('내 초안이 아니거나 로그인하지 않으면 보낼 수 없다', async () => {
    mocks.draft = null;
    expect((await POST(sendRequest(), context)).status).toBe(404);
    mocks.authenticate.mockResolvedValue(null);
    expect((await POST(sendRequest(), context)).status).toBe(401);
    expect(mocks.batch).not.toHaveBeenCalled();
  });
});
