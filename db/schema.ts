import { sql } from 'drizzle-orm';
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

export const gifts = sqliteTable(
  'gifts',
  {
    id: text('id').primaryKey(),
    senderKey: text('sender_key').notNull(),
    recipientKey: text('recipient_key').notNull(),
    title: text('title').notNull(),
    bgmId: text('bgm_id').notNull(),
    bgmVolume: integer('bgm_volume').notNull().default(12),
    recordingCount: integer('recording_count').notNull(),
    totalSizeBytes: integer('total_size_bytes').notNull(),
    createdAt: integer('created_at').notNull(),
    openedAt: integer('opened_at'),
    recipientDeletedAt: integer('recipient_deleted_at'),
    thankYouNote: text('thank_you_note'),
    thankedAt: integer('thanked_at'),
  },
  (table) => [
    index('idx_gifts_recipient_created').on(table.recipientKey, table.createdAt),
    index('idx_gifts_sender_created').on(table.senderKey, table.createdAt),
    uniqueIndex('idx_gifts_one_unopened_per_pair').on(table.senderKey, table.recipientKey).where(sql`${table.openedAt} IS NULL`),
  ],
);

export const giftRecordings = sqliteTable(
  'gift_recordings',
  {
    id: text('id').primaryKey(),
    giftId: text('gift_id').notNull(),
    position: integer('position').notNull(),
    book: text('book').notNull(),
    chapter: integer('chapter').notNull(),
    verse: integer('verse').notNull(),
    verseText: text('verse_text').notNull(),
    objectKey: text('object_key').notNull().unique(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    durationSeconds: integer('duration_seconds').notNull(),
  },
  (table) => [
    uniqueIndex('idx_gift_recordings_position').on(table.giftId, table.position),
    index('idx_gift_recordings_gift').on(table.giftId),
  ],
);
