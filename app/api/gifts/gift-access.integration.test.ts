import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  ensureSchema: vi.fn(),
  gift: { id: 'gift-1', title: '시편 23편', bgm_id: 'none', bgm_volume: 12, sender_nickname: '엄마' } as Record<string, unknown> | null,
  recording: { id: 'gr-1', object_key: 'gifts/friend/gift-1/one', mime_type: 'audio/webm' } as Record<string, unknown> | null,
  recordings: [{ id: 'gr-1', position: 0, book: '시편', chapter: 23, verse: 1, verse_text: '첫 절', object_key: 'gifts/friend/gift-1/one', mime_type: 'audio/webm', size_bytes: 4, duration_seconds: 3 }] as Array<Record<string, unknown>>,
  batch: vi.fn(),
  r2Head: vi.fn(),
  r2Get: vi.fn(),
  r2Delete: vi.fn(),
}));

vi.mock('cloudflare:workers', () => ({
  env: { FILES: { head: mocks.r2Head, get: mocks.r2Get, delete: mocks.r2Delete } },
}));
vi.mock('@/lib/supabase-auth', () => ({ authenticateRequest: mocks.authenticate }));
vi.mock('@/db', () => ({
  ensureDbSchema: mocks.ensureSchema,
  getD1: () => ({
    prepare: (sql: string) => ({
      bind: () => ({
        first: async () => sql.includes('gift_recordings') ? mocks.recording : mocks.gift,
        all: async () => ({ results: mocks.recordings }),
      }),
    }),
    batch: mocks.batch,
  }),
}));

import { DELETE } from './[id]/route';
import { GET as GET_AUDIO } from './[id]/audio/[position]/route';
import { GET as DOWNLOAD } from './[id]/download/route';

const giftContext = { params: Promise.resolve({ id: 'gift-1' }) };
const audioContext = { params: Promise.resolve({ id: 'gift-1', position: '0' }) };

describe('받은 선물 접근·삭제·다운로드 회귀', () => {
  beforeEach(() => {
    mocks.authenticate.mockReset().mockResolvedValue({ id: 'friend-2' });
    mocks.ensureSchema.mockReset().mockResolvedValue(undefined);
    mocks.gift = { id: 'gift-1', title: '시편 23편', bgm_id: 'none', bgm_volume: 12, sender_nickname: '엄마' };
    mocks.recording = { id: 'gr-1', object_key: 'gifts/friend/gift-1/one', mime_type: 'audio/webm' };
    mocks.recordings = [{ id: 'gr-1', position: 0, book: '시편', chapter: 23, verse: 1, verse_text: '첫 절', object_key: 'gifts/friend/gift-1/one', mime_type: 'audio/webm', size_bytes: 4, duration_seconds: 3 }];
    mocks.batch.mockReset().mockResolvedValue([]);
    mocks.r2Head.mockReset().mockResolvedValue({ size: 4 });
    mocks.r2Get.mockReset().mockResolvedValue({ body: new Uint8Array([1, 2, 3, 4]), arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer, httpEtag: 'etag', writeHttpMetadata: vi.fn() });
    mocks.r2Delete.mockReset().mockResolvedValue(undefined);
  });

  it('수신자만 선물 음성을 byte range로 재생한다', async () => {
    const response = await GET_AUDIO(new Request('https://example.test/api/gifts/gift-1/audio/0', { headers: { Range: 'bytes=1-2' } }), audioContext);
    expect(response.status).toBe(206);
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(mocks.r2Get).toHaveBeenCalledWith('gifts/friend/gift-1/one', { range: { offset: 1, length: 2 } });
  });

  it('수신자가 선물을 삭제하면 목록 메타데이터와 복사된 음원을 제거한다', async () => {
    const response = await DELETE(new Request('https://example.test/api/gifts/gift-1', { method: 'DELETE' }), giftContext);
    expect(response.status).toBe(200);
    expect(mocks.batch).toHaveBeenCalledOnce();
    expect(mocks.r2Delete).toHaveBeenCalledWith(['gifts/friend/gift-1/one']);
  });

  it('선물을 하나의 ZIP 파일로 다운로드한다', async () => {
    const response = await DOWNLOAD(new Request('https://example.test/api/gifts/gift-1/download'), giftContext);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/zip');
    expect(response.headers.get('content-disposition')).toContain('.zip');
    expect(Array.from(new Uint8Array(await response.arrayBuffer()).slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it('수신자의 선물이 아니면 재생·삭제·다운로드하지 않는다', async () => {
    mocks.gift = null;
    mocks.recording = null;
    expect((await GET_AUDIO(new Request('https://example.test/api/gifts/gift-1/audio/0'), audioContext)).status).toBe(404);
    expect((await DELETE(new Request('https://example.test/api/gifts/gift-1', { method: 'DELETE' }), giftContext)).status).toBe(404);
    expect((await DOWNLOAD(new Request('https://example.test/api/gifts/gift-1/download'), giftContext)).status).toBe(404);
  });
});
