/**
 * Idempotent (F5.2 — catatan peserta Mentoring Day):
 *   worship_notes
 *
 * Jalankan: npm run db:migrate:worship-notes[:staging|:prod]
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const DDL = [
  `CREATE TABLE IF NOT EXISTS \`worship_notes\` (
    \`id\` VARCHAR(64) NOT NULL,
    \`session_id\` VARCHAR(64) NOT NULL,
    \`user_id\` VARCHAR(64) NOT NULL,
    \`topic_code\` VARCHAR(40) NOT NULL,
    \`content\` TEXT NOT NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`worship_notes_session_id_user_id_topic_code_key\`(\`session_id\`, \`user_id\`, \`topic_code\`),
    INDEX \`worship_notes_session_id_topic_code_idx\`(\`session_id\`, \`topic_code\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
];

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

  for (const ddl of DDL) {
    const name = /`([a-z_]+)`/.exec(ddl)?.[1] || '?';
    const [t] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [name],
    );
    if (t.length) {
      console.log(`tabel ${name} sudah ada`);
      continue;
    }
    await conn.query(ddl);
    console.log(`✓ tabel ${name} dibuat`);
  }

  await conn.end();
  console.log('✓ Selesai (F5.2: catatan mentoring).');
})().catch((e) => {
  console.error('Gagal migrasi worship notes:', e?.message || e);
  process.exit(1);
});
