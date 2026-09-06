import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ authenticate: vi.fn(), ensureSchema: vi.fn(), first: null as unknown, rows: [] as Record<string, unknown>[] }));
vi.mock('@/lib/supabase-auth', () => ({ authenticateRequest: mocks.authenticate }));
vi.mock('@/db', () => ({ ensureDbSchema: mocks.ensureSchema, getD1: () => ({ prepare: () => ({ bind: () => ({ first: async () => mocks.first, all: async () => ({ results: mocks.rows }) }) }) }) }));
import { GET } from './[projectId]/recordings/route';
const context = { params: Promise.resolve({ projectId: 'p1' }) };
describe('이어읽기 progress playback 녹음 목록', () => {
  beforeEach(() => { mocks.authenticate.mockReset().mockResolvedValue({ id: 'member-a' }); mocks.ensureSchema.mockReset().mockResolvedValue(undefined); mocks.first = { id: 'p1', status: 'completed', current_turn_index: null }; mocks.rows = []; });
  it('비참여자 프로젝트를 노출하지 않는다', async () => { mocks.first = null; expect((await GET(new Request('https://example.test'), context)).status).toBe(404); });
  it('turn과 passage 순서로 재생 목록을 반환한다', async () => {
    mocks.rows = [
      { id: 'r2', turn_index: 1, owner_nickname: 'B', book: '창세기', chapter: 1, verse: 2, verse_text: '2', bgm_id: 'none', duration_seconds: 2, passages_json: '[{"name":"창세기","chapter":1,"startVerse":2,"endVerse":2}]' },
      { id: 'r1', turn_index: 0, owner_nickname: 'A', book: '창세기', chapter: 1, verse: 1, verse_text: '1', bgm_id: 'none', duration_seconds: 2, passages_json: '[{"name":"창세기","chapter":1,"startVerse":1,"endVerse":1}]' },
    ];
    const payload = await (await GET(new Request('https://example.test'), context)).json() as { recordings: Array<{ id: string }> };
    expect(payload.recordings.map((item: { id: string }) => item.id)).toEqual(['r1', 'r2']);
  });

  it('IN_PROGRESS 프로젝트의 현재 turn 녹음도 participant에게 반환한다', async () => {
    mocks.first = { id: 'p1', status: 'in_progress', current_turn_index: 1 };
    mocks.rows = [
      { id: 'r1', turn_index: 0, owner_nickname: 'A', book: '창세기', chapter: 1, verse: 1, verse_text: '1', bgm_id: 'none', duration_seconds: 2, passages_json: '[{"name":"창세기","chapter":1,"startVerse":1,"endVerse":1}]' },
      { id: 'r2', turn_index: 1, owner_nickname: 'B', book: '창세기', chapter: 1, verse: 2, verse_text: '2', bgm_id: 'none', duration_seconds: 2, passages_json: '[{"name":"창세기","chapter":1,"startVerse":2,"endVerse":3}]' },
      { id: 'future', turn_index: 2, owner_nickname: 'A', book: '창세기', chapter: 1, verse: 4, verse_text: '4', bgm_id: 'none', duration_seconds: 2, passages_json: '[{"name":"창세기","chapter":1,"startVerse":4,"endVerse":4}]' },
    ];
    const payload = await (await GET(new Request('https://example.test'), context)).json() as { recordings: Array<{ id: string }> };
    expect(payload.recordings.map((item) => item.id)).toEqual(['r1', 'r2']);
  });
});
