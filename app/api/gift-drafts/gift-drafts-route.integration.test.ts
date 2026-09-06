import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  ensureSchema: vi.fn(),
  ensureProfile: vi.fn(),
  friendship: { id: 'friendship-1' } as { id: string } | null,
  block: null as { id: string } | null,
  journeyRows: [] as Array<Record<string, unknown>>,
  draftRows: [] as Array<Record<string, unknown>>,
  draftItemRows: [] as Array<Record<string, unknown>>,
  statements: [] as Array<{ sql: string; values: unknown[] }>,
  batch: vi.fn(),
  r2Put: vi.fn(),
  r2Delete: vi.fn(),
}));

vi.mock('cloudflare:workers', () => ({ env: { FILES: { put: mocks.r2Put, delete: mocks.r2Delete } } }));
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
          if (sql.includes('FROM friend_blocks')) return mocks.block;
          if (sql.includes('FROM friendships')) return mocks.friendship;
          return null;
        },
        all: async () => {
          mocks.statements.push({ sql, values });
          if (sql.includes('FROM gift_draft_items')) return { results: mocks.draftItemRows };
          if (sql.includes('FROM gift_drafts')) return { results: mocks.draftRows };
          if (sql.includes('FROM recordings')) return { results: mocks.journeyRows };
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

import { GET, POST } from './route';

function createRequest(body: Record<string, unknown>) {
  return new Request('https://example.test/api/gift-drafts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function insertedItems() {
  return mocks.batch.mock.calls
    .flatMap((call) => call[0] as Array<{ sql: string; values: unknown[] }>)
    .filter((statement) => statement.sql.includes('INSERT INTO gift_draft_items'));
}

describe('선물 초안 만들기 API 통합 회귀', () => {
  beforeEach(() => {
    mocks.authenticate.mockReset().mockResolvedValue({ id: 'sender-1', email: 'sender@example.com' });
    mocks.ensureSchema.mockReset().mockResolvedValue(undefined);
    mocks.ensureProfile.mockReset().mockResolvedValue(undefined);
    mocks.friendship = { id: 'friendship-1' };
    mocks.block = null;
    mocks.journeyRows = [];
    mocks.draftRows = [];
    mocks.draftItemRows = [];
    mocks.statements = [];
    mocks.batch.mockReset().mockImplementation(async (statements: unknown[]) => statements.map(() => ({ success: true })));
    mocks.r2Put.mockReset().mockResolvedValue(undefined);
    mocks.r2Delete.mockReset().mockResolvedValue(undefined);
  });

  it('고른 말씀 범위를 절 순서대로 담은 선물 초안을 만든다', async () => {
    const response = await POST(createRequest({
      recipientUserId: 'friend-2',
      scope: { kind: 'verses', bookCode: '시', chapter: 23, startVerse: 1, endVerse: 3 },
    }));
    expect(response.status).toBe(201);
    const payload = await response.json() as { draft: { id: string; title: string; items: Array<{ position: number; verse: number }> } };
    expect(payload.draft.title).toBe('시편 23편 1–3절');
    expect(payload.draft.items.map((item) => item.position)).toEqual([0, 1, 2]);
    expect(payload.draft.items.map((item) => item.verse)).toEqual([1, 2, 3]);
    expect(insertedItems()).toHaveLength(3);
  });

  it('선물 초안은 새 읽기 여정이나 녹음 그룹을 만들지 않는다', async () => {
    await POST(createRequest({
      recipientUserId: 'friend-2',
      scope: { kind: 'chapter', bookCode: '옵', chapter: 1 },
    }));
    const written = mocks.batch.mock.calls.flatMap((call) => (call[0] as Array<{ sql: string }>).map((statement) => statement.sql)).join('\n');
    expect(written).not.toContain('INSERT INTO recordings');
    expect(written).not.toContain('user_states');
    expect(written).toContain('INSERT INTO gift_drafts');
  });

  it('최대 30명의 수신자를 초안에 함께 저장한다', async () => {
    const response = await POST(createRequest({
      recipientUserId: 'friend-2',
      recipientUserIds: ['friend-2', 'friend-3'],
      scope: { kind: 'chapter', bookCode: '옵', chapter: 1 },
    }));
    expect(response.status).toBe(201);
    const payload = await response.json() as { draft: { recipientUserIds: string[]; recipientCount: number } };
    expect(payload.draft).toMatchObject({ recipientUserIds: ['friend-2', 'friend-3'], recipientCount: 2 });
    const insert = mocks.batch.mock.calls[0][0][0] as { values: unknown[] };
    expect(insert.values).toContain(JSON.stringify(['friend-2', 'friend-3']));
  });

  it('31명 이상의 수신자는 초안 생성 전에 거절한다', async () => {
    const recipientUserIds = Array.from({ length: 31 }, (_, index) => `friend-${index}`);
    const response = await POST(createRequest({
      recipientUserId: recipientUserIds[0],
      recipientUserIds,
      scope: { kind: 'chapter', bookCode: '옵', chapter: 1 },
    }));
    expect(response.status).toBe(400);
    expect((await response.json() as { error: string }).error).toContain('최대 30명');
    expect(mocks.batch).not.toHaveBeenCalled();
  });

  it('진행 중인 말씀 여정을 고르면 그 여정의 녹음만 순서대로 참조한다', async () => {
    mocks.journeyRows = [
      { id: 'r-2', book: '시편', chapter: 23, verse: 2, verse_text: '둘째 절', mime_type: 'audio/wav', size_bytes: 20, duration_seconds: 4 },
      { id: 'r-1', book: '시편', chapter: 23, verse: 1, verse_text: '첫 절', mime_type: 'audio/wav', size_bytes: 10, duration_seconds: 3 },
    ];
    const response = await POST(createRequest({
      recipientUserId: 'friend-2',
      scope: { kind: 'journey', projectId: 'daily-1' },
      journeyTitle: '시편 묵상',
    }));
    expect(response.status).toBe(201);
    const payload = await response.json() as { draft: { items: Array<{ sourceRecordingId: string | null; recorded: boolean }> } };
    expect(payload.draft.items.map((item) => item.sourceRecordingId)).toEqual(['r-1', 'r-2']);
    expect(payload.draft.items.every((item) => item.recorded)).toBe(true);
    const recordingQuery = mocks.statements.find((statement) => statement.sql.includes('FROM recordings'));
    expect(recordingQuery?.values).toContain('daily-1');
    expect(recordingQuery?.values).toContain('sender-1');
  });

  it('친구가 아니거나 나 자신에게는 선물 초안을 만들 수 없다', async () => {
    mocks.friendship = null;
    expect((await POST(createRequest({ recipientUserId: 'friend-2', scope: { kind: 'chapter', bookCode: '옵', chapter: 1 } }))).status).toBe(403);
    mocks.friendship = { id: 'friendship-1' };
    expect((await POST(createRequest({ recipientUserId: 'sender-1', scope: { kind: 'chapter', bookCode: '옵', chapter: 1 } }))).status).toBe(400);
    expect(mocks.batch).not.toHaveBeenCalled();
  });

  it('보낼 수 없는 말씀 범위는 이유와 함께 거절한다', async () => {
    expect((await POST(createRequest({ recipientUserId: 'friend-2', scope: { kind: 'nonsense' } }))).status).toBe(400);
    const tooWide = await POST(createRequest({ recipientUserId: 'friend-2', scope: { kind: 'books', bookCodes: ['시'] } }));
    expect(tooWide.status).toBe(409);
    expect((await tooWide.json() as { error: string }).error).toContain('500');
    const emptyJourney = await POST(createRequest({ recipientUserId: 'friend-2', scope: { kind: 'journey', projectId: 'daily-1' } }));
    expect(emptyJourney.status).toBe(409);
    expect(mocks.batch).not.toHaveBeenCalled();
  });

  it('내가 만든 전송 전 초안만 이어서 만들 수 있게 돌려준다', async () => {
    mocks.draftRows = [{ id: 'draft-1', recipient_keys_json: '["friend-2"]', recipient_nickname: '받는친구', title: '시편 23편', bgm_id: 'still-waters', bgm_volume: 20, created_at: 10, updated_at: 20 }];
    mocks.draftItemRows = [
      { id: 'item-1', draft_id: 'draft-1', position: 0, book: '시편', chapter: 23, verse: 1, verse_text: '첫 절', source_recording_id: null, object_key: 'sender-1/gift-drafts/draft-1/item-1', mime_type: 'audio/wav', size_bytes: 10, duration_seconds: 3 },
      { id: 'item-2', draft_id: 'draft-1', position: 1, book: '시편', chapter: 23, verse: 2, verse_text: '둘째 절', source_recording_id: null, object_key: null, mime_type: '', size_bytes: 0, duration_seconds: 0 },
    ];
    const response = await GET(new Request('https://example.test/api/gift-drafts'));
    expect(response.status).toBe(200);
    const payload = await response.json() as { drafts: Array<{ id: string; recipientNickname: string; recorded: number; total: number; nextPosition: number | null; items: Array<{ recorded: boolean }> }> };
    expect(payload.drafts[0]).toMatchObject({ id: 'draft-1', recipientNickname: '받는친구', recorded: 1, total: 2, nextPosition: 1 });
    expect(payload.drafts[0].items.map((item) => item.recorded)).toEqual([true, false]);
    const listQuery = mocks.statements.find((statement) => statement.sql.includes('FROM gift_drafts'));
    expect(listQuery?.sql).toContain('sent_gift_id IS NULL');
    expect(listQuery?.values).toContain('sender-1');
  });

  it('차단한 사이에는 선물 초안을 만들 수 없다', async () => {
    mocks.block = { id: 'block-1' };
    const response = await POST(createRequest({ recipientUserId: 'friend-2', scope: { kind: 'chapter', bookCode: '옵', chapter: 1 } }));
    expect(response.status).toBe(403);
    expect(mocks.batch).not.toHaveBeenCalled();
  });

  it('로그인하지 않은 사용자는 선물 초안을 만들거나 볼 수 없다', async () => {
    mocks.authenticate.mockResolvedValue(null);
    expect((await POST(createRequest({ recipientUserId: 'friend-2', scope: { kind: 'chapter', bookCode: '옵', chapter: 1 } }))).status).toBe(401);
    expect((await GET(new Request('https://example.test/api/gift-drafts'))).status).toBe(401);
  });
});
