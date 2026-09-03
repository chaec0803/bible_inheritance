import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const panel = readFileSync(new URL('./friends-panel.tsx', import.meta.url), 'utf8');
const route = readFileSync(new URL('./api/friends/route.ts', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../db/schema.ts', import.meta.url), 'utf8');

describe('친구 추가 기능 회귀', () => {
  it('로그인한 사용자만 친구 검색과 관계 변경을 할 수 있다', () => {
    expect(route.match(/await authenticateRequest\(request\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(route).toContain("{ status: 401 }");
    expect(route).toContain("targetUserId === user.id");
  });

  it('이메일 정확 검색과 닉네임 앞부분 검색을 지원한다', () => {
    expect(route).toContain('email_normalized = ?');
    expect(route).toContain("nickname_normalized LIKE ? ESCAPE");
    expect(panel).toContain('이메일 또는 닉네임');
  });

  it('친구 관계는 사용자 쌍당 하나이고 양쪽 사용자 조회 인덱스가 있다', () => {
    expect(schema).toContain("uniqueIndex('idx_friendships_pair')");
    expect(schema).toContain("index('idx_friendships_user_a_status')");
    expect(schema).toContain("index('idx_friendships_user_b_status')");
  });

  it('친구 요청의 수락·거절과 친구 해제를 제공한다', () => {
    expect(panel).toContain("runAction('accept'");
    expect(panel).toContain("runAction('reject'");
    expect(panel).toContain("runAction('remove'");
    expect(route).toContain("existing.requested_by === user.id");
  });

  it('데스크톱과 모바일 내비게이션에서 친구 화면을 연다', () => {
    expect(page).toContain("navigateTo('friends')");
    expect(page.match(/onClick={openFriendsTab}/g)?.length).toBeGreaterThanOrEqual(3);
    expect(page).toContain("appTab === 'friends' && <FriendsPanel");
  });
});
