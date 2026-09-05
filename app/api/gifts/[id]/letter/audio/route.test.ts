import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authenticate: vi.fn(), first: vi.fn(), head: vi.fn(), get: vi.fn() }));
vi.mock('cloudflare:workers', () => ({ env: { FILES: { head: mocks.head, get: mocks.get } } }));
vi.mock('@/lib/supabase-auth', () => ({ authenticateRequest: mocks.authenticate }));
vi.mock('@/db', () => ({ ensureDbSchema: vi.fn(), getD1: () => ({ prepare: () => ({ bind: () => ({ first: mocks.first }) }) }) }));
import { GET } from './route';

describe('음성 쪽지 스트리밍 API', () => {
  beforeEach(() => {
    mocks.authenticate.mockResolvedValue({ id: 'recipient-1' });
    mocks.first.mockResolvedValue({ letter_object_key: 'sender/gift-letters/gift-1', letter_mime_type: 'audio/webm' });
    mocks.head.mockResolvedValue({ size: 4 });
    mocks.get.mockResolvedValue({ body: new Uint8Array([1, 2]), httpEtag: 'etag', writeHttpMetadata: vi.fn() });
  });

  it('쪽지를 연 수신자에게만 구간 재생으로 제공한다', async () => {
    const response = await GET(new Request('https://example.test/api/gifts/gift-1/letter/audio', { headers: { Range: 'bytes=0-1' } }), { params: Promise.resolve({ id: 'gift-1' }) });
    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 0-1/4');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('로그인하지 않았거나 조회 권한이 없으면 음성을 제공하지 않는다', async () => {
    mocks.authenticate.mockResolvedValueOnce(null);
    expect((await GET(new Request('https://example.test'), { params: Promise.resolve({ id: 'gift-1' }) })).status).toBe(401);
    mocks.first.mockResolvedValueOnce(null);
    expect((await GET(new Request('https://example.test'), { params: Promise.resolve({ id: 'gift-1' }) })).status).toBe(404);
  });
});
