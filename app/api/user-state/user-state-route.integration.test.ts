import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  ensureSchema: vi.fn(),
  selected: [] as Array<{ stateJson: string; updatedAt: number }>,
  selectedRecordings: [] as Array<Record<string, unknown>>,
  selectCalls: 0,
  inserted: [] as Array<Record<string, unknown>>,
  upserted: [] as Array<Record<string, unknown>>,
  updated: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/lib/supabase-auth', () => ({ authenticateRequest: mocks.authenticate }));
vi.mock('@/db', () => ({
  ensureDbSchema: mocks.ensureSchema,
  getDb: () => ({
    select: () => {
      const call = mocks.selectCalls++;
      return { from: () => ({ where: () => call === 0
        ? { limit: async () => mocks.selected }
        : Promise.resolve(mocks.selectedRecordings) }) };
    },
    insert: () => ({ values: (value: Record<string, unknown>) => ({
      onConflictDoUpdate: async (upsert: Record<string, unknown>) => {
        mocks.inserted.push(value);
        mocks.upserted.push(upsert);
      },
    }) }),
    update: () => ({ set: (value: Record<string, unknown>) => ({ where: async () => { mocks.updated.push(value); } }) }),
  }),
}));

import { GET, PUT } from './route';

describe('말씀 여정·진행도·보상 상태 API 통합 회귀', () => {
  beforeEach(() => {
    mocks.authenticate.mockReset().mockResolvedValue({ id: 'user-1' });
    mocks.ensureSchema.mockReset().mockResolvedValue(undefined);
    mocks.selected = [];
    mocks.selectedRecordings = [];
    mocks.selectCalls = 0;
    mocks.inserted = [];
    mocks.upserted = [];
    mocks.updated = [];
  });

  it('활성 여정, 현재 여정, 카드 보상을 사용자 계정에 한 묶음으로 저장한다', async () => {
    const state = {
      activeProjects: [{ id: 'theme-믿음-7', readingDay: 2 }],
      activeProjectId: 'theme-믿음-7',
      wordCardAwards: [{ key: 'theme-믿음-7:day-1', cardId: 'david', collected: true }],
    };
    const response = await PUT(new Request('https://example.test/api/user-state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    }));
    expect(response.status).toBe(200);
    expect(mocks.inserted).toHaveLength(1);
    expect(mocks.inserted[0]).toMatchObject({ ownerKey: 'user-1' });
    expect(JSON.parse(mocks.inserted[0].stateJson as string)).toEqual(state);
    expect(mocks.upserted).toHaveLength(1);
  });

  it('저장된 여정 상태를 다시 읽어 진행도와 보상을 복원한다', async () => {
    const state = { activeProjects: [{ id: 'theme-소망-7', readingDay: 3 }], activeProjectId: 'theme-소망-7', wordCardAwards: [] };
    mocks.selected = [{ stateJson: JSON.stringify(state), updatedAt: 1234 }];
    const response = await GET(new Request('https://example.test/api/user-state'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ state, updatedAt: 1234 });
  });

  it('자정 전에 끝낸 일차가 오늘로 잘못 찍혔으면 DB 녹음 시간으로 다음 일차를 연다', async () => {
    const state = {
      activeProjects: [{
        id: 'theme-믿음-7', duration: 7, kind: 'guided',
        tasks: ['창세기 15장 1–2절', '출애굽기 14장 13–14절'],
        readingDay: 1, readingDayDate: '2026-09-03',
      }],
      activeProjectId: 'theme-믿음-7', wordCardAwards: [],
    };
    mocks.selected = [{ stateJson: JSON.stringify(state), updatedAt: 1234 }];
    mocks.selectedRecordings = [1, 2].map((verse) => ({
      projectId: 'theme-믿음-7', book: '창세기', chapter: 15, verse,
      createdAt: new Date('2026-09-02T14:58:00Z').getTime(),
    }));
    vi.setSystemTime(new Date('2026-09-02T15:30:00Z'));
    const response = await GET(new Request('https://example.test/api/user-state'));
    const body = await response.json() as { state: { activeProjects: Array<{ readingDay: number }> } };
    expect(body.state.activeProjects[0].readingDay).toBe(2);
    expect(mocks.updated).toHaveLength(1);
    vi.useRealTimers();
  });

  it('로그인하지 않거나 잘못된 상태 본문이면 저장하지 않는다', async () => {
    mocks.authenticate.mockResolvedValueOnce(null);
    expect((await PUT(new Request('https://example.test/api/user-state', { method: 'PUT', body: '{}' }))).status).toBe(401);
    expect((await PUT(new Request('https://example.test/api/user-state', { method: 'PUT', body: '[]' }))).status).toBe(400);
    expect(mocks.inserted).toHaveLength(0);
  });

  it('상태 행이 없거나 깨졌으면 안전하게 빈 상태로 응답한다', async () => {
    expect(await (await GET(new Request('https://example.test/api/user-state'))).json()).toEqual({ state: null });
    mocks.selectCalls = 0;
    mocks.selected = [{ stateJson: '{broken', updatedAt: 1234 }];
    expect(await (await GET(new Request('https://example.test/api/user-state'))).json()).toEqual({ state: null });
  });
});
