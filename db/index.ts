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
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS friend_blocks (
      id TEXT PRIMARY KEY NOT NULL,
      blocker_key TEXT NOT NULL,
      blocked_key TEXT NOT NULL,
      created_at INTEGER NOT NULL
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
      created_at INTEGER NOT NULL,
      arrival_seen_at INTEGER,
      opened_at INTEGER,
      recipient_deleted_at INTEGER,
      sender_deleted_at INTEGER,
      thank_you_note TEXT,
      thanked_at INTEGER
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS gift_recordings (
      id TEXT PRIMARY KEY NOT NULL,
      gift_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      book TEXT NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      verse_text TEXT NOT NULL,
      source_recording_id TEXT,
      object_key TEXT UNIQUE,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      duration_seconds INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS gift_drafts (
      id TEXT PRIMARY KEY NOT NULL, owner_key TEXT NOT NULL, recipient_key TEXT NOT NULL,
      title TEXT NOT NULL, bgm_id TEXT NOT NULL DEFAULT 'none', bgm_volume INTEGER NOT NULL DEFAULT 12,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, sent_gift_id TEXT
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS gift_draft_items (
      id TEXT PRIMARY KEY NOT NULL, draft_id TEXT NOT NULL, position INTEGER NOT NULL,
      book TEXT NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL, verse_text TEXT NOT NULL,
      source_recording_id TEXT, object_key TEXT UNIQUE, mime_type TEXT NOT NULL DEFAULT '',
      size_bytes INTEGER NOT NULL DEFAULT 0, duration_seconds INTEGER NOT NULL DEFAULT 0
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
    const giftColumns = await env.DB.prepare('PRAGMA table_info(gifts)').all<{ name: string }>();
    if (!giftColumns.results.some((column) => column.name === 'opened_at')) {
      await env.DB.prepare('ALTER TABLE gifts ADD COLUMN opened_at INTEGER').run();
    }
    if (!giftColumns.results.some((column) => column.name === 'arrival_seen_at')) {
      await env.DB.prepare('ALTER TABLE gifts ADD COLUMN arrival_seen_at INTEGER').run();
    }
    if (!giftColumns.results.some((column) => column.name === 'recipient_deleted_at')) {
      await env.DB.prepare('ALTER TABLE gifts ADD COLUMN recipient_deleted_at INTEGER').run();
    }
    if (!giftColumns.results.some((column) => column.name === 'sender_deleted_at')) {
      await env.DB.prepare('ALTER TABLE gifts ADD COLUMN sender_deleted_at INTEGER').run();
    }
    if (!giftColumns.results.some((column) => column.name === 'thank_you_note')) {
      await env.DB.prepare('ALTER TABLE gifts ADD COLUMN thank_you_note TEXT').run();
    }
    if (!giftColumns.results.some((column) => column.name === 'thanked_at')) {
      await env.DB.prepare('ALTER TABLE gifts ADD COLUMN thanked_at INTEGER').run();
    }
    await env.DB.prepare(`UPDATE gifts
      SET opened_at = created_at
      WHERE opened_at IS NULL
        AND EXISTS (
          SELECT 1 FROM gifts AS newer
          WHERE newer.sender_key = gifts.sender_key
            AND newer.recipient_key = gifts.recipient_key
            AND (newer.created_at > gifts.created_at OR (newer.created_at = gifts.created_at AND newer.id > gifts.id))
        )`).run();
    await env.DB.batch([
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_recordings_owner_created ON recordings(owner_key, created_at)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_recordings_owner_version_created ON recordings(owner_key, data_version, created_at)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_recordings_owner_project_created ON recordings(owner_key, project_id, created_at)'),
      env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email_normalized)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_user_profiles_nickname ON user_profiles(nickname_normalized)'),
      env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_friendships_pair ON friendships(user_a_key, user_b_key)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_friendships_user_a_status ON friendships(user_a_key, status)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_friendships_user_b_status ON friendships(user_b_key, status)'),
      env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_blocks_pair ON friend_blocks(blocker_key, blocked_key)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_friend_blocks_blocked ON friend_blocks(blocked_key)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_gifts_recipient_created ON gifts(recipient_key, created_at)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_gifts_sender_created ON gifts(sender_key, created_at)'),
      env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_gifts_one_unopened_per_pair ON gifts(sender_key, recipient_key) WHERE opened_at IS NULL'),
      env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_gift_recordings_position ON gift_recordings(gift_id, position)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_gift_recordings_gift ON gift_recordings(gift_id)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_gift_recordings_source ON gift_recordings(source_recording_id)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_gift_drafts_owner_updated ON gift_drafts(owner_key, updated_at)'),
      env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_gift_draft_items_position ON gift_draft_items(draft_id, position)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_gift_draft_items_draft ON gift_draft_items(draft_id)'),
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
