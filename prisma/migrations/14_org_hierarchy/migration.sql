-- Org hierarchy + membership kind (simpatisan)
ALTER TABLE `users` ADD COLUMN `membership_kind` ENUM('JEMAAT', 'SIMPATISAN') NOT NULL DEFAULT 'JEMAAT';

CREATE TABLE IF NOT EXISTS `org_nodes` (
  `id` VARCHAR(64) NOT NULL,
  `domain` VARCHAR(24) NOT NULL,
  `parent_id` VARCHAR(64) NULL,
  `slug` VARCHAR(80) NOT NULL,
  `label` VARCHAR(150) NOT NULL,
  `node_kind` VARCHAR(24) NOT NULL,
  `metadata` JSON NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `org_nodes_domain_slug_key` (`domain`, `slug`),
  INDEX `org_nodes_domain_idx` (`domain`),
  INDEX `org_nodes_parent_id_idx` (`parent_id`)
);

CREATE TABLE IF NOT EXISTS `org_assignments` (
  `id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `org_node_id` VARCHAR(64) NOT NULL,
  `position` VARCHAR(150) NULL,
  `role_assignment_id` VARCHAR(64) NULL,
  `assigned_by` VARCHAR(64) NOT NULL,
  `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (`id`),
  INDEX `org_assignments_user_id_idx` (`user_id`),
  INDEX `org_assignments_org_node_id_idx` (`org_node_id`),
  INDEX `org_assignments_assigned_by_idx` (`assigned_by`)
);
