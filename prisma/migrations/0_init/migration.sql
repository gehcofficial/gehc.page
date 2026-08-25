-- CreateTable
CREATE TABLE `tenants` (
    `id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `domain` VARCHAR(150) NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `tenants_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(64) NOT NULL,
    `email` VARCHAR(190) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `avatar` TEXT NULL,
    `phone` VARCHAR(40) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_roles` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(64) NOT NULL,
    `tenant_id` VARCHAR(64) NOT NULL,
    `role` ENUM('SUPERADMIN', 'COMMITTEE', 'MENTOR', 'MENTI') NOT NULL,
    `group_id` VARCHAR(64) NULL,

    INDEX `user_roles_group_id_idx`(`group_id`),
    UNIQUE INDEX `user_roles_user_id_tenant_id_key`(`user_id`, `tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `groups` (
    `id` VARCHAR(64) NOT NULL,
    `tenant_id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `meaning` VARCHAR(255) NULL,
    `scripture` TEXT NULL,
    `meeting_schedule` VARCHAR(150) NULL,
    `meeting_location` VARCHAR(255) NULL,
    `color` VARCHAR(20) NULL,
    `icon` VARCHAR(60) NULL,
    `description` TEXT NULL,
    `member_count` INTEGER NOT NULL DEFAULT 0,

    INDEX `groups_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `group_batches` (
    `id` VARCHAR(64) NOT NULL,
    `group_id` VARCHAR(64) NOT NULL,
    `period` VARCHAR(10) NOT NULL,
    `batch_label` VARCHAR(190) NULL,
    `mentor_name` VARCHAR(150) NOT NULL,
    `comentor_name` VARCHAR(150) NULL,
    `theme` VARCHAR(255) NULL,
    `is_current` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `group_batches_group_id_period_idx`(`group_id`, `period`),
    UNIQUE INDEX `group_batches_group_id_period_key`(`group_id`, `period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `group_members` (
    `id` VARCHAR(64) NOT NULL,
    `group_id` VARCHAR(64) NOT NULL,
    `batch_period` VARCHAR(10) NULL,
    `name` VARCHAR(150) NOT NULL,
    `email` VARCHAR(190) NULL,
    `phone` VARCHAR(40) NULL,
    `family_role` ENUM('MENTOR', 'COMENTOR', 'MENTEE') NOT NULL DEFAULT 'MENTEE',
    `joined_date` DATE NULL,
    `attendance_rate` INTEGER NOT NULL DEFAULT 0,
    `notes` TEXT NULL,

    INDEX `group_members_group_id_idx`(`group_id`),
    INDEX `group_members_group_id_batch_period_idx`(`group_id`, `batch_period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `monitoring_records` (
    `id` VARCHAR(64) NOT NULL,
    `group_id` VARCHAR(64) NOT NULL,
    `mentor_id` VARCHAR(64) NULL,
    `date` DATE NOT NULL,
    `data` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `monitoring_records_group_id_date_idx`(`group_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `content_items` (
    `id` VARCHAR(64) NOT NULL,
    `tenant_id` VARCHAR(64) NOT NULL,
    `type` ENUM('WEEKLY_INFO', 'ACTIVITY') NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `subtitle` VARCHAR(255) NULL,
    `body` MEDIUMTEXT NULL,
    `category` VARCHAR(100) NULL,
    `published_at` DATE NULL,
    `is_published` BOOLEAN NOT NULL DEFAULT true,
    `author` VARCHAR(150) NULL,
    `banner_url` TEXT NULL,
    `pdf_url` TEXT NULL,
    `tags` JSON NULL,
    `drive_folder_id` VARCHAR(64) NULL,

    INDEX `content_items_tenant_id_type_published_at_idx`(`tenant_id`, `type`, `published_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `struktur_members` (
    `id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `position` VARCHAR(190) NULL,
    `division` VARCHAR(150) NULL,
    `period` VARCHAR(60) NULL,
    `photo_url` TEXT NULL,
    `bio` TEXT NULL,
    `phone` VARCHAR(40) NULL,
    `email` VARCHAR(190) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `groups` ADD CONSTRAINT `groups_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_batches` ADD CONSTRAINT `group_batches_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_members` ADD CONSTRAINT `group_members_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `monitoring_records` ADD CONSTRAINT `monitoring_records_mentor_id_fkey` FOREIGN KEY (`mentor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
