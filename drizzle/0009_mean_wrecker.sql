PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_gift_recordings` (
	`id` text PRIMARY KEY NOT NULL,
	`gift_id` text NOT NULL,
	`position` integer NOT NULL,
	`book` text NOT NULL,
	`chapter` integer NOT NULL,
	`verse` integer NOT NULL,
	`verse_text` text NOT NULL,
	`source_recording_id` text,
	`object_key` text,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`duration_seconds` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_gift_recordings`("id", "gift_id", "position", "book", "chapter", "verse", "verse_text", "source_recording_id", "object_key", "mime_type", "size_bytes", "duration_seconds") SELECT "id", "gift_id", "position", "book", "chapter", "verse", "verse_text", NULL, "object_key", "mime_type", "size_bytes", "duration_seconds" FROM `gift_recordings`;--> statement-breakpoint
DROP TABLE `gift_recordings`;--> statement-breakpoint
ALTER TABLE `__new_gift_recordings` RENAME TO `gift_recordings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `gift_recordings_object_key_unique` ON `gift_recordings` (`object_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_gift_recordings_position` ON `gift_recordings` (`gift_id`,`position`);--> statement-breakpoint
CREATE INDEX `idx_gift_recordings_gift` ON `gift_recordings` (`gift_id`);--> statement-breakpoint
CREATE INDEX `idx_gift_recordings_source` ON `gift_recordings` (`source_recording_id`);
