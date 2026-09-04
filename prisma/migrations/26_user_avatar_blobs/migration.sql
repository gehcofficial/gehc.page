-- JPEG foto profil kustom. Dijalankan idempotent lewat server/_migrate-user-avatar-blobs.cjs.

CREATE TABLE IF NOT EXISTS user_avatars (
  user_id VARCHAR(64) NOT NULL,
  data MEDIUMBLOB NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
