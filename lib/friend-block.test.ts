import { describe, expect, it } from 'vitest';
import { BLOCK_CONSEQUENCES, isBlockedBetween, normalizeBlockTarget } from './friend-block';

describe('차단 대상 검증', () => {
  it('자기 자신은 차단할 수 없다', () => {
    expect(normalizeBlockTarget('user-a', 'user-a')).toEqual({ ok: false, error: '자기 자신은 차단할 수 없습니다.' });
  });

  it('빈 값이나 문자열이 아닌 대상은 받지 않는다', () => {
    expect(normalizeBlockTarget('   ', 'user-a').ok).toBe(false);
    expect(normalizeBlockTarget(null, 'user-a').ok).toBe(false);
    expect(normalizeBlockTarget(42, 'user-a').ok).toBe(false);
  });

  it('다른 사용자는 차단 대상으로 받아들인다', () => {
    expect(normalizeBlockTarget(' user-b ', 'user-a')).toEqual({ ok: true, userId: 'user-b' });
  });
});

describe('차단 관계 판정', () => {
  const rows = [{ blockerKey: 'user-a', blockedKey: 'user-b' }];

  it('차단한 쪽과 차단당한 쪽 모두 차단 상태로 본다', () => {
    expect(isBlockedBetween(rows, 'user-a', 'user-b')).toBe(true);
    expect(isBlockedBetween(rows, 'user-b', 'user-a')).toBe(true);
  });

  it('관계없는 사용자 쌍은 차단 상태가 아니다', () => {
    expect(isBlockedBetween(rows, 'user-a', 'user-c')).toBe(false);
    expect(isBlockedBetween([], 'user-a', 'user-b')).toBe(false);
  });
});

describe('차단 확인 안내 문구', () => {
  it('차단 후 달라지는 점과 기존 선물 보존 정책을 모두 설명한다', () => {
    const copy = BLOCK_CONSEQUENCES.join('\n');
    expect(copy).toContain('친구 목록에서');
    expect(copy).toContain('검색 결과에');
    expect(copy).toContain('친구 요청');
    expect(copy).toContain('새 말씀 선물');
    expect(copy).toContain('이미 주고받은 말씀 선물은 그대로 남아');
    expect(BLOCK_CONSEQUENCES.length).toBeGreaterThanOrEqual(5);
  });
});
