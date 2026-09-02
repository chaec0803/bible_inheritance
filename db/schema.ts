import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

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

export const userProfiles = sqliteTable(
  'user_profiles',
  {
    ownerKey: text('owner_key').primaryKey(),
    email: text('email').notNull(),
    emailNormalized: text('email_normalized').notNull(),
    nickname: text('nickname').notNull(),
    nicknameNormalized: text('nickname_normalized').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_user_profiles_email').on(table.emailNormalized),
    index('idx_user_profiles_nickname').on(table.nicknameNormalized),
  ],
);

export const friendships = sqliteTable(
  'friendships',
  {
    id: text('id').primaryKey(),
    userAKey: text('user_a_key').notNull(),
    userBKey: text('user_b_key').notNull(),
    requestedBy: text('requested_by').notNull(),
    status: text('status').notNull().default('pending'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_friendships_pair').on(table.userAKey, table.userBKey),
    index('idx_friendships_user_a_status').on(table.userAKey, table.status),
    index('idx_friendships_user_b_status').on(table.userBKey, table.status),
  ],
);
