import { env } from 'cloudflare:workers';
import { ensureDbSchema, getD1 } from '@/db';
import { parseByteRange } from '@/lib/http-range';
import { authenticateRequest } from '@/lib/supabase-auth';

type RouteContext = { params: Promise<{ id: string; position: string }> };

export async function GET(request: Request, context: RouteContext) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  await ensureDbSchema();
  const { id, position: rawPosition } = await context.params;
  const position = Number(rawPosition);
  if (!Number.isInteger(position) || position < 0) return Response.json({ error: '올바른 녹음 순서가 아닙니다.' }, { status: 400 });

  const recording = await getD1().prepare(`SELECT
      COALESCE(source_recordings.object_key, gift_recordings.object_key) AS object_key,
      COALESCE(source_recordings.mime_type, gift_recordings.mime_type) AS mime_type
    FROM gift_recordings
    JOIN gifts ON gifts.id = gift_recordings.gift_id
    LEFT JOIN recordings AS source_recordings
      ON source_recordings.id = gift_recordings.source_recording_id
      AND source_recordings.owner_key = gifts.sender_key
    WHERE gifts.id = ? AND gifts.recipient_key = ? AND gifts.recipient_deleted_at IS NULL AND gift_recordings.position = ?`)
    .bind(id, user.id, position)
    .first<{ object_key: string; mime_type: string }>();
  if (!recording) return Response.json({ error: '선물 녹음을 찾을 수 없습니다.' }, { status: 404 });

  const metadata = await env.FILES.head(recording.object_key);
  if (!metadata) return Response.json({ error: '음성 파일을 찾을 수 없습니다.' }, { status: 404 });
  const range = parseByteRange(request.headers.get('range'), metadata.size);
  const object = await env.FILES.get(recording.object_key, range ? { range: { offset: range.start, length: range.end - range.start + 1 } } : undefined);
  if (!object) return Response.json({ error: '음성 파일을 찾을 수 없습니다.' }, { status: 404 });

  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store',
    'Content-Disposition': 'inline',
    'Content-Length': String(range ? range.end - range.start + 1 : metadata.size),
    'Content-Type': recording.mime_type,
    ETag: object.httpEtag,
  });
  object.writeHttpMetadata(headers);
  if (range) headers.set('Content-Range', `bytes ${range.start}-${range.end}/${metadata.size}`);
  return new Response(object.body, { headers, status: range ? 206 : 200 });
}
