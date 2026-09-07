ALTER TABLE `users` ADD COLUMN `given_name` VARCHAR(80) NULL;
ALTER TABLE `users` ADD COLUMN `middle_name` VARCHAR(80) NULL;
ALTER TABLE `users` ADD COLUMN `family_name` VARCHAR(80) NULL;
ALTER TABLE `users` ADD COLUMN `church_title` VARCHAR(8) NULL;
ALTER TABLE `users` ADD COLUMN `academic_titles` JSON NULL;
