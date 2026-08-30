-- Alamat terstruktur, status hidup, katalog institusi
CREATE TABLE IF NOT EXISTS `institutions` (
  `id` VARCHAR(64) NOT NULL,
  `slug` VARCHAR(80) NOT NULL,
  `name` VARCHAR(190) NOT NULL,
  `kind` VARCHAR(24) NOT NULL,
  `city` VARCHAR(120) NULL,
  UNIQUE INDEX `institutions_slug_key`(`slug`),
  INDEX `institutions_kind_idx`(`kind`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `users`
  ADD COLUMN `address_line` VARCHAR(255) NULL,
  ADD COLUMN `village` VARCHAR(120) NULL,
  ADD COLUMN `district` VARCHAR(120) NULL,
  ADD COLUMN `city` VARCHAR(120) NULL,
  ADD COLUMN `province` VARCHAR(80) NULL,
  ADD COLUMN `postal_code` VARCHAR(12) NULL,
  ADD COLUMN `lat` DOUBLE NULL,
  ADD COLUMN `lng` DOUBLE NULL,
  ADD COLUMN `place_id` VARCHAR(255) NULL,
  ADD COLUMN `address_note` VARCHAR(255) NULL,
  ADD COLUMN `life_statuses` JSON NULL,
  ADD COLUMN `school_level` VARCHAR(24) NULL,
  ADD COLUMN `school_name` VARCHAR(190) NULL,
  ADD COLUMN `institution_id` VARCHAR(64) NULL,
  ADD COLUMN `major` VARCHAR(150) NULL,
  ADD COLUMN `workplace_name` VARCHAR(190) NULL,
  ADD COLUMN `workplace_place_id` VARCHAR(255) NULL;

CREATE INDEX `users_institution_id_idx` ON `users`(`institution_id`);
ALTER TABLE `users` ADD CONSTRAINT `users_institution_id_fkey` FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
