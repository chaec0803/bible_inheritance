import { env } from 'cloudflare:workers';
import { ensureDbSchema, getD1 } from '@/db';
import { authenticateRequest } from '@/lib/supabase-auth';

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  await ensureDbSchema();
  const { id } = await context.params;
  const gift = await getD1().prepare('SELECT id, letter_object_key FROM gifts WHERE id = ? AND recipient_key = ? AND recipient_deleted_at IS NULL')
    .bind(id, user.id)
    .first<{ id: string; letter_object_key: string | null }>();
  if (!gift) {
    const sentGift = await getD1().prepare('SELECT id FROM gifts WHERE id = ? AND sender_key = ? AND sender_deleted_at IS NULL')
      .bind(id, user.id)
      .first<{ id: string }>();
    if (!sentGift) return Response.json({ error: '선물을 찾을 수 없습니다.' }, { status: 404 });
    await getD1().prepare('UPDATE gifts SET sender_deleted_at = ? WHERE id = ? AND sender_key = ?').bind(Date.now(), id, user.id).run();
    return Response.json({ deleted: true });
  }

  const recordingResult = await getD1().prepare('SELECT object_key FROM gift_recordings WHERE gift_id = ? AND source_recording_id IS NULL AND object_key IS NOT NULL ORDER BY position')
    .bind(id)
    .all<{ object_key: string }>();
  const d1 = getD1();
  const deletedAt = Date.now();
  await d1.batch([
    d1.prepare('DELETE FROM gift_recordings WHERE gift_id = ?').bind(id),
    d1.prepare('UPDATE gifts SET recipient_deleted_at = ?, opened_at = COALESCE(opened_at, ?) WHERE id = ? AND recipient_key = ? AND recipient_deleted_at IS NULL').bind(deletedAt, deletedAt, id, user.id),
  ]);
  const objectKeys = recordingResult.results.map((recording) => recording.object_key);
  if (gift.letter_object_key) objectKeys.push(gift.letter_object_key);
  if (objectKeys.length) await env.FILES.delete(objectKeys);
  return Response.json({ deleted: true });
}
