-- Kalender gerejawi bertanggal: hari raya liturgis, tanggal tetap GMIM, agenda jemaat.
-- Dijalankan idempotent lewat server/_migrate-church-calendar.cjs.

CREATE TABLE IF NOT EXISTS church_calendar_entries (
  id VARCHAR(64) NOT NULL,
  tenant_id VARCHAR(16) NOT NULL DEFAULT 'tenant-youth',
  start_date DATE NOT NULL,
  end_date DATE NULL,
  all_day TINYINT(1) NOT NULL DEFAULT 1,
  level VARCHAR(16) NOT NULL,
  source VARCHAR(16) NOT NULL,
  season VARCHAR(32) NULL,
  name VARCHAR(160) NOT NULL,
  name_en VARCHAR(160) NULL,
  scripture_ref VARCHAR(120) NULL,
  notes TEXT NULL,
  is_public TINYINT(1) NOT NULL DEFAULT 0,
  church_program_id VARCHAR(64) NULL,
  created_by_id VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY church_calendar_natural (tenant_id, source, name, start_date),
  KEY church_calendar_tenant_start_idx (tenant_id, start_date),
  KEY church_calendar_public_start_idx (is_public, start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
