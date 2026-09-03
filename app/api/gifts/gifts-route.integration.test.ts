import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  ensureSchema: vi.fn(),
  ensureProfile: vi.fn(),
  friendship: { id: 'friendship-1' } as { id: string } | null,
  unopenedGift: null as { id: string } | null,
  sourceRows: [] as Array<Record<string, unknown>>,
  giftRows: [] as Array<Record<string, unknown>>,
  giftRecordingRows: [] as Array<Record<string, unknown>>,
  statements: [] as Array<{ sql: string; values: unknown[] }>,
  batch: vi.fn(),
  r2Get: vi.fn(),
  r2Put: vi.fn(),
  r2Delete: vi.fn(),
}));

vi.mock('cloudflare:workers', () => ({
  env: { FILES: { get: mocks.r2Get, put: mocks.r2Put, delete: mocks.r2Delete } },
}));
vi.mock('@/lib/supabase-auth', () => ({ authenticateRequest: mocks.authenticate }));
vi.mock('@/lib/friend-server', () => ({ ensureUserProfile: mocks.ensureProfile }));
vi.mock('@/db', () => ({
  ensureDbSchema: mocks.ensureSchema,
  getD1: () => ({
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => ({
        first: async () => {
          mocks.statements.push({ sql, values });
          if (sql.includes('FROM friendships')) return mocks.friendship;
          if (sql.includes('opened_at IS NULL')) return mocks.unopenedGift;
          return null;
        },
        all: async () => {
          mocks.statements.push({ sql, values });
          if (sql.includes('FROM recordings')) return { results: mocks.sourceRows };
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
      title: '시편 23편',
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
    mocks.unopenedGift = null;
    mocks.sourceRows = [
      { id: 'r-1', book: '시편', chapter: 23, verse: 1, verse_text: '첫 절', object_key: 'sender/r-1', mime_type: 'audio/webm', size_bytes: 4, duration_seconds: 3 },
      { id: 'r-2', book: '시편', chapter: 23, verse: 2, verse_text: '둘째 절', object_key: 'sender/r-2', mime_type: 'audio/webm', size_bytes: 4, duration_seconds: 4 },
    ];
    mocks.giftRows = [];
    mocks.giftRecordingRows = [];
    mocks.statements = [];
    mocks.batch.mockReset().mockResolvedValue([]);
    mocks.r2Get.mockReset().mockResolvedValue({ body: new Uint8Array([1, 2, 3, 4]) });
    mocks.r2Put.mockReset().mockResolvedValue(undefined);
    mocks.r2Delete.mockReset().mockResolvedValue(undefined);
  });

  it('친구에게 요청한 순서대로 녹음을 복사하고 선택 BGM과 함께 선물을 저장한다', async () => {
    const response = await POST(sendRequest());
    expect(response.status).toBe(201);
    expect(mocks.r2Get).toHaveBeenNthCalledWith(1, 'sender/r-2');
    expect(mocks.r2Get).toHaveBeenNthCalledWith(2, 'sender/r-1');
    expect(mocks.r2Put).toHaveBeenCalledTimes(2);
    expect(mocks.batch).toHaveBeenCalledOnce();
    const statements = mocks.batch.mock.calls[0][0] as Array<{ sql?: string }>;
    expect(statements).toHaveLength(3);
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

  it('받은 사용자의 선물 목록에 발신자와 순서가 붙은 녹음을 반환한다', async () => {
    mocks.authenticate.mockResolvedValue({ id: 'friend-2', email: 'friend@example.com' });
    mocks.giftRows = [{ id: 'gift-1', title: '시편 23편', sender_nickname: '말씀친구', bgm_id: 'still-waters', bgm_volume: 17, recording_count: 2, total_size_bytes: 8, created_at: 100, opened_at: null }];
    mocks.giftRecordingRows = [{ id: 'gr-1', gift_id: 'gift-1', position: 0, book: '시편', chapter: 23, verse: 1, verse_text: '첫 절', mime_type: 'audio/webm', size_bytes: 4, duration_seconds: 3 }];
    const response = await GET(new Request('https://example.test/api/gifts'));
    expect(response.status).toBe(200);
    const payload = await response.json() as { gifts: Array<{ senderNickname: string; openedAt: number | null; recordings: Array<{ position: number }> }> };
    expect(payload.gifts[0].senderNickname).toBe('말씀친구');
    expect(payload.gifts[0].openedAt).toBeNull();
    expect(payload.gifts[0].recordings[0].position).toBe(0);
  });

  it('로그인하지 않은 사용자는 선물을 보내거나 받을 수 없다', async () => {
    mocks.authenticate.mockResolvedValue(null);
    expect((await POST(sendRequest())).status).toBe(401);
    expect((await GET(new Request('https://example.test/api/gifts'))).status).toBe(401);
  });
});
