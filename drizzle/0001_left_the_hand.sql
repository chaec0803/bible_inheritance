ALTER TABLE `recordings` ADD `project_id` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `recordings` ADD `project_title` text DEFAULT '이전 녹음' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_recordings_owner_project_created` ON `recordings` (`owner_key`,`project_id`,`created_at`);