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

export const friendBlocks = sqliteTable(
  'friend_blocks',
  {
    id: text('id').primaryKey(),
    blockerKey: text('blocker_key').notNull(),
    blockedKey: text('blocked_key').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_friend_blocks_pair').on(table.blockerKey, table.blockedKey),
    index('idx_friend_blocks_blocked').on(table.blockedKey),
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
    createdAt: integer('created_at').notNull(),
    arrivalSeenAt: integer('arrival_seen_at'),
    openedAt: integer('opened_at'),
    recipientDeletedAt: integer('recipient_deleted_at'),
    senderDeletedAt: integer('sender_deleted_at'),
    thankYouNote: text('thank_you_note'),
    thankedAt: integer('thanked_at'),
    letterType: text('letter_type'),
    letterText: text('letter_text'),
    letterObjectKey: text('letter_object_key').unique(),
    letterMimeType: text('letter_mime_type'),
    letterSizeBytes: integer('letter_size_bytes'),
    letterDurationSeconds: integer('letter_duration_seconds'),
    letterOpenedAt: integer('letter_opened_at'),
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
    sourceRecordingId: text('source_recording_id'),
    objectKey: text('object_key').unique(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    durationSeconds: integer('duration_seconds').notNull(),
  },
  (table) => [
    uniqueIndex('idx_gift_recordings_position').on(table.giftId, table.position),
    index('idx_gift_recordings_gift').on(table.giftId),
    index('idx_gift_recordings_source').on(table.sourceRecordingId),
  ],
);

export const giftDrafts = sqliteTable(
  'gift_drafts',
  {
    id: text('id').primaryKey(), ownerKey: text('owner_key').notNull(),
    title: text('title').notNull(), bgmId: text('bgm_id').notNull().default('none'), bgmVolume: integer('bgm_volume').notNull().default(12),
    recipientKeysJson: text('recipient_keys_json').notNull().default('[]'),
    createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(), sentGiftId: text('sent_gift_id'),
  },
  (table) => [index('idx_gift_drafts_owner_updated').on(table.ownerKey, table.updatedAt)],
);

export const giftDraftItems = sqliteTable(
  'gift_draft_items',
  {
    id: text('id').primaryKey(), draftId: text('draft_id').notNull(), position: integer('position').notNull(),
    book: text('book').notNull(), chapter: integer('chapter').notNull(), verse: integer('verse').notNull(), verseText: text('verse_text').notNull(),
    sourceRecordingId: text('source_recording_id'), objectKey: text('object_key').unique(), mimeType: text('mime_type').notNull().default(''),
    sizeBytes: integer('size_bytes').notNull().default(0), durationSeconds: integer('duration_seconds').notNull().default(0),
  },
  (table) => [uniqueIndex('idx_gift_draft_items_position').on(table.draftId, table.position), index('idx_gift_draft_items_draft').on(table.draftId)],
);

export const friendGroups = sqliteTable(
  'friend_groups',
  {
    id: text('id').primaryKey(),
    ownerKey: text('owner_key').notNull(),
    name: text('name').notNull(),
    memberKeysJson: text('member_keys_json').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [index('idx_friend_groups_owner_updated').on(table.ownerKey, table.updatedAt)],
);

export const relayProjects = sqliteTable(
  'relay_projects',
  {
    id: text('id').primaryKey(),
    creatorKey: text('creator_key').notNull(),
    groupId: text('group_id').notNull(),
    title: text('title').notNull(),
    scopeJson: text('scope_json').notNull(),
    bgmId: text('bgm_id').notNull().default('none'),
    bgmVolume: integer('bgm_volume').notNull().default(12),
    rotation: integer('rotation').notNull(),
    currentTurnIndex: integer('current_turn_index'),
    status: text('status').notNull().default('pending_invites'),
    inviteMessage: text('invite_message').notNull().default(''),
    createdAt: integer('created_at').notNull(),
    startedAt: integer('started_at'),
    completedAt: integer('completed_at'),
    cancelledAt: integer('cancelled_at'),
    cancelReason: text('cancel_reason'),
  },
  (table) => [
    index('idx_relay_projects_creator_created').on(table.creatorKey, table.createdAt),
    index('idx_relay_projects_status').on(table.status),
  ],
);

export const relayParticipants = sqliteTable(
  'relay_participants',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull(),
    memberKey: text('member_key').notNull(),
    position: integer('position').notNull(),
    inviteStatus: text('invite_status').notNull().default('pending'),
    respondedAt: integer('responded_at'),
  },
  (table) => [
    uniqueIndex('idx_relay_participants_project_member').on(table.projectId, table.memberKey),
    uniqueIndex('idx_relay_participants_project_position').on(table.projectId, table.position),
    index('idx_relay_participants_member').on(table.memberKey),
  ],
);

export const relayTurns = sqliteTable(
  'relay_turns',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull(),
    turnIndex: integer('turn_index').notNull(),
    memberKey: text('member_key').notNull(),
    passagesJson: text('passages_json').notNull(),
    arrivalSeenAt: integer('arrival_seen_at'),
    completedAt: integer('completed_at'),
  },
  (table) => [
    uniqueIndex('idx_relay_turns_project_index').on(table.projectId, table.turnIndex),
    index('idx_relay_turns_member').on(table.memberKey),
  ],
);
