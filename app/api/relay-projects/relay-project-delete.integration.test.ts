import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authenticate: vi.fn(), ensureSchema: vi.fn(), first: vi.fn(), all: vi.fn(), batch: vi.fn(), r2Delete: vi.fn(), statements: [] as Array<{ sql: string; values: unknown[] }> }));
vi.mock('cloudflare:workers', () => ({ env: { FILES: { delete: mocks.r2Delete } } }));
vi.mock('@/lib/supabase-auth', () => ({ authenticateRequest: mocks.authenticate }));
vi.mock('@/db', () => ({ ensureDbSchema: mocks.ensureSchema, getD1: () => ({ prepare: (sql: string) => ({ bind: (...values: unknown[]) => { const statement = { sql, values }; mocks.statements.push(statement); return { ...statement, first: mocks.first, all: mocks.all }; } }), batch: mocks.batch }) }));

import { DELETE } from './[projectId]/route';

const request = new Request('https://example.test/api/relay-projects/project-1', { method: 'DELETE' });
const context = { params: Promise.resolve({ projectId: 'project-1' }) };

describe('이어읽기 프로젝트 삭제', () => {
  beforeEach(() => { mocks.authenticate.mockReset().mockResolvedValue({ id: 'creator' }); mocks.ensureSchema.mockReset().mockResolvedValue(undefined); mocks.first.mockReset().mockResolvedValue({ id: 'project-1' }); mocks.all.mockReset().mockResolvedValue({ results: [{ id: 'r1', object_key: 'creator/relay-audio' }] }); mocks.batch.mockReset().mockResolvedValue([]); mocks.r2Delete.mockReset().mockResolvedValue(undefined); mocks.statements = []; });

  it('비로그인 사용자를 차단한다', async () => { mocks.authenticate.mockResolvedValue(null); expect((await DELETE(request, context)).status).toBe(401); });

  it('participant여도 creator가 아니면 존재를 노출하지 않고 삭제하지 않는다', async () => {
    mocks.first.mockResolvedValue(null);
    expect((await DELETE(request, context)).status).toBe(404);
    expect(mocks.batch).not.toHaveBeenCalled();
    expect(mocks.r2Delete).not.toHaveBeenCalled();
  });

  it.each(['pending_invites', 'in_progress', 'completed', 'cancelled'])('creator는 %s 프로젝트와 종속 row·음성을 삭제하고 그룹은 유지한다', async () => {
    const response = await DELETE(request, context);
    expect(response.status).toBe(200);
    const sql = mocks.statements.map((item) => item.sql).join('\n');
    expect(sql).toContain('DELETE FROM recordings');
    expect(sql).toContain('DELETE FROM relay_turns');
    expect(sql).toContain('DELETE FROM relay_participants');
    expect(sql).toContain('DELETE FROM relay_projects');
    expect(sql).not.toContain('DELETE FROM friend_groups');
    expect(mocks.r2Delete).toHaveBeenCalledWith(['creator/relay-audio']);
  });

  it('relay context만 삭제해 일반 녹음에는 영향주지 않는다', async () => {
    await DELETE(request, context);
    const recordingDelete = mocks.statements.find((item) => item.sql.includes('DELETE FROM recordings'))!;
    expect(recordingDelete.values).toEqual(['relay:project-1:turn:%']);
  });
});
