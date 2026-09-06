import { ensureDbSchema, getD1 } from '@/db';
import { authenticateRequest } from '@/lib/supabase-auth';
import { buildRelayPlaybackQueue } from '@/lib/relay-playback-queue';

type Context = { params: Promise<{ projectId: string }> };
type Row = { id: string; turn_index: number; owner_nickname: string; book: string; chapter: number; verse: number; verse_text: string; bgm_id: string; duration_seconds: number; passages_json: string };

export async function GET(request: Request, context: Context) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  await ensureDbSchema();
  const { projectId } = await context.params;
  const db = getD1();
  const allowed = await db.prepare(`SELECT relay_projects.id, relay_projects.status, relay_projects.current_turn_index FROM relay_projects
    JOIN relay_participants ON relay_participants.project_id = relay_projects.id AND relay_participants.member_key = ?
    WHERE relay_projects.id = ? AND relay_projects.status IN ('in_progress', 'completed')`).bind(user.id, projectId).first<{ id: string; status: string; current_turn_index: number | null }>();
  if (!allowed) return Response.json({ error: '재생할 수 있는 이어읽기를 찾을 수 없어요.' }, { status: 404 });
  const result = await db.prepare(`SELECT recordings.id, relay_turns.turn_index,
      user_profiles.nickname AS owner_nickname, recordings.book, recordings.chapter,
      recordings.verse, recordings.verse_text, recordings.bgm_id, recordings.duration_seconds,
      relay_turns.passages_json
    FROM relay_turns
    JOIN recordings ON recordings.project_id = 'relay:' || relay_turns.project_id || ':turn:' || relay_turns.turn_index
      AND recordings.owner_key = relay_turns.member_key
    JOIN user_profiles ON user_profiles.owner_key = recordings.owner_key
    WHERE relay_turns.project_id = ?`).bind(projectId).all<Row>();
  const rows = buildRelayPlaybackQueue({
    status: allowed.status,
    currentTurnIndex: allowed.current_turn_index,
    rows: result.results.map((row) => ({
      id: row.id, turnIndex: row.turn_index, ownerNickname: row.owner_nickname,
      book: row.book, chapter: row.chapter, verse: row.verse, verseText: row.verse_text,
      bgmId: row.bgm_id, durationSeconds: row.duration_seconds, passagesJson: row.passages_json,
    })),
  });
  return Response.json({ recordings: rows.map((row) => ({
    id: row.id, turnIndex: row.turnIndex, ownerNickname: row.ownerNickname,
    book: row.book, chapter: row.chapter, verse: row.verse, verseText: row.verseText,
    bgmId: row.bgmId, durationSeconds: row.durationSeconds,
  })) });
}
