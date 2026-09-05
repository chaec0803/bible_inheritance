import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  ensureSchema: vi.fn(),
  draft: { id: 'draft-1', recipient_key: 'friend-2', title: '시편 23편', bgm_id: 'none', bgm_volume: 12, created_at: 1, updated_at: 2, sent_gift_id: null } as Record<string, unknown> | null,
  item: { id: 'item-1', object_key: null as string | null } as Record<string, unknown> | null,
  audioTarget: { object_key: 'sender-1/gift-drafts/draft-1/item-1', mime_type: 'audio/wav' } as Record<string, unknown> | null,
  itemRows: [] as Array<Record<string, unknown>>,
  ownObjectKeys: [] as Array<{ object_key: string }>,
  statements: [] as Array<{ sql: string; values: unknown[] }>,
  batch: vi.fn(),
  r2Put: vi.fn(),
  r2Get: vi.fn(),
  r2Head: vi.fn(),
  r2Delete: vi.fn(),
}));

vi.mock('cloudflare:workers', () => ({
  env: { FILES: { put: mocks.r2Put, get: mocks.r2Get, head: mocks.r2Head, delete: mocks.r2Delete } },
}));
vi.mock('@/lib/supabase-auth', () => ({ authenticateRequest: mocks.authenticate }));
vi.mock('@/db', () => ({
  ensureDbSchema: mocks.ensureSchema,
  getD1: () => ({
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => ({
        sql,
        values,
        first: async () => {
          mocks.statements.push({ sql, values });
          if (sql.includes('COALESCE(source_recordings.object_key')) return mocks.audioTarget;
          if (sql.includes('FROM gift_draft_items')) return mocks.item;
          if (sql.includes('FROM gift_drafts')) return mocks.draft;
          return null;
        },
        all: async () => {
          mocks.statements.push({ sql, values });
          if (sql.includes('object_key IS NOT NULL')) return { results: mocks.ownObjectKeys };
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

import { GET as GET_AUDIO, PUT } from './[id]/items/[position]/audio/route';
import { DELETE as DELETE_DRAFT, GET as GET_DRAFT, PATCH } from './[id]/route';

const context = { params: Promise.resolve({ id: 'draft-1', position: '1' }) };
const draftContext = { params: Promise.resolve({ id: 'draft-1' }) };

function audioRequest(bytes = 4) {
  const form = new FormData();
  form.append('audio', new File([new Uint8Array(bytes)], 'verse.wav', { type: 'audio/wav' }));
  form.append('verseText', '내 영혼을 소생시키시고');
  form.append('durationSeconds', '5');
  return new Request('https://example.test/api/gift-drafts/draft-1/items/1/audio', { method: 'PUT', body: form });
}

describe('선물 초안 절별 녹음 API 통합 회귀', () => {
  beforeEach(() => {
    mocks.authenticate.mockReset().mockResolvedValue({ id: 'sender-1', email: 'sender@example.com' });
    mocks.ensureSchema.mockReset().mockResolvedValue(undefined);
    mocks.draft = { id: 'draft-1', recipient_key: 'friend-2', title: '시편 23편', bgm_id: 'none', bgm_volume: 12, created_at: 1, updated_at: 2, sent_gift_id: null };
    mocks.item = { id: 'item-1', object_key: null };
    mocks.audioTarget = { object_key: 'sender-1/gift-drafts/draft-1/item-1', mime_type: 'audio/wav' };
    mocks.itemRows = [];
    mocks.ownObjectKeys = [];
    mocks.statements = [];
    mocks.batch.mockReset().mockImplementation(async (statements: unknown[]) => statements.map(() => ({ success: true })));
    mocks.r2Put.mockReset().mockResolvedValue(undefined);
    mocks.r2Head.mockReset().mockResolvedValue({ size: 4 });
    mocks.r2Get.mockReset().mockResolvedValue({ body: new Uint8Array([1, 2, 3, 4]), httpEtag: '"etag"', writeHttpMetadata: () => undefined });
    mocks.r2Delete.mockReset().mockResolvedValue(undefined);
  });

  it('고른 순서의 절 위치에 새 녹음과 본문을 저장한다', async () => {
    const response = await PUT(audioRequest(), context);
    expect(response.status).toBe(200);
    expect(mocks.r2Put).toHaveBeenCalledOnce();
    expect(mocks.r2Put.mock.calls[0][0] as string).toContain('sender-1/gift-drafts/draft-1/');
    const update = mocks.statements.find((statement) => statement.sql.includes('UPDATE gift_draft_items'));
    expect(update?.values).toContain('내 영혼을 소생시키시고');
    expect(update?.values).toContain(5);
  });

  it('절별 재녹음은 이전 초안 음원을 즉시 지운다', async () => {
    mocks.item = { id: 'item-1', object_key: 'sender-1/gift-drafts/draft-1/item-1-old' };
    const response = await PUT(audioRequest(), context);
    expect(response.status).toBe(200);
    expect(mocks.r2Delete).toHaveBeenCalledWith('sender-1/gift-drafts/draft-1/item-1-old');
  });

  it('남의 초안이나 이미 보낸 초안에는 녹음할 수 없다', async () => {
    mocks.item = null;
    expect((await PUT(audioRequest(), context)).status).toBe(404);
    expect(mocks.r2Put).not.toHaveBeenCalled();
  });

  it('25MB를 넘는 녹음과 빈 파일은 거절한다', async () => {
    expect((await PUT(audioRequest(26 * 1024 * 1024), context)).status).toBe(413);
    const empty = new FormData();
    empty.append('verseText', '본문');
    expect((await PUT(new Request('https://example.test/api/gift-drafts/draft-1/items/1/audio', { method: 'PUT', body: empty }), context)).status).toBe(400);
    expect(mocks.r2Put).not.toHaveBeenCalled();
  });

  it('초안 음원 미리 듣기는 본인만 비캐시로 받는다', async () => {
    const response = await GET_AUDIO(new Request('https://example.test/api/gift-drafts/draft-1/items/1/audio'), context);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const lookup = mocks.statements.find((statement) => statement.sql.includes('COALESCE(source_recordings.object_key'));
    expect(lookup?.values).toContain('sender-1');

    mocks.authenticate.mockResolvedValue(null);
    expect((await GET_AUDIO(new Request('https://example.test/api/gift-drafts/draft-1/items/1/audio'), context)).status).toBe(401);
  });

  it('초안 음원 미리 듣기는 재생 길이를 계산할 수 있게 byte range를 지원한다', async () => {
    const response = await GET_AUDIO(new Request('https://example.test/api/gift-drafts/draft-1/items/1/audio', {
      headers: { Range: 'bytes=1-2' },
    }), context);

    expect(response.status).toBe(206);
    expect(response.headers.get('Accept-Ranges')).toBe('bytes');
    expect(response.headers.get('Content-Length')).toBe('2');
    expect(response.headers.get('Content-Range')).toBe('bytes 1-2/4');
    expect(response.headers.get('Content-Disposition')).toBe('inline');
    expect(mocks.r2Get).toHaveBeenCalledWith(
      'sender-1/gift-drafts/draft-1/item-1',
      { range: { offset: 1, length: 2 } },
    );
  });

  it('BGM과 음량은 전송 전까지 초안에 저장한다', async () => {
    const response = await PATCH(new Request('https://example.test/api/gift-drafts/draft-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bgmId: 'peaceful-morning', bgmVolume: 42 }),
    }), draftContext);
    expect(response.status).toBe(200);
    const update = mocks.statements.find((statement) => statement.sql.includes('UPDATE gift_drafts'));
    expect(update?.sql).toContain('sent_gift_id IS NULL');
    expect(update?.values).toContain('peaceful-morning');
    expect(update?.values).toContain(42);
  });

  it('초안을 버리면 초안 음원까지 함께 지운다', async () => {
    mocks.ownObjectKeys = [{ object_key: 'sender-1/gift-drafts/draft-1/item-1' }];
    const response = await DELETE_DRAFT(new Request('https://example.test/api/gift-drafts/draft-1', { method: 'DELETE' }), draftContext);
    expect(response.status).toBe(200);
    expect(mocks.r2Delete).toHaveBeenCalledWith(['sender-1/gift-drafts/draft-1/item-1']);
    const deletes = mocks.batch.mock.calls.flatMap((call) => (call[0] as Array<{ sql: string }>).map((statement) => statement.sql)).join('\n');
    expect(deletes).toContain('DELETE FROM gift_draft_items');
    expect(deletes).toContain('DELETE FROM gift_drafts');
  });

  it('초안 하나를 열면 절 목록과 다음 녹음 위치를 함께 준다', async () => {
    mocks.itemRows = [
      { id: 'item-1', draft_id: 'draft-1', position: 0, book: '시편', chapter: 23, verse: 1, verse_text: '첫 절', source_recording_id: null, object_key: 'sender-1/gift-drafts/draft-1/item-1', mime_type: 'audio/wav', size_bytes: 10, duration_seconds: 3 },
      { id: 'item-2', draft_id: 'draft-1', position: 1, book: '시편', chapter: 23, verse: 2, verse_text: '', source_recording_id: null, object_key: null, mime_type: '', size_bytes: 0, duration_seconds: 0 },
    ];
    const response = await GET_DRAFT(new Request('https://example.test/api/gift-drafts/draft-1'), draftContext);
    expect(response.status).toBe(200);
    const payload = await response.json() as { draft: { total: number; recorded: number; nextPosition: number | null; sendable: boolean } };
    expect(payload.draft).toMatchObject({ total: 2, recorded: 1, nextPosition: 1, sendable: false });
  });
});
