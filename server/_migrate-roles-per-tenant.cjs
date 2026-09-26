/**
 * Migrasi peran ke tenant unit (F3.3).
 *
 *  1) Pindah peran jemaat (SUPERADMIN, BPMJ) → `tenant-jemaat` (berlaku lintas unit).
 *  2) Gandakan peran kepemimpinan unit (KOMISI, COMMITTEE, ALUMNI) ke tenant
 *     sesuai `users.bipra` (mis. BAPAK → tenant-men). Peran asli tidak dihapus.
 *     `group_id` dikosongkan pada salinan (grup = milik Pemuda).
 *  3) MENTOR/CO_MENTOR/MENTEE dibiarkan (khusus Pemuda).
 *
 * Idempotent: aman dijalankan berulang. Default DRY-RUN.
 *
 * Flags:
 *   --apply     benar-benar menulis (tanpa ini = dry-run)
 *
 * Env: DATABASE_URL (jalankan via `dotenv -e .env.staging|.env.production`).
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const { JEMAAT_TENANT_ID, JEMAAT_ROLES, UNIT_LEAD_ROLES, tenantForBipra } = require('./lib/tenant-map.mjs');

const APPLY = process.argv.includes('--apply');

function connConfig(raw) {
  if (!raw) throw new Error('DATABASE_URL kosong');
  const u = new URL(raw);
  return {
    host: u.hostname,
    port: Number(u.port || 4000),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '').split('?')[0],
    ssl: { rejectUnauthorized: true },
  };
}

const inList = (arr) => arr.map((r) => `'${r}'`).join(', ');

async function main() {
  const c = await mysql.createConnection(connConfig(process.env.DATABASE_URL));
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  const [tenants] = await c.query('SELECT id FROM tenants');
  const tenantIds = new Set(tenants.map((t) => t.id));
  if (!tenantIds.has(JEMAAT_TENANT_ID)) throw new Error(`${JEMAAT_TENANT_ID} tidak ada — jalankan db:seed:tenants dulu.`);

  // ---------- 1) Pindah peran jemaat ----------
  const [jRows] = await c.query(
    `SELECT id, user_id, role FROM user_roles WHERE role IN (${inList(JEMAAT_ROLES)}) AND tenant_id <> ? ORDER BY id`,
    [JEMAAT_TENANT_ID],
  );
  let moved = 0;
  let dropped = 0;
  for (const r of jRows) {
    const [dup] = await c.query('SELECT id FROM user_roles WHERE user_id = ? AND tenant_id = ? AND role = ? LIMIT 1', [
      r.user_id,
      JEMAAT_TENANT_ID,
      r.role,
    ]);
    if (dup.length) {
      console.log(`- ${r.user_id} ${r.role}: sudah ada di jemaat → hapus duplikat lama.`);
      if (APPLY) await c.query('DELETE FROM user_roles WHERE id = ?', [r.id]);
      dropped += 1;
    } else {
      if (APPLY) await c.query('UPDATE user_roles SET tenant_id = ?, group_id = NULL WHERE id = ?', [JEMAAT_TENANT_ID, r.id]);
      moved += 1;
    }
  }
  console.log(`\n1) Peran jemaat: ${moved} dipindah, ${dropped} duplikat dihapus.`);

  // ---------- 2) Gandakan peran unit per BIPRA ----------
  const [uRows] = await c.query(
    `SELECT r.id, r.user_id, r.role, r.tenant_id, u.bipra
       FROM user_roles r JOIN users u ON u.id = r.user_id
      WHERE r.role IN (${inList(UNIT_LEAD_ROLES)}) AND r.tenant_id <> ?
      ORDER BY r.id`,
    [JEMAAT_TENANT_ID],
  );
  let copied = 0;
  let skipped = 0;
  for (const r of uRows) {
    const target = tenantForBipra(r.bipra);
    if (!target || target === r.tenant_id || !tenantIds.has(target)) {
      skipped += 1;
      continue;
    }
    const [dup] = await c.query(
      'SELECT id FROM user_roles WHERE user_id = ? AND tenant_id = ? AND role = ? LIMIT 1',
      [r.user_id, target, r.role],
    );
    if (dup.length) {
      skipped += 1;
      continue;
    }
    console.log(`- ${r.user_id} ${r.role}: ${r.tenant_id} → ${target} (${r.bipra})`);
    if (APPLY) {
      await c.query('INSERT INTO user_roles (user_id, tenant_id, role, group_id) VALUES (?, ?, ?, NULL)', [
        r.user_id,
        target,
        r.role,
      ]);
    }
    copied += 1;
  }
  console.log(`\n2) Gandakan peran unit: ${copied} dibuat, ${skipped} dilewati.`);

  await c.end();
  console.log(`\n${APPLY ? 'APPLY selesai.' : 'DRY-RUN selesai. Jalankan dengan --apply untuk menulis.'}`);
}

main().catch((err) => {
  console.error('Gagal:', err.message);
  process.exit(1);
});
