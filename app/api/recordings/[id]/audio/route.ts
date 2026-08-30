import { env } from 'cloudflare:workers';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { recordings } from '@/db/schema';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const ownerKey = new URL(request.url).searchParams.get('owner')?.trim() ?? '';
  if (!/^[a-f0-9-]{20,80}$/i.test(ownerKey)) {
    return Response.json({ error: '재생 권한이 없습니다.' }, { status: 401 });
  }

  const { id } = await context.params;
  const [recording] = await getDb()
    .select({ objectKey: recordings.objectKey, mimeType: recordings.mimeType })
    .from(recordings)
    .where(and(eq(recordings.id, id), eq(recordings.ownerKey, ownerKey)))
    .limit(1);

  if (!recording) return Response.json({ error: '녹음을 찾을 수 없습니다.' }, { status: 404 });

  const object = await env.FILES.get(recording.objectKey);
  if (!object) return Response.json({ error: '음성 파일을 찾을 수 없습니다.' }, { status: 404 });

  const headers = new Headers({
    'Cache-Control': 'private, no-store',
    'Content-Disposition': 'inline',
    'Content-Length': String(object.size),
    'Content-Type': recording.mimeType,
    ETag: object.httpEtag,
  });
  object.writeHttpMetadata(headers);

  return new Response(object.body, { headers });
}
