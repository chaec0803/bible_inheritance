import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  ensureSchema: vi.fn(),
  r2Put: vi.fn(),
  r2Delete: vi.fn(),
  existing: [] as Array<{ id: string; objectKey: string }>,
  inserted: [] as Array<Record<string, unknown>>,
  deletedWhere: vi.fn(),
  insertError: null as Error | null,
  mutationLocked: vi.fn(),
}));

vi.mock('cloudflare:workers', () => ({
  env: { FILES: { put: mocks.r2Put, delete: mocks.r2Delete } },
}));

vi.mock('@/lib/supabase-auth', () => ({ authenticateRequest: mocks.authenticate }));
vi.mock('@/lib/recording-lock-server', () => ({ isRecordingMutationLocked: mocks.mutationLocked }));
vi.mock('@/db', () => ({
  ensureDbSchema: mocks.ensureSchema,
  getDb: () => ({
    select: () => ({ from: () => ({ where: async () => mocks.existing }) }),
    insert: () => ({ values: async (value: Record<string, unknown>) => {
      if (mocks.insertError) throw mocks.insertError;
      mocks.inserted.push(value);
    } }),
    delete: () => ({ where: mocks.deletedWhere }),
  }),
}));

import { POST } from './route';

function validRequest(projectId = 'free-시') {
  const form = new FormData();
  form.append('audio', new File([new Uint8Array([1, 2, 3, 4])], 'verse.wav', { type: 'audio/wav' }));
  form.append('book', '시편');
  form.append('chapter', '23');
  form.append('verse', '1');
  form.append('verseText', '여호와는 나의 목자시니');
  form.append('projectId', projectId);
  form.append('projectTitle', '시편 녹음');
  form.append('recordingMode', 'continuous');
  form.append('recordingGroupId', 'group-1');
  form.append('bgmId', 'peaceful-morning');
  form.append('reverb', '원음');
  form.append('durationSeconds', '4');
  return new Request('https://example.test/api/recordings', { method: 'POST', body: form });
}

describe('녹음 저장 API 통합 회귀', () => {
  beforeEach(() => {
    mocks.authenticate.mockReset().mockResolvedValue({ id: 'user-1' });
    mocks.ensureSchema.mockReset().mockResolvedValue(undefined);
    mocks.r2Put.mockReset().mockResolvedValue(undefined);
    mocks.r2Delete.mockReset().mockResolvedValue(undefined);
    mocks.deletedWhere.mockReset().mockResolvedValue(undefined);
    mocks.existing = [];
    mocks.inserted = [];
    mocks.insertError = null;
    mocks.mutationLocked.mockReset().mockResolvedValue(false);
  });

  it('인증된 사용자의 음원은 R2에, 메타데이터는 D1에 저장한다', async () => {
    const response = await POST(validRequest());
    expect(response.status).toBe(201);
    expect(mocks.r2Put).toHaveBeenCalledOnce();
    expect(mocks.inserted).toHaveLength(1);
    expect(mocks.inserted[0]).toMatchObject({
      ownerKey: 'user-1',
      projectId: 'free-시',
      book: '시편',
      chapter: 23,
      verse: 1,
      recordingMode: 'continuous',
      recordingGroupId: 'group-1',
      bgmId: 'peaceful-morning',
      mimeType: 'audio/wav',
      sizeBytes: 4,
      durationSeconds: 4,
    });
  });

  it('같은 여정의 같은 절이 있으면 새 저장 성공 후 이전 레코드와 파일을 제거한다', async () => {
    mocks.existing = [{ id: 'old-id', objectKey: 'user-1/old-id' }];
    const response = await POST(validRequest());
    expect(response.status).toBe(201);
    expect(mocks.deletedWhere).toHaveBeenCalledOnce();
    expect(mocks.r2Delete).toHaveBeenCalledWith('user-1/old-id');
  });

  it('D1 저장이 실패하면 방금 업로드한 R2 파일을 정리하고 이전 파일은 유지한다', async () => {
    mocks.existing = [{ id: 'old-id', objectKey: 'user-1/old-id' }];
    mocks.insertError = new Error('db unavailable');
    await expect(POST(validRequest())).rejects.toThrow('db unavailable');
    const newObjectKey = mocks.r2Put.mock.calls[0][0] as string;
    expect(mocks.r2Delete).toHaveBeenCalledWith(newObjectKey);
    expect(mocks.r2Delete).not.toHaveBeenCalledWith('user-1/old-id');
    expect(mocks.deletedWhere).not.toHaveBeenCalled();
  });

  it('로그인하지 않았거나 음성 파일이 비어 있으면 저장하지 않는다', async () => {
    mocks.authenticate.mockResolvedValueOnce(null);
    expect((await POST(validRequest())).status).toBe(401);

    const empty = new FormData();
    empty.append('book', '시편');
    expect((await POST(new Request('https://example.test/api/recordings', { method: 'POST', body: empty }))).status).toBe(400);
    expect(mocks.r2Put).not.toHaveBeenCalled();
  });

  it('완료되어 잠긴 말씀에는 새 녹음을 저장하지 않는다', async () => {
    mocks.mutationLocked.mockResolvedValue(true);
    const response = await POST(validRequest());
    expect(response.status).toBe(409);
    expect(mocks.r2Put).not.toHaveBeenCalled();
  });

  it('relay 권한이 확인된 녹음은 auth user를 owner로 저장한다', async () => {
    const response = await POST(validRequest('relay:project-1:turn:0'));
    expect(response.status).toBe(201);
    expect(mocks.mutationLocked).toHaveBeenCalledWith('user-1', expect.objectContaining({ projectId: 'relay:project-1:turn:0' }));
    expect(mocks.inserted[0]).toMatchObject({ ownerKey: 'user-1', projectId: 'relay:project-1:turn:0' });
  });
});
