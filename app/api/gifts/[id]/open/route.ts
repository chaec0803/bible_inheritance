import { ensureDbSchema, getD1 } from '@/db';
import { authenticateRequest } from '@/lib/supabase-auth';

type GiftOpenRow = {
  id: string;
  opened_at: number | null;
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  await ensureDbSchema();
  const { id } = await context.params;
  const gift = await getD1().prepare('SELECT id, opened_at FROM gifts WHERE id = ? AND recipient_key = ?')
    .bind(id, user.id)
    .first<GiftOpenRow>();
  if (!gift) return Response.json({ error: '선물을 찾을 수 없습니다.' }, { status: 404 });

  const openedAt = gift.opened_at ?? Date.now();
  if (gift.opened_at === null) {
    await getD1().prepare('UPDATE gifts SET opened_at = ? WHERE id = ? AND recipient_key = ? AND opened_at IS NULL')
      .bind(openedAt, id, user.id)
      .run();
  }

  return Response.json({ gift: { id, openedAt } });
}
