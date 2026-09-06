import { env } from 'cloudflare:workers';
import { ensureDbSchema, getD1 } from '@/db';
import { parseByteRange } from '@/lib/http-range';
import { authenticateRequest } from '@/lib/supabase-auth';
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export async function PUT(request: Request, { params }: { params: Promise<{ id: string; position: string }> }) { const user = await authenticateRequest(request); if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 }); const { id, position } = await params; await ensureDbSchema(); const db = getD1(); const item = await db.prepare(`SELECT gift_draft_items.id, gift_draft_items.object_key FROM gift_draft_items JOIN gift_drafts ON gift_drafts.id = gift_draft_items.draft_id WHERE gift_drafts.id = ? AND gift_drafts.owner_key = ? AND gift_drafts.sent_gift_id IS NULL AND gift_draft_items.position = ?`).bind(id, user.id, Number(position)).first<{ id: string; object_key: string | null }>(); if (!item) return Response.json({ error: '초안 구절을 찾을 수 없습니다.' }, { status: 404 }); const form = await request.formData(); const audio = form.get('audio'); if (!(audio instanceof File) || !audio.size) return Response.json({ error: '녹음 파일이 없습니다.' }, { status: 400 }); if (audio.size > MAX_AUDIO_BYTES) return Response.json({ error: '한 번의 녹음은 25MB까지 저장할 수 있어요.' }, { status: 413 }); const key = `${user.id}/gift-drafts/${id}/${item.id}-${crypto.randomUUID()}`; const mime = audio.type || 'audio/webm'; await env.FILES.put(key, audio.stream(), { httpMetadata: { contentType: mime } }); const rawVerseText = form.get('verseText'); const verseText = typeof rawVerseText === 'string' ? rawVerseText.trim().slice(0, 1000) : ''; const duration = Math.max(1, Number(form.get('durationSeconds')) || 1); await db.prepare('UPDATE gift_draft_items SET verse_text = ?, source_recording_id = NULL, object_key = ?, mime_type = ?, size_bytes = ?, duration_seconds = ? WHERE id = ?').bind(verseText, key, mime, audio.size, duration, item.id).run(); await db.prepare('UPDATE gift_drafts SET updated_at = ? WHERE id = ?').bind(Date.now(), id).run(); if (item.object_key && item.object_key !== key) await env.FILES.delete(item.object_key); return Response.json({ recorded: true, objectKey: key }); }
export async function GET(request: Request, { params }: { params: Promise<{ id: string; position: string }> }) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const { id, position } = await params;
  await ensureDbSchema();
  const target = await getD1().prepare(`SELECT COALESCE(source_recordings.object_key, gift_draft_items.object_key) AS object_key, COALESCE(source_recordings.mime_type, gift_draft_items.mime_type) AS mime_type FROM gift_draft_items JOIN gift_drafts ON gift_drafts.id = gift_draft_items.draft_id LEFT JOIN recordings AS source_recordings ON source_recordings.id = gift_draft_items.source_recording_id WHERE gift_drafts.id = ? AND gift_drafts.owner_key = ? AND gift_drafts.sent_gift_id IS NULL AND gift_draft_items.position = ?`).bind(id, user.id, Number(position)).first<{ object_key: string; mime_type: string }>();
  if (!target?.object_key) return Response.json({ error: '녹음을 찾을 수 없습니다.' }, { status: 404 });

  const metadata = await env.FILES.head(target.object_key);
  if (!metadata) return Response.json({ error: '녹음을 찾을 수 없습니다.' }, { status: 404 });
  const range = parseByteRange(request.headers.get('range'), metadata.size);
  const object = await env.FILES.get(
    target.object_key,
    range ? { range: { offset: range.start, length: range.end - range.start + 1 } } : undefined,
  );
  if (!object) return Response.json({ error: '녹음을 찾을 수 없습니다.' }, { status: 404 });

  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store',
    'Content-Disposition': 'inline',
    'Content-Length': String(range ? range.end - range.start + 1 : metadata.size),
    'Content-Type': target.mime_type,
    ETag: object.httpEtag ?? '',
  });
  object.writeHttpMetadata(headers);
  if (range) headers.set('Content-Range', `bytes ${range.start}-${range.end}/${metadata.size}`);
  return new Response(object.body, { headers, status: range ? 206 : 200 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; position: string }> }) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const { id, position } = await params;
  await ensureDbSchema();
  const db = getD1();
  const item = await db.prepare(`SELECT gift_draft_items.id, gift_draft_items.object_key FROM gift_draft_items JOIN gift_drafts ON gift_drafts.id = gift_draft_items.draft_id WHERE gift_drafts.id = ? AND gift_drafts.owner_key = ? AND gift_drafts.sent_gift_id IS NULL AND gift_draft_items.position = ?`).bind(id, user.id, Number(position)).first<{ id: string; object_key: string | null }>();
  if (!item) return Response.json({ error: '초안 구절을 찾을 수 없습니다.' }, { status: 404 });
  await db.prepare("UPDATE gift_draft_items SET source_recording_id = NULL, object_key = NULL, mime_type = '', size_bytes = 0, duration_seconds = 0 WHERE id = ?").bind(item.id).run();
  await db.prepare('UPDATE gift_drafts SET updated_at = ? WHERE id = ?').bind(Date.now(), id).run();
  if (item.object_key) await env.FILES.delete(item.object_key);
  return Response.json({ recorded: false });
}
