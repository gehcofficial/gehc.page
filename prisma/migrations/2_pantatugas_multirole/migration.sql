-- DropForeignKey
ALTER TABLE `user_roles` DROP FOREIGN KEY `user_roles_user_id_fkey`;

-- DropIndex
DROP INDEX `user_roles_user_id_tenant_id_key` ON `user_roles`;

-- AlterTable
ALTER TABLE `struktur_members` ADD COLUMN `subdivision` VARCHAR(100) NULL;

-- CreateIndex
CREATE INDEX `struktur_members_division_idx` ON `struktur_members`(`division`);

-- CreateIndex
CREATE INDEX `user_roles_user_id_tenant_id_idx` ON `user_roles`(`user_id`, `tenant_id`);

-- Catatan: FK `attendance_records_recorded_by_id_fkey` sudah ada sejak 0_init —
-- tidak perlu dibuat ulang (diff false-positive setelah prisma format).
