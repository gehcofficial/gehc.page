-- Unified profile photos: Google default + optional Drive custom
ALTER TABLE `users` ADD COLUMN `avatar_google` TEXT NULL;
ALTER TABLE `users` ADD COLUMN `avatar_source` VARCHAR(16) NOT NULL DEFAULT 'GOOGLE';
ALTER TABLE `users` ADD COLUMN `avatar_drive_file_id` VARCHAR(128) NULL;

ALTER TABLE `struktur_members` ADD COLUMN `user_id` VARCHAR(64) NULL;
CREATE INDEX `struktur_members_user_id_idx` ON `struktur_members`(`user_id`);

ALTER TABLE `testimonials` ADD COLUMN `user_id` VARCHAR(64) NULL;
CREATE INDEX `testimonials_user_id_idx` ON `testimonials`(`user_id`);

UPDATE `users` SET `avatar_google` = `avatar` WHERE `avatar` IS NOT NULL AND `avatar_google` IS NULL;
