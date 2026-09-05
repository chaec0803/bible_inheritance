import { ensureDbSchema, getD1 } from '@/db';
import { authenticateRequest } from '@/lib/supabase-auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  await ensureDbSchema();
  const { id } = await params;
  const gift = await getD1().prepare(`SELECT letter_type, letter_text, letter_mime_type,
      letter_duration_seconds, letter_opened_at
    FROM gifts WHERE id = ? AND recipient_key = ? AND recipient_deleted_at IS NULL`)
    .bind(id, user.id)
    .first<{ letter_type: 'text' | 'voice' | null; letter_text: string | null; letter_mime_type: string | null; letter_duration_seconds: number | null; letter_opened_at: number | null }>();
  if (!gift) return Response.json({ error: '선물을 찾을 수 없습니다.' }, { status: 404 });
  if (!gift.letter_type) return Response.json({ error: '함께 온 쪽지가 없습니다.' }, { status: 404 });
  const openedAt = gift.letter_opened_at ?? Date.now();
  if (gift.letter_opened_at === null) await getD1().prepare('UPDATE gifts SET letter_opened_at = ? WHERE id = ? AND recipient_key = ? AND letter_opened_at IS NULL').bind(openedAt, id, user.id).run();
  return Response.json({ letter: {
    type: gift.letter_type,
    text: gift.letter_type === 'text' ? gift.letter_text : null,
    mimeType: gift.letter_type === 'voice' ? gift.letter_mime_type : null,
    durationSeconds: gift.letter_type === 'voice' ? gift.letter_duration_seconds : null,
    openedAt,
  } });
}
