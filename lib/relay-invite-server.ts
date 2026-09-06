import { ensureDbSchema, getD1 } from '@/db';
import { authenticateRequest } from './supabase-auth';

type InviteAction = 'accept' | 'decline';
type InviteRow = {
  project_id: string;
  project_status: string;
  member_key: string;
  invite_status: string;
  current_turn_index?: number | null;
  started_at?: number | null;
  cancelled_at?: number | null;
};

function conflict(row: InviteRow) {
  if (row.project_status === 'cancelled') return { error: '취소된 이어읽기예요.', code: 'PROJECT_CANCELLED' };
  if (row.project_status === 'completed') return { error: '이미 완료된 이어읽기예요.', code: 'PROJECT_COMPLETED' };
  if (row.project_status !== 'pending_invites') return { error: '초대 응답을 받을 수 없는 상태예요.', code: 'PROJECT_NOT_PENDING' };
  return { error: '이미 응답한 초대예요.', code: 'INVITE_ALREADY_RESPONDED' };
}

async function loadInvite(projectId: string, memberKey: string) {
  return getD1().prepare(`SELECT relay_projects.id AS project_id,
      relay_projects.status AS project_status, relay_projects.current_turn_index,
      relay_projects.started_at, relay_projects.cancelled_at,
      relay_participants.member_key, relay_participants.invite_status
    FROM relay_projects
    JOIN relay_participants ON relay_participants.project_id = relay_projects.id
      AND relay_participants.member_key = ?
    WHERE relay_projects.id = ?`)
    .bind(memberKey, projectId)
    .first<InviteRow>();
}

export async function respondToRelayInviteRequest(
  request: Request,
  projectId: string,
  action: InviteAction,
) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.', code: 'UNAUTHENTICATED' }, { status: 401 });
  await ensureDbSchema();
  const before = await loadInvite(projectId, user.id);
  if (!before) return Response.json({ error: '이어읽기를 찾을 수 없습니다.', code: 'NOT_PARTICIPANT' }, { status: 404 });
  if (before.project_status !== 'pending_invites' || before.invite_status !== 'pending') {
    return Response.json(conflict(before), { status: 409 });
  }

  const db = getD1();
  const now = Date.now();
  if (action === 'accept') {
    await db.batch([
      db.prepare(`UPDATE relay_participants
        SET invite_status = 'accepted', responded_at = ?
        WHERE project_id = ? AND member_key = ?
          AND relay_participants.invite_status = 'pending'
          AND EXISTS (SELECT 1 FROM relay_projects
            WHERE relay_projects.id = relay_participants.project_id
              AND relay_projects.status = 'pending_invites')`)
        .bind(now, projectId, user.id),
      db.prepare(`UPDATE relay_projects
        SET status = 'in_progress', started_at = ?, current_turn_index = 0
        WHERE id = ? AND relay_projects.status = 'pending_invites'
          AND NOT EXISTS (SELECT 1 FROM relay_participants
            WHERE relay_participants.project_id = relay_projects.id
              AND relay_participants.invite_status != 'accepted')`)
        .bind(now, projectId),
    ]);
  } else {
    await db.batch([
      db.prepare(`UPDATE relay_participants
        SET invite_status = 'declined', responded_at = ?
        WHERE project_id = ? AND member_key = ?
          AND relay_participants.invite_status = 'pending'
          AND EXISTS (SELECT 1 FROM relay_projects
            WHERE relay_projects.id = relay_participants.project_id
              AND relay_projects.status = 'pending_invites')`)
        .bind(now, projectId, user.id),
      db.prepare(`UPDATE relay_projects
        SET status = 'cancelled', cancelled_at = ?, cancel_reason = 'PARTICIPANT_DECLINED'
        WHERE id = ? AND relay_projects.status = 'pending_invites'
          AND EXISTS (SELECT 1 FROM relay_participants
            WHERE relay_participants.project_id = relay_projects.id
              AND relay_participants.member_key = ?
              AND relay_participants.invite_status = 'declined')`)
        .bind(now, projectId, user.id),
    ]);
  }

  const after = await loadInvite(projectId, user.id);
  if (!after) return Response.json({ error: '이어읽기 상태를 확인하지 못했습니다.', code: 'STATE_UNAVAILABLE' }, { status: 409 });
  const expectedStatus = action === 'accept' ? 'accepted' : 'declined';
  if (after.invite_status !== expectedStatus) return Response.json(conflict(after), { status: 409 });
  return Response.json({
    projectStatus: after.project_status,
    inviteStatus: after.invite_status,
    currentTurnIndex: after.current_turn_index ?? null,
    startedAt: after.started_at ?? null,
    cancelledAt: after.cancelled_at ?? null,
  });
}
