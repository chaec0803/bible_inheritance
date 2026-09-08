import { withRecordingDiagnostics } from '@/lib/recording-server-diagnostics';
import { env } from 'cloudflare:workers';
import { getBgmObjectKey } from '@/lib/bgm';
import { parseByteRange } from '@/lib/http-range';

type RouteContext = {
  params: Promise<{ track: string }>;
};

async function getBgm(request: Request, context: RouteContext, phase: (name: string) => void) {
  const { track } = await context.params;
  const objectKey = getBgmObjectKey(track);
  if (!objectKey) return Response.json({ error: 'BGM을 찾을 수 없습니다.' }, { status: 404 });

  phase(`${track}/object-head`);
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

  phase(`${track}/object-read`);
  const object = await env.FILES.get(
    objectKey,
    range ? { range: { offset: range.start, length: range.end - range.start + 1 } } : undefined,
  );
  if (!object) return Response.json({ error: 'BGM을 찾을 수 없습니다.' }, { status: 404 });

  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Disposition': 'inline',
    'Content-Length': String(range ? range.end - range.start + 1 : metadata.size),
    'Content-Type': 'audio/mpeg',
    ETag: object.httpEtag,
  });
  if (range) headers.set('Content-Range', `bytes ${range.start}-${range.end}/${metadata.size}`);

  return new Response(object.body, { headers, status: range ? 206 : 200 });
}

export const GET = withRecordingDiagnostics("bgm-get", getBgm);
