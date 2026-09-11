/**
 * Merge 10 grup legacy UPPERCASE (grp-<nama>, tenant-bapak, artefak seed retreat)
 * ke kanonis grp-1..10 (tenant-youth).
 * - Default: DRY-RUN (laporan counts). Migrate penuh: node ... --apply
 * - Backup CSV ditulis ke backups/ sebelum --apply.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('node:fs');
const path = require('node:path');

const APPLY = process.argv.includes('--apply');

async function tableCols(conn, table) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table],
  ).catch(() => [[]]);
  return new Set(rows.map((r) => r.COLUMN_NAME));
}

async function main() {
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

  const [groups] = await conn.query('SELECT id, tenant_id, name, member_count, status FROM `groups` ORDER BY name');
  const legacy = groups.filter((g) => /^grp-[a-z]+$/.test(g.id) && !/^grp-\d+$/.test(g.id));
  const canonByName = new Map();
  for (const g of groups) {
    if (/^grp-\d+$/.test(g.id)) canonByName.set(String(g.name).toUpperCase(), g);
  }
  console.log(`groups total=${groups.length} legacy=${legacy.length}`);
  const pairs = [];
  for (const lg of legacy) {
    const cg = canonByName.get(String(lg.name).toUpperCase());
    console.log(`- legacy ${lg.id} (${lg.name}, tenant=${lg.tenant_id}) -> ${cg ? `${cg.id} (${cg.name})` : 'TIDAK ADA PASANGAN!'}`);
    if (cg) pairs.push([lg, cg]);
  }

  // Referensi per legacy id
  const probes = [
    ['group_members', 'group_id'],
    ['user_roles', 'group_id'],
    ['group_batches', 'group_id'],
    ['group_albums', 'group_id'],
    ['attendance_records', 'group_id'],
    ['monitoring_records', 'group_id'],
    ['mentor_transitions', 'group_id'],
    ['role_assignments', 'group_id'],
    ['serving_assignments', 'responsible_group_id'],
    ['serving_assignments', 'host_group_id'],
  ];
  const counts = {};
  for (const [table, col] of probes) {
    const cols = await tableCols(conn, table);
    if (!cols.has(col)) { console.log(`  (skip ${table}.${col} — kolom tidak ada)`); continue; }
    const ids = legacy.map((g) => g.id);
    if (!ids.length) break;
    const [rows] = await conn.query(
      `SELECT \`${col}\` AS gid, COUNT(*) AS n FROM \`${table}\` WHERE \`${col}\` IN (${ids.map(() => '?').join(',')}) GROUP BY \`${col}\``,
      ids,
    ).catch((e) => { console.log(`  (skip ${table}: ${e.message.slice(0, 80)})`); return [[]]; });
    for (const r of rows || []) {
      counts[`${table}.${col}:${r.gid}`] = r.n;
      console.log(`  ${table}.${col} ${r.gid} = ${r.n}`);
    }
  }
  // channel_links GROUP
  try {
    const ids = legacy.map((g) => g.id);
    const [rows] = await conn.query(
      `SELECT ref_id AS gid, COUNT(*) AS n FROM channel_links WHERE kind = 'GROUP' AND ref_id IN (${ids.map(() => '?').join(',')}) GROUP BY ref_id`,
      ids,
    );
    for (const r of rows || []) { counts[`channel_links:${r.gid}`] = r.n; console.log(`  channel_links ${r.gid} = ${r.n}`); }
  } catch (e) { console.log(`  (skip channel_links: ${e.message.slice(0, 80)})`); }

  // Cek duplikat nama lain per tenant (untuk unique key)
  const [dups] = await conn.query(
    `SELECT tenant_id, UPPER(name) AS nm, COUNT(*) AS n, GROUP_CONCAT(id) AS ids FROM \`groups\`
     GROUP BY tenant_id, UPPER(name) HAVING n > 1`,
  ).catch(() => [[]]);
  const otherDups = (dups || []).filter((d) => !legacy.some((g) => String(d.ids).split(',').includes(g.id)));
  console.log(`duplikat-nama lain di luar legacy: ${otherDups.length}`, otherDups.length ? JSON.stringify(otherDups) : '');

  if (!APPLY) {
    console.log('\nDRY-RUN selesai. Jalankan dengan --apply untuk migrasi + hapus legacy.');
    await conn.end();
    return;
  }

  // Backup CSV
  const dir = path.join(__dirname, '..', 'backups', `legacy-groups-${new Date().toISOString().slice(0, 10)}`);
  fs.mkdirSync(dir, { recursive: true });
  const legacyIds = legacy.map((g) => g.id);
  const dumps = [
    ['groups', 'id', legacyIds],
    ['group_members', 'group_id', legacyIds],
    ['user_roles', 'group_id', legacyIds],
    ['group_batches', 'group_id', legacyIds],
    ['group_albums', 'group_id', legacyIds],
    ['attendance_records', 'group_id', legacyIds],
    ['monitoring_records', 'group_id', legacyIds],
    ['mentor_transitions', 'group_id', legacyIds],
    ['role_assignments', 'group_id', legacyIds],
  ];
  for (const [table, col, ids] of dumps) {
    try {
      const [rows] = await conn.query(`SELECT * FROM \`${table}\` WHERE \`${col}\` IN (${ids.map(() => '?').join(',')})`, ids);
      fs.writeFileSync(path.join(dir, `${table}.json`), JSON.stringify(rows, null, 1));
      console.log(`backup ${table}: ${(rows || []).length} baris`);
    } catch (e) { console.log(`backup skip ${table}: ${e.message.slice(0, 80)}`); }
  }

  await conn.beginTransaction();
  try {
    const move = async (table, col, fromId, toId) => {
      const cols = await tableCols(conn, table);
      if (!cols.has(col)) return 0;
      const [r] = await conn.query(`UPDATE \`${table}\` SET \`${col}\` = ? WHERE \`${col}\` = ?`, [toId, fromId]);
      return r.affectedRows || 0;
    };
    for (const [lg, cg] of pairs) {
      console.log(`merge ${lg.id} -> ${cg.id}`);
      // batches: gabung per period bila konflik
      const cols = await tableCols(conn, 'group_batches');
      if (cols.has('group_id')) {
        const [lb] = await conn.query('SELECT * FROM group_batches WHERE group_id = ?', [lg.id]);
        for (const b of lb || []) {
          const [ex] = await conn.query('SELECT * FROM group_batches WHERE group_id = ? AND period = ? LIMIT 1', [cg.id, b.period]);
          if (!ex.length) {
            await conn.query('UPDATE group_batches SET group_id = ? WHERE id = ?', [cg.id, b.id]);
          } else {
            // isi field kosong kanonis dari legacy, lalu hapus baris legacy
            const e = ex[0];
            const fill = {};
            for (const f of ['batch_label', 'mentor_name', 'comentor_name', 'mentor_user_id', 'comentor_user_id', 'theme']) {
              if ((e[f] === null || e[f] === '') && b[f] !== null && b[f] !== '') fill[f] = b[f];
            }
            if (Object.keys(fill).length) {
              await conn.query(`UPDATE group_batches SET ${Object.keys(fill).map((f) => `\`${f}\` = ?`).join(', ')} WHERE id = ?`, [...Object.values(fill), e.id]);
            }
            await conn.query('DELETE FROM group_batches WHERE id = ?', [b.id]);
          }
        }
      }
      for (const [t, c] of [['group_members', 'group_id'], ['user_roles', 'group_id'], ['group_albums', 'group_id'], ['attendance_records', 'group_id'], ['monitoring_records', 'group_id'], ['mentor_transitions', 'group_id'], ['role_assignments', 'group_id']]) {
        const n = await move(t, c, lg.id, cg.id);
        if (n) console.log(`  ${t}: ${n}`);
      }
      for (const c of ['responsible_group_id', 'host_group_id']) {
        const n = await move('serving_assignments', c, lg.id, cg.id);
        if (n) console.log(`  serving_assignments.${c}: ${n}`);
      }
      try {
        const [r] = await conn.query("UPDATE channel_links SET ref_id = ? WHERE kind = 'GROUP' AND ref_id = ?", [cg.id, lg.id]);
        if (r.affectedRows) console.log(`  channel_links: ${r.affectedRows}`);
      } catch {}
      await conn.query('DELETE FROM `groups` WHERE id = ?', [lg.id]);
      console.log(`  hapus ${lg.id}`);
    }
    // dedupe user_roles identik (user,tenant,role,group) sisakan id terkecil
    try {
      const [dupes] = await conn.query(
        `SELECT user_id, tenant_id, role, group_id, MIN(id) AS keepId, COUNT(*) AS n FROM user_roles
         GROUP BY user_id, tenant_id, role, group_id HAVING n > 1 LIMIT 200`,
      );
      for (const d of dupes || []) {
        await conn.query('DELETE FROM user_roles WHERE user_id = ? AND tenant_id = ? AND role = ? AND (group_id <=> ?) AND id <> ?', [d.user_id, d.tenant_id, d.role, d.group_id, d.keepId]);
      }
      if ((dupes || []).length) console.log(`dedupe user_roles: ${dupes.length} grup kunci`);
    } catch (e) { console.log(`dedupe skip: ${e.message.slice(0, 80)}`); }
    // hitung ulang member_count kanonis
    for (const [, cg] of pairs) {
      await conn.query('UPDATE `groups` SET member_count = (SELECT COUNT(*) FROM group_members WHERE group_id = ?) WHERE id = ?', [cg.id, cg.id]);
    }
    await conn.commit();
    console.log('COMMIT OK');
  } catch (e) {
    await conn.rollback();
    console.error('ROLLBACK:', e.message);
    process.exitCode = 1;
  }
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
