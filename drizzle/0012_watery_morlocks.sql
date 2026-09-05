ALTER TABLE `gifts` ADD `letter_type` text;--> statement-breakpoint
ALTER TABLE `gifts` ADD `letter_text` text;--> statement-breakpoint
ALTER TABLE `gifts` ADD `letter_object_key` text;--> statement-breakpoint
ALTER TABLE `gifts` ADD `letter_mime_type` text;--> statement-breakpoint
ALTER TABLE `gifts` ADD `letter_size_bytes` integer;--> statement-breakpoint
ALTER TABLE `gifts` ADD `letter_duration_seconds` integer;--> statement-breakpoint
ALTER TABLE `gifts` ADD `letter_opened_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `gifts_letter_object_key_unique` ON `gifts` (`letter_object_key`);