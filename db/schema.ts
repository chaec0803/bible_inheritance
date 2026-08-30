import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const recordings = sqliteTable(
  'recordings',
  {
    id: text('id').primaryKey(),
    ownerKey: text('owner_key').notNull(),
    book: text('book').notNull(),
    chapter: integer('chapter').notNull(),
    verse: integer('verse').notNull(),
    verseText: text('verse_text').notNull(),
    bgmId: text('bgm_id').notNull(),
    reverb: text('reverb').notNull(),
    objectKey: text('object_key').notNull().unique(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    durationSeconds: integer('duration_seconds').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('idx_recordings_owner_created').on(table.ownerKey, table.createdAt)],
);
