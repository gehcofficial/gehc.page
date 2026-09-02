CREATE TABLE IF NOT EXISTS access_groups (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(80) NOT NULL,
  description TEXT NULL,
  roles JSON NOT NULL,
  org_node_id VARCHAR(64) NULL,
  group_id VARCHAR(64) NULL,
  auto_apply_on_login BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY access_groups_slug (slug),
  KEY access_groups_is_active_idx (is_active)
);

CREATE TABLE IF NOT EXISTS access_group_members (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  group_id VARCHAR(64) NOT NULL,
  email VARCHAR(190) NOT NULL,
  user_id VARCHAR(64) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  added_by VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY access_group_members_group_email (group_id, email),
  KEY access_group_members_email_idx (email),
  KEY access_group_members_user_id_idx (user_id),
  CONSTRAINT access_group_members_group_fk FOREIGN KEY (group_id) REFERENCES access_groups(id) ON DELETE CASCADE
);
