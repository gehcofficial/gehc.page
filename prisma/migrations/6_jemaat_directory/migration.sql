-- Direktori jemaat: BIPRA, Kolom, rekreasional, taut Google

CREATE TABLE `kolom` (
    `id` VARCHAR(64) NOT NULL,
    `number` INTEGER NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `area` VARCHAR(190) NULL,
    UNIQUE INDEX `kolom_number_key`(`number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `recreational_groups` (
    `id` VARCHAR(64) NOT NULL,
    `slug` VARCHAR(40) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `kind` VARCHAR(24) NOT NULL,
    UNIQUE INDEX `recreational_groups_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `recreational_memberships` (
    `user_id` VARCHAR(64) NOT NULL,
    `group_id` VARCHAR(64) NOT NULL,
    PRIMARY KEY (`user_id`, `group_id`),
    INDEX `recreational_memberships_group_id_idx`(`group_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `users`
    MODIFY `email` VARCHAR(190) NULL,
    ADD COLUMN `bipra` ENUM('BAPAK', 'IBU', 'PEMUDA', 'REMAJA', 'ANAK') NOT NULL DEFAULT 'PEMUDA',
    ADD COLUMN `kolom_id` VARCHAR(64) NULL,
    ADD COLUMN `google_sub` VARCHAR(64) NULL,
    ADD COLUMN `link_status` VARCHAR(16) NOT NULL DEFAULT 'UNLINKED',
    ADD COLUMN `claim_token` VARCHAR(64) NULL,
    ADD COLUMN `claim_token_expires_at` DATETIME(3) NULL;

CREATE UNIQUE INDEX `users_google_sub_key` ON `users`(`google_sub`);
CREATE UNIQUE INDEX `users_claim_token_key` ON `users`(`claim_token`);
CREATE INDEX `users_kolom_id_idx` ON `users`(`kolom_id`);
CREATE INDEX `users_bipra_idx` ON `users`(`bipra`);

ALTER TABLE `users` ADD CONSTRAINT `users_kolom_id_fkey` FOREIGN KEY (`kolom_id`) REFERENCES `kolom`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `recreational_memberships` ADD CONSTRAINT `recreational_memberships_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `recreational_memberships` ADD CONSTRAINT `recreational_memberships_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `recreational_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO `kolom` (`id`, `number`, `name`) VALUES
  ('kolom-1', 1, 'Kolom 1'),
  ('kolom-2', 2, 'Kolom 2'),
  ('kolom-3', 3, 'Kolom 3'),
  ('kolom-4', 4, 'Kolom 4'),
  ('kolom-5', 5, 'Kolom 5');

INSERT INTO `recreational_groups` (`id`, `slug`, `name`, `kind`) VALUES
  ('rec-sports', 'sports', 'Sports', 'SPORTS'),
  ('rec-arts', 'arts', 'Arts', 'ARTS');

-- Superseded by server/_seed-recreational.cjs (hierarchical catalog)

UPDATE `users` SET
  `bipra` = 'PEMUDA',
  `link_status` = CASE
    WHEN `password_hash` IS NOT NULL OR (`email` IS NOT NULL AND `email` <> '') THEN 'LINKED'
    ELSE 'UNLINKED'
  END;
