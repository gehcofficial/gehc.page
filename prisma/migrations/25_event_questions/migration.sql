-- Bank soal event + assignment + jawaban + usulan Komisi.
-- Dijalankan idempotent lewat server/_migrate-event-questions.cjs.

CREATE TABLE IF NOT EXISTS event_question_bank (
  id VARCHAR(64) NOT NULL,
  `key` VARCHAR(64) NOT NULL,
  label VARCHAR(190) NOT NULL,
  hint TEXT NULL,
  `type` VARCHAR(16) NOT NULL,
  options JSON NULL,
  owner_division VARCHAR(24) NOT NULL,
  owner_subdivision VARCHAR(80) NOT NULL,
  show_if JSON NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY event_question_bank_key ( `key` ),
  KEY event_question_bank_status_sort (status, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_question_requests (
  id VARCHAR(64) NOT NULL,
  label VARCHAR(190) NOT NULL,
  hint TEXT NULL,
  `type` VARCHAR(16) NOT NULL,
  options JSON NULL,
  owner_division VARCHAR(24) NOT NULL,
  owner_subdivision VARCHAR(80) NOT NULL,
  reason TEXT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  created_by_id VARCHAR(64) NOT NULL,
  reviewed_by_id VARCHAR(64) NULL,
  reviewed_at DATETIME(3) NULL,
  admin_note TEXT NULL,
  approved_question_id VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY event_question_requests_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_question_assignments (
  id VARCHAR(64) NOT NULL,
  event_id VARCHAR(64) NOT NULL,
  question_id VARCHAR(64) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY event_question_assignments_event_q (event_id, question_id),
  KEY event_question_assignments_event (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_question_answers (
  id VARCHAR(64) NOT NULL,
  event_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  question_id VARCHAR(64) NOT NULL,
  value JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY event_question_answers_event_user_q (event_id, user_id, question_id),
  KEY event_question_answers_event_user (event_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
