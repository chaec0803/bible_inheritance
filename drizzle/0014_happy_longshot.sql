UPDATE `gift_drafts`
SET `recipient_keys_json` = json_array(`recipient_key`)
WHERE NOT json_valid(`recipient_keys_json`) OR json_array_length(`recipient_keys_json`) = 0;--> statement-breakpoint
ALTER TABLE `gift_drafts` DROP COLUMN `recipient_key`;--> statement-breakpoint
ALTER TABLE `gifts` DROP COLUMN `recording_count`;--> statement-breakpoint
ALTER TABLE `gifts` DROP COLUMN `total_size_bytes`;
