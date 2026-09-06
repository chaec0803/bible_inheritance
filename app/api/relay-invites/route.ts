import { ensureDbSchema, getD1 } from '@/db';
import { authenticateRequest } from '@/lib/supabase-auth';

function parseScope(value: unknown) {
  try { return typeof value === 'string' ? JSON.parse(value) : null; } catch { return null; }
}

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.', code: 'UNAUTHENTICATED' }, { status: 401 });
  await ensureDbSchema();
  const result = await getD1().prepare(`SELECT relay_projects.id, relay_projects.title,
      relay_projects.status, relay_projects.invite_message, relay_projects.scope_json,
      relay_projects.rotation, relay_projects.created_at, creator.nickname AS creator_nickname,
      friend_groups.name AS group_name, relay_participants.position AS my_position
    FROM relay_participants
    JOIN relay_projects ON relay_projects.id = relay_participants.project_id
    JOIN user_profiles AS creator ON creator.owner_key = relay_projects.creator_key
    JOIN friend_groups ON friend_groups.id = relay_projects.group_id
    WHERE relay_participants.member_key = ?
      AND relay_participants.invite_status = 'pending'
      AND relay_projects.status = 'pending_invites'
    ORDER BY relay_projects.created_at DESC`)
    .bind(user.id)
    .all<Record<string, unknown>>();
  return Response.json({ invites: result.results.map((item) => ({
    id: item.id,
    title: item.title,
    creatorNickname: item.creator_nickname,
    groupName: item.group_name,
    scope: parseScope(item.scope_json),
    rotation: item.rotation,
    inviteMessage: item.invite_message,
    myPosition: item.my_position,
    createdAt: item.created_at,
  })) });
}
