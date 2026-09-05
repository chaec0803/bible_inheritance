import { env } from 'cloudflare:workers';
import { ensureDbSchema, getD1 } from '@/db';
import { ensureUserProfile } from '@/lib/friend-server';
import { canonicalFriendPair } from '@/lib/friend-policy';
import { isGiftDraftSendable } from '@/lib/gift-draft';
import { authenticateRequest } from '@/lib/supabase-auth';
import type { DraftItemRow } from '../../shared';
import { decodeGiftLetterAudio, normalizeGiftLetter } from '@/lib/gift-letter';

function draftRecipients(draft: Record<string, unknown>) {
  try {
    const parsed = JSON.parse(typeof draft.recipient_keys_json === 'string' ? draft.recipient_keys_json : '[]');
    if (Array.isArray(parsed)) {
      const ids = [...new Set(parsed.filter((id): id is string => typeof id === 'string' && Boolean(id)))];
      if (ids.length) return ids;
    }
  } catch { /* 이전 초안은 대표 수신자로 복구합니다. */ }
  return [String(draft.recipient_key)];
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(request); if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { letter?: unknown };
  const letter = normalizeGiftLetter(body.letter);
  if (!letter) return Response.json({ error: '편지 내용을 다시 확인해 주세요.' }, { status: 400 });
  const { id } = await params; await ensureDbSchema(); await ensureUserProfile(user); const db = getD1();
  const draft = await db.prepare('SELECT * FROM gift_drafts WHERE id = ? AND owner_key = ? AND sent_gift_id IS NULL').bind(id, user.id).first<Record<string, unknown>>();
  if (!draft) return Response.json({ error: '초안을 찾을 수 없습니다.' }, { status: 404 });
  const recipients = draftRecipients(draft);
  if (!recipients.length || recipients.length > 30) return Response.json({ error: '받을 친구는 최대 30명까지 선택할 수 있어요.' }, { status: 400 });
  const items = (await db.prepare('SELECT * FROM gift_draft_items WHERE draft_id = ? ORDER BY position').bind(id).all<DraftItemRow>()).results;
  if (!isGiftDraftSendable(items.map((item) => ({ objectKey: item.object_key, sourceRecordingId: item.source_recording_id })))) return Response.json({ error: '모든 절을 녹음한 뒤 선물할 수 있어요.' }, { status: 409 });
  for (const recipient of recipients) {
    const [a, b] = canonicalFriendPair(user.id, recipient);
    const friendship = await db.prepare("SELECT id FROM friendships WHERE user_a_key = ? AND user_b_key = ? AND status = 'accepted'").bind(a, b).first();
    if (!friendship) return Response.json({ error: '선택한 모든 사람이 현재 친구인지 확인해 주세요.' }, { status: 403 });
    const block = await db.prepare('SELECT id FROM friend_blocks WHERE (blocker_key = ? AND blocked_key = ?) OR (blocker_key = ? AND blocked_key = ?) LIMIT 1').bind(user.id, recipient, recipient, user.id).first<{ id: string }>();
    if (block) return Response.json({ error: '차단 관계인 친구가 포함되어 있어 선물을 보낼 수 없습니다.' }, { status: 403 });
    const unopened = await db.prepare('SELECT id FROM gifts WHERE sender_key = ? AND recipient_key = ? AND opened_at IS NULL LIMIT 1').bind(user.id, recipient).first();
    if (unopened) return Response.json({ error: '선택한 친구 중 이전 선물을 아직 열지 않았어요. 선물을 연 뒤에 다시 보낼 수 있어요.' }, { status: 409 });
  }

  const giftIds = recipients.map(() => crypto.randomUUID());
  const total = items.reduce((sum, item) => sum + item.size_bytes, 0); const now = Date.now();
  const voiceBytes = letter.type === 'voice' ? decodeGiftLetterAudio(letter) : null;
  if (letter.type === 'voice' && !voiceBytes) return Response.json({ error: '음성 편지 파일을 다시 확인해 주세요.' }, { status: 400 });
  const copiedKeys: string[] = [];
  try {
    for (const giftId of giftIds) {
      if (letter.type === 'voice') {
        const key = `${user.id}/gift-letters/${giftId}`;
        await env.FILES.put(key, voiceBytes!, { httpMetadata: { contentType: letter.mimeType } });
        copiedKeys.push(key);
      }
      for (const item of items) {
        if (!item.object_key) continue;
        const source = await env.FILES.get(item.object_key);
        if (!source) throw new Error('draft recording object missing');
        const key = `${user.id}/gifts/${giftId}/${item.position}`;
        await env.FILES.put(key, await source.arrayBuffer(), { httpMetadata: { contentType: item.mime_type } });
        copiedKeys.push(key);
      }
    }

    const statements = recipients.flatMap((recipient, giftIndex) => {
      const giftId = giftIds[giftIndex];
      const letterObjectKey = letter.type === 'voice' ? `${user.id}/gift-letters/${giftId}` : null;
      return [
        db.prepare('INSERT INTO gifts (id, sender_key, recipient_key, title, bgm_id, bgm_volume, recording_count, total_size_bytes, created_at, letter_type, letter_text, letter_object_key, letter_mime_type, letter_size_bytes, letter_duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(giftId, user.id, recipient, draft.title, draft.bgm_id, draft.bgm_volume, items.length, total, now, letter.type === 'none' ? null : letter.type, letter.type === 'text' ? letter.text : null, letterObjectKey, letter.type === 'voice' ? letter.mimeType : null, letter.type === 'voice' ? letter.sizeBytes : null, letter.type === 'voice' ? letter.durationSeconds : null),
        ...items.map((item) => db.prepare('INSERT INTO gift_recordings (id, gift_id, position, book, chapter, verse, verse_text, source_recording_id, object_key, mime_type, size_bytes, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), giftId, item.position, item.book, item.chapter, item.verse, item.verse_text, item.source_recording_id, item.object_key ? `${user.id}/gifts/${giftId}/${item.position}` : null, item.mime_type, item.size_bytes, item.duration_seconds)),
      ];
    });
    statements.push(db.prepare('DELETE FROM gift_draft_items WHERE draft_id = ?').bind(id));
    statements.push(db.prepare('UPDATE gift_drafts SET sent_gift_id = ?, updated_at = ? WHERE id = ? AND owner_key = ?').bind(giftIds[0], now, id, user.id));
    for (let offset = 0; offset < statements.length; offset += 500) await db.batch(statements.slice(offset, offset + 500));
    const originalKeys = items.flatMap((item) => item.object_key ? [item.object_key] : []);
    if (originalKeys.length) await env.FILES.delete(originalKeys).catch(() => undefined);
    const gifts = giftIds.map((giftId, index) => ({ id: giftId, recipientUserId: recipients[index], title: draft.title, recordingCount: items.length }));
    return Response.json({ gift: gifts[0], gifts }, { status: 201 });
  } catch (error) {
    if (copiedKeys.length) await env.FILES.delete(copiedKeys).catch(() => undefined);
    console.error('gift_drafts.send_failed', error);
    return Response.json({ error: '말씀 선물을 보내지 못했습니다.' }, { status: 500 });
  }
}
