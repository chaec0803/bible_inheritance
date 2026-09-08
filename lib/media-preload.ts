import { reportRecordingFailure } from './recording-diagnostics';
type ArrayBufferFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function loadArrayBufferOnce(
  source: string,
  cache: Map<string, Promise<ArrayBuffer>>,
  fetcher: ArrayBufferFetcher = fetch,
) {
  const cached = cache.get(source);
  if (cached) return cached;

  const track = source.match(/^\/api\/bgm\/(aeternum|unto-thee|the-kings-return)(?:\?|$)/)?.[1];
  const started = Date.now();
  let status: number | undefined;
  let requestId: string | undefined;
  const pending = fetcher(source)
    .then((response) => {
      status = response.status;
      requestId = response.headers.get('X-Recording-Request-Id') ?? undefined;
      if (!response.ok) throw new Error('미디어 파일을 불러오지 못했어요.');
      return response.arrayBuffer();
    })
    .catch((error) => {
      if (track) reportRecordingFailure('bgm-download', error, { track, status, requestId, elapsedMs: Date.now() - started });
      cache.delete(source);
      throw error;
    });
  cache.set(source, pending);
  return pending;
}

type PreloadImage = {
  decoding: string;
  src: string;
};

export function preloadImages(
  sources: readonly string[],
  createImage: () => PreloadImage = () => new Image(),
) {
  return sources.map((source) => {
    const image = createImage();
    image.decoding = 'async';
    image.src = source;
    return image;
  });
}
