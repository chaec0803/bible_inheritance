import { ensureDbSchema, getD1 } from '@/db';
import { bibleBooks } from '@/app/bible-metadata';
import { normalizeBibleRange } from '@/lib/bible-scope';
import { buildRelayTurns } from '@/lib/relay-reading';
import { authenticateRequest } from '@/lib/supabase-auth';
import { ensureUserProfile } from '@/lib/friend-server';

function parseJson(value: unknown) {
  try { return typeof value === 'string' ? JSON.parse(value) : null; } catch { return null; }
}

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.', code: 'UNAUTHENTICATED' }, { status: 401 });
  await ensureDbSchema();
  const result = await getD1().prepare(`SELECT relay_projects.id, relay_projects.title,
      relay_projects.status, relay_projects.scope_json, relay_projects.rotation,
      relay_projects.current_turn_index, relay_projects.created_at,
      friend_groups.name AS group_name,
      relay_participants.invite_status AS my_invite_status,
      relay_participants.position AS my_position,
      CASE WHEN relay_projects.status = 'in_progress' AND EXISTS (
        SELECT 1 FROM relay_turns
        WHERE relay_turns.project_id = relay_projects.id
          AND relay_turns.turn_index = relay_projects.current_turn_index
          AND relay_turns.member_key = relay_participants.member_key
      ) THEN 1 ELSE 0 END AS can_record,
      (SELECT COUNT(*) FROM relay_turns WHERE relay_turns.project_id = relay_projects.id) AS total_turns,
      (SELECT COUNT(*) FROM relay_turns WHERE relay_turns.project_id = relay_projects.id AND relay_turns.completed_at IS NOT NULL) AS completed_turns,
      (SELECT user_profiles.nickname FROM relay_turns
        JOIN user_profiles ON user_profiles.owner_key = relay_turns.member_key
        WHERE relay_turns.project_id = relay_projects.id
          AND relay_turns.turn_index = relay_projects.current_turn_index) AS current_member_nickname
    FROM relay_participants
    JOIN relay_projects ON relay_projects.id = relay_participants.project_id
    JOIN friend_groups ON friend_groups.id = relay_projects.group_id
    WHERE relay_participants.member_key = ?
    ORDER BY relay_projects.created_at DESC`)
    .bind(user.id)
    .all<Record<string, unknown>>();
  return Response.json({ projects: result.results.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    scope: parseJson(row.scope_json),
    rotation: row.rotation,
    currentTurnIndex: row.current_turn_index,
    createdAt: row.created_at,
    groupName: row.group_name,
    myInviteStatus: row.my_invite_status,
    myPosition: row.my_position,
    canRecord: Boolean(row.can_record),
    totalTurns: Number(row.total_turns),
    completedTurns: Number(row.completed_turns),
    currentMemberNickname: row.current_member_nickname,
  })) });
}

export async function POST(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.', code: 'UNAUTHENTICATED' }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const groupId = typeof body?.groupId === 'string' ? body.groupId : '';
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 60) : '';
  const scope = normalizeBibleRange(body?.scope, bibleBooks);
  const rotation = Number(body?.rotation);
  const bgmId = typeof body?.bgmId === 'string' ? body.bgmId.slice(0, 80) : 'none';
  const bgmVolume = Math.max(0, Math.min(100, Number(body?.bgmVolume) || 0));
  const inviteMessage = typeof body?.inviteMessage === 'string' ? body.inviteMessage.trim().slice(0, 300) : '';
  if (!groupId || !title || !scope || !Number.isInteger(rotation) || rotation < 1 || rotation > 10) {
    return Response.json({ error: '이어읽기 설정을 확인해 주세요.', code: 'INVALID_PROJECT' }, { status: 400 });
  }
  await ensureDbSchema();
  await ensureUserProfile(user);
  const db = getD1();
  const group = await db.prepare('SELECT id, member_keys_json FROM friend_groups WHERE id = ? AND owner_key = ?')
    .bind(groupId, user.id).first<{ id: string; member_keys_json: string }>();
  if (!group) return Response.json({ error: '친구 그룹을 찾을 수 없어요.', code: 'GROUP_NOT_FOUND' }, { status: 404 });
  let groupMemberKeys: string[] = [];
  try {
    const parsed = JSON.parse(group.member_keys_json);
    if (Array.isArray(parsed)) groupMemberKeys = parsed.filter((key): key is string => typeof key === 'string');
  } catch {
    return Response.json({ error: '친구 그룹 정보가 손상되었어요.', code: 'INVALID_GROUP' }, { status: 409 });
  }
  const requestedMemberKeys = Array.isArray(body?.memberKeys) ? body.memberKeys.filter((key): key is string => typeof key === 'string') : groupMemberKeys;
  const sameMembers = requestedMemberKeys.length === groupMemberKeys.length && new Set(requestedMemberKeys).size === requestedMemberKeys.length && requestedMemberKeys.every((key) => groupMemberKeys.includes(key));
  if (groupMemberKeys.length < 2 || groupMemberKeys.length > 30 || new Set(groupMemberKeys).size !== groupMemberKeys.length || !groupMemberKeys.includes(user.id) || !sameMembers) {
    return Response.json({ error: '친구 그룹 멤버를 확인해 주세요.', code: 'INVALID_GROUP' }, { status: 409 });
  }
  const memberKeys = requestedMemberKeys;
  const friendKeys = memberKeys.filter((key) => key !== user.id);
  const placeholders = friendKeys.map(() => '?').join(', ');
  const accepted = await db.prepare(`SELECT CASE WHEN user_a_key = ? THEN user_b_key ELSE user_a_key END AS friend_key
    FROM friendships WHERE status = 'accepted' AND (user_a_key = ? OR user_b_key = ?)
      AND (CASE WHEN user_a_key = ? THEN user_b_key ELSE user_a_key END) IN (${placeholders})`)
    .bind(user.id, user.id, user.id, user.id, ...friendKeys).all<{ friend_key: string }>();
  if (new Set(accepted.results.map((row) => row.friend_key)).size !== friendKeys.length) {
    return Response.json({ error: '현재 친구로 연결된 사람만 초대할 수 있어요.', code: 'MEMBER_NOT_FRIEND' }, { status: 403 });
  }
  let turns;
  try { turns = buildRelayTurns({ books: bibleBooks, range: scope, memberKeys, rotation }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : '말씀을 배분하지 못했어요.', code: 'INVALID_ALLOCATION' }, { status: 400 }); }

  const projectId = crypto.randomUUID();
  const now = Date.now();
  const statements = [
    db.prepare(`INSERT INTO relay_projects (id, creator_key, group_id, title, scope_json, bgm_id, bgm_volume, rotation, current_turn_index, status, invite_message, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending_invites', ?, ?)`).bind(projectId, user.id, groupId, title, JSON.stringify(scope), bgmId, bgmVolume, rotation, inviteMessage, now),
    ...memberKeys.map((memberKey, position) => db.prepare(`INSERT INTO relay_participants (id, project_id, member_key, position, invite_status, responded_at)
      VALUES (?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), projectId, memberKey, position, memberKey === user.id ? 'accepted' : 'pending', memberKey === user.id ? now : null)),
    ...turns.map((turn) => db.prepare(`INSERT INTO relay_turns (id, project_id, turn_index, member_key, passages_json, arrival_seen_at, completed_at)
      VALUES (?, ?, ?, ?, ?, NULL, NULL)`).bind(crypto.randomUUID(), projectId, turn.turnIndex, turn.memberKey, JSON.stringify(turn.passages))),
  ];
  await db.batch(statements);
  return Response.json({ project: { id: projectId, title, status: 'pending_invites', currentTurnIndex: null, totalTurns: turns.length } }, { status: 201 });
}
