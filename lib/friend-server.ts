import { ensureDbSchema, getD1 } from '@/db';
import type { AuthenticatedUser } from './supabase-auth';
import { deriveNickname, normalizeFriendLookup } from './friend-policy';

export async function ensureUserProfile(user: AuthenticatedUser) {
  await ensureDbSchema();
  const email = user.email?.trim();
  if (!email) throw new Error('친구 기능에는 이메일이 등록된 계정이 필요합니다.');
  const now = Date.now();
  const nickname = deriveNickname(email, user.metadata);
  await getD1().prepare(`INSERT INTO user_profiles (
    owner_key, email, email_normalized, nickname, nickname_normalized, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(owner_key) DO UPDATE SET
    email = excluded.email,
    email_normalized = excluded.email_normalized,
    updated_at = excluded.updated_at`)
    .bind(user.id, email, normalizeFriendLookup(email), nickname, normalizeFriendLookup(nickname), now, now)
    .run();
}
