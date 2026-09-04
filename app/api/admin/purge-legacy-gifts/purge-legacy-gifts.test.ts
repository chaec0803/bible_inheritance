import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  token: 'purge-secret',
  rows: [
    { gift_id: 'gift-1', object_key: 'gifts/one' },
    { gift_id: 'gift-1', object_key: 'gifts/two' },
  ],
  batch: vi.fn(),
  r2Delete: vi.fn(),
}));

vi.mock('cloudflare:workers', () => ({
  env: {
    get GIFT_PURGE_TOKEN() { return mocks.token; },
    FILES: { delete: mocks.r2Delete },
  },
}));
vi.mock('@/db', () => ({
  ensureDbSchema: vi.fn(),
  getD1: () => ({
    prepare: (sql: string) => ({
      all: async () => ({ results: mocks.rows }),
      sql,
    }),
    batch: mocks.batch,
  }),
}));

import { DELETE } from './route';

describe('기존 선물 일회성 정리', () => {
  beforeEach(() => {
    mocks.token = 'purge-secret';
    mocks.batch.mockReset().mockResolvedValue([]);
    mocks.r2Delete.mockReset().mockResolvedValue(undefined);
  });

  it('비밀 토큰 없이는 존재를 드러내지 않는다', async () => {
    expect((await DELETE(new Request('https://example.test/api/admin/purge-legacy-gifts', { method: 'DELETE' }))).status).toBe(404);
    expect(mocks.r2Delete).not.toHaveBeenCalled();
  });

  it('이전 선물의 복사 음원과 DB 기록을 함께 지운다', async () => {
    const response = await DELETE(new Request('https://example.test/api/admin/purge-legacy-gifts', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer purge-secret' },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deletedGifts: 1, deletedAudioFiles: 2 });
    expect(mocks.r2Delete).toHaveBeenCalledWith(['gifts/one', 'gifts/two']);
    expect(mocks.batch).toHaveBeenCalledOnce();
  });
});
