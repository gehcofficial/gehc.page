-- Drive ownership: album kelompok, arsip acara, kesaksian, BZP, pastoral.

CREATE TABLE IF NOT EXISTS group_albums (
  id VARCHAR(64) NOT NULL,
  group_id VARCHAR(64) NOT NULL,
  title VARCHAR(190) NOT NULL,
  kind VARCHAR(24) NOT NULL DEFAULT 'ADHOC',
  occurred_on DATE NOT NULL,
  location VARCHAR(190) NULL,
  event_id VARCHAR(64) NULL,
  drive_folder_id VARCHAR(128) NULL,
  cover_drive_file_id VARCHAR(128) NULL,
  preview_file_ids JSON NULL,
  created_by_id VARCHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX group_albums_group_occurred (group_id, occurred_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pastoral_care_notes (
  id VARCHAR(64) NOT NULL,
  subject_user_id VARCHAR(64) NOT NULL,
  reporter_user_id VARCHAR(64) NOT NULL,
  kind VARCHAR(24) NOT NULL,
  note TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
  expires_at DATETIME(3) NULL,
  drive_folder_id VARCHAR(128) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX pastoral_subject_status (subject_user_id, status),
  INDEX pastoral_status_expires (status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `EventProgram` ADD COLUMN IF NOT EXISTS archive_folder_id VARCHAR(128) NULL;
ALTER TABLE `EventProgram` ADD COLUMN IF NOT EXISTS preview_file_ids JSON NULL;
ALTER TABLE `testimonials` ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'DRAFT';
ALTER TABLE `testimonials` ADD COLUMN IF NOT EXISTS inbox_drive_file_id VARCHAR(128) NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS invoice_drive_file_id VARCHAR(128) NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS payment_proof_drive_file_id VARCHAR(128) NULL;
