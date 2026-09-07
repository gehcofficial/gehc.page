ALTER TABLE `users` MODIFY COLUMN `church_title` VARCHAR(32) NULL;

CREATE TABLE IF NOT EXISTS `title_catalog` (
  `id` VARCHAR(64) NOT NULL,
  `kind` VARCHAR(16) NOT NULL,
  `code` VARCHAR(32) NOT NULL,
  `abbr` VARCHAR(32) NOT NULL,
  `name_id` VARCHAR(120) NOT NULL,
  `name_en` VARCHAR(120) NOT NULL,
  `position` VARCHAR(8) NOT NULL,
  `locked` TINYINT(1) NOT NULL DEFAULT 0,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `title_catalog_code_key` (`code`),
  KEY `title_catalog_kind_active_idx` (`kind`, `active`)
);

CREATE TABLE IF NOT EXISTS `title_suggestions` (
  `id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `kind` VARCHAR(16) NOT NULL,
  `abbr` VARCHAR(32) NOT NULL,
  `name_hint` VARCHAR(120) NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  `title_id` VARCHAR(64) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `title_suggestions_user_id_idx` (`user_id`),
  KEY `title_suggestions_status_idx` (`status`)
);
