import { bibleBooks } from '@/app/bible-metadata';
import { getD1 } from '@/db';
import { CURRENT_DATA_VERSION } from './data-version';
import { isRecordingScopeLocked, type GiftPolicyProject, type GiftPolicyRecording } from './gift-eligibility';
import { canMutateRelayRecording } from './relay-recording-authorization';
import { parseRelayRecordingProjectId } from './relay-recording-completeness';
import type { ReadingPlanPassage } from './custom-reading-plan';

type RecordingMutationTarget = Omit<GiftPolicyRecording, 'id'> & { id?: string };

export async function canAccessRelayRecording(userKey: string, recordingProjectId: string) {
  const context = parseRelayRecordingProjectId(recordingProjectId);
  if (context.kind !== 'relay') return false;
  const row = await getD1().prepare(`SELECT 1 AS allowed FROM relay_projects
    JOIN relay_participants ON relay_participants.project_id = relay_projects.id
      AND relay_participants.member_key = ?
    WHERE relay_projects.id = ?
      AND relay_projects.status IN ('in_progress', 'completed')
      AND (relay_projects.status = 'completed' OR ? <= relay_projects.current_turn_index)`)
    .bind(userKey, context.projectId, context.turnIndex).first<{ allowed: number }>();
  return Boolean(row);
}

export async function loadRecordingCompletionContext(ownerKey: string) {
  const [recordingResult, stateRow] = await Promise.all([
    getD1().prepare(`SELECT id, project_id, book, chapter, verse
      FROM recordings
      WHERE owner_key = ? AND data_version = ?`)
      .bind(ownerKey, CURRENT_DATA_VERSION)
      .all<{ id: string; project_id: string; book: string; chapter: number; verse: number }>(),
    getD1().prepare('SELECT state_json FROM user_states WHERE owner_key = ?')
      .bind(ownerKey)
      .first<{ state_json: string }>(),
  ]);
  let projects: GiftPolicyProject[] = [];
  try {
    const state = stateRow ? JSON.parse(stateRow.state_json) as { activeProjects?: GiftPolicyProject[] } : null;
    if (Array.isArray(state?.activeProjects)) projects = state.activeProjects;
  } catch {
    projects = [];
  }
  return {
    recordings: recordingResult.results.map((recording) => ({
      id: recording.id,
      projectId: recording.project_id,
      book: recording.book,
      chapter: recording.chapter,
      verse: recording.verse,
    })),
    projects,
    chapterCounts: Object.fromEntries(bibleBooks.map((book) => [book.name, book.chapters])) as Readonly<Record<string, readonly number[]>>,
  };
}

export async function isRecordingMutationLocked(ownerKey: string, target: RecordingMutationTarget) {
  const relayContext = parseRelayRecordingProjectId(target.projectId);
  if (relayContext.kind === 'malformed') return true;
  if (relayContext.kind === 'relay') {
    const row = await getD1().prepare(`SELECT relay_projects.status AS project_status,
        relay_projects.current_turn_index, relay_turns.turn_index, relay_turns.member_key,
        relay_turns.completed_at, relay_turns.passages_json
      FROM relay_projects
      JOIN relay_participants ON relay_participants.project_id = relay_projects.id
        AND relay_participants.member_key = ?
      JOIN relay_turns ON relay_turns.project_id = relay_projects.id
        AND relay_turns.turn_index = ?
      WHERE relay_projects.id = ?`)
      .bind(ownerKey, relayContext.turnIndex, relayContext.projectId)
      .first<{ project_status: string; current_turn_index: number | null; turn_index: number; member_key: string; completed_at: number | null; passages_json: string }>();
    if (!row) return true;
    let passages: ReadingPlanPassage[] = [];
    try {
      const parsed = JSON.parse(row.passages_json);
      if (Array.isArray(parsed)) passages = parsed;
    } catch {
      return true;
    }
    return !canMutateRelayRecording({
      projectStatus: row.project_status,
      currentTurnIndex: row.current_turn_index,
      participant: true,
      turnIndex: row.turn_index,
      turnMemberKey: row.member_key,
      turnCompletedAt: row.completed_at,
      passages,
    }, ownerKey, target);
  }
  const context = await loadRecordingCompletionContext(ownerKey);
  return isRecordingScopeLocked({ id: target.id ?? '', ...target }, context.recordings, context.projects, context.chapterCounts);
}
