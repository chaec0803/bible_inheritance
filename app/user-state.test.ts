import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const route = readFileSync(new URL('./api/user-state/route.ts', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../db/schema.ts', import.meta.url), 'utf8');

describe('로그인 사용자 말씀 여정 서버 저장', () => {
  it('Supabase 인증 사용자별 상태를 D1에 upsert한다', () => {
    expect(schema).toContain("sqliteTable('user_states'");
    expect(route).toContain('await authenticateRequest(request)');
    expect(route).toContain('onConflictDoUpdate');
  });

  it('진행 여정, 선택 여정, 말씀카드 지급 상태를 저장한다', () => {
    expect(page).toContain('activeProjects, activeProjectId: activeProject?.id ?? null, wordCardAwards');
    expect(page).toContain("fetch('/api/user-state'");
  });

  it('상태 행이 없으면 남아 있는 녹음 메타데이터로 여정을 복구한다', () => {
    expect(page).toContain('recoverJourneyProjects(recordings, projectTemplates, bibleBooks');
  });
});
