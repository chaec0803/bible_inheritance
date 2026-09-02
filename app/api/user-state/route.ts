import { eq } from 'drizzle-orm';
import { ensureDbSchema, getDb } from '@/db';
import { userStates } from '@/db/schema';
import { authenticateRequest } from '@/lib/supabase-auth';

const MAX_STATE_BYTES = 256 * 1024;

export async function GET(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  await ensureDbSchema();
  const [row] = await getDb().select().from(userStates).where(eq(userStates.ownerKey, user.id)).limit(1);
  if (!row) return Response.json({ state: null });
  try {
    return Response.json({ state: JSON.parse(row.stateJson), updatedAt: row.updatedAt });
  } catch {
    return Response.json({ state: null });
  }
}

export async function PUT(request: Request) {
  const user = await authenticateRequest(request);
  if (!user) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const state = (await request.json().catch(() => null)) as unknown;
  if (!state || typeof state !== 'object' || Array.isArray(state)) return Response.json({ error: '저장할 상태가 올바르지 않습니다.' }, { status: 400 });
  const stateJson = JSON.stringify(state);
  if (new TextEncoder().encode(stateJson).byteLength > MAX_STATE_BYTES) return Response.json({ error: '저장할 상태가 너무 큽니다.' }, { status: 413 });
  await ensureDbSchema();
  const updatedAt = Date.now();
  await getDb().insert(userStates).values({ ownerKey: user.id, stateJson, updatedAt }).onConflictDoUpdate({
    target: userStates.ownerKey,
    set: { stateJson, updatedAt },
  });
  return Response.json({ updatedAt });
}
