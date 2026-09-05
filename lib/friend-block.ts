export const BLOCK_CONSEQUENCES = [
  '서로의 친구 목록에서 사라져요.',
  '친구 검색 결과에 서로 나타나지 않아요.',
  '서로 친구 요청을 주고받을 수 없어요.',
  '서로에게 새 말씀 선물을 보낼 수 없어요.',
  '이미 주고받은 말씀 선물은 그대로 남아 계속 듣고 보관할 수 있어요.',
] as const;

export type BlockRow = { blockerKey: string; blockedKey: string };

export function normalizeBlockTarget(
  rawUserId: unknown,
  currentUserId: string,
): { ok: true; userId: string } | { ok: false; error: string } {
  if (typeof rawUserId !== 'string') return { ok: false, error: '올바른 차단 요청이 아닙니다.' };
  const userId = rawUserId.trim();
  if (!userId) return { ok: false, error: '올바른 차단 요청이 아닙니다.' };
  if (userId === currentUserId) return { ok: false, error: '자기 자신은 차단할 수 없습니다.' };
  return { ok: true, userId };
}

export function isBlockedBetween(rows: readonly BlockRow[], firstUserId: string, secondUserId: string) {
  return rows.some((row) =>
    (row.blockerKey === firstUserId && row.blockedKey === secondUserId)
    || (row.blockerKey === secondUserId && row.blockedKey === firstUserId));
}
