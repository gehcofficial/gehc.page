ALTER TABLE `users` ADD COLUMN `work_industry` VARCHAR(80) NULL;
ALTER TABLE `users` ADD COLUMN `work_role` VARCHAR(120) NULL;
ALTER TABLE `users` ADD COLUMN `major_other` VARCHAR(150) NULL;

CREATE TABLE IF NOT EXISTS `recreational_suggestions` (
  `id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `kind` VARCHAR(24) NOT NULL,
  `parent_id` VARCHAR(64) NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  `group_id` VARCHAR(64) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `recreational_suggestions_user_id_idx` (`user_id`),
  INDEX `recreational_suggestions_status_idx` (`status`)
);
