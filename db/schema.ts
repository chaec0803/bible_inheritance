import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const recordings = sqliteTable(
  'recordings',
  {
    id: text('id').primaryKey(),
    ownerKey: text('owner_key').notNull(),
    dataVersion: text('data_version').notNull().default('legacy'),
    projectId: text('project_id').notNull().default('legacy'),
    projectTitle: text('project_title').notNull().default('이전 녹음'),
    recordingGroupId: text('recording_group_id'),
    recordingMode: text('recording_mode').notNull().default('verse'),
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
  (table) => [
    index('idx_recordings_owner_created').on(table.ownerKey, table.createdAt),
    index('idx_recordings_owner_version_created').on(table.ownerKey, table.dataVersion, table.createdAt),
    index('idx_recordings_owner_project_created').on(table.ownerKey, table.projectId, table.createdAt),
  ],
);

export const userStates = sqliteTable('user_states', {
  ownerKey: text('owner_key').primaryKey(),
  stateJson: text('state_json').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
