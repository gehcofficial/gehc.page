require('dotenv').config();
const mysql = require('mysql2/promise');

/**
 * Notifikasi & Pengumuman:
 * - tabel push_subscriptions, notification_preferences, announcements
 * - kolom notifications.category / announcement_id / sender_role
 * - perluas enum notifications.type (ANNOUNCEMENT, SWAP_REQUEST, ALBUM_USULAN)
 * - migrasi baris langganan lama (notifications judul 'Push Subscription') → push_subscriptions
 * Idempotent.
 */
(async () => {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL missing');
  const u = new URL(raw);
  const conn = await mysql.createConnection({
    host: u.hostname,
    port: Number(u.port || 4000),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '').split('?')[0],
    ssl: { rejectUnauthorized: true },
  });

  await conn.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      endpoint VARCHAR(500) NOT NULL,
      p256dh VARCHAR(255) NOT NULL,
      auth VARCHAR(255) NOT NULL,
      user_agent VARCHAR(255) NULL,
      failure_count INT NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY push_subscriptions_endpoint_key (endpoint),
      KEY push_subscriptions_user_id_idx (user_id)
    )
  `);
  console.log('push_subscriptions ready');

  await conn.query(`
    CREATE TABLE IF NOT EXISTS notification_preferences (
      user_id VARCHAR(64) NOT NULL PRIMARY KEY,
      announcement BOOLEAN NOT NULL DEFAULT true,
      warta BOOLEAN NOT NULL DEFAULT true,
      kegiatan BOOLEAN NOT NULL DEFAULT true,
      penatalayan BOOLEAN NOT NULL DEFAULT true,
      tugas BOOLEAN NOT NULL DEFAULT true,
      pengingat BOOLEAN NOT NULL DEFAULT true,
      birthday BOOLEAN NOT NULL DEFAULT true,
      materi BOOLEAN NOT NULL DEFAULT true,
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    )
  `);
  console.log('notification_preferences ready');

  await conn.query(`
    CREATE TABLE IF NOT EXISTS announcements (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      title VARCHAR(190) NOT NULL,
      message TEXT NULL,
      href VARCHAR(300) NULL,
      sender_id VARCHAR(64) NULL,
      sender_role VARCHAR(32) NOT NULL,
      audience_type VARCHAR(16) NOT NULL,
      audience_roles JSON NULL,
      audience_divisions JSON NULL,
      audience_group_ids JSON NULL,
      audience_user_ids JSON NULL,
      category VARCHAR(24) NOT NULL,
      priority VARCHAR(16) NOT NULL DEFAULT 'INFO',
      publish_at DATETIME(3) NOT NULL,
      expires_at DATETIME(3) NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'SCHEDULED',
      sent_at DATETIME(3) NULL,
      sent_count INT NOT NULL DEFAULT 0,
      fail_count INT NOT NULL DEFAULT 0,
      created_by_id VARCHAR(64) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY announcements_status_publish_idx (status, publish_at),
      KEY announcements_sender_idx (sender_id)
    )
  `);
  console.log('announcements ready');

  async function hasColumn(table, column) {
    const [rows] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column],
    );
    return rows.length > 0;
  }

  if (!(await hasColumn('notifications', 'category'))) {
    await conn.query(`ALTER TABLE notifications ADD COLUMN category VARCHAR(24) NULL`);
    console.log('notifications.category added');
  }
  if (!(await hasColumn('notifications', 'announcement_id'))) {
    await conn.query(`ALTER TABLE notifications ADD COLUMN announcement_id VARCHAR(64) NULL`);
    console.log('notifications.announcement_id added');
  }
  if (!(await hasColumn('notifications', 'sender_role'))) {
    await conn.query(`ALTER TABLE notifications ADD COLUMN sender_role VARCHAR(32) NULL`);
    console.log('notifications.sender_role added');
  }

  const [typeCol] = await conn.query(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'type'`,
  );
  const typeStr = String(typeCol[0]?.COLUMN_TYPE || '');
  if (!typeStr.includes('ANNOUNCEMENT') || !typeStr.includes('SWAP_REQUEST') || !typeStr.includes('ALBUM_USULAN')) {
    await conn.query(
      `ALTER TABLE notifications MODIFY COLUMN type ENUM(
        'IDLE_FLAG','MITOSIS_ALERT','MERGER_SUGGESTION','MENTION','ROLE_ASSIGNED',
        'RUNBOOK_DUE','CATALOG_REMINDER','EVENT_ARCHIVED','APPROVAL_ITEM','DRIVE_DRIFT',
        'BIRTHDAY_WISH','ANNOUNCEMENT','SWAP_REQUEST','ALBUM_USULAN'
      ) NOT NULL`,
    );
    console.log('notifications.type enum widened');
  }

  // Migrasi langganan lama (baris hack) → push_subscriptions.
  const [subs] = await conn.query(
    `SELECT id, member_id, message FROM notifications WHERE title = 'Push Subscription'`,
  );
  let migrated = 0;
  let removed = 0;
  for (const row of subs) {
    const rawMessage = String(row.message || '');
    let parsed = null;
    try { parsed = JSON.parse(rawMessage.replace(/^json:/, '')); } catch { parsed = null; }
    const endpoint = parsed?.endpoint;
    const p256dh = parsed?.keys?.p256dh;
    const auth = parsed?.keys?.auth;
    if (row.member_id && endpoint && p256dh && auth) {
      const id = 'psub-' + Math.random().toString(36).slice(2, 12);
      const [res] = await conn.query(
        `INSERT IGNORE INTO push_subscriptions (id, user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?, ?)`,
        [id, row.member_id, String(endpoint).slice(0, 500), String(p256dh).slice(0, 255), String(auth).slice(0, 255)],
      );
      if (res.affectedRows) migrated += 1;
    }
    await conn.query(`DELETE FROM notifications WHERE id = ?`, [row.id]);
    removed += 1;
  }
  if (subs.length) console.log(`langganan lama: ${migrated} dimigrasikan, ${removed} baris hack dihapus`);

  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
