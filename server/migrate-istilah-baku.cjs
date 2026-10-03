/**
 * Istilah baku Indonesia (KBBI-proper) untuk sub-divisi, posisi & peran penatalayan.
 *
 * - Rename nilai lama → baru di: role_assignments, struktur_members,
 *   org_nodes (metadata + label bila sama), service_roles (+checklist),
 *   service_schedules (pindah baris merge).
 * - Merge (nonaktif sumber): Song Leader → Pemimpin Pujian;
 *   Pembaca Firman 2 → Pembaca Firman.
 * - Rename folder Drive pillar yang bernama sub lama (best-effort).
 *
 * Idempotent: hanya menyentuh nilai lama yang masih ada.
 * Default DRY-RUN; tulis dengan --apply.
 *
 *   node server/migrate-istilah-baku.cjs [--apply]
 *   npm run db:migrate:istilah[:staging|:prod]
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const APPLY = process.argv.includes('--apply');

const SUBS = {
  'Kasih Peduli & Benevolence': 'Kasih Peduli & Kedermawanan',
  'Merchandise & Produk': 'Cenderamata & Produk',
  'Kesaksian & Story': 'Kesaksian & Cerita',
  'Doa & Intercession': 'Doa & Syafaat',
};

const POSITIONS = {
  'Chairperson — Penatua Pemuda / Ketua Komisi': 'Ketua Komisi',
  'Chairperson - Penatua Pemuda / Ketua Komisi': 'Ketua Komisi',
  'Secretary — Sekretaris Komisi': 'Sekretaris Komisi',
  'Secretary - Sekretaris Komisi': 'Sekretaris Komisi',
  'Treasurer — Bendahara Komisi': 'Bendahara Komisi',
  'Treasurer - Bendahara Komisi': 'Bendahara Komisi',
  'Lead Equipper — Pembekal Mentor & Comentor': 'Pembekal Mentor & Co-mentor',
  'Lead Equipper - Pembekal Mentor & Comentor': 'Pembekal Mentor & Co-mentor',
  'PIC Acara & Rundown': 'Penanggung Jawab Acara & Rundown',
  'PIC Logistik & Fasilitas': 'Penanggung Jawab Logistik & Fasilitas',
  'PIC Konsumsi & Keramahan': 'Penanggung Jawab Konsumsi & Keramahan',
  'PIC Musik & Vokal': 'Penanggung Jawab Musik & Vokal',
  'PIC Desain & Publikasi': 'Penanggung Jawab Desain & Publikasi',
  'Koordinator Doa & Intercession': 'Koordinator Doa & Syafaat',
  'Koordinator Kesaksian & Story': 'Koordinator Kesaksian & Cerita',
  'Koordinator Merchandise & Produk': 'Koordinator Cenderamata & Produk',
};

const ROLES = {
  Liturgist: 'Pemimpin Liturgi',
  'Worship Leader': 'Pemimpin Pujian',
  Singer: 'Penyanyi',
  'MC / Pembawa Acara': 'Pembawa Acara',
  'Penerima Tamu / Usher': 'Penerima Tamu',
  'Operator Sound': 'Operator Tata Suara',
  'Operator Multimedia / Live Streaming': 'Operator Multimedia / Siaran Langsung',
  Kameramen: 'Videografer',
  'Kantoria / Paduan Suara': 'Paduan Suara',
  'Kolektor Persembahan': 'Pengumpul Persembahan',
  'Pembaca Firman 1': 'Pembaca Firman',
};

const MERGES = {
  'Song Leader': 'Pemimpin Pujian',
  'Pembaca Firman 2': 'Pembaca Firman',
};

async function updateWhere(conn, table, column, from, to, extra = '') {
  const [r] = await conn.query(
    `UPDATE \`${table}\` SET \`${column}\` = ? WHERE \`${column}\` = ? ${extra}`,
    [to, from],
  );
  return r.affectedRows || 0;
}

async function main() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL missing');
  const u = new URL(raw);
  const conn = await mysql.createConnection({
    host: u.hostname, port: Number(u.port || 4000),
    user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '').split('?')[0],
    ssl: { rejectUnauthorized: true },
  });
  console.log(`Istilah baku → mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  const stats = { subs: 0, positions: 0, roles: 0, moved: 0, deactivated: 0, orgMeta: 0, orgLabels: 0 };

  const run = async (fn) => (APPLY ? fn() : 0);

  // 1. Sub-divisi: role_assignments + struktur_members.
  for (const [from, to] of Object.entries(SUBS)) {
    const a = await run(() => updateWhere(conn, 'role_assignments', 'subdivision', from, to));
    const b = await run(() => updateWhere(conn, 'struktur_members', 'subdivision', from, to));
    stats.subs += a + b;
    if (!APPLY) {
      const [[x]] = await conn.query(
        'SELECT (SELECT COUNT(*) FROM role_assignments WHERE subdivision=?) + (SELECT COUNT(*) FROM struktur_members WHERE subdivision=?) n',
        [from, from],
      );
      if (x.n) console.log(`- sub "${from}" → "${to}": ${x.n} baris`);
    }
  }

  // 2. Posisi: role_assignments + struktur_members (+ yang memuat nama sub lama).
  const posMap = { ...POSITIONS };
  for (const [fromSub, toSub] of Object.entries(SUBS)) {
    posMap[`Koordinator ${fromSub}`] = `Koordinator ${toSub}`;
  }
  for (const [from, to] of Object.entries(posMap)) {
    const a = await run(() => updateWhere(conn, 'role_assignments', 'position', from, to));
    const b = await run(() => updateWhere(conn, 'struktur_members', 'position', from, to));
    stats.positions += a + b;
    if (!APPLY) {
      const [[x]] = await conn.query(
        'SELECT (SELECT COUNT(*) FROM role_assignments WHERE position=?) + (SELECT COUNT(*) FROM struktur_members WHERE position=?) n',
        [from, from],
      );
      if (x.n) console.log(`- posisi "${from}" → "${to}": ${x.n} baris`);
    }
  }

  // 3. org_nodes: metadata.subdivision/position + label bila sama dengan nilai lama.
  const allOld = [...Object.keys(SUBS), ...Object.keys(posMap)];
  try {
    const [nodes] = await conn.query('SELECT id, label, metadata FROM org_nodes');
    let meta = 0, labels = 0;
    for (const n of nodes) {
      let m = {};
      try { m = typeof n.metadata === 'string' ? JSON.parse(n.metadata) : (n.metadata || {}); } catch { m = {}; }
      let changed = false;
      for (const k of ['subdivision', 'position']) {
        const v = m[k];
        const nv = SUBS[v] || posMap[v];
        if (nv && nv !== v) { m[k] = nv; changed = true; }
      }
      let label = n.label;
      const nl = SUBS[label] || posMap[label];
      if (nl && nl !== label) { label = nl; labels += 1; }
      if (changed || label !== n.label) {
        meta += changed ? 1 : 0;
        if (APPLY) await conn.query('UPDATE org_nodes SET metadata=?, label=? WHERE id=?', [JSON.stringify(m), label, n.id]);
      }
    }
    stats.orgMeta = meta; stats.orgLabels = labels;
    console.log(`- org_nodes: ${APPLY ? 'diperbarui' : 'akan diperbarui'} metadata ${meta}, label ${labels}`);
  } catch (e) { console.warn(`  ! org_nodes dilewati: ${e.message.slice(0, 100)}`); }

  // 4. service_roles: rename + checklist + merge + nonaktif sumber.
  const roleIdByName = {};
  try {
    const [roles] = await conn.query('SELECT id, name FROM service_roles');
    for (const r of roles) roleIdByName[r.name] = r.id;
    for (const [from, to] of Object.entries(ROLES)) {
      if (!roleIdByName[from]) continue;
      if (roleIdByName[to]) {
        console.log(`- role "${from}": target "${to}" sudah ada — lewati rename`);
        continue;
      }
      if (APPLY) {
        await conn.query('UPDATE service_roles SET name=? WHERE id=?', [to, roleIdByName[from]]);
        await conn.query(
          "UPDATE service_roles SET checklist_template=REPLACE(checklist_template,'Liturgist','Pemimpin Liturgi') WHERE id=?",
          [roleIdByName[from]],
        );
      }
      roleIdByName[to] = roleIdByName[from];
      delete roleIdByName[from];
      stats.roles += 1;
      console.log(`- role "${from}" → "${to}"`);
    }
    for (const [from, to] of Object.entries(MERGES)) {
      const src = roleIdByName[from];
      const dst = roleIdByName[to];
      if (!src) { console.log(`- merge "${from}": sumber tidak ada — lewati`); continue; }
      if (!dst) { console.log(`- merge "${from}": target "${to}" tidak ada — lewati`); continue; }
      if (APPLY) {
        const [mv] = await conn.query('UPDATE service_schedules SET service_role_id=? WHERE service_role_id=?', [dst, src]);
        await conn.query('UPDATE service_roles SET is_active=0 WHERE id=?', [src]);
        stats.moved += mv.affectedRows || 0;
      } else {
        const [[c]] = await conn.query('SELECT COUNT(*) n FROM service_schedules WHERE service_role_id=?', [src]);
        console.log(`- merge "${from}" → "${to}": ${c.n} jadwal pindah + nonaktif sumber`);
      }
      stats.deactivated += 1;
    }
  } catch (e) { console.warn(`  ! service_roles dilewati: ${e.message.slice(0, 120)}`); }

  // 5. Folder Drive pillar bernama sub lama → rename (best-effort).
  try {
    const { findPillarFolders, renameFolder } = await import('./lib/drive-rename.mjs').catch(() => ({}));
    if (APPLY && findPillarFolders) {
      const renamed = await findPillarFolders(SUBS);
      console.log(`- Drive: ${renamed} folder diganti nama`);
    } else if (!APPLY) {
      console.log('- Drive: cek folder saat --apply (best-effort)');
    }
  } catch (e) { console.warn(`  ! Drive dilewati: ${e.message.slice(0, 100)}`); }

  console.log(`${APPLY ? 'APPLY' : 'DRY-RUN'} selesai:`, JSON.stringify(stats));
  await conn.end();
}

main().catch((e) => {
  console.error('Gagal:', e?.message || e);
  process.exit(1);
});
