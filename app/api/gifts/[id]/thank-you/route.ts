import { ensureDbSchema, getD1 } from '@/db';
import { normalizeThankYouNote } from '@/lib/gift-thank-you';
import { authenticateRequest } from '@/lib/supabase-auth';

type GiftRow = {
  id: string;
  opened_at: number | null;
  recipient_deleted_at: number | null;
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => null) as { note?: unknown } | null;
  const note = normalizeThankYouNote(body?.note);
  if (!note) return Response.json({ error: '감사 인사는 1자 이상 300자 이하로 적어 주세요.' }, { status: 400 });

  await ensureDbSchema();
  const { id } = await context.params;
  const gift = await getD1().prepare(`SELECT id, opened_at, recipient_deleted_at
    FROM gifts
    WHERE id = ? AND recipient_key = ?`)
    .bind(id, user.id)
    .first<GiftRow>();
  if (!gift || gift.recipient_deleted_at !== null) {
    return Response.json({ error: '선물을 찾을 수 없습니다.' }, { status: 404 });
  }
  if (gift.opened_at === null) {
    return Response.json({ error: '선물을 연 뒤 감사 인사를 보낼 수 있어요.' }, { status: 409 });
  }

  const thankedAt = Date.now();
  await getD1().prepare(`UPDATE gifts
    SET thank_you_note = ?, thanked_at = ?
    WHERE id = ? AND recipient_key = ? AND opened_at IS NOT NULL AND recipient_deleted_at IS NULL`)
    .bind(note, thankedAt, id, user.id)
    .run();
  return Response.json({ thankYou: { note, thankedAt } });
}
