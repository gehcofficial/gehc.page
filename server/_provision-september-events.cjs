/**
 * Provision event ibadah September (prod) agar tiap tanggal punya folder DIDASKALIA
 * sendiri + 3 subfolder, tanpa mengubah nama event (tetap pola tema prod).
 *
 * Yang dilakukan per event:
 *   1. set serviceType + metadata { weekIndex, yearMonth } (paritas perilaku staging)
 *   2. pastikan EventDivision DIDASKALIA ada
 *   3. createEventFolder(ev, 'DIDASKALIA') → folder "<nama> [EV:<slug>:DIDASKALIA]"
 *      + 01 Pembekalan Mentor - Co mentor / 02 Ringkasan Khotbah / 03 RHB 7 Hari
 *
 * Idempotent — aman diulang.
 *
 * Jalankan (lihat dulu, tidak menulis):
 *   dotenv -e .env.production -- node server/_provision-september-events.cjs --dry
 * Eksekusi:
 *   dotenv -e .env.production -- node server/_provision-september-events.cjs --apply
 */

require('dotenv/config');

const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');
const MODE = APPLY ? 'APPLY' : 'DRY';

const LIST_MODE = process.argv.some((a) => a.startsWith('--list='));
if (!APPLY && !process.argv.includes('--dry') && !LIST_MODE && !process.argv.includes('--move')) {
  console.log('Gunakan --dry (lihat), --apply (eksekusi), --list=<folderId>, atau --move.');
  process.exit(1);
}

// File Week 1 (milik 06 Sep) yang sekarang nyangkut di folder 13 Sep.
const MOVE_PLAN = [
  { name: 'RHB - Week 1 Path 1 - Apa itu Gereja.pdf', id: '1Occ3TBWT2XahugDSJTioBwBnZys57vUb', slot: 'rhb' },
  { name: 'RHB - Week 1 Path 2 - Apakah Kristen dan Gereja Satu.pdf', id: '1MKaNdPnLf6ye1_BftTwgCURtw3xDH2jh', slot: 'rhb' },
  { name: 'RHB - Week 1 Path 3 - Fondasi dalam Kristus.pdf', id: '1lbbTV2041HhhaEDihQVNtD7-U2yOZh4u', slot: 'rhb' },
  { name: 'RHB - Week 1 Path 4 - Tritunggal.pdf', id: '1fcKf2d4CA0cgs6goI8uCGS0CRr4RKWcj', slot: 'rhb' },
  { name: 'RHB - Week 1 Path 5 - Pekerjaan Roh Kudus.pdf', id: '19kwK2rr5ZIT6gHvCT_cCWqXIn_9od0DX', slot: 'rhb' },
  { name: 'RHB - Week 1 Path 6 - Kasih Allah sebagai Dasar Pelayanan.pdf', id: '1IcxWDrFMIQkRNb2uhYJMlfxSd8iunERy', slot: 'rhb' },
  { name: 'RHB - Week 1 Path 7 - Komunitas Pemuda - Sebelum Kita Diutus.pdf', id: '1kn4v8cXHZiCy3K9BvTGHHJ7dc8QW2Du8', slot: 'rhb' },
  { name: 'THE CHURCH BEGINS HERE.pdf', id: '1P3abVR0Mcmaw47G-BLZL8ShBnEmknEoy', slot: 'khotbah' },
];

const MOVE_FOLDERS = {
  src: { rhb: '1DQ6jlKgk57EBtEaDvM3FSK9oPw12OkDm', khotbah: '173zZ-SgXOCaGlZAKapp6k8NvtRjiGdDK' },
  dst: { rhb: '1SYM7BYUnSfCcGXHSt2HiOiqRhgiX2rzn', khotbah: '1OFmf9DpOLkp95vh84zJbrgmc2m-pKeg5' },
};

const EVENTS = [
  { id: 'evt-ibadah-pemuda-the-early-church-06-sep-20-mttodh5b', serviceType: 'MENTORING_DAY', weekIndex: 1 },
  { id: 'evt-ibadah-pemuda-living-together-13-sep-202-mttodke2', serviceType: 'SERVING_DAY', weekIndex: 2 },
  { id: 'evt-ibadah-pemuda-follow-the-true-voice-20-s-mttodmol', serviceType: 'SERVING_DAY', weekIndex: 3 },
  { id: 'evt-ibadah-pemuda-the-call-to-serve-27-sep-2-mttodoxj', serviceType: 'SERVING_DAY', weekIndex: 4 },
];

const YEAR_MONTH = '2026-09';

function wibMonth(iso) {
  if (!iso) return YEAR_MONTH;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return YEAR_MONTH;
  return new Date(t + 7 * 3600 * 1000).toISOString().slice(0, 7);
}

function wibDay(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  return new Date(t + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Susun spec event untuk satu bulan dari DB + urutan minggu di MinistryMonthPlan. */
async function discoverEvents(prisma, yearMonth) {
  const plan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth } });
  const weeks = plan ? (typeof plan.weeks === 'string' ? JSON.parse(plan.weeks) : plan.weeks) : [];
  const monthStart = new Date(`${yearMonth}-01T00:00:00.000Z`);
  const next = new Date(monthStart);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const events = await prisma.eventProgram.findMany({
    where: { eventDate: { gte: monthStart, lt: next } },
    orderBy: { eventDate: 'asc' },
  });
  return events.map((ev, i) => {
    const day = wibDay(ev.eventDate);
    const wk = Array.isArray(weeks) ? weeks.find((w) => String(w.date || '').slice(0, 10) === day) : null;
    const weekIndex = wk?.index || i + 1;
    return { id: ev.id, serviceType: weekIndex === 1 ? 'MENTORING_DAY' : 'SERVING_DAY', weekIndex };
  });
}

async function listMode(folderId) {
  const { listFolders, listFiles } = await import('./gdrive.mjs');
  console.log(`\n=== Isi folder ${folderId} ===`);
  const files = await listFiles({ folderId, pageSize: 100, fresh: true });
  for (const f of files) console.log(`  · ${f.name} | created=${f.createdTime || '-'} | modified=${f.modifiedTime || '-'} | id=${f.id}`);
  const kids = await listFolders(folderId, 100);
  for (const k of kids) {
    console.log(`\n  [subfolder] ${k.name} (${k.id})`);
    const sub = await listFiles({ folderId: k.id, pageSize: 100, fresh: true });
    for (const f of sub) console.log(`    · ${f.name} | created=${f.createdTime || '-'} | modified=${f.modifiedTime || '-'} | id=${f.id}`);
  }
}

async function moveMode() {
  const { moveFolder, listFiles } = await import('./gdrive.mjs');
  console.log(`\n=== Move file Week 1 (13 Sep → 06 Sep) — mode ${MODE} ===`);
  for (const f of MOVE_PLAN) {
    const from = MOVE_FOLDERS.src[f.slot];
    const to = MOVE_FOLDERS.dst[f.slot];
    console.log(`  ${APPLY ? 'moving' : '(dry) move'}: ${f.name}  [${f.slot}]`);
    if (APPLY) await moveFolder(f.id, to, from);
  }
  if (APPLY) {
    console.log('\nVerifikasi folder 06 Sep:');
    for (const slot of ['rhb', 'khotbah']) {
      const list = await listFiles({ folderId: MOVE_FOLDERS.dst[slot], pageSize: 100, fresh: true });
      console.log(`  ${slot}: ${list.length} file`);
      for (const x of list) console.log(`    · ${x.name}`);
    }
    console.log('\nVerifikasi sisa folder 13 Sep:');
    for (const slot of ['rhb', 'khotbah']) {
      const list = await listFiles({ folderId: MOVE_FOLDERS.src[slot], pageSize: 100, fresh: true });
      console.log(`  ${slot}: ${list.length} file`);
      for (const x of list) console.log(`    · ${x.name}`);
    }
  }
  console.log(`\n${APPLY ? '✅ Move selesai.' : 'ℹ️  Dry-run move — jalankan --move --apply untuk eksekusi.'}`);
}

async function main() {
  if (process.argv.includes('--move')) return moveMode();

  const listTarget = (process.argv.find((a) => a.startsWith('--list=')) || '').split('=')[1];
  if (listTarget) return listMode(listTarget);

  const { getPrisma, getDbLabel } = await import('./db.mjs');
  const { createEventFolder } = await import('./gdrive-events.mjs');
  const { listFolders, listFiles } = await import('./gdrive.mjs');

  const label = getDbLabel();
  console.log(`\n=== Provision September events — mode ${MODE} ===`);
  console.log(`DB target: ${label}`);
  if (APPLY && !/production/i.test(label) && !FORCE) {
    console.error('\n❌ DB target bukan production. Jalankan dengan .env.production (dotenv -e) atau tambah --force.');
    process.exit(1);
  }

  const rootId = process.env.GDRIVE_ROOT_FOLDER_ID;
  console.log(`GDRIVE_ROOT_FOLDER_ID: ${rootId ? rootId : '(kosong!)'}`);
  console.log(`GDRIVE_WRITE: ${process.env.GDRIVE_WRITE || '(kosong)'}`);

  const prisma = getPrisma();
  if (!prisma) {
    console.error('❌ DATABASE_URL tidak tersedia.');
    process.exit(1);
  }
  if (!rootId) {
    console.error('❌ GDRIVE_ROOT_FOLDER_ID tidak tersedia.');
    process.exit(1);
  }

  const yearMonthArg = (process.argv.find((a) => a.startsWith('--year-month=')) || '').split('=')[1];
  const specs = yearMonthArg ? await discoverEvents(prisma, yearMonthArg) : EVENTS;
  if (!specs.length) {
    console.log(`\n(tidak ada event untuk ${yearMonthArg || YEAR_MONTH})`);
    process.exit(0);
  }
  console.log(`\nEvent target: ${specs.length} (${yearMonthArg || 'daftar September bawaan'})`);

  // ---------- Inspect struktur Didaskalia sekarang ----------
  try {
    const rootKids = await listFolders(rootId, 100);
    const didaskalia = rootKids.find((f) => /^didaskalia/i.test(f.name));
    console.log('\n--- Inspeksi Drive ---');
    console.log(`Root anak (${rootKids.length}): ${rootKids.map((f) => f.name).join(' | ').slice(0, 400)}`);
    if (!didaskalia) {
      console.log('  ⚠ Pillar Didaskalia belum ada — createEventFolder akan membuatnya? (tidak, pillar wajib ada)');
    } else {
      console.log(`Pillar: "${didaskalia.name}" (${didaskalia.id})`);
      const pillarKids = await listFolders(didaskalia.id, 100);
      console.log(`  Isi pillar (${pillarKids.length}): ${pillarKids.map((f) => f.name).join(' | ').slice(0, 500)}`);
    }
  } catch (e) {
    console.warn(`  (inspeksi Drive dilewati: ${e.message})`);
  }

  const report = [];
  for (const spec of specs) {
    const ev = await prisma.eventProgram.findUnique({ where: { id: spec.id } });
    if (!ev) {
      report.push({ id: spec.id, status: 'EVENT TIDAK DITEMUKAN' });
      continue;
    }
    const ym = wibMonth(ev.eventDate) || YEAR_MONTH;
    const row = { id: ev.id, name: ev.name, serviceType: ev.serviceType, weekIndex: null, folder: null, subfolders: null, notes: [] };

    // 1. serviceType + metadata
    let meta = ev.metadata && typeof ev.metadata === 'object' ? ev.metadata : {};
    const wantService = spec.serviceType;
    const wantMeta = { ...meta, weekIndex: spec.weekIndex, yearMonth: ym };
    const needService = String(ev.serviceType || '') !== wantService;
    const needMeta = Number(meta.weekIndex || 0) !== spec.weekIndex || String(meta.yearMonth || '') !== ym;
    row.weekIndex = spec.weekIndex;
    if (needService || needMeta) {
      if (APPLY) {
        await prisma.eventProgram.update({
          where: { id: ev.id },
          data: { serviceType: wantService, metadata: wantMeta },
        });
        row.notes.push(`serviceType→${wantService}, metadata weekIndex=${spec.weekIndex}`);
      } else {
        row.notes.push(`(dry) serviceType ${ev.serviceType || '-'}→${wantService}, metadata weekIndex=${spec.weekIndex}`);
      }
    } else {
      row.notes.push('serviceType/metadata OK');
    }

    // 2. divisi DIDASKALIA
    let div = await prisma.eventDivision.findUnique({
      where: { eventId_division: { eventId: ev.id, division: 'DIDASKALIA' } },
    });
    if (!div) {
      if (APPLY) {
        div = await prisma.eventDivision.create({
          data: { id: `evd-${require('node:crypto').randomUUID()}`, eventId: ev.id, division: 'DIDASKALIA' },
        });
        row.notes.push('divisi DIDASKALIA dibuat');
      } else {
        row.notes.push('(dry) divisi DIDASKALIA akan dibuat');
      }
    }

    // 3. folder Drive (createEventFolder idempotent → juga memastikan 3 subfolder)
    if (APPLY && div) {
      try {
        const fid = await createEventFolder(ev, 'DIDASKALIA');
        if (fid && fid !== div.driveFolderId) {
          await prisma.eventDivision.update({ where: { id: div.id }, data: { driveFolderId: fid } });
          row.notes.push(`driveFolderId→${fid}`);
        } else {
          row.notes.push(`driveFolderId OK (${fid || '-'})`);
        }
        row.folder = fid;
      } catch (e) {
        row.notes.push(`GAGAL provision: ${e.message}`);
      }
    } else if (div) {
      row.folder = div.driveFolderId || '(akan dibuat)';
    }

    // 4. inspeksi isi folder + subfolder
    try {
      const folderId = row.folder && !String(row.folder).startsWith('(') ? row.folder : div?.driveFolderId;
      if (folderId) {
        const kids = await listFolders(folderId, 50);
        row.subfolders = kids.map((f) => f.name);
        const shown = [];
        for (const k of kids) {
          const files = await listFiles({ folderId: k.id, pageSize: 50, fresh: true }).catch(() => []);
          shown.push(`${k.name}: ${files.length} file${files.length ? ` [${files.slice(0, 4).map((x) => x.name).join(', ')}${files.length > 4 ? ', …' : ''}]` : ''}`);
        }
        row.contents = shown;
      }
    } catch (e) {
      row.notes.push(`inspeksi folder gagal: ${e.message}`);
    }

    report.push(row);
  }

  console.log('\n=== Laporan ===');
  for (const r of report) {
    console.log(`\n• ${r.name || r.id} (${r.id})`);
    if (r.status) { console.log(`  ${r.status}`); continue; }
    console.log(`  weekIndex=${r.weekIndex} folder=${r.folder || '-'}`);
    for (const n of r.notes) console.log(`  - ${n}`);
    if (r.subfolders) console.log(`  subfolder (${r.subfolders.length}): ${r.subfolders.join(' | ')}`);
    if (r.contents) for (const c of r.contents) console.log(`    · ${c}`);
  }

  console.log(`\n${APPLY ? '✅ Selesai (apply).' : 'ℹ️  Dry-run selesai — jalankan --apply untuk eksekusi.'}`);
  process.exit(0);
}

main().catch((e) => {
  console.error('\n❌ Gagal:', e.message);
  if (e.errors) console.error(JSON.stringify(e.errors, null, 2));
  process.exit(1);
});
