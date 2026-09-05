import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  ensureSchema: vi.fn(),
  selected: [] as Array<{ objectKey: string; mimeType?: string; projectId?: string; book?: string; chapter?: number; verse?: number }>,
  updated: [] as Array<Record<string, unknown>>,
  deletedWhere: vi.fn(),
  r2Head: vi.fn(),
  r2Get: vi.fn(),
  r2Put: vi.fn(),
  r2Delete: vi.fn(),
  mutationLocked: vi.fn(),
}));

vi.mock('cloudflare:workers', () => ({
  env: {
    FILES: {
      head: mocks.r2Head,
      get: mocks.r2Get,
      put: mocks.r2Put,
      delete: mocks.r2Delete,
    },
  },
}));

vi.mock('@/lib/supabase-auth', () => ({ authenticateRequest: mocks.authenticate }));
vi.mock('@/lib/recording-lock-server', () => ({ isRecordingMutationLocked: mocks.mutationLocked }));
vi.mock('@/db', () => ({
  ensureDbSchema: mocks.ensureSchema,
  getDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => mocks.selected }) }) }),
    update: () => ({ set: (value: Record<string, unknown>) => ({ where: async () => { mocks.updated.push(value); } }) }),
    delete: () => ({ where: mocks.deletedWhere }),
  }),
}));

import { DELETE, GET, PUT } from './[id]/audio/route';

const context = { params: Promise.resolve({ id: 'recording-1' }) };

function replacementRequest() {
  const form = new FormData();
  form.append('audio', new File([new Uint8Array([9, 8, 7])], 'replacement.wav', { type: 'audio/wav' }));
  form.append('book', '시편');
  form.append('chapter', '23');
  form.append('verse', '2');
  form.append('verseText', '그가 나를 푸른 풀밭에 누이시며');
  form.append('projectId', 'free-시');
  form.append('projectTitle', '시편 녹음');
  form.append('recordingMode', 'verse');
  form.append('bgmId', 'word-breath');
  form.append('reverb', '따뜻하게');
  form.append('durationSeconds', '5');
  return new Request('https://example.test/api/recordings/recording-1/audio', { method: 'PUT', body: form });
}

describe('녹음 듣기·교체·삭제 API 통합 회귀', () => {
  beforeEach(() => {
    mocks.authenticate.mockReset().mockResolvedValue({ id: 'user-1' });
    mocks.ensureSchema.mockReset().mockResolvedValue(undefined);
    mocks.selected = [{ objectKey: 'user-1/recording-1', mimeType: 'audio/wav', projectId: 'free-시', book: '시편', chapter: 23, verse: 1 }];
    mocks.updated = [];
    mocks.deletedWhere.mockReset().mockResolvedValue(undefined);
    mocks.r2Head.mockReset().mockResolvedValue({ size: 1000 });
    mocks.r2Get.mockReset().mockResolvedValue({
      body: new Uint8Array([1, 2, 3, 4]),
      httpEtag: 'etag-1',
      writeHttpMetadata: vi.fn(),
    });
    mocks.r2Put.mockReset().mockResolvedValue(undefined);
    mocks.r2Delete.mockReset().mockResolvedValue(undefined);
    mocks.mutationLocked.mockReset().mockResolvedValue(false);
  });

  it('아이폰 탐색 재생을 위한 byte range 응답을 반환한다', async () => {
    const request = new Request('https://example.test/api/recordings/recording-1/audio', { headers: { Range: 'bytes=100-199' } });
    const response = await GET(request, context);
    expect(response.status).toBe(206);
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(response.headers.get('content-range')).toBe('bytes 100-199/1000');
    expect(response.headers.get('content-length')).toBe('100');
    expect(response.headers.get('content-type')).toBe('audio/wav');
    expect(mocks.r2Get).toHaveBeenCalledWith('user-1/recording-1', { range: { offset: 100, length: 100 } });
  });

  it('절별 수정 저장은 새 파일과 메타데이터를 반영한 뒤 이전 파일을 지운다', async () => {
    const response = await PUT(replacementRequest(), context);
    expect(response.status).toBe(200);
    expect(mocks.r2Put).toHaveBeenCalledOnce();
    expect(mocks.updated[0]).toMatchObject({
      projectId: 'free-시', book: '시편', chapter: 23, verse: 2,
      recordingMode: 'verse', bgmId: 'word-breath', sizeBytes: 3, durationSeconds: 5,
    });
    expect(mocks.r2Delete).toHaveBeenCalledWith('user-1/recording-1');
  });

  it('삭제는 로그인 사용자의 D1 레코드와 R2 파일을 함께 제거한다', async () => {
    const response = await DELETE(new Request('https://example.test/api/recordings/recording-1/audio', { method: 'DELETE' }), context);
    expect(response.status).toBe(200);
    expect(mocks.deletedWhere).toHaveBeenCalledOnce();
    expect(mocks.r2Delete).toHaveBeenCalledWith('user-1/recording-1');
  });

  it('다른 계정이거나 없는 녹음은 듣기·수정·삭제할 수 없다', async () => {
    mocks.selected = [];
    expect((await GET(new Request('https://example.test/api/recordings/recording-1/audio'), context)).status).toBe(404);
    expect((await PUT(replacementRequest(), context)).status).toBe(404);
    expect((await DELETE(new Request('https://example.test/api/recordings/recording-1/audio', { method: 'DELETE' }), context)).status).toBe(404);
    expect(mocks.r2Put).not.toHaveBeenCalled();
    expect(mocks.r2Delete).not.toHaveBeenCalled();
  });

  it('완료되어 잠긴 말씀은 교체할 수 없지만 언제든 삭제할 수 있다', async () => {
    mocks.mutationLocked.mockResolvedValue(true);
    expect((await PUT(replacementRequest(), context)).status).toBe(409);
    expect((await DELETE(new Request('https://example.test/api/recordings/recording-1/audio', { method: 'DELETE' }), context)).status).toBe(200);
    expect(mocks.r2Put).not.toHaveBeenCalled();
    expect(mocks.r2Delete).toHaveBeenCalledWith('user-1/recording-1');
  });
});
