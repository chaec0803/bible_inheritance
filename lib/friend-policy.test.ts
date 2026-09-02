import { describe, expect, it } from 'vitest';
import { canonicalFriendPair, deriveNickname, normalizeFriendLookup, validateNickname } from './friend-policy';

describe('친구 검색·관계 정책', () => {
  it('이메일과 닉네임 검색어를 대소문자·공백에 관계없이 정규화한다', () => {
    expect(normalizeFriendLookup('  Annie@Example.COM  ')).toBe('annie@example.com');
    expect(normalizeFriendLookup('  말씀   친구  ')).toBe('말씀 친구');
  });

  it('OAuth 닉네임을 우선하고 없으면 이메일 앞부분을 기본 닉네임으로 쓴다', () => {
    expect(deriveNickname('annie@example.com', { full_name: '애니 장' })).toBe('애니 장');
    expect(deriveNickname('annie@example.com', {})).toBe('annie');
  });

  it('닉네임은 2~20자의 한 줄 문자열만 허용한다', () => {
    expect(validateNickname('말씀친구')).toEqual({ ok: true, nickname: '말씀친구' });
    expect(validateNickname('a').ok).toBe(false);
    expect(validateNickname('친구\n이름').ok).toBe(false);
  });

  it('양방향 친구 관계를 항상 같은 사용자 쌍으로 저장한다', () => {
    expect(canonicalFriendPair('user-z', 'user-a')).toEqual(['user-a', 'user-z']);
    expect(canonicalFriendPair('user-a', 'user-z')).toEqual(['user-a', 'user-z']);
  });
});
