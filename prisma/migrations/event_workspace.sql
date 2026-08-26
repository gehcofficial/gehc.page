-- Event Workspace tables (migration 6)
-- Only the new Event-related tables; existing tables already in TiDB

-- CreateTable
CREATE TABLE `EventProgram` (
    `id` VARCHAR(64) NOT NULL,
    `tenant_id` VARCHAR(16) NOT NULL,
    `slug` VARCHAR(60) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `description` TEXT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'PLANNING',
    `start_date` DATETIME(3) NULL,
    `end_date` DATETIME(3) NULL,
    `drive_folder_id` VARCHAR(128) NULL,
    `gmeet_link` VARCHAR(512) NULL,
    `created_by_id` VARCHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EventProgram_slug_key`(`slug`),
    INDEX `EventProgram_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventDivision` (
    `id` VARCHAR(64) NOT NULL,
    `event_id` VARCHAR(64) NOT NULL,
    `division` VARCHAR(24) NOT NULL,
    `drive_folder_id` VARCHAR(128) NULL,
    `extra_user_ids` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EventDivision_event_id_division_key`(`event_id`, `division`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventMeeting` (
    `id` VARCHAR(64) NOT NULL,
    `event_id` VARCHAR(64) NOT NULL,
    `division` VARCHAR(24) NULL,
    `title` VARCHAR(200) NOT NULL,
    `scheduled_at` DATETIME(3) NOT NULL,
    `gmeet_link` VARCHAR(512) NULL,
    `notes` TEXT NULL,
    `created_by_id` VARCHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EventMeeting_event_id_idx`(`event_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventUpdate` (
    `id` VARCHAR(64) NOT NULL,
    `event_division_id` VARCHAR(64) NOT NULL,
    `author_id` VARCHAR(64) NOT NULL,
    `body` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EventUpdate_event_division_id_idx`(`event_division_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EventDivision` ADD CONSTRAINT `EventDivision_event_id_fkey` FOREIGN KEY (`event_id`) REFERENCES `EventProgram`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventMeeting` ADD CONSTRAINT `EventMeeting_event_id_fkey` FOREIGN KEY (`event_id`) REFERENCES `EventProgram`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventUpdate` ADD CONSTRAINT `EventUpdate_event_division_id_fkey` FOREIGN KEY (`event_division_id`) REFERENCES `EventDivision`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
