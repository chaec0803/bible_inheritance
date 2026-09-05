import { getGiftDraftProgress, isGiftDraftSendable } from '@/lib/gift-draft';

export type DraftItemRow = { id: string; draft_id?: string; position: number; book: string; chapter: number; verse: number; verse_text: string; source_recording_id: string | null; object_key: string | null; mime_type: string; size_bytes: number; duration_seconds: number };

export function presentItems(rows: DraftItemRow[]) {
  return rows.map((row) => ({ id: row.id, position: row.position, book: row.book, chapter: row.chapter, verse: row.verse, verseText: row.verse_text, sourceRecordingId: row.source_recording_id, mimeType: row.mime_type, sizeBytes: row.size_bytes, durationSeconds: row.duration_seconds, recorded: Boolean(row.object_key || row.source_recording_id) }));
}

export function presentDraft(row: Record<string, unknown>, rows: DraftItemRow[]) {
  const progressItems = rows.map((item) => ({ objectKey: item.object_key, sourceRecordingId: item.source_recording_id }));
  return { id: row.id, recipientUserId: row.recipient_key, recipientNickname: row.recipient_nickname, title: row.title, bgmId: row.bgm_id, bgmVolume: row.bgm_volume, createdAt: row.created_at, updatedAt: row.updated_at, ...getGiftDraftProgress(progressItems), sendable: isGiftDraftSendable(progressItems), items: presentItems(rows) };
}
