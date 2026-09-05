import { ensureDbSchema, getD1 } from '@/db';
import { authenticateRequest } from '@/lib/supabase-auth';

type ArrivalRow = {
  id: string;
  sender_nickname: string;
  created_at: number;
};

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  await ensureDbSchema();
  const result = await getD1().prepare(`SELECT
    gifts.id, gifts.created_at, user_profiles.nickname AS sender_nickname
  FROM gifts
  JOIN user_profiles ON user_profiles.owner_key = gifts.sender_key
  WHERE gifts.recipient_key = ?
    AND gifts.recipient_deleted_at IS NULL
    AND gifts.arrival_seen_at IS NULL
    AND gifts.opened_at IS NULL
  ORDER BY gifts.created_at ASC
  LIMIT 100`).bind(user.id).all<ArrivalRow>();

  return Response.json({
    arrivals: result.results.map((gift) => ({
      id: gift.id,
      senderNickname: gift.sender_nickname,
      createdAt: gift.created_at,
    })),
  });
}

export async function PATCH(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => null) as { giftIds?: unknown } | null;
  const giftIds = [...new Set(Array.isArray(body?.giftIds)
    ? body.giftIds.filter((id): id is string => typeof id === 'string' && id.length > 0).slice(0, 100)
    : [])];
  if (!giftIds.length) return Response.json({ error: '확인할 선물이 없습니다.' }, { status: 400 });

  await ensureDbSchema();
  const placeholders = giftIds.map(() => '?').join(', ');
  await getD1().prepare(`UPDATE gifts SET arrival_seen_at = ?
    WHERE id IN (${placeholders}) AND recipient_key = ? AND arrival_seen_at IS NULL`)
    .bind(Date.now(), ...giftIds, user.id)
    .run();

  return Response.json({ acknowledged: giftIds });
}
