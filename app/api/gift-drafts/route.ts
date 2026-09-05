import { bibleBooks } from '@/app/bible-metadata';
import { ensureDbSchema, getD1 } from '@/db';
import { ensureUserProfile } from '@/lib/friend-server';
import { canonicalFriendPair } from '@/lib/friend-policy';
import { buildGiftDraftPlan, normalizeGiftDraftScope } from '@/lib/gift-draft';
import { authenticateRequest } from '@/lib/supabase-auth';
import { presentDraft, type DraftItemRow } from './shared';

export async function GET(request: Request) {
  const user = await authenticateRequest(request); if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  await ensureDbSchema(); await ensureUserProfile(user); const db = getD1();
  const drafts = await db.prepare(`SELECT gift_drafts.*, user_profiles.nickname AS recipient_nickname FROM gift_drafts JOIN user_profiles ON user_profiles.owner_key = gift_drafts.recipient_key WHERE gift_drafts.owner_key = ? AND gift_drafts.sent_gift_id IS NULL ORDER BY gift_drafts.updated_at DESC`).bind(user.id).all<Record<string, unknown>>();
  const items = await db.prepare(`SELECT gift_draft_items.* FROM gift_draft_items JOIN gift_drafts ON gift_drafts.id = gift_draft_items.draft_id WHERE gift_drafts.owner_key = ? AND gift_drafts.sent_gift_id IS NULL ORDER BY gift_draft_items.draft_id, gift_draft_items.position`).bind(user.id).all<DraftItemRow>();
  return Response.json({ drafts: drafts.results.map((draft) => presentDraft(draft, items.results.filter((item) => item.draft_id === draft.id))) });
}

export async function POST(request: Request) {
  const user = await authenticateRequest(request); if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null; const recipient = typeof body?.recipientUserId === 'string' ? body.recipientUserId : '';
  const scope = normalizeGiftDraftScope(body?.scope); if (!recipient || !scope) return Response.json({ error: '선물 정보를 다시 확인해 주세요.' }, { status: 400 });
  if (recipient === user.id) return Response.json({ error: '나 자신에게는 선물할 수 없습니다.' }, { status: 400 });
  await ensureDbSchema(); await ensureUserProfile(user); const db = getD1(); const [a, b] = canonicalFriendPair(user.id, recipient);
  const friendship = await db.prepare("SELECT id FROM friendships WHERE user_a_key = ? AND user_b_key = ? AND status = 'accepted'").bind(a, b).first();
  if (!friendship) return Response.json({ error: '친구에게만 말씀을 선물할 수 있습니다.' }, { status: 403 });

  const block = await db.prepare(`SELECT id FROM friend_blocks
    WHERE (blocker_key = ? AND blocked_key = ?) OR (blocker_key = ? AND blocked_key = ?)
    LIMIT 1`)
    .bind(user.id, recipient, recipient, user.id)
    .first<{ id: string }>();
  if (block) return Response.json({ error: '차단한 사용자에게는 말씀 선물을 보낼 수 없습니다.' }, { status: 403 });
  let journey;
  if (scope.kind === 'journey') {
    const rows = await db.prepare(`SELECT id, book, chapter, verse, verse_text, mime_type, size_bytes, duration_seconds FROM recordings WHERE owner_key = ? AND project_id = ? ORDER BY chapter, verse`).bind(user.id, scope.projectId).all<Record<string, unknown>>();
    journey = { projectId: scope.projectId, title: typeof body?.journeyTitle === 'string' ? body.journeyTitle.slice(0, 100) : '말씀 여정', recordings: rows.results.map((row) => ({ id: String(row.id), book: String(row.book), chapter: Number(row.chapter), verse: Number(row.verse), verseText: String(row.verse_text), mimeType: String(row.mime_type), sizeBytes: Number(row.size_bytes), durationSeconds: Number(row.duration_seconds) })) };
  }
  const plan = buildGiftDraftPlan({ scope, books: bibleBooks, journey }); if (!plan.ok) return Response.json({ error: plan.reason }, { status: 409 });
  const requestedTitle = typeof body?.title === 'string' ? body.title.trim().slice(0, 100) : '';
  const title = requestedTitle || plan.title;
  const id = crypto.randomUUID(); const now = Date.now();
  const statements = [db.prepare(`INSERT INTO gift_drafts (id, owner_key, recipient_key, title, bgm_id, bgm_volume, created_at, updated_at, sent_gift_id) VALUES (?, ?, ?, ?, 'none', 12, ?, ?, NULL)`).bind(id, user.id, recipient, title, now, now), ...plan.items.map((item) => db.prepare(`INSERT INTO gift_draft_items (id, draft_id, position, book, chapter, verse, verse_text, source_recording_id, object_key, mime_type, size_bytes, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`).bind(crypto.randomUUID(), id, item.position, item.book, item.chapter, item.verse, item.verseText, item.sourceRecordingId, item.mimeType, item.sizeBytes, item.durationSeconds))];
  await db.batch(statements); return Response.json({ draft: { id, recipientUserId: recipient, title, total: plan.items.length, recorded: plan.items.filter((item) => item.sourceRecordingId).length, items: plan.items.map((item) => ({ ...item, recorded: Boolean(item.sourceRecordingId) })) } }, { status: 201 });
}
