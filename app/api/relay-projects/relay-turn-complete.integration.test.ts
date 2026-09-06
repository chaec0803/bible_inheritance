import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authenticate: vi.fn(), ensureSchema: vi.fn(), first: [] as unknown[], all: [] as unknown[][], batch: vi.fn(), writes: [] as string[] }));
vi.mock('@/lib/supabase-auth', () => ({ authenticateRequest: mocks.authenticate }));
vi.mock('@/db', () => ({ ensureDbSchema: mocks.ensureSchema, getD1: () => ({
  prepare: (sql: string) => ({ bind: (...values: unknown[]) => ({ sql, values,
    first: async () => mocks.first.shift() ?? null,
    all: async () => ({ results: mocks.all.shift() ?? [] }),
  }) }),
  batch: mocks.batch,
}) }));

import { POST } from './[projectId]/turns/[turnIndex]/complete/route';

const request = new Request('https://example.test/api/relay-projects/p1/turns/0/complete', { method: 'POST' });
const context = { params: Promise.resolve({ projectId: 'p1', turnIndex: '0' }) };
const active = { project_id: 'p1', project_status: 'in_progress', current_turn_index: 0, project_completed_at: null, turn_id: 't0', turn_index: 0, member_key: 'a', turn_completed_at: null, passages_json: '[{"code":"창","name":"창세기","chapter":1,"startVerse":1,"endVerse":2}]', last_turn_index: 1 };
const recordings = [1, 2].map((verse) => ({ owner_key: 'a', project_id: 'relay:p1:turn:0', book: '창세기', chapter: 1, verse }));
function sql() { return mocks.batch.mock.calls.flatMap((c) => c[0] as Array<{ sql: string }>).map((s) => s.sql).join('\n'); }
async function payload(response: Response) { return response.json() as Promise<Record<string, unknown>>; }

describe('이어읽기 turn 완료 API', () => {
  beforeEach(() => { mocks.authenticate.mockReset().mockResolvedValue({ id: 'a' }); mocks.ensureSchema.mockReset().mockResolvedValue(undefined); mocks.first = []; mocks.all = []; mocks.batch.mockReset().mockResolvedValue([]); });

  it('비로그인 요청을 차단한다', async () => { mocks.authenticate.mockResolvedValue(null); expect((await POST(request, context)).status).toBe(401); expect(mocks.batch).not.toHaveBeenCalled(); });
  it('비참여자에게 프로젝트 존재를 노출하지 않는다', async () => { mocks.first = [null]; const r = await POST(request, context); expect(r.status).toBe(404); expect((await payload(r)).code).toBe('NOT_PARTICIPANT'); expect(mocks.batch).not.toHaveBeenCalled(); });

  it.each([
    ['pending_invites', 'PROJECT_NOT_IN_PROGRESS'],
    ['cancelled', 'PROJECT_CANCELLED'],
    ['completed', 'PROJECT_COMPLETED'],
  ])('%s 프로젝트를 완료할 수 없다', async (status, code) => {
    mocks.first = [{ ...active, project_status: status }];
    const r = await POST(request, context); expect(r.status).toBe(409); expect((await payload(r)).code).toBe(code); expect(mocks.batch).not.toHaveBeenCalled();
  });

  it('과거나 미래 turn 요청을 차단한다', async () => { mocks.first = [{ ...active, current_turn_index: 1 }]; const r = await POST(request, context); expect((await payload(r)).code).toBe('NOT_CURRENT_TURN'); expect(mocks.batch).not.toHaveBeenCalled(); });
  it('creator라도 다른 담당자의 turn을 완료할 수 없다', async () => { mocks.first = [{ ...active, member_key: 'b' }]; const r = await POST(request, context); expect((await payload(r)).code).toBe('NOT_TURN_OWNER'); expect(mocks.batch).not.toHaveBeenCalled(); });
  it('배정 녹음이 일부 누락되면 상태를 변경하지 않는다', async () => { mocks.first = [active]; mocks.all = [[recordings[0]]]; const r = await POST(request, context); expect((await payload(r)).code).toBe('RECORDINGS_INCOMPLETE'); expect(mocks.batch).not.toHaveBeenCalled(); });

  it('모든 녹음이 있으면 turn 완료와 다음 index 이동을 한 batch에서 처리한다', async () => {
    mocks.first = [active, { ...active, current_turn_index: 1, turn_completed_at: 10 }]; mocks.all = [recordings];
    const r = await POST(request, context); expect(r.status).toBe(200); expect(await r.json()).toMatchObject({ completed: true, projectStatus: 'in_progress', currentTurnIndex: 1 });
    expect(mocks.batch).toHaveBeenCalledTimes(1); expect(sql()).toContain('completed_at = ?'); expect(sql()).toContain('current_turn_index + 1'); expect(sql()).toContain("status = 'in_progress'"); expect(sql()).toContain('relay_turns.completed_at IS NULL');
  });

  it('마지막 turn은 index를 넘기지 않고 프로젝트를 완료한다', async () => {
    const last = { ...active, last_turn_index: 0 }; mocks.first = [last, { ...last, project_status: 'completed', project_completed_at: 20, turn_completed_at: 20 }]; mocks.all = [recordings];
    const r = await POST(request, context); expect(await r.json()).toMatchObject({ projectStatus: 'completed', currentTurnIndex: 0 });
    expect(sql()).toContain("THEN 'completed'"); expect(sql()).toContain('THEN current_turn_index ELSE current_turn_index + 1');
  });

  it('이미 정상 완료된 동일 turn retry는 mutation 없이 현재 상태를 반환한다', async () => {
    mocks.first = [{ ...active, current_turn_index: 1, turn_completed_at: 10 }];
    const r = await POST(request, context); expect(r.status).toBe(200); expect(await r.json()).toMatchObject({ completed: true, idempotent: true, currentTurnIndex: 1 }); expect(mocks.batch).not.toHaveBeenCalled();
  });
});
