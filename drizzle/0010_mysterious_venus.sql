CREATE TABLE `friend_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`blocker_key` text NOT NULL,
	`blocked_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_friend_blocks_pair` ON `friend_blocks` (`blocker_key`,`blocked_key`);--> statement-breakpoint
CREATE INDEX `idx_friend_blocks_blocked` ON `friend_blocks` (`blocked_key`);--> statement-breakpoint
CREATE TABLE `gift_draft_items` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`position` integer NOT NULL,
	`book` text NOT NULL,
	`chapter` integer NOT NULL,
	`verse` integer NOT NULL,
	`verse_text` text NOT NULL,
	`source_recording_id` text,
	`object_key` text,
	`mime_type` text DEFAULT '' NOT NULL,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`duration_seconds` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gift_draft_items_object_key_unique` ON `gift_draft_items` (`object_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_gift_draft_items_position` ON `gift_draft_items` (`draft_id`,`position`);--> statement-breakpoint
CREATE INDEX `idx_gift_draft_items_draft` ON `gift_draft_items` (`draft_id`);--> statement-breakpoint
CREATE TABLE `gift_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`recipient_key` text NOT NULL,
	`title` text NOT NULL,
	`bgm_id` text DEFAULT 'none' NOT NULL,
	`bgm_volume` integer DEFAULT 12 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`sent_gift_id` text
);
--> statement-breakpoint
CREATE INDEX `idx_gift_drafts_owner_updated` ON `gift_drafts` (`owner_key`,`updated_at`);--> statement-breakpoint
ALTER TABLE `gifts` ADD `sender_deleted_at` integer;