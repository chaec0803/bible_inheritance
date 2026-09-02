import { authenticateRequest } from '@/lib/supabase-auth';
import { canonicalFriendPair, normalizeFriendLookup, validateNickname } from '@/lib/friend-policy';
import { ensureUserProfile } from '@/lib/friend-server';
import { getD1 } from '@/db';

type RelationshipRow = {
  id: string;
  user_a_key: string;
  user_b_key: string;
  requested_by: string;
  status: 'pending' | 'accepted';
  updated_at: number;
  other_user_id: string;
  nickname: string;
  email: string;
};

type SearchProfileRow = {
  owner_key: string;
  nickname: string;
  email: string;
};

function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(1, Math.min(4, local.length - visible.length)))}@${domain}`;
}

function publicPerson(userId: string, nickname: string, email: string) {
  return { userId, nickname, emailHint: maskEmail(email) };
}

function relationshipView(row: RelationshipRow, currentUserId: string) {
  const person = publicPerson(row.other_user_id, row.nickname, row.email);
  if (row.status === 'accepted') return { ...person, relationshipId: row.id, relationship: 'friend' as const };
  return {
    ...person,
    relationshipId: row.id,
    relationship: row.requested_by === currentUserId ? 'outgoing' as const : 'incoming' as const,
  };
}

async function loadRelationships(currentUserId: string) {
  const result = await getD1().prepare(`SELECT
    friendships.id,
    friendships.user_a_key,
    friendships.user_b_key,
    friendships.requested_by,
    friendships.status,
    friendships.updated_at,
    user_profiles.owner_key AS other_user_id,
    user_profiles.nickname,
    user_profiles.email
  FROM friendships
  JOIN user_profiles ON user_profiles.owner_key = CASE
    WHEN friendships.user_a_key = ? THEN friendships.user_b_key
    ELSE friendships.user_a_key
  END
  WHERE friendships.user_a_key = ? OR friendships.user_b_key = ?
  ORDER BY friendships.updated_at DESC`)
    .bind(currentUserId, currentUserId, currentUserId)
    .all<RelationshipRow>();
  return result.results.map((row) => relationshipView(row, currentUserId));
}

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  try {
    await ensureUserProfile(user);
    const profile = await getD1().prepare('SELECT owner_key, nickname, email FROM user_profiles WHERE owner_key = ?')
      .bind(user.id)
      .first<SearchProfileRow>();
    const relationships = await loadRelationships(user.id);
    const friends = relationships.filter((item) => item.relationship === 'friend');
    const incoming = relationships.filter((item) => item.relationship === 'incoming');
    const outgoing = relationships.filter((item) => item.relationship === 'outgoing');

    const rawQuery = new URL(request.url).searchParams.get('q') ?? '';
    const query = normalizeFriendLookup(rawQuery);
    let results: Array<ReturnType<typeof publicPerson> & { relationship: 'none' | 'friend' | 'incoming' | 'outgoing' }> = [];
    if (query.length >= 2) {
      const escapedNickname = query.replace(/[\\%_]/g, '\\$&');
      const search = await getD1().prepare(`SELECT owner_key, nickname, email
        FROM user_profiles
        WHERE owner_key != ?
          AND (email_normalized = ? OR nickname_normalized LIKE ? ESCAPE '\\')
        ORDER BY CASE WHEN nickname_normalized = ? THEN 0 ELSE 1 END, nickname_normalized
        LIMIT 20`)
        .bind(user.id, query, `${escapedNickname}%`, query)
        .all<SearchProfileRow>();
      const relationByUser = new Map(relationships.map((item) => [item.userId, item.relationship]));
      results = search.results.map((item) => ({
        ...publicPerson(item.owner_key, item.nickname, item.email),
        relationship: relationByUser.get(item.owner_key) ?? 'none',
      }));
    }

    return Response.json({
      profile: profile ? { nickname: profile.nickname, email: profile.email } : null,
      friends,
      incoming,
      outgoing,
      results,
    });
  } catch (error) {
    console.error('friends.get_failed', error);
    return Response.json({ error: '친구 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => null) as { nickname?: unknown } | null;
  const validated = validateNickname(body?.nickname);
  if (!validated.ok) return Response.json({ error: validated.error }, { status: 400 });

  try {
    await ensureUserProfile(user);
    await getD1().prepare('UPDATE user_profiles SET nickname = ?, nickname_normalized = ?, updated_at = ? WHERE owner_key = ?')
      .bind(validated.nickname, normalizeFriendLookup(validated.nickname), Date.now(), user.id)
      .run();
    return Response.json({ nickname: validated.nickname });
  } catch (error) {
    console.error('friends.profile_update_failed', error);
    return Response.json({ error: '닉네임을 저장하지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => null) as { action?: unknown; userId?: unknown } | null;
  const action = body?.action;
  const targetUserId = body?.userId;
  if (!['request', 'accept', 'reject', 'remove'].includes(String(action)) || typeof targetUserId !== 'string') {
    return Response.json({ error: '올바른 친구 요청이 아닙니다.' }, { status: 400 });
  }
  if (targetUserId === user.id) return Response.json({ error: '나 자신에게는 친구 요청을 보낼 수 없습니다.' }, { status: 400 });

  try {
    await ensureUserProfile(user);
    const target = await getD1().prepare('SELECT owner_key FROM user_profiles WHERE owner_key = ?').bind(targetUserId).first<{ owner_key: string }>();
    if (!target) return Response.json({ error: '해당 사용자를 찾을 수 없습니다.' }, { status: 404 });

    const [userA, userB] = canonicalFriendPair(user.id, targetUserId);
    const existing = await getD1().prepare('SELECT id, requested_by, status FROM friendships WHERE user_a_key = ? AND user_b_key = ?')
      .bind(userA, userB)
      .first<{ id: string; requested_by: string; status: 'pending' | 'accepted' }>();
    const now = Date.now();

    if (action === 'request') {
      if (existing?.status === 'accepted') return Response.json({ error: '이미 친구입니다.' }, { status: 409 });
      if (existing?.requested_by === user.id) return Response.json({ error: '이미 친구 요청을 보냈습니다.' }, { status: 409 });
      if (existing) {
        await getD1().prepare("UPDATE friendships SET status = 'accepted', updated_at = ? WHERE id = ?")
          .bind(now, existing.id)
          .run();
        return Response.json({ relationship: 'friend' });
      }
      await getD1().prepare(`INSERT INTO friendships (
        id, user_a_key, user_b_key, requested_by, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'pending', ?, ?)`)
        .bind(crypto.randomUUID(), userA, userB, user.id, now, now)
        .run();
      return Response.json({ relationship: 'outgoing' }, { status: 201 });
    }

    if (!existing) return Response.json({ error: '친구 관계를 찾을 수 없습니다.' }, { status: 404 });
    if (action === 'accept') {
      if (existing.status !== 'pending' || existing.requested_by === user.id) return Response.json({ error: '수락할 수 없는 요청입니다.' }, { status: 409 });
      await getD1().prepare("UPDATE friendships SET status = 'accepted', updated_at = ? WHERE id = ?")
        .bind(now, existing.id)
        .run();
      return Response.json({ relationship: 'friend' });
    }
    if (action === 'reject') {
      if (existing.status !== 'pending' || existing.requested_by === user.id) return Response.json({ error: '거절할 수 없는 요청입니다.' }, { status: 409 });
      await getD1().prepare("DELETE FROM friendships WHERE id = ? AND status = 'pending'").bind(existing.id).run();
      return Response.json({ relationship: 'none' });
    }
    if (existing.status !== 'accepted') return Response.json({ error: '친구 관계가 아닙니다.' }, { status: 409 });
    await getD1().prepare("DELETE FROM friendships WHERE id = ? AND status = 'accepted'").bind(existing.id).run();
    return Response.json({ relationship: 'none' });
  } catch (error) {
    console.error('friends.action_failed', error);
    return Response.json({ error: '친구 요청을 처리하지 못했습니다.' }, { status: 500 });
  }
}
