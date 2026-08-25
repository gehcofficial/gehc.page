-- AlterTable
ALTER TABLE `content_items` ADD COLUMN `event_date` DATE NULL,
    ADD COLUMN `is_featured_event` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `location_detail` VARCHAR(190) NULL;
