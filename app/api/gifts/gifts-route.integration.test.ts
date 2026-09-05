import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  ensureSchema: vi.fn(),
  ensureProfile: vi.fn(),
  friendship: { id: 'friendship-1' } as { id: string } | null,
  block: null as { id: string } | null,
  unopenedGift: null as { id: string } | null,
  sourceRows: [] as Array<Record<string, unknown>>,
  giftRows: [] as Array<Record<string, unknown>>,
  sentGiftRows: [] as Array<Record<string, unknown>>,
  giftRecordingRows: [] as Array<Record<string, unknown>>,
  statements: [] as Array<{ sql: string; values: unknown[] }>,
  batch: vi.fn(),
  r2Get: vi.fn(),
  r2Put: vi.fn(),
  r2Delete: vi.fn(),
  completionContext: {
    projects: [{ id: 'daily-1', title: '시편 묵상', kind: 'guided', tasks: ['시편 23편 1–2절'], completedAt: 100 }],
    chapterCounts: { 시편: [6] },
  },
}));

vi.mock('cloudflare:workers', () => ({
  env: { FILES: { get: mocks.r2Get, put: mocks.r2Put, delete: mocks.r2Delete } },
}));
vi.mock('@/lib/supabase-auth', () => ({ authenticateRequest: mocks.authenticate }));
vi.mock('@/lib/friend-server', () => ({ ensureUserProfile: mocks.ensureProfile }));
vi.mock('@/lib/recording-lock-server', () => ({ loadRecordingCompletionContext: async () => mocks.completionContext }));
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
          if (sql.includes('opened_at IS NULL')) return mocks.unopenedGift;
          return null;
        },
        all: async () => {
          mocks.statements.push({ sql, values });
          if (sql.includes('FROM recordings')) return { results: mocks.sourceRows };
          if (sql.includes('gifts.sender_key = ?')) return { results: mocks.sentGiftRows };
          if (sql.includes('FROM gifts')) return { results: mocks.giftRows };
          if (sql.includes('FROM gift_recordings')) return { results: mocks.giftRecordingRows };
          return { results: [] };
        },
      }),
    }),
    batch: mocks.batch,
  }),
}));

import { GET, POST } from './route';

function sendRequest(overrides: Record<string, unknown> = {}) {
  return new Request('https://example.test/api/gifts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipientUserId: 'friend-2',
      recordingIds: ['r-2', 'r-1'],
      title: '엄마에게 드리는 말씀',
      bgmId: 'still-waters',
      bgmVolume: 17,
      ...overrides,
    }),
  });
}

describe('말씀 선물 API 통합 회귀', () => {
  beforeEach(() => {
    mocks.authenticate.mockReset().mockResolvedValue({ id: 'sender-1', email: 'sender@example.com' });
    mocks.ensureSchema.mockReset().mockResolvedValue(undefined);
    mocks.ensureProfile.mockReset().mockResolvedValue(undefined);
    mocks.friendship = { id: 'friendship-1' };
    mocks.block = null;
    mocks.unopenedGift = null;
    mocks.sourceRows = [
      { id: 'r-1', project_id: 'daily-1', book: '시편', chapter: 23, verse: 1, verse_text: '첫 절', mime_type: 'audio/webm', size_bytes: 4, duration_seconds: 3 },
      { id: 'r-2', project_id: 'daily-1', book: '시편', chapter: 23, verse: 2, verse_text: '둘째 절', mime_type: 'audio/webm', size_bytes: 4, duration_seconds: 4 },
    ];
    mocks.giftRows = [];
    mocks.sentGiftRows = [];
    mocks.giftRecordingRows = [];
    mocks.statements = [];
    mocks.batch.mockReset().mockResolvedValue([]);
    mocks.r2Get.mockReset().mockResolvedValue({ body: new Uint8Array([1, 2, 3, 4]) });
    mocks.r2Put.mockReset().mockResolvedValue(undefined);
    mocks.r2Delete.mockReset().mockResolvedValue(undefined);
  });

  it('완료된 여정의 녹음을 말씀 순서로 참조하고 선택 BGM과 함께 선물을 저장한다', async () => {
    const response = await POST(sendRequest());
    expect(response.status).toBe(201);
    expect(mocks.batch).toHaveBeenCalledOnce();
    const statements = mocks.batch.mock.calls[0][0] as Array<{ sql?: string }>;
    expect(statements).toHaveLength(3);
    expect(mocks.r2Put).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ gift: { title: '엄마에게 드리는 말씀' } });
  });

  it('텍스트 편지는 선물과 함께 저장하고 음성 편지는 R2에 원본 바이트로 저장한다', async () => {
    await POST(sendRequest({ letter: { type: 'text', text: ' 늘 힘내요. ' } }));
    let gift = (mocks.batch.mock.calls[0][0] as Array<{ sql: string; values: unknown[] }>).find((statement) => statement.sql.includes('INSERT INTO gifts'))!;
    expect(gift.values).toContain('text');
    expect(gift.values).toContain('늘 힘내요.');
    expect(mocks.r2Put).not.toHaveBeenCalled();

    mocks.batch.mockClear();
    const response = await POST(sendRequest({ letter: { type: 'voice', dataUrl: 'data:audio/webm;base64,AQID', mimeType: 'audio/webm', sizeBytes: 3, durationSeconds: 4 } }));
    expect(response.status).toBe(201);
    expect(mocks.r2Put).toHaveBeenCalledOnce();
    expect([...mocks.r2Put.mock.calls[0][1] as Uint8Array]).toEqual([1, 2, 3]);
    gift = (mocks.batch.mock.calls[0][0] as Array<{ sql: string; values: unknown[] }>).find((statement) => statement.sql.includes('INSERT INTO gifts'))!;
    expect(gift.values).toContain('voice');
    expect(gift.values).toContain('audio/webm');
  });

  it('수신자가 쪽지를 열기 전에는 편지 내용을 목록 응답에 노출하지 않는다', async () => {
    mocks.authenticate.mockResolvedValue({ id: 'friend-2', email: 'friend@example.com' });
    mocks.giftRows = [{ id: 'gift-letter', title: '힘이 되는 말씀', sender_nickname: '말씀친구', bgm_id: 'none', bgm_volume: 0, recording_count: 1, total_size_bytes: 4, created_at: 100, opened_at: 110, thank_you_note: null, thanked_at: null, letter_type: 'text', letter_text: '사랑해요', letter_mime_type: null, letter_size_bytes: null, letter_duration_seconds: null, letter_opened_at: null }];
    let payload = await (await GET(new Request('https://example.test/api/gifts'))).json() as { gifts: Array<{ hasLetter: boolean; letterText: string | null }> };
    expect(payload.gifts[0]).toMatchObject({ hasLetter: true, letterText: null });
    mocks.giftRows[0].letter_opened_at = 120;
    payload = await (await GET(new Request('https://example.test/api/gifts'))).json() as typeof payload;
    expect(payload.gifts[0].letterText).toBe('사랑해요');
  });

  it('친구가 아니거나 소유하지 않은 녹음은 보낼 수 없다', async () => {
    mocks.friendship = null;
    expect((await POST(sendRequest())).status).toBe(403);
    mocks.friendship = { id: 'friendship-1' };
    mocks.sourceRows = [mocks.sourceRows[0]];
    expect((await POST(sendRequest())).status).toBe(404);
    expect(mocks.r2Put).not.toHaveBeenCalled();
  });

  it('받는 사람이 이전 선물을 열기 전에는 같은 친구에게 추가로 보낼 수 없다', async () => {
    mocks.unopenedGift = { id: 'gift-pending' };
    const response = await POST(sendRequest());
    expect(response.status).toBe(409);
    expect((await response.json() as { error: string }).error).toContain('아직 열지 않았어요');
    expect(mocks.r2Put).not.toHaveBeenCalled();
  });

  it('완료된 말씀 묶음에서 일부 절만 골라서는 보낼 수 없다', async () => {
    const response = await POST(sendRequest({ recordingIds: ['r-1'] }));
    expect(response.status).toBe(409);
    expect(mocks.batch).not.toHaveBeenCalled();
  });

  it('받은 사용자의 선물 목록에 발신자와 순서가 붙은 녹음을 반환한다', async () => {
    mocks.authenticate.mockResolvedValue({ id: 'friend-2', email: 'friend@example.com' });
    mocks.giftRows = [{ id: 'gift-1', title: '시편 23편', sender_nickname: '말씀친구', bgm_id: 'still-waters', bgm_volume: 17, recording_count: 2, total_size_bytes: 8, created_at: 100, opened_at: null, recipient_deleted_at: null, thank_you_note: null, thanked_at: null }];
    mocks.giftRecordingRows = [{ id: 'gr-1', gift_id: 'gift-1', position: 0, book: '시편', chapter: 23, verse: 1, verse_text: '첫 절', mime_type: 'audio/webm', size_bytes: 4, duration_seconds: 3 }];
    const response = await GET(new Request('https://example.test/api/gifts'));
    expect(response.status).toBe(200);
    const payload = await response.json() as { gifts: Array<{ senderNickname: string; openedAt: number | null; recordings: Array<{ position: number }> }> };
    expect(payload.gifts[0].senderNickname).toBe('말씀친구');
    expect(payload.gifts[0].openedAt).toBeNull();
    expect(payload.gifts[0].recordings[0].position).toBe(0);
  });

  it('내가 보낸 선물 목록에 수신자와 개봉 상태를 반환한다', async () => {
    mocks.sentGiftRows = [{ id: 'gift-sent', title: '요한복음 1장', recipient_nickname: '받는친구', bgm_id: 'none', bgm_volume: 0, recording_count: 5, total_size_bytes: 40, created_at: 200, opened_at: 210, recipient_deleted_at: 230, thank_you_note: '잘 들었어요!', thanked_at: 220 }];
    const response = await GET(new Request('https://example.test/api/gifts'));
    expect(response.status).toBe(200);
    const payload = await response.json() as { sentGifts: Array<{ recipientNickname: string; openedAt: number | null; thankYouNote: string | null }> };
    expect(payload.sentGifts).toEqual([expect.objectContaining({ recipientNickname: '받는친구', openedAt: 210, thankYouNote: '잘 들었어요!' })]);
    expect(payload.sentGifts[0]).not.toHaveProperty('recipientDeletedAt');
  });

  it('차단한 사이에는 말씀 선물을 보낼 수 없다', async () => {
    mocks.block = { id: 'block-1' };
    const response = await POST(sendRequest());
    expect(response.status).toBe(403);
    expect(mocks.batch).not.toHaveBeenCalled();
  });

  it('차단한 뒤에도 이미 주고받은 선물은 선물함에서 그대로 조회한다', async () => {
    mocks.block = { id: 'block-1' };
    mocks.authenticate.mockResolvedValue({ id: 'friend-2', email: 'friend@example.com' });
    mocks.giftRows = [{ id: 'gift-1', title: '시편 23편', sender_nickname: '말씀친구', bgm_id: 'still-waters', bgm_volume: 17, recording_count: 1, total_size_bytes: 4, created_at: 100, opened_at: 120, recipient_deleted_at: null, thank_you_note: null, thanked_at: null }];
    const response = await GET(new Request('https://example.test/api/gifts'));
    expect(response.status).toBe(200);
    const payload = await response.json() as { gifts: unknown[] };
    expect(payload.gifts).toHaveLength(1);
  });

  it('로그인하지 않은 사용자는 선물을 보내거나 받을 수 없다', async () => {
    mocks.authenticate.mockResolvedValue(null);
    expect((await POST(sendRequest())).status).toBe(401);
    expect((await GET(new Request('https://example.test/api/gifts'))).status).toBe(401);
  });
});
