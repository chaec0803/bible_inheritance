import { ensureDbSchema, getD1 } from '@/db';
import { CURRENT_DATA_VERSION } from '@/lib/data-version';
import { ensureUserProfile } from '@/lib/friend-server';
import { canonicalFriendPair } from '@/lib/friend-policy';
import { evaluateGiftSelection } from '@/lib/gift-eligibility';
import { normalizeGiftRequest } from '@/lib/gift-policy';
import { decodeGiftLetterAudio } from '@/lib/gift-letter';
import { loadRecordingCompletionContext } from '@/lib/recording-lock-server';
import { authenticateRequest } from '@/lib/supabase-auth';

type SourceRecordingRow = {
  id: string;
  project_id: string;
  book: string;
  chapter: number;
  verse: number;
  verse_text: string;
  mime_type: string;
  size_bytes: number;
  duration_seconds: number;
};

type GiftRow = {
  id: string;
  title: string;
  sender_nickname: string;
  bgm_id: string;
  bgm_volume: number;
  recording_count: number;
  total_size_bytes: number;
  created_at: number;
  opened_at: number | null;
  thank_you_note: string | null;
  thanked_at: number | null;
  letter_type: 'text' | 'voice' | null;
  letter_text: string | null;
  letter_mime_type: string | null;
  letter_size_bytes: number | null;
  letter_duration_seconds: number | null;
  letter_opened_at: number | null;
};

type SentGiftRow = Omit<GiftRow, 'sender_nickname' | 'recipient_deleted_at'> & {
  recipient_nickname: string;
};

type GiftRecordingRow = {
  id: string;
  gift_id: string;
  position: number;
  book: string;
  chapter: number;
  verse: number;
  verse_text: string;
  mime_type: string;
  size_bytes: number;
  duration_seconds: number;
};

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  try {
    await ensureDbSchema();
    await ensureUserProfile(user);
    const giftResult = await getD1().prepare(`SELECT
      gifts.id, gifts.title, gifts.bgm_id, gifts.bgm_volume,
      gifts.recording_count, gifts.total_size_bytes, gifts.created_at, gifts.opened_at,
      gifts.thank_you_note, gifts.thanked_at,
      gifts.letter_type, gifts.letter_text, gifts.letter_mime_type,
      gifts.letter_size_bytes, gifts.letter_duration_seconds, gifts.letter_opened_at,
      user_profiles.nickname AS sender_nickname
    FROM gifts
    JOIN user_profiles ON user_profiles.owner_key = gifts.sender_key
    WHERE gifts.recipient_key = ? AND gifts.recipient_deleted_at IS NULL
    ORDER BY gifts.created_at DESC
    LIMIT 100`)
      .bind(user.id)
      .all<GiftRow>();

    const sentGiftResult = await getD1().prepare(`SELECT
      gifts.id, gifts.title, gifts.bgm_id, gifts.bgm_volume,
      gifts.recording_count, gifts.total_size_bytes, gifts.created_at, gifts.opened_at,
      gifts.thank_you_note, gifts.thanked_at,
      gifts.letter_type, NULL AS letter_text, gifts.letter_mime_type,
      gifts.letter_size_bytes, gifts.letter_duration_seconds, gifts.letter_opened_at,
      user_profiles.nickname AS recipient_nickname
    FROM gifts
    JOIN user_profiles ON user_profiles.owner_key = gifts.recipient_key
    WHERE gifts.sender_key = ?
      AND gifts.sender_deleted_at IS NULL
    ORDER BY gifts.created_at DESC
    LIMIT 100`)
      .bind(user.id)
      .all<SentGiftRow>();

    const giftIds = giftResult.results.map((gift) => gift.id);
    let recordingRows: GiftRecordingRow[] = [];
    if (giftIds.length) {
      const placeholders = giftIds.map(() => '?').join(', ');
      const recordingResult = await getD1().prepare(`SELECT
        id, gift_id, position, book, chapter, verse, verse_text,
        mime_type, size_bytes, duration_seconds
      FROM gift_recordings
      WHERE gift_id IN (${placeholders})
      ORDER BY gift_id, position`)
        .bind(...giftIds)
        .all<GiftRecordingRow>();
      recordingRows = recordingResult.results;
    }

    return Response.json({
      gifts: giftResult.results.map((gift) => ({
        id: gift.id,
        title: gift.title,
        senderNickname: gift.sender_nickname,
        bgmId: gift.bgm_id,
        bgmVolume: gift.bgm_volume,
        recordingCount: gift.recording_count,
        totalSizeBytes: gift.total_size_bytes,
        createdAt: gift.created_at,
        openedAt: gift.opened_at,
        thankYouNote: gift.thank_you_note,
        thankedAt: gift.thanked_at,
        hasLetter: Boolean(gift.letter_type),
        letterType: gift.letter_type,
        letterOpenedAt: gift.letter_opened_at,
        letterText: gift.letter_opened_at !== null && gift.letter_type === 'text' ? gift.letter_text : null,
        letterMimeType: gift.letter_opened_at !== null && gift.letter_type === 'voice' ? gift.letter_mime_type : null,
        letterDurationSeconds: gift.letter_opened_at !== null && gift.letter_type === 'voice' ? gift.letter_duration_seconds : null,
        recordings: recordingRows
          .filter((recording) => recording.gift_id === gift.id)
          .map((recording) => ({
            id: recording.id,
            position: recording.position,
            book: recording.book,
            chapter: recording.chapter,
            verse: recording.verse,
            verseText: recording.verse_text,
            mimeType: recording.mime_type,
            sizeBytes: recording.size_bytes,
            durationSeconds: recording.duration_seconds,
          })),
      })),
      sentGifts: sentGiftResult.results.map((gift) => ({
        id: gift.id,
        title: gift.title,
        recipientNickname: gift.recipient_nickname,
        bgmId: gift.bgm_id,
        bgmVolume: gift.bgm_volume,
        recordingCount: gift.recording_count,
        totalSizeBytes: gift.total_size_bytes,
        createdAt: gift.created_at,
        openedAt: gift.opened_at,
        thankYouNote: gift.thank_you_note,
        thankedAt: gift.thanked_at,
        hasLetter: Boolean(gift.letter_type),
        letterType: gift.letter_type,
      })),
    });
  } catch (error) {
    console.error('gifts.get_failed', error);
    return Response.json({ error: '선물함을 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const giftRequest = normalizeGiftRequest(await request.json().catch(() => null));
  if (!giftRequest) return Response.json({ error: '보낼 선물 정보를 다시 확인해 주세요.' }, { status: 400 });
  if (giftRequest.recipientUserId === user.id) return Response.json({ error: '나 자신에게는 선물할 수 없습니다.' }, { status: 400 });

  await ensureDbSchema();
  await ensureUserProfile(user);
  const [userA, userB] = canonicalFriendPair(user.id, giftRequest.recipientUserId);
  const friendship = await getD1().prepare("SELECT id FROM friendships WHERE user_a_key = ? AND user_b_key = ? AND status = 'accepted'")
    .bind(userA, userB)
    .first<{ id: string }>();
  if (!friendship) return Response.json({ error: '친구에게만 말씀을 선물할 수 있습니다.' }, { status: 403 });

  const block = await getD1().prepare(`SELECT id FROM friend_blocks
    WHERE (blocker_key = ? AND blocked_key = ?) OR (blocker_key = ? AND blocked_key = ?)
    LIMIT 1`)
    .bind(user.id, giftRequest.recipientUserId, giftRequest.recipientUserId, user.id)
    .first<{ id: string }>();
  if (block) return Response.json({ error: '차단한 사용자에게는 말씀 선물을 보낼 수 없습니다.' }, { status: 403 });

  const unopenedGift = await getD1().prepare(`SELECT id FROM gifts
    WHERE sender_key = ? AND recipient_key = ? AND opened_at IS NULL
    LIMIT 1`)
    .bind(user.id, giftRequest.recipientUserId)
    .first<{ id: string }>();
  if (unopenedGift) {
    return Response.json({ error: '친구가 이전 선물을 아직 열지 않았어요. 선물을 연 뒤에 다시 보낼 수 있어요.' }, { status: 409 });
  }

  const sourceResult = await getD1().prepare(`SELECT
    id, project_id, book, chapter, verse, verse_text, mime_type, size_bytes, duration_seconds
  FROM recordings
  WHERE owner_key = ? AND data_version = ?`)
    .bind(user.id, CURRENT_DATA_VERSION)
    .all<SourceRecordingRow>();
  const completionContext = await loadRecordingCompletionContext(user.id);
  const selection = evaluateGiftSelection({
    recordings: sourceResult.results.map((recording) => ({ id: recording.id, projectId: recording.project_id, book: recording.book, chapter: recording.chapter, verse: recording.verse })),
    projects: completionContext.projects,
    selectedRecordingIds: giftRequest.recordingIds,
    chapterCounts: completionContext.chapterCounts,
  });
  if (!selection.eligible) return Response.json({ error: selection.reason }, { status: selection.reason.includes('찾을 수 없') ? 404 : 409 });
  const sourceById = new Map(sourceResult.results.map((recording) => [recording.id, recording]));
  const recordings = selection.orderedRecordingIds.map((id) => sourceById.get(id)!).filter(Boolean);
  const totalSizeBytes = recordings.reduce((sum, recording) => sum + recording.size_bytes, 0);

  const giftId = crypto.randomUUID();
  const now = Date.now();
  const letterObjectKey = giftRequest.letter.type === 'voice' ? `${user.id}/gift-letters/${giftId}` : null;
  if (giftRequest.letter.type === 'voice') {
    const bytes = decodeGiftLetterAudio(giftRequest.letter);
    if (!bytes) return Response.json({ error: '음성 편지 파일을 다시 확인해 주세요.' }, { status: 400 });
    await env.FILES.put(letterObjectKey!, bytes, { httpMetadata: { contentType: giftRequest.letter.mimeType } });
  }
  const giftRecordings: Array<SourceRecordingRow & { id: string; position: number }> = recordings.map((recording, position) => ({ ...recording, id: crypto.randomUUID(), position }));

  try {
    const d1 = getD1();
    const statements = [
      d1.prepare(`INSERT INTO gifts (
        id, sender_key, recipient_key, title, bgm_id, bgm_volume,
        recording_count, total_size_bytes, created_at, letter_type, letter_text,
        letter_object_key, letter_mime_type, letter_size_bytes, letter_duration_seconds
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(giftId, user.id, giftRequest.recipientUserId, giftRequest.title, giftRequest.bgmId, giftRequest.bgmVolume, recordings.length, totalSizeBytes, now,
          giftRequest.letter.type === 'none' ? null : giftRequest.letter.type,
          giftRequest.letter.type === 'text' ? giftRequest.letter.text : null,
          letterObjectKey,
          giftRequest.letter.type === 'voice' ? giftRequest.letter.mimeType : null,
          giftRequest.letter.type === 'voice' ? giftRequest.letter.sizeBytes : null,
          giftRequest.letter.type === 'voice' ? giftRequest.letter.durationSeconds : null),
      ...giftRecordings.map((recording) => d1.prepare(`INSERT INTO gift_recordings (
        id, gift_id, position, book, chapter, verse, verse_text,
        source_recording_id, object_key, mime_type, size_bytes, duration_seconds
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`)
        .bind(recording.id, giftId, recording.position, recording.book, recording.chapter, recording.verse, recording.verse_text, sourceById.get(selection.orderedRecordingIds[recording.position])!.id, recording.mime_type, recording.size_bytes, recording.duration_seconds)),
    ];
    for (let offset = 0; offset < statements.length; offset += 500) await d1.batch(statements.slice(offset, offset + 500));
    return Response.json({ gift: { id: giftId, title: giftRequest.title, recordingCount: recordings.length } }, { status: 201 });
  } catch (error) {
    const d1 = getD1();
    if (letterObjectKey) await env.FILES.delete(letterObjectKey).catch(() => undefined);
    await d1.batch([
      d1.prepare('DELETE FROM gift_recordings WHERE gift_id = ?').bind(giftId),
      d1.prepare('DELETE FROM gifts WHERE id = ?').bind(giftId),
    ]).catch(() => undefined);
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('idx_gifts_one_unopened_per_pair') || errorMessage.includes('UNIQUE constraint failed: gifts.sender_key, gifts.recipient_key')) {
      return Response.json({ error: '친구가 이전 선물을 아직 열지 않았어요. 선물을 연 뒤에 다시 보낼 수 있어요.' }, { status: 409 });
    }
    console.error('gifts.send_failed', error);
    return Response.json({ error: '말씀 선물을 보내지 못했습니다.' }, { status: 500 });
  }
}
import { env } from 'cloudflare:workers';
