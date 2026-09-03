-- Check-in hari H, kanal WA, payung gerejawi, rencana bulanan.
-- Dijalankan idempotent lewat server/_migrate-event-checkin.cjs.

CREATE TABLE IF NOT EXISTS church_programs (
  id VARCHAR(64) NOT NULL,
  tenant_id VARCHAR(16) NOT NULL DEFAULT 'tenant-youth',
  scope VARCHAR(16) NOT NULL,
  parent_id VARCHAR(64) NULL,
  kolom_id VARCHAR(64) NULL,
  season VARCHAR(32) NULL,
  name VARCHAR(160) NOT NULL,
  description TEXT NULL,
  year INT NULL,
  created_by_id VARCHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY church_programs_tenant_scope_idx (tenant_id, scope),
  KEY church_programs_parent_idx (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_check_ins (
  id VARCHAR(64) NOT NULL,
  event_id VARCHAR(64) NOT NULL,
  waiting_pool_id VARCHAR(64) NULL,
  user_id VARCHAR(64) NULL,
  code VARCHAR(190) NOT NULL,
  result VARCHAR(16) NOT NULL,
  scanned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  scanned_by_id VARCHAR(64) NOT NULL,
  PRIMARY KEY (id),
  KEY event_check_ins_event_scanned_idx (event_id, scanned_at),
  KEY event_check_ins_pool_idx (waiting_pool_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS channel_links (
  id VARCHAR(64) NOT NULL,
  kind VARCHAR(24) NOT NULL,
  ref_id VARCHAR(64) NOT NULL,
  label VARCHAR(160) NULL,
  url VARCHAR(512) NOT NULL,
  updated_by_id VARCHAR(64) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY channel_links_kind_ref (kind, ref_id),
  KEY channel_links_kind_idx (kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ministry_month_plans (
  id VARCHAR(64) NOT NULL,
  `year_month` VARCHAR(7) NOT NULL,
  theme VARCHAR(190) NULL,
  notes TEXT NULL,
  weeks JSON NULL,
  created_by_id VARCHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY ministry_month_plans_year_month (`year_month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ministry_week_deliverables (
  id VARCHAR(64) NOT NULL,
  plan_id VARCHAR(64) NOT NULL,
  week_index INT NOT NULL,
  division VARCHAR(24) NOT NULL,
  kind VARCHAR(24) NULL,
  title VARCHAR(190) NOT NULL,
  notes TEXT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'TODO',
  PRIMARY KEY (id),
  KEY ministry_week_deliverables_plan_week (plan_id, week_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Kolom pada tabel yang sudah ada. IF NOT EXISTS didukung TiDB.
ALTER TABLE `EventProgram` ADD COLUMN IF NOT EXISTS kind VARCHAR(16) NOT NULL DEFAULT 'KHUSUS';
ALTER TABLE `EventProgram` ADD COLUMN IF NOT EXISTS church_program_id VARCHAR(64) NULL;
ALTER TABLE `EventProgram` ADD INDEX IF NOT EXISTS EventProgram_church_program_idx (church_program_id);

ALTER TABLE event_attendees ADD COLUMN IF NOT EXISTS checked_in_at DATETIME(3) NULL;
ALTER TABLE event_attendees ADD COLUMN IF NOT EXISTS checked_in_by_id VARCHAR(64) NULL;

ALTER TABLE waiting_pool ADD COLUMN IF NOT EXISTS event_checked_in_at DATETIME(3) NULL;
ALTER TABLE waiting_pool ADD COLUMN IF NOT EXISTS event_checked_in_by_id VARCHAR(64) NULL;
