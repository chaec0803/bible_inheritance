import { env } from 'cloudflare:workers';
import { ensureDbSchema, getD1 } from '@/db';
import { normalizeGiftDraftSettings } from '@/lib/gift-draft';
import { authenticateRequest } from '@/lib/supabase-auth';
import { presentDraft, type DraftItemRow } from '../shared';

async function ownedDraft(
  request: Request,
  id: string,
): Promise<
  | { ok: false; response: Response }
  | { ok: true; user: { id: string }; draft: Record<string, unknown> }
> {
  const user = await authenticateRequest(request);
  if (!user)
    return {
      ok: false,
      response: Response.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 },
      ),
    };
  await ensureDbSchema();
  const draft = await getD1()
    .prepare(
      `SELECT gift_drafts.*, user_profiles.nickname AS recipient_nickname
       FROM gift_drafts
       JOIN user_profiles ON user_profiles.owner_key = gift_drafts.recipient_key
       WHERE gift_drafts.id = ? AND gift_drafts.owner_key = ? AND gift_drafts.sent_gift_id IS NULL`,
    )
    .bind(id, user.id)
    .first<Record<string, unknown>>();
  if (!draft)
    return {
      ok: false,
      response: Response.json(
        { error: '초안을 찾을 수 없습니다.' },
        { status: 404 },
      ),
    };
  return { ok: true, user, draft };
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await ownedDraft(request, id);
  if (!result.ok) return result.response;
  const rows = await getD1()
    .prepare(
      'SELECT * FROM gift_draft_items WHERE draft_id = ? ORDER BY position',
    )
    .bind(id)
    .all<DraftItemRow>();
  return Response.json({ draft: presentDraft(result.draft, rows.results) });
}
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await ownedDraft(request, id);
  if (!result.ok) return result.response;
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const db = getD1();
  if (typeof body?.title === 'string') {
    const title = body.title.trim().slice(0, 100);
    if (!title)
      return Response.json(
        { error: '선물 이름을 입력해 주세요.' },
        { status: 400 },
      );
    await db
      .prepare(
        'UPDATE gift_drafts SET title = ?, updated_at = ? WHERE id = ? AND owner_key = ? AND sent_gift_id IS NULL',
      )
      .bind(title, Date.now(), id, result.user.id)
      .run();
    return Response.json({ title });
  }
  if (body?.action === 'reset-recordings') {
    const keys = await db
      .prepare(
        'SELECT object_key FROM gift_draft_items WHERE draft_id = ? AND object_key IS NOT NULL',
      )
      .bind(id)
      .all<{ object_key: string }>();
    if (keys.results.length)
      await env.FILES.delete(keys.results.map((row) => row.object_key));
    await db.batch([
      db
        .prepare(
          "UPDATE gift_draft_items SET source_recording_id = NULL, object_key = NULL, mime_type = '', size_bytes = 0, duration_seconds = 0 WHERE draft_id = ?",
        )
        .bind(id),
      db
        .prepare(
          'UPDATE gift_drafts SET updated_at = ? WHERE id = ? AND owner_key = ? AND sent_gift_id IS NULL',
        )
        .bind(Date.now(), id, result.user.id),
    ]);
    return Response.json({ reset: true });
  }
  const settings = normalizeGiftDraftSettings(body);
  await db
    .prepare(
      'UPDATE gift_drafts SET bgm_id = ?, bgm_volume = ?, updated_at = ? WHERE id = ? AND owner_key = ? AND sent_gift_id IS NULL',
    )
    .bind(settings.bgmId, settings.bgmVolume, Date.now(), id, result.user.id)
    .run();
  return Response.json(settings);
}
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await ownedDraft(request, id);
  if (!result.ok) return result.response;
  const keys = await getD1()
    .prepare(
      'SELECT object_key FROM gift_draft_items WHERE draft_id = ? AND object_key IS NOT NULL',
    )
    .bind(id)
    .all<{ object_key: string }>();
  if (keys.results.length)
    await env.FILES.delete(keys.results.map((row) => row.object_key));
  const db = getD1();
  await db.batch([
    db.prepare('DELETE FROM gift_draft_items WHERE draft_id = ?').bind(id),
    db
      .prepare('DELETE FROM gift_drafts WHERE id = ? AND owner_key = ?')
      .bind(id, result.user.id),
  ]);
  return Response.json({ deleted: true });
}
