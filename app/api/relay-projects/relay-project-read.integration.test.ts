import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  ensureSchema: vi.fn(),
  firstResults: [] as unknown[],
  allResults: [] as unknown[][],
  statements: [] as Array<{ sql: string; values: unknown[] }>,
}));

vi.mock('@/lib/supabase-auth', () => ({ authenticateRequest: mocks.authenticate }));
vi.mock('cloudflare:workers', () => ({ env: { FILES: { delete: vi.fn() } } }));
vi.mock('@/db', () => ({
  ensureDbSchema: mocks.ensureSchema,
  getD1: () => ({
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => ({
        first: async () => { mocks.statements.push({ sql, values }); return mocks.firstResults.shift() ?? null; },
        all: async () => { mocks.statements.push({ sql, values }); return { results: mocks.allResults.shift() ?? [] }; },
      }),
    }),
  }),
}));

import { GET as getProject } from './[projectId]/route';
import { GET as getInvites } from '../relay-invites/route';

const projectRequest = new Request('https://example.test/api/relay-projects/project-1');
const context = { params: Promise.resolve({ projectId: 'project-1' }) };

describe('이어읽기 프로젝트 조회 권한', () => {
  beforeEach(() => {
    mocks.authenticate.mockReset().mockResolvedValue({ id: 'member-b' });
    mocks.ensureSchema.mockReset().mockResolvedValue(undefined);
    mocks.firstResults = [];
    mocks.allResults = [];
    mocks.statements = [];
  });

  it('로그인하지 않은 사용자의 프로젝트와 초대 조회를 거부한다', async () => {
    mocks.authenticate.mockResolvedValue(null);
    expect((await getProject(projectRequest, context)).status).toBe(401);
    expect((await getInvites(new Request('https://example.test/api/relay-invites'))).status).toBe(401);
  });

  it('participant가 아닌 사용자에게 프로젝트 존재를 노출하지 않는다', async () => {
    mocks.firstResults = [null];
    const response = await getProject(projectRequest, context);
    expect(response.status).toBe(404);
    expect((await response.json() as { code: string }).code).toBe('NOT_PARTICIPANT');
    expect(mocks.statements[0].sql).toContain('relay_participants.member_key = ?');
    expect(mocks.statements[0].values).toContain('member-b');
  });

  it('participant에게 필요한 프로젝트·참여자·turn 정보와 녹음 가능 여부만 반환한다', async () => {
    mocks.firstResults = [{
      id: 'project-1', creator_key: 'member-a', group_id: 'group-1', title: '함께 읽는 시편',
      scope_json: '{"start":{"bookCode":"시","chapter":23,"verse":1},"end":{"bookCode":"시","chapter":23,"verse":6}}',
      bgm_id: 'aeternum', bgm_volume: 5, rotation: 1, current_turn_index: 1,
      status: 'in_progress', invite_message: '함께 읽어요', created_at: 1, started_at: 2,
      completed_at: null, cancelled_at: null, cancel_reason: null, creator_nickname: '가은',
      group_name: '우리 가족',
      my_position: 1, my_invite_status: 'accepted',
    }];
    mocks.allResults = [[
      { member_key: 'member-a', position: 0, invite_status: 'accepted', responded_at: 1, nickname: '가은' },
      { member_key: 'member-b', position: 1, invite_status: 'accepted', responded_at: 2, nickname: '채린' },
    ], [
      { id: 'turn-0', turn_index: 0, member_key: 'member-a', passages_json: '[]', arrival_seen_at: 2, completed_at: 3 },
      { id: 'turn-1', turn_index: 1, member_key: 'member-b', passages_json: '[{"code":"시","name":"시편","chapter":23,"startVerse":4,"endVerse":6}]', arrival_seen_at: null, completed_at: null },
    ], [
      { owner_key: 'member-b', project_id: 'relay:project-1:turn:1', book: '시편', chapter: 23, verse: 4 },
    ]];
    const response = await getProject(projectRequest, context);
    const payload = await response.json() as { project: Record<string, unknown> };
    expect(response.status).toBe(200);
    expect(payload.project).toMatchObject({ id: 'project-1', groupName: '우리 가족', currentTurnIndex: 1, canRecord: true, isCreator: false, myPosition: 1, currentTurnRecording: { complete: false, requiredCount: 3, recordedCount: 1 } });
    expect(JSON.stringify(payload)).not.toContain('creator_key');
  });

  it('내 pending 초대만 반환하고 별도 알림 테이블을 조회하지 않는다', async () => {
    mocks.allResults = [[{
      id: 'project-1', title: '함께 읽는 시편', status: 'pending_invites', invite_message: '함께 읽어요',
      scope_json: '{}', rotation: 2, created_at: 1, creator_nickname: '가은', group_name: '우리 가족',
      my_position: 1,
    }]];
    const response = await getInvites(new Request('https://example.test/api/relay-invites'));
    const payload = await response.json() as { invites: Array<{ id: string }> };
    expect(response.status).toBe(200);
    expect(payload.invites).toHaveLength(1);
    expect(mocks.statements[0].sql).toContain("invite_status = 'pending'");
    expect(mocks.statements[0].sql).not.toContain('notifications');
  });
});
