ALTER TABLE `gifts` ADD `opened_at` integer;--> statement-breakpoint
UPDATE `gifts`
SET `opened_at` = `created_at`
WHERE `opened_at` IS NULL
  AND EXISTS (
    SELECT 1 FROM `gifts` AS `newer`
    WHERE `newer`.`sender_key` = `gifts`.`sender_key`
      AND `newer`.`recipient_key` = `gifts`.`recipient_key`
      AND (`newer`.`created_at` > `gifts`.`created_at` OR (`newer`.`created_at` = `gifts`.`created_at` AND `newer`.`id` > `gifts`.`id`))
  );--> statement-breakpoint
CREATE UNIQUE INDEX `idx_gifts_one_unopened_per_pair` ON `gifts` (`sender_key`,`recipient_key`) WHERE "gifts"."opened_at" IS NULL;
