CREATE TABLE `recordings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`book` text NOT NULL,
	`chapter` integer NOT NULL,
	`verse` integer NOT NULL,
	`verse_text` text NOT NULL,
	`bgm_id` text NOT NULL,
	`reverb` text NOT NULL,
	`object_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`duration_seconds` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recordings_object_key_unique` ON `recordings` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_recordings_owner_created` ON `recordings` (`owner_key`,`created_at`);