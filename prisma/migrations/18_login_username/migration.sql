-- Login username + onboarding path (dual auth / invited track)
ALTER TABLE `users` ADD COLUMN `login_username` VARCHAR(40) NULL;
ALTER TABLE `users` ADD COLUMN `onboarding_path` VARCHAR(16) NOT NULL DEFAULT 'ORGANIC';
ALTER TABLE `users` ADD COLUMN `username_changed_at` DATETIME(3) NULL;

CREATE UNIQUE INDEX `users_login_username_key` ON `users`(`login_username`);
