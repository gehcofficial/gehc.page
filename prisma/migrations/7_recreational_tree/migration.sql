-- Hierarki rekreasional: parent_id, selectable, sort_order
ALTER TABLE `recreational_groups`
  ADD COLUMN `parent_id` VARCHAR(64) NULL,
  ADD COLUMN `selectable` TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN `sort_order` INT NOT NULL DEFAULT 0;

CREATE INDEX `recreational_groups_parent_id_idx` ON `recreational_groups`(`parent_id`);
CREATE INDEX `recreational_groups_kind_idx` ON `recreational_groups`(`kind`);

-- Seed lengkap: node server/_seed-recreational.cjs
