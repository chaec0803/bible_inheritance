import { env } from 'cloudflare:workers';
import { ensureDbSchema, getD1 } from '@/db';
import { authenticateRequest } from '@/lib/supabase-auth';
import { getRelayRecordingProjectId, inspectRelayTurnRecordings } from '@/lib/relay-recording-completeness';

type RouteContext = { params: Promise<{ projectId: string }> };

function parseJson(value: unknown, fallback: unknown) {
  try { return typeof value === 'string' ? JSON.parse(value) : fallback; } catch { return fallback; }
}

export async function GET(request: Request, context: RouteContext) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.', code: 'UNAUTHENTICATED' }, { status: 401 });
  await ensureDbSchema();
  const { projectId } = await context.params;
  const db = getD1();
  const project = await db.prepare(`SELECT relay_projects.*, creator.nickname AS creator_nickname,
      friend_groups.name AS group_name,
      relay_participants.position AS my_position, relay_participants.invite_status AS my_invite_status
    FROM relay_projects
    JOIN friend_groups ON friend_groups.id = relay_projects.group_id
    JOIN relay_participants ON relay_participants.project_id = relay_projects.id
      AND relay_participants.member_key = ?
    JOIN user_profiles AS creator ON creator.owner_key = relay_projects.creator_key
    WHERE relay_projects.id = ?`)
    .bind(user.id, projectId)
    .first<Record<string, unknown>>();
  if (!project) return Response.json({ error: '이어읽기를 찾을 수 없습니다.', code: 'NOT_PARTICIPANT' }, { status: 404 });

  const [participants, turns] = await Promise.all([
    db.prepare(`SELECT relay_participants.member_key, relay_participants.position,
        relay_participants.invite_status, relay_participants.responded_at, user_profiles.nickname
      FROM relay_participants JOIN user_profiles ON user_profiles.owner_key = relay_participants.member_key
      WHERE relay_participants.project_id = ? ORDER BY relay_participants.position`)
      .bind(projectId).all<Record<string, unknown>>(),
    db.prepare(`SELECT id, turn_index, member_key, passages_json, arrival_seen_at, completed_at
      FROM relay_turns WHERE project_id = ? ORDER BY turn_index`)
      .bind(projectId).all<Record<string, unknown>>(),
  ]);
  const currentTurnIndex = project.current_turn_index === null ? null : Number(project.current_turn_index);
  const currentTurn = turns.results.find((turn) => Number(turn.turn_index) === currentTurnIndex);
  const canRecord = project.status === 'in_progress' && currentTurn?.member_key === user.id && currentTurn.completed_at === null;
  let currentTurnRecording = null;
  if (canRecord && currentTurn) {
    const passages = parseJson(currentTurn.passages_json, []);
    const recordingProjectId = getRelayRecordingProjectId(projectId, currentTurnIndex!);
    const recordingRows = await db.prepare(`SELECT owner_key, project_id, book, chapter, verse FROM recordings
      WHERE owner_key = ? AND project_id = ?`).bind(user.id, recordingProjectId).all<Record<string, unknown>>();
    currentTurnRecording = inspectRelayTurnRecordings({
      projectId, turnIndex: currentTurnIndex!, memberKey: user.id, passages,
      recordings: recordingRows.results.map((row) => ({ ownerKey: String(row.owner_key), projectId: String(row.project_id), book: String(row.book), chapter: Number(row.chapter), verse: Number(row.verse) })),
    });
  }

  return Response.json({ project: {
    id: project.id,
    title: project.title,
    creator: { nickname: project.creator_nickname },
    isCreator: project.creator_key === user.id,
    groupId: project.group_id,
    groupName: project.group_name,
    scope: parseJson(project.scope_json, null),
    bgmId: project.bgm_id,
    bgmVolume: project.bgm_volume,
    rotation: project.rotation,
    currentTurnIndex,
    status: project.status,
    inviteMessage: project.invite_message,
    createdAt: project.created_at,
    startedAt: project.started_at,
    completedAt: project.completed_at,
    cancelledAt: project.cancelled_at,
    cancelReason: project.cancel_reason,
    myPosition: project.my_position,
    myInviteStatus: project.my_invite_status,
    canRecord,
    currentTurnRecording,
    participants: participants.results.map((item) => ({
      memberKey: item.member_key, nickname: item.nickname, position: item.position,
      inviteStatus: item.invite_status, respondedAt: item.responded_at,
    })),
    turns: turns.results.map((item) => ({
      id: item.id, turnIndex: item.turn_index, memberKey: item.member_key,
      passages: parseJson(item.passages_json, []), arrivalSeenAt: item.arrival_seen_at,
      completedAt: item.completed_at,
    })),
  } });
}

export async function DELETE(request: Request, context: RouteContext) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.', code: 'UNAUTHENTICATED' }, { status: 401 });
  await ensureDbSchema();
  const { projectId } = await context.params;
  const db = getD1();
  const project = await db.prepare('SELECT id FROM relay_projects WHERE id = ? AND creator_key = ?')
    .bind(projectId, user.id).first<{ id: string }>();
  if (!project) return Response.json({ error: '이어읽기를 찾을 수 없습니다.', code: 'NOT_FOUND' }, { status: 404 });
  const relayPrefix = `relay:${projectId}:turn:`;
  const recordingRows = await db.prepare('SELECT id, object_key FROM recordings WHERE project_id LIKE ?')
    .bind(`${relayPrefix}%`).all<{ id: string; object_key: string }>();
  if (recordingRows.results.length) await env.FILES.delete(recordingRows.results.map((row) => row.object_key));
  await db.batch([
    db.prepare('DELETE FROM recordings WHERE project_id LIKE ?').bind(`${relayPrefix}%`),
    db.prepare('DELETE FROM relay_turns WHERE project_id = ?').bind(projectId),
    db.prepare('DELETE FROM relay_participants WHERE project_id = ?').bind(projectId),
    db.prepare('DELETE FROM relay_projects WHERE id = ? AND creator_key = ?').bind(projectId, user.id),
  ]);
  return Response.json({ deleted: true });
}
