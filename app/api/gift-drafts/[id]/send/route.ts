import { ensureDbSchema, getD1 } from '@/db';
import { ensureUserProfile } from '@/lib/friend-server';
import { canonicalFriendPair } from '@/lib/friend-policy';
import { isGiftDraftSendable } from '@/lib/gift-draft';
import { authenticateRequest } from '@/lib/supabase-auth';
import type { DraftItemRow } from '../../shared';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(request); if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const { id } = await params; await ensureDbSchema(); await ensureUserProfile(user); const db = getD1();
  const draft = await db.prepare('SELECT * FROM gift_drafts WHERE id = ? AND owner_key = ? AND sent_gift_id IS NULL').bind(id, user.id).first<Record<string, unknown>>();
  if (!draft) return Response.json({ error: '초안을 찾을 수 없습니다.' }, { status: 404 });
  const items = (await db.prepare('SELECT * FROM gift_draft_items WHERE draft_id = ? ORDER BY position').bind(id).all<DraftItemRow>()).results;
  if (!isGiftDraftSendable(items.map((item) => ({ objectKey: item.object_key, sourceRecordingId: item.source_recording_id })))) return Response.json({ error: '모든 절을 녹음한 뒤 선물할 수 있어요.' }, { status: 409 });
  const recipient = String(draft.recipient_key); const [a, b] = canonicalFriendPair(user.id, recipient); const friendship = await db.prepare("SELECT id FROM friendships WHERE user_a_key = ? AND user_b_key = ? AND status = 'accepted'").bind(a, b).first();
  if (!friendship) return Response.json({ error: '친구 관계를 확인해 주세요.' }, { status: 403 });
  const block = await db.prepare(`SELECT id FROM friend_blocks
    WHERE (blocker_key = ? AND blocked_key = ?) OR (blocker_key = ? AND blocked_key = ?)
    LIMIT 1`)
    .bind(user.id, recipient, recipient, user.id)
    .first<{ id: string }>();
  if (block) return Response.json({ error: '차단한 사용자에게는 말씀 선물을 보낼 수 없습니다.' }, { status: 403 });
  const unopened = await db.prepare('SELECT id FROM gifts WHERE sender_key = ? AND recipient_key = ? AND opened_at IS NULL LIMIT 1').bind(user.id, recipient).first();
  if (unopened) return Response.json({ error: '친구가 이전 선물을 아직 열지 않았어요. 선물을 연 뒤에 다시 보낼 수 있어요.' }, { status: 409 });
  const giftId = crypto.randomUUID(); const total = items.reduce((sum, item) => sum + item.size_bytes, 0); const now = Date.now();
  const statements = [db.prepare(`INSERT INTO gifts (id, sender_key, recipient_key, title, bgm_id, bgm_volume, recording_count, total_size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(giftId, user.id, recipient, draft.title, draft.bgm_id, draft.bgm_volume, items.length, total, now), ...items.map((item) => db.prepare(`INSERT INTO gift_recordings (id, gift_id, position, book, chapter, verse, verse_text, source_recording_id, object_key, mime_type, size_bytes, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), giftId, item.position, item.book, item.chapter, item.verse, item.verse_text, item.source_recording_id, item.object_key, item.mime_type, item.size_bytes, item.duration_seconds)), db.prepare('DELETE FROM gift_draft_items WHERE draft_id = ?').bind(id), db.prepare('UPDATE gift_drafts SET sent_gift_id = ?, updated_at = ? WHERE id = ? AND owner_key = ?').bind(giftId, now, id, user.id)];
  await db.batch(statements); return Response.json({ gift: { id: giftId, title: draft.title, recordingCount: items.length } }, { status: 201 });
}
