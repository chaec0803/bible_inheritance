import { ensureDbSchema, getD1 } from '@/db';
import { inspectRelayTurnRecordings, getRelayRecordingProjectId } from '@/lib/relay-recording-completeness';
import { authenticateRequest } from '@/lib/supabase-auth';

type Context = { params: Promise<{ projectId: string; turnIndex: string }> };
type StateRow = {
  project_id: string; project_status: string; current_turn_index: number | null; project_completed_at: number | null;
  turn_id: string; turn_index: number; member_key: string; turn_completed_at: number | null; passages_json: string; last_turn_index: number;
};

async function loadState(projectId: string, memberKey: string, turnIndex: number) {
  return getD1().prepare(`SELECT relay_projects.id AS project_id, relay_projects.status AS project_status,
      relay_projects.current_turn_index, relay_projects.completed_at AS project_completed_at,
      relay_turns.id AS turn_id, relay_turns.turn_index, relay_turns.member_key,
      relay_turns.completed_at AS turn_completed_at, relay_turns.passages_json,
      (SELECT MAX(last_turn.turn_index) FROM relay_turns AS last_turn WHERE last_turn.project_id = relay_projects.id) AS last_turn_index
    FROM relay_projects
    JOIN relay_participants ON relay_participants.project_id = relay_projects.id AND relay_participants.member_key = ?
    JOIN relay_turns ON relay_turns.project_id = relay_projects.id AND relay_turns.turn_index = ?
    WHERE relay_projects.id = ?`)
    .bind(memberKey, turnIndex, projectId).first<StateRow>();
}

function stateResponse(state: StateRow, idempotent = false) {
  return { completed: true, idempotent, projectStatus: state.project_status, currentTurnIndex: state.current_turn_index, completedAt: state.project_completed_at };
}

export async function POST(request: Request, context: Context) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.', code: 'UNAUTHENTICATED' }, { status: 401 });
  const { projectId, turnIndex: rawTurnIndex } = await context.params;
  const turnIndex = Number(rawTurnIndex);
  if (!Number.isInteger(turnIndex) || turnIndex < 0) return Response.json({ error: 'turn 번호가 올바르지 않습니다.', code: 'NOT_CURRENT_TURN' }, { status: 400 });
  await ensureDbSchema();
  const state = await loadState(projectId, user.id, turnIndex);
  if (!state) return Response.json({ error: '이어읽기를 찾을 수 없습니다.', code: 'NOT_PARTICIPANT' }, { status: 404 });
  if (state.turn_completed_at !== null && state.member_key === user.id) return Response.json(stateResponse(state, true));
  if (state.project_status === 'cancelled') return Response.json({ error: '취소된 이어읽기예요.', code: 'PROJECT_CANCELLED' }, { status: 409 });
  if (state.project_status === 'completed') return Response.json({ error: '이미 완료된 이어읽기예요.', code: 'PROJECT_COMPLETED' }, { status: 409 });
  if (state.project_status !== 'in_progress') return Response.json({ error: '진행 중인 이어읽기가 아니에요.', code: 'PROJECT_NOT_IN_PROGRESS' }, { status: 409 });
  if (state.current_turn_index !== turnIndex) return Response.json({ error: '현재 차례가 아닙니다.', code: 'NOT_CURRENT_TURN' }, { status: 409 });
  if (state.member_key !== user.id) return Response.json({ error: '현재 turn 담당자가 아닙니다.', code: 'NOT_TURN_OWNER' }, { status: 403 });

  let passages;
  try { passages = JSON.parse(state.passages_json); } catch { passages = []; }
  const recordingProjectId = getRelayRecordingProjectId(projectId, turnIndex);
  const rows = await getD1().prepare(`SELECT owner_key, project_id, book, chapter, verse FROM recordings
    WHERE owner_key = ? AND project_id = ?`).bind(user.id, recordingProjectId).all<Record<string, unknown>>();
  const completeness = inspectRelayTurnRecordings({ projectId, turnIndex, memberKey: user.id, passages, recordings: rows.results.map((row) => ({ ownerKey: String(row.owner_key), projectId: String(row.project_id), book: String(row.book), chapter: Number(row.chapter), verse: Number(row.verse) })) });
  if (!completeness.complete) return Response.json({ error: '배정된 말씀 녹음이 아직 모두 저장되지 않았어요.', code: 'RECORDINGS_INCOMPLETE', ...completeness }, { status: 409 });

  const db = getD1(); const now = Date.now();
  await db.batch([
    db.prepare(`UPDATE relay_turns SET completed_at = ?
      WHERE project_id = ? AND turn_index = ? AND member_key = ? AND relay_turns.completed_at IS NULL
        AND EXISTS (SELECT 1 FROM relay_projects WHERE relay_projects.id = relay_turns.project_id
          AND relay_projects.status = 'in_progress' AND relay_projects.current_turn_index = ?)`)
      .bind(now, projectId, turnIndex, user.id, turnIndex),
    db.prepare(`UPDATE relay_projects SET
        status = CASE WHEN current_turn_index = (SELECT MAX(turn_index) FROM relay_turns WHERE project_id = relay_projects.id) THEN 'completed' ELSE 'in_progress' END,
        current_turn_index = CASE WHEN current_turn_index = (SELECT MAX(turn_index) FROM relay_turns WHERE project_id = relay_projects.id) THEN current_turn_index ELSE current_turn_index + 1 END,
        completed_at = CASE WHEN current_turn_index = (SELECT MAX(turn_index) FROM relay_turns WHERE project_id = relay_projects.id) THEN ? ELSE completed_at END
      WHERE id = ? AND status = 'in_progress' AND current_turn_index = ?
        AND EXISTS (SELECT 1 FROM relay_turns WHERE relay_turns.project_id = relay_projects.id
          AND relay_turns.turn_index = ? AND relay_turns.member_key = ? AND relay_turns.completed_at IS NOT NULL)`)
      .bind(now, projectId, turnIndex, turnIndex, user.id),
  ]);
  const after = await loadState(projectId, user.id, turnIndex);
  if (!after?.turn_completed_at) return Response.json({ error: '차례가 이미 변경되었습니다.', code: 'NOT_CURRENT_TURN' }, { status: 409 });
  return Response.json(stateResponse(after));
}
