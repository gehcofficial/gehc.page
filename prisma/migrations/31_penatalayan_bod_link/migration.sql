-- Aditif: role_key pada service_roles + tautan BOD penatalayan per event.
ALTER TABLE `service_roles` ADD COLUMN `role_key` VARCHAR(48) NULL;
CREATE UNIQUE INDEX `service_roles_role_key_key` ON `service_roles`(`role_key`);

CREATE TABLE IF NOT EXISTS `penatalayan_bod_links` (
  `id` VARCHAR(64) NOT NULL,
  `token` VARCHAR(64) NOT NULL,
  `event_id` VARCHAR(64) NOT NULL,
  `service_date` DATE NOT NULL,
  `pattern_code` VARCHAR(32) NOT NULL DEFAULT 'CREATIVE_LAB',
  `host_group_id` VARCHAR(64) NULL,
  `responsible_group_id` VARCHAR(64) NULL,
  `created_by_id` VARCHAR(64) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `penatalayan_bod_links_token_key`(`token`),
  UNIQUE INDEX `penatalayan_bod_links_event_id_key`(`event_id`),
  INDEX `penatalayan_bod_links_service_date_idx`(`service_date`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
