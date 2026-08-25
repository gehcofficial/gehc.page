-- AlterTable
ALTER TABLE `users` ADD COLUMN `auth_provider` VARCHAR(16) NOT NULL DEFAULT 'GOOGLE',
    ADD COLUMN `password_hash` TEXT NULL;
