CREATE TABLE IF NOT EXISTS `friendships` (
	`id` text PRIMARY KEY NOT NULL,
	`user_a_key` text NOT NULL,
	`user_b_key` text NOT NULL,
	`requested_by` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_friendships_pair` ON `friendships` (`user_a_key`,`user_b_key`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_friendships_user_a_status` ON `friendships` (`user_a_key`,`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_friendships_user_b_status` ON `friendships` (`user_b_key`,`status`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_profiles` (
	`owner_key` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`email_normalized` text NOT NULL,
	`nickname` text NOT NULL,
	`nickname_normalized` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_user_profiles_email` ON `user_profiles` (`email_normalized`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_user_profiles_nickname` ON `user_profiles` (`nickname_normalized`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_states` (
	`owner_key` text PRIMARY KEY NOT NULL,
	`state_json` text NOT NULL,
	`updated_at` integer NOT NULL
);
