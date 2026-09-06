import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  ensureSchema: vi.fn(),
  firstResults: [] as unknown[],
  statements: [] as Array<{ sql: string; values: unknown[]; operation: 'first' | 'batch' }>,
  batch: vi.fn(),
}));

vi.mock('@/lib/supabase-auth', () => ({ authenticateRequest: mocks.authenticate }));
vi.mock('@/db', () => ({
  ensureDbSchema: mocks.ensureSchema,
  getD1: () => ({
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => ({
        sql,
        values,
        first: async () => {
          mocks.statements.push({ sql, values, operation: 'first' });
          return mocks.firstResults.shift() ?? null;
        },
      }),
    }),
    batch: mocks.batch,
  }),
}));

import { POST as accept } from './[projectId]/accept/route';
import { POST as decline } from './[projectId]/decline/route';

const context = { params: Promise.resolve({ projectId: 'project-1' }) };
const request = new Request('https://example.test/api/relay-projects/project-1/action', { method: 'POST' });
const pending = { project_id: 'project-1', project_status: 'pending_invites', member_key: 'member-b', invite_status: 'pending' };

function batchSql() {
  return mocks.batch.mock.calls.flatMap((call) => call[0] as Array<{ sql: string }>).map((item) => item.sql).join('\n');
}

describe('이어읽기 초대 승낙·거절 API', () => {
  beforeEach(() => {
    mocks.authenticate.mockReset().mockResolvedValue({ id: 'member-b' });
    mocks.ensureSchema.mockReset().mockResolvedValue(undefined);
    mocks.firstResults = [];
    mocks.statements = [];
    mocks.batch.mockReset().mockResolvedValue([{ success: true }, { success: true }]);
  });

  it('비로그인 accept와 decline을 DB 접근 전에 차단한다', async () => {
    mocks.authenticate.mockResolvedValue(null);
    expect((await accept(request, context)).status).toBe(401);
    expect((await decline(request, context)).status).toBe(401);
    expect(mocks.batch).not.toHaveBeenCalled();
  });

  it('비참여자의 accept와 decline에 프로젝트 존재를 노출하지 않고 mutation하지 않는다', async () => {
    mocks.firstResults = [null, null];
    expect((await accept(request, context)).status).toBe(404);
    expect((await decline(request, context)).status).toBe(404);
    expect(mocks.batch).not.toHaveBeenCalled();
  });

  it('pending 참여자만 조건부로 승낙하고 모든 참여자가 승낙했을 때만 즉시 시작한다', async () => {
    mocks.firstResults = [pending, { ...pending, project_status: 'in_progress', invite_status: 'accepted', current_turn_index: 0, started_at: 20 }];
    const response = await accept(request, context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ projectStatus: 'in_progress', inviteStatus: 'accepted', currentTurnIndex: 0 });
    const sql = batchSql();
    expect(sql).toContain("invite_status = 'accepted'");
    expect(sql).toContain("invite_status != 'accepted'");
    expect(sql).toContain("status = 'in_progress'");
    expect(sql).toContain('current_turn_index = 0');
    expect(sql).toContain('started_at = ?');
  });

  it('다른 pending 참여자가 남으면 프로젝트 시작 조건이 성립하지 않는다', async () => {
    mocks.firstResults = [pending, { ...pending, project_status: 'pending_invites', invite_status: 'accepted', current_turn_index: null, started_at: null }];
    const response = await accept(request, context);
    expect(await response.json()).toMatchObject({ projectStatus: 'pending_invites', currentTurnIndex: null });
    expect(batchSql()).toContain('NOT EXISTS');
  });

  it('거절과 프로젝트 취소를 같은 batch에서 조건부 처리한다', async () => {
    mocks.firstResults = [pending, { ...pending, project_status: 'cancelled', invite_status: 'declined', current_turn_index: null, cancelled_at: 30 }];
    const response = await decline(request, context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ projectStatus: 'cancelled', inviteStatus: 'declined' });
    const sql = batchSql();
    expect(sql).toContain("invite_status = 'declined'");
    expect(sql).toContain("status = 'cancelled'");
    expect(sql).toContain("cancel_reason = 'PARTICIPANT_DECLINED'");
    expect(sql).toContain('cancelled_at = ?');
  });

  it.each([
    ['accepted', 'pending_invites'],
    ['declined', 'pending_invites'],
    ['pending', 'cancelled'],
    ['pending', 'in_progress'],
  ])('invite=%s project=%s이면 accept와 decline 모두 mutation하지 않는다', async (inviteStatus, projectStatus) => {
    const invalid = { ...pending, invite_status: inviteStatus, project_status: projectStatus };
    mocks.firstResults = [invalid, invalid];
    expect((await accept(request, context)).status).toBe(409);
    expect((await decline(request, context)).status).toBe(409);
    expect(mocks.batch).not.toHaveBeenCalled();
  });

  it('동시 승낙은 pending 개수의 사전 판단 없이 DB의 전체 accepted 조건으로 한 번만 시작한다', async () => {
    mocks.firstResults = [pending, { ...pending, project_status: 'in_progress', invite_status: 'accepted', current_turn_index: 0, started_at: 40 }];
    await accept(request, context);
    const sql = batchSql();
    expect(sql).not.toContain('COUNT(');
    expect(sql).toContain("relay_projects.status = 'pending_invites'");
    expect(sql).toContain('NOT EXISTS');
  });

  it('accept/decline 경쟁은 participant와 project 모두 pending일 때만 한 전이가 유효하다', async () => {
    mocks.firstResults = [pending, { ...pending, project_status: 'cancelled', invite_status: 'declined', cancelled_at: 50 }];
    await decline(request, context);
    const sql = batchSql();
    expect(sql).toContain("relay_participants.invite_status = 'pending'");
    expect(sql).toContain("relay_projects.status = 'pending_invites'");
    expect(sql).toContain('EXISTS');
  });
});
