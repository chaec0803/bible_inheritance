import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

let schemaReady: Promise<void> | null = null;

export function ensureDbSchema() {
  if (!env.DB) throw new Error('Cloudflare D1 binding `DB` is unavailable.');
  schemaReady ??= env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS recordings (
      id TEXT PRIMARY KEY NOT NULL,
      owner_key TEXT NOT NULL,
      data_version TEXT NOT NULL DEFAULT 'legacy',
      project_id TEXT NOT NULL DEFAULT 'legacy',
      project_title TEXT NOT NULL DEFAULT '이전 녹음',
      recording_group_id TEXT,
      recording_mode TEXT NOT NULL DEFAULT 'verse',
      book TEXT NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      verse_text TEXT NOT NULL,
      bgm_id TEXT NOT NULL,
      reverb TEXT NOT NULL,
      object_key TEXT NOT NULL UNIQUE,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      duration_seconds INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_states (
      owner_key TEXT PRIMARY KEY NOT NULL,
      state_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_profiles (
      owner_key TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL,
      email_normalized TEXT NOT NULL,
      nickname TEXT NOT NULL,
      nickname_normalized TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS friendships (
      id TEXT PRIMARY KEY NOT NULL,
      user_a_key TEXT NOT NULL,
      user_b_key TEXT NOT NULL,
      requested_by TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS gifts (
      id TEXT PRIMARY KEY NOT NULL,
      sender_key TEXT NOT NULL,
      recipient_key TEXT NOT NULL,
      title TEXT NOT NULL,
      bgm_id TEXT NOT NULL,
      bgm_volume INTEGER NOT NULL DEFAULT 12,
      recording_count INTEGER NOT NULL,
      total_size_bytes INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS gift_recordings (
      id TEXT PRIMARY KEY NOT NULL,
      gift_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      book TEXT NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      verse_text TEXT NOT NULL,
      object_key TEXT NOT NULL UNIQUE,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      duration_seconds INTEGER NOT NULL
    )`),
  ]).then(async () => {
    const columns = await env.DB.prepare('PRAGMA table_info(recordings)').all<{ name: string }>();
    const names = new Set(columns.results.map((column) => column.name));
    const additions = [];
    if (!names.has('project_id')) additions.push(env.DB.prepare("ALTER TABLE recordings ADD COLUMN project_id TEXT NOT NULL DEFAULT 'legacy'"));
    if (!names.has('data_version')) additions.push(env.DB.prepare("ALTER TABLE recordings ADD COLUMN data_version TEXT NOT NULL DEFAULT 'legacy'"));
    if (!names.has('project_title')) additions.push(env.DB.prepare("ALTER TABLE recordings ADD COLUMN project_title TEXT NOT NULL DEFAULT '이전 녹음'"));
    if (!names.has('recording_group_id')) additions.push(env.DB.prepare('ALTER TABLE recordings ADD COLUMN recording_group_id TEXT'));
    if (!names.has('recording_mode')) additions.push(env.DB.prepare("ALTER TABLE recordings ADD COLUMN recording_mode TEXT NOT NULL DEFAULT 'verse'"));
    if (additions.length) await env.DB.batch(additions);
    await env.DB.batch([
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_recordings_owner_created ON recordings(owner_key, created_at)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_recordings_owner_version_created ON recordings(owner_key, data_version, created_at)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_recordings_owner_project_created ON recordings(owner_key, project_id, created_at)'),
      env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email_normalized)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_user_profiles_nickname ON user_profiles(nickname_normalized)'),
      env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_friendships_pair ON friendships(user_a_key, user_b_key)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_friendships_user_a_status ON friendships(user_a_key, status)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_friendships_user_b_status ON friendships(user_b_key, status)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_gifts_recipient_created ON gifts(recipient_key, created_at)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_gifts_sender_created ON gifts(sender_key, created_at)'),
      env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_gift_recordings_position ON gift_recordings(gift_id, position)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_gift_recordings_gift ON gift_recordings(gift_id)'),
    ]);
    await env.DB.prepare('PRAGMA optimize').run();
  }).catch((error) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

export function getDb() {
  if (!env.DB) {
    throw new Error('Cloudflare D1 binding `DB` is unavailable.');
  }

  return drizzle(env.DB, { schema });
}

export function getD1() {
  if (!env.DB) throw new Error('Cloudflare D1 binding `DB` is unavailable.');
  return env.DB;
}
