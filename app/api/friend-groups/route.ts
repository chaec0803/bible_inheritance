import { ensureDbSchema, getD1 } from '@/db';
import { ensureUserProfile } from '@/lib/friend-server';
import { authenticateRequest } from '@/lib/supabase-auth';

type GroupRow = { id: string; name: string; created_at: number; updated_at: number };
type MemberRow = { group_id: string; member_key: string; nickname: string; position: number };

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  await ensureDbSchema();
  const db = getD1();
  const groups = await db.prepare(`SELECT id, name, created_at, updated_at FROM friend_groups
    WHERE owner_key = ? ORDER BY updated_at DESC`).bind(user.id).all<GroupRow>();
  const members = await db.prepare(`SELECT friend_groups.id AS group_id,
      json_each.value AS member_key, user_profiles.nickname, CAST(json_each.key AS INTEGER) AS position
    FROM friend_groups, json_each(friend_groups.member_keys_json)
    JOIN user_profiles ON user_profiles.owner_key = json_each.value
    WHERE friend_groups.owner_key = ?
    ORDER BY friend_groups.updated_at DESC, CAST(json_each.key AS INTEGER)`)
    .bind(user.id).all<MemberRow>();
  return Response.json({ groups: groups.results.map((group) => ({
    id: group.id,
    name: group.name,
    createdAt: group.created_at,
    updatedAt: group.updated_at,
    members: members.results.filter((member) => member.group_id === group.id).map((member) => ({
      memberKey: member.member_key,
      nickname: member.nickname,
      position: member.position,
    })),
  })) });
}

export async function POST(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const body = await request.json().catch(() => null) as { name?: unknown; memberKeys?: unknown } | null;
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 40) : '';
  const rawKeys = Array.isArray(body?.memberKeys) ? body.memberKeys : [];
  const memberKeys = rawKeys.map((key) => key === 'self' ? user.id : typeof key === 'string' ? key.trim() : '').filter(Boolean);
  if (!name || memberKeys.length < 2 || memberKeys.length > 30 || new Set(memberKeys).size !== memberKeys.length || !memberKeys.includes(user.id)) {
    return Response.json({ error: '그룹 이름과 중복 없는 2~30명의 멤버를 확인해 주세요.' }, { status: 400 });
  }
  await ensureDbSchema();
  await ensureUserProfile(user);
  const friendKeys = memberKeys.filter((key) => key !== user.id);
  const placeholders = friendKeys.map(() => '?').join(', ');
  const accepted = await getD1().prepare(`SELECT CASE WHEN user_a_key = ? THEN user_b_key ELSE user_a_key END AS friend_key
    FROM friendships
    WHERE status = 'accepted' AND (user_a_key = ? OR user_b_key = ?)
      AND (CASE WHEN user_a_key = ? THEN user_b_key ELSE user_a_key END) IN (${placeholders})`)
    .bind(user.id, user.id, user.id, user.id, ...friendKeys)
    .all<{ friend_key: string }>();
  if (new Set(accepted.results.map((row) => row.friend_key)).size !== friendKeys.length) {
    return Response.json({ error: '친구로 연결된 사람만 그룹에 초대할 수 있어요.' }, { status: 403 });
  }
  const id = crypto.randomUUID();
  const now = Date.now();
  await getD1().prepare(`INSERT INTO friend_groups (id, owner_key, name, member_keys_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(id, user.id, name, JSON.stringify(memberKeys), now, now).run();
  return Response.json({ group: { id, name, memberKeys, createdAt: now, updatedAt: now } }, { status: 201 });
}
