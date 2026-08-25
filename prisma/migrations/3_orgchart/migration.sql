-- AlterTable
ALTER TABLE `struktur_members` ADD COLUMN `is_open_role` BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
