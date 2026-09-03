ALTER TABLE users ADD COLUMN reset_token VARCHAR(64) NULL;
ALTER TABLE users ADD COLUMN reset_token_expires_at DATETIME(3) NULL;
CREATE UNIQUE INDEX users_reset_token_key ON users(reset_token);
