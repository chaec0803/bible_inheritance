import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(new URL('../db/schema.ts', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../db/index.ts', import.meta.url), 'utf8');

describe('이어읽기 최소 DB 구조', () => {
  it('그룹·프로젝트·참여자·turn 네 테이블만 별도 도메인 상태로 둔다', () => {
    for (const table of ['friend_groups', 'relay_projects', 'relay_participants', 'relay_turns']) {
      expect(schema).toContain(`'${table}'`);
      expect(bootstrap).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(schema).not.toContain('relay_recordings');
    expect(schema).not.toContain('relay_notifications');
  });

  it('참여자와 turn의 프로젝트 내 중복을 DB에서 차단한다', () => {
    expect(schema).toContain("uniqueIndex('idx_relay_participants_project_member')");
    expect(schema).toContain("uniqueIndex('idx_relay_participants_project_position')");
    expect(schema).toContain("uniqueIndex('idx_relay_turns_project_index')");
  });

  it('turn에 active/waiting 같은 파생 상태를 중복 저장하지 않는다', () => {
    const relayTurns = schema.slice(schema.indexOf('export const relayTurns'));
    expect(relayTurns).not.toContain("text('status')");
    expect(relayTurns).toContain("completedAt: integer('completed_at')");
  });
});
