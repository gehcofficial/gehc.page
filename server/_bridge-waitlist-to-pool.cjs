require('dotenv').config();
const mysql = require('mysql2/promise');
const crypto = require('crypto');

const wpId = () => `wp-bridge-${crypto.randomUUID()}`;

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

  const [entries] = await conn.query(
    `SELECT id, name, email, phone, gender, status, gifts_top5, gifts_scores, talents, assigned_group_id, created_at
     FROM waitlist_entries WHERE status IN ('WAITLISTED', 'PROFILED', 'ASSIGNED')`,
  );

  let created = 0;
  let skipped = 0;

  for (const e of entries) {
    let userId = null;
    if (e.email) {
      const [users] = await conn.query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [e.email]);
      if (users.length) userId = users[0].id;
    }

    const giftsDone = e.gifts_top5 != null;
    const status = e.status === 'ASSIGNED' ? 'ROLE_ASSIGNED' : giftsDone ? 'PROFILE_COMPLETED' : 'WAITING_POOL';

    const [existing] = await conn.query(
      `SELECT id FROM waiting_pool WHERE email = ? OR (user_id IS NOT NULL AND user_id = ?) LIMIT 1`,
      [e.email || '', userId || ''],
    );
    if (existing.length) {
      skipped++;
      continue;
    }

    const id = wpId();
    await conn.query(
      `INSERT INTO waiting_pool
        (id, user_id, name, email, phone, gender, status, gift_test_done, gifts_top5, gifts_scores, talents,
         profile_completed, profile_completed_at, source_event, registered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        e.name,
        e.email,
        e.phone,
        e.gender,
        status,
        giftsDone,
        e.gifts_top5 ? JSON.stringify(e.gifts_top5) : null,
        e.gifts_scores ? JSON.stringify(e.gifts_scores) : null,
        e.talents ? JSON.stringify(e.talents) : null,
        giftsDone,
        giftsDone ? new Date() : null,
        'Legacy WaitlistEntry',
        e.created_at || new Date(),
      ],
    );
    created++;
  }

  console.log(`Bridge complete: ${created} created, ${skipped} skipped (${entries.length} total)`);
  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
