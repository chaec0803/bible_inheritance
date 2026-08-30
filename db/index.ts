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
      project_id TEXT NOT NULL DEFAULT 'legacy',
      project_title TEXT NOT NULL DEFAULT '이전 녹음',
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
  ]).then(async () => {
    const columns = await env.DB.prepare('PRAGMA table_info(recordings)').all<{ name: string }>();
    const names = new Set(columns.results.map((column) => column.name));
    const additions = [];
    if (!names.has('project_id')) additions.push(env.DB.prepare("ALTER TABLE recordings ADD COLUMN project_id TEXT NOT NULL DEFAULT 'legacy'"));
    if (!names.has('project_title')) additions.push(env.DB.prepare("ALTER TABLE recordings ADD COLUMN project_title TEXT NOT NULL DEFAULT '이전 녹음'"));
    if (additions.length) await env.DB.batch(additions);
    await env.DB.batch([
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_recordings_owner_created ON recordings(owner_key, created_at)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_recordings_owner_project_created ON recordings(owner_key, project_id, created_at)'),
    ]);
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
