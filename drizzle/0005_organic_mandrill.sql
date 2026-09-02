CREATE TABLE IF NOT EXISTS `gift_recordings` (
	`id` text PRIMARY KEY NOT NULL,
	`gift_id` text NOT NULL,
	`position` integer NOT NULL,
	`book` text NOT NULL,
	`chapter` integer NOT NULL,
	`verse` integer NOT NULL,
	`verse_text` text NOT NULL,
	`object_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`duration_seconds` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `gift_recordings_object_key_unique` ON `gift_recordings` (`object_key`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_gift_recordings_position` ON `gift_recordings` (`gift_id`,`position`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_gift_recordings_gift` ON `gift_recordings` (`gift_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `gifts` (
	`id` text PRIMARY KEY NOT NULL,
	`sender_key` text NOT NULL,
	`recipient_key` text NOT NULL,
	`title` text NOT NULL,
	`bgm_id` text NOT NULL,
	`bgm_volume` integer DEFAULT 12 NOT NULL,
	`recording_count` integer NOT NULL,
	`total_size_bytes` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_gifts_recipient_created` ON `gifts` (`recipient_key`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_gifts_sender_created` ON `gifts` (`sender_key`,`created_at`);
