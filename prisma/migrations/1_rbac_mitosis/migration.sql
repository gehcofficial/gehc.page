-- AlterTable
ALTER TABLE `group_members` ADD COLUMN `alumni_date` DATE NULL,
    ADD COLUMN `alumni_note` VARCHAR(255) NULL,
    ADD COLUMN `status` ENUM('ACTIVE', 'ALUMNI') NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN `user_id` VARCHAR(64) NULL;

-- AlterTable
ALTER TABLE `groups` ADD COLUMN `founded_period` VARCHAR(10) NULL,
    ADD COLUMN `parent_group_id` VARCHAR(64) NULL,
    ADD COLUMN `status` ENUM('ACTIVE', 'DORMANT', 'MERGED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE `user_roles` MODIFY `role` ENUM('SUPERADMIN', 'BPMJ', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR', 'MENTEE', 'ALUMNI') NOT NULL;

-- DataFix: rename role lama MENTI -> MENTEE (revision-v2-beyonders.md)
UPDATE `user_roles` SET `role` = 'MENTEE' WHERE `role` = 'MENTI';

-- CreateTable
CREATE TABLE `attendance_records` (
    `id` VARCHAR(64) NOT NULL,
    `group_id` VARCHAR(64) NOT NULL,
    `group_member_id` VARCHAR(64) NOT NULL,
    `date` DATE NOT NULL,
    `status` ENUM('HADIR', 'IZIN', 'SAKIT', 'TANPA_KABAR') NOT NULL DEFAULT 'HADIR',
    `note` VARCHAR(255) NULL,
    `recorded_by_id` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `attendance_records_group_id_date_idx`(`group_id`, `date`),
    UNIQUE INDEX `attendance_records_group_member_id_date_key`(`group_member_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(64) NOT NULL,
    `type` ENUM('IDLE_FLAG', 'MITOSIS_ALERT', 'MERGER_SUGGESTION') NOT NULL,
    `group_id` VARCHAR(64) NULL,
    `member_id` VARCHAR(64) NULL,
    `title` VARCHAR(190) NOT NULL,
    `message` TEXT NULL,
    `payload` JSON NULL,
    `status` ENUM('OPEN', 'ACKNOWLEDGED', 'RESOLVED') NOT NULL DEFAULT 'OPEN',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolved_at` DATETIME(3) NULL,

    INDEX `notifications_type_status_idx`(`type`, `status`),
    INDEX `notifications_group_id_idx`(`group_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `group_members_user_id_idx` ON `group_members`(`user_id`);

-- CreateIndex
CREATE INDEX `groups_parent_group_id_idx` ON `groups`(`parent_group_id`);

-- AddForeignKey
ALTER TABLE `groups` ADD CONSTRAINT `groups_parent_group_id_fkey` FOREIGN KEY (`parent_group_id`) REFERENCES `groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_members` ADD CONSTRAINT `group_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_group_member_id_fkey` FOREIGN KEY (`group_member_id`) REFERENCES `group_members`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_recorded_by_id_fkey` FOREIGN KEY (`recorded_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
