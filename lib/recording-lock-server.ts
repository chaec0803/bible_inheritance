import { bibleBooks } from '@/app/bible-metadata';
import { getD1 } from '@/db';
import { CURRENT_DATA_VERSION } from './data-version';
import { isRecordingScopeLocked, type GiftPolicyProject, type GiftPolicyRecording } from './gift-eligibility';

type RecordingMutationTarget = Omit<GiftPolicyRecording, 'id'> & { id?: string };

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
  const context = await loadRecordingCompletionContext(ownerKey);
  return isRecordingScopeLocked({ id: target.id ?? '', ...target }, context.recordings, context.projects, context.chapterCounts);
}
