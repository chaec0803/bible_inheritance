import { env } from 'cloudflare:workers';
import { ensureDbSchema, getD1 } from '@/db';
import { parseByteRange } from '@/lib/http-range';
import { authenticateRequest } from '@/lib/supabase-auth';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  await ensureDbSchema();
  const { id } = await params;
  const letter = await getD1().prepare(`SELECT letter_object_key, letter_mime_type FROM gifts
    WHERE id = ? AND recipient_key = ? AND recipient_deleted_at IS NULL
      AND letter_type = 'voice' AND letter_opened_at IS NOT NULL`)
    .bind(id, user.id).first<{ letter_object_key: string; letter_mime_type: string }>();
  if (!letter?.letter_object_key) return Response.json({ error: '음성 쪽지를 찾을 수 없습니다.' }, { status: 404 });
  const metadata = await env.FILES.head(letter.letter_object_key);
  if (!metadata) return Response.json({ error: '음성 쪽지 파일을 찾을 수 없습니다.' }, { status: 404 });
  const range = parseByteRange(request.headers.get('range'), metadata.size);
  const object = await env.FILES.get(letter.letter_object_key, range ? { range: { offset: range.start, length: range.end - range.start + 1 } } : undefined);
  if (!object) return Response.json({ error: '음성 쪽지 파일을 찾을 수 없습니다.' }, { status: 404 });
  const headers = new Headers({
    'Accept-Ranges': 'bytes', 'Cache-Control': 'private, no-store', 'Content-Disposition': 'inline',
    'Content-Length': String(range ? range.end - range.start + 1 : metadata.size),
    'Content-Type': letter.letter_mime_type, ETag: object.httpEtag,
  });
  object.writeHttpMetadata(headers);
  if (range) headers.set('Content-Range', `bytes ${range.start}-${range.end}/${metadata.size}`);
  return new Response(object.body, { headers, status: range ? 206 : 200 });
}
