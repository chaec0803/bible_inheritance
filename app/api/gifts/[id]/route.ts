import { env } from 'cloudflare:workers';
import { ensureDbSchema, getD1 } from '@/db';
import { authenticateRequest } from '@/lib/supabase-auth';

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  await ensureDbSchema();
  const { id } = await context.params;
  const gift = await getD1().prepare('SELECT id FROM gifts WHERE id = ? AND recipient_key = ?')
    .bind(id, user.id)
    .first<{ id: string }>();
  if (!gift) return Response.json({ error: '선물을 찾을 수 없습니다.' }, { status: 404 });

  const recordingResult = await getD1().prepare('SELECT object_key FROM gift_recordings WHERE gift_id = ? ORDER BY position')
    .bind(id)
    .all<{ object_key: string }>();
  const d1 = getD1();
  await d1.batch([
    d1.prepare('DELETE FROM gift_recordings WHERE gift_id = ?').bind(id),
    d1.prepare('DELETE FROM gifts WHERE id = ? AND recipient_key = ?').bind(id, user.id),
  ]);
  const objectKeys = recordingResult.results.map((recording) => recording.object_key);
  if (objectKeys.length) await env.FILES.delete(objectKeys);
  return Response.json({ deleted: true });
}
