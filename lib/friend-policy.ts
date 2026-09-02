type AuthMetadata = Record<string, unknown>;

export function normalizeFriendLookup(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase('ko-KR').replace(/\s+/g, ' ');
}

export function deriveNickname(email: string | undefined, metadata: AuthMetadata = {}) {
  const candidates = [metadata.nickname, metadata.full_name, metadata.name, metadata.preferred_username];
  const fromMetadata = candidates.find((value): value is string => typeof value === 'string' && value.trim().length > 0);
  const fallback = email?.split('@')[0] || '말씀친구';
  return String(fromMetadata ?? fallback).normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, 20);
}

export function validateNickname(value: unknown): { ok: true; nickname: string } | { ok: false; error: string } {
  if (typeof value !== 'string' || /[\r\n]/.test(value)) return { ok: false, error: '닉네임은 한 줄로 입력해 주세요.' };
  const nickname = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (nickname.length < 2 || nickname.length > 20) return { ok: false, error: '닉네임은 2~20자로 입력해 주세요.' };
  return { ok: true, nickname };
}

export function canonicalFriendPair(firstUserId: string, secondUserId: string): [string, string] {
  return firstUserId.localeCompare(secondUserId) <= 0
    ? [firstUserId, secondUserId]
    : [secondUserId, firstUserId];
}
