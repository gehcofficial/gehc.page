/**
 * Migrasi 33: content_items.event_id — konten agenda dikelola by-event.
 * Idempotent — aman dijalankan berulang. Backfill cnt-bakutau → evt-baku-tau-4-0.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

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
  try {
    const [cols] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'content_items' AND COLUMN_NAME = 'event_id'`,
    );
    if (!cols.length) {
      await conn.query('ALTER TABLE content_items ADD COLUMN event_id VARCHAR(64) NULL');
      console.log('event_id added');
    } else {
      console.log('event_id exists');
    }
    await conn.query('CREATE INDEX content_items_event_id_idx ON content_items (event_id)').catch(() => null);
    const [upd] = await conn.query(
      `UPDATE content_items SET event_id = 'evt-baku-tau-4-0' WHERE id = 'cnt-bakutau' AND (event_id IS NULL OR event_id = '')`,
    );
    if (upd.affectedRows) console.log(`cnt-bakutau tertaut (${upd.affectedRows})`);
    else console.log('cnt-bakutau sudah tertaut / tidak ada');

    // Draf konten untuk event yang belum punya (agar muncul di alur by-event).
    const [bare] = await conn.query(
      `SELECT e.id, e.name FROM EventProgram e
       LEFT JOIN content_items c ON c.event_id = e.id AND c.type = 'ACTIVITY'
       WHERE c.id IS NULL`,
    );
    let drafts = 0;
    for (const ev of bare) {
      const id = `cnt-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${drafts}`;
      await conn.query(
        `INSERT INTO content_items (id, tenant_id, type, title, category, is_featured_event, is_published, banner_url, event_id)
         VALUES (?, 'tenant-youth', 'ACTIVITY', ?, 'Lainnya', 0, 0, '', ?)`,
        [id, String(ev.name || 'Kegiatan').slice(0, 255), ev.id],
      ).catch(() => null);
      drafts += 1;
    }
    console.log(`draf konten dibuat: ${drafts}`);
  } finally {
    await conn.end();
  }
  console.log('OK content event link');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
