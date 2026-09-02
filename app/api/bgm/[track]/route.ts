import { env } from 'cloudflare:workers';
import { getBgmObjectKey } from '@/lib/bgm';
import { parseByteRange } from '@/lib/http-range';

type RouteContext = {
  params: Promise<{ track: string }>;
};

type BgmEnv = typeof env & { BGM_UPLOAD_TOKEN?: string };

export async function GET(request: Request, context: RouteContext) {
  const { track } = await context.params;
  const objectKey = getBgmObjectKey(track);
  if (!objectKey) return Response.json({ error: 'BGM을 찾을 수 없습니다.' }, { status: 404 });

  const metadata = await env.FILES.head(objectKey);
  if (!metadata) return Response.json({ error: 'BGM을 찾을 수 없습니다.' }, { status: 404 });

  const rangeHeader = request.headers.get('range');
  const range = parseByteRange(rangeHeader, metadata.size);
  if (rangeHeader && !range) {
    return new Response(null, {
      status: 416,
      headers: { 'Accept-Ranges': 'bytes', 'Content-Range': `bytes */${metadata.size}` },
    });
  }

  const object = await env.FILES.get(
    objectKey,
    range ? { range: { offset: range.start, length: range.end - range.start + 1 } } : undefined,
  );
  if (!object) return Response.json({ error: 'BGM을 찾을 수 없습니다.' }, { status: 404 });

  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    'Content-Disposition': 'inline',
    'Content-Length': String(range ? range.end - range.start + 1 : metadata.size),
    'Content-Type': 'audio/mpeg',
    ETag: object.httpEtag,
  });
  if (range) headers.set('Content-Range', `bytes ${range.start}-${range.end}/${metadata.size}`);

  return new Response(object.body, { headers, status: range ? 206 : 200 });
}

// Temporary, secret-protected bootstrap endpoint. Removed after the three originals are uploaded.
export async function PUT(request: Request, context: RouteContext) {
  const token = (env as BgmEnv).BGM_UPLOAD_TOKEN;
  if (!token || request.headers.get('authorization') !== `Bearer ${token}`) {
    return Response.json({ error: '업로드 권한이 없습니다.' }, { status: 401 });
  }

  const { track } = await context.params;
  const objectKey = getBgmObjectKey(track);
  if (!objectKey) return Response.json({ error: 'BGM을 찾을 수 없습니다.' }, { status: 404 });
  if (request.headers.get('content-type')?.split(';')[0] !== 'audio/mpeg') {
    return Response.json({ error: 'MP3 파일만 업로드할 수 있습니다.' }, { status: 415 });
  }
  if (!request.body) return Response.json({ error: '음원 파일이 없습니다.' }, { status: 400 });

  await env.FILES.put(objectKey, request.body, { httpMetadata: { contentType: 'audio/mpeg' } });
  return Response.json({ track });
}
