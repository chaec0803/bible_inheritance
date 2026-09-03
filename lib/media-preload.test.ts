import { describe, expect, it, vi } from 'vitest';
import { loadArrayBufferOnce, preloadImages } from './media-preload';

describe('공용 미디어 미리 불러오기', () => {
  it('같은 BGM을 동시에 요청해도 한 번만 내려받는다', async () => {
    const payload = new ArrayBuffer(8);
    const fetcher = vi.fn(async () => new Response(payload));
    const cache = new Map<string, Promise<ArrayBuffer>>();

    const [first, second] = await Promise.all([
      loadArrayBufferOnce('/api/bgm/aeternum?v=1', cache, fetcher),
      loadArrayBufferOnce('/api/bgm/aeternum?v=1', cache, fetcher),
    ]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  it('실패한 BGM 요청은 캐시에서 제거해 다시 시도할 수 있다', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(new ArrayBuffer(4)));
    const cache = new Map<string, Promise<ArrayBuffer>>();

    await expect(loadArrayBufferOnce('/api/bgm/aeternum?v=1', cache, fetcher)).rejects.toThrow();
    await expect(loadArrayBufferOnce('/api/bgm/aeternum?v=1', cache, fetcher)).resolves.toBeInstanceOf(ArrayBuffer);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('카드 스프라이트를 비동기 디코딩으로 미리 불러온다', () => {
    const images: Array<{ decoding: string; src: string }> = [];
    const result = preloadImages(['/cards/one.webp', '/cards/two.webp'], () => {
      const image = { decoding: '', src: '' };
      images.push(image);
      return image;
    });

    expect(result).toHaveLength(2);
    expect(images).toEqual([
      { decoding: 'async', src: '/cards/one.webp' },
      { decoding: 'async', src: '/cards/two.webp' },
    ]);
  });
});
