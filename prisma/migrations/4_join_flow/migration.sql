-- AlterTable
ALTER TABLE `users` ADD COLUMN `account_status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN `address` TEXT NULL,
    ADD COLUMN `gifts_scores` JSON NULL,
    ADD COLUMN `gifts_top5` JSON NULL,
    ADD COLUMN `origin` VARCHAR(190) NULL,
    ADD COLUMN `talents` JSON NULL;

-- CreateTable
CREATE TABLE `invite_codes` (
    `code` VARCHAR(16) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'SINGLE',
    `defaultRole` ENUM('SUPERADMIN', 'BPMJ', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR', 'MENTEE', 'ALUMNI') NOT NULL DEFAULT 'MENTEE',
    `maxUses` INTEGER NOT NULL DEFAULT 1,
    `uses` INTEGER NOT NULL DEFAULT 0,
    `expires_at` DATETIME(3) NULL,
    `created_by` VARCHAR(190) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `waitlist_entries` (
    `id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `phone` VARCHAR(40) NOT NULL,
    `email` VARCHAR(190) NULL,
    `origin` VARCHAR(190) NULL,
    `address` TEXT NULL,
    `gifts_top5` JSON NULL,
    `gifts_scores` JSON NULL,
    `talents` JSON NULL,
    `notes` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'WAITLISTED',
    `source_event_id` VARCHAR(64) NULL,
    `assigned_group_id` VARCHAR(64) NULL,
    `promote_token` VARCHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `waitlist_entries_promote_token_key`(`promote_token`),
    INDEX `waitlist_entries_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
