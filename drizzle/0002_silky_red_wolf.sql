ALTER TABLE `recordings` ADD `recording_group_id` text;--> statement-breakpoint
ALTER TABLE `recordings` ADD `recording_mode` text DEFAULT 'verse' NOT NULL;