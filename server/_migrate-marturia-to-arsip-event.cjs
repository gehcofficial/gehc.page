/**
 * Migrasi Marturia: pindah folder event [EV:...:MARTURIA] dari root Marturia [MENTOR]
 * ke Marturia [MENTOR]/Arsip Event/ , lalu bersihkan folder yatim level-pillar.
 *
 * Pola baru (meniru Didaskalia/Kurikulum):
 *   Marturia [MENTOR]/
 *     Arsip Event/
 *       Ibadah Pemuda Mentoring: ... [EV:slug:MARTURIA]/
 *         Dokumentasi/  Desain/
 *     Dokumentasi Visual/ | Desain & Publikasi | Kesaksian & Story | Penginjilan & Misi  (tetap)
 *
 * Folder yatim (dibuat efek-samping ensurePillarTree, tak dibaca kode manapun):
 *   Foto Tim, Cover, Foto Kegiatan (level pillar) + bare Dokumentasi (legacy pra-rename).
 * Cleanup HANYA men-trash yang kosong; yang berisi dilaporkan untuk keputusan manual.
 *
 * Idempotent, aman diulang. Pindah parent TIDAK mengganti ID folder → referensi DB
 * (EventDivision.driveFolderId, EventProgram.archiveFolderId) tetap valid.
 * Jalankan:
 *   node server/_migrate-marturia-to-arsip-event.cjs --dry           # lihat rencana
 *   node server/_migrate-marturia-to-arsip-event.cjs --apply         # eksekusi pindah
 *   node server/_migrate-marturia-to-arsip-event.cjs --apply --cleanup  # pindah + trash yatim kosong
 *
 * Env: sama seperti drive-provision (GDRIVE_ROOT_FOLDER_ID + service account)
 * Prod: dotenv -e .env.production -- node server/_migrate-marturia-to-arsip-event.cjs --dry
 */
require('dotenv/config');
const { readFileSync } = require('node:fs');
const { google } = require('googleapis');

const DRY = process.argv.includes('--dry');
const APPLY = process.argv.includes('--apply');
const CLEANUP = process.argv.includes('--cleanup');

if (!DRY && !APPLY) {
  console.log('Gunakan --dry atau --apply. Contoh: node server/_migrate-marturia-to-arsip-event.cjs --dry');
  process.exit(1);
}

const PARENT_NAME = 'Arsip Event';
const MARTURIA_PILLAR_RE = /^marturia/i;
const EV_MARTURIA_RE = /\[EV:[^\]]+:MARTURIA\]/i;
// Folder yatim level-pillar: tak ada pembaca di kode (lihat HANDOFF). Trash hanya bila kosong.
const ORPHAN_NAMES = ['foto tim', 'cover', 'foto kegiatan', 'dokumentasi'];

function getWriteDrive() {
  let credentials;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    credentials = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
  } else {
    throw new Error('Kredensial service account tidak ditemukan di .env');
  }
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
    subject: process.env.GDRIVE_IMPERSONATE || undefined,
  });
  return google.drive({ version: 'v3', auth });
}

async function listFolders(drive, parentId) {
  const out = [];
  let pageToken;
  do {
    const res = await drive.files.list({
      q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'nextPageToken, files(id, name, parents)',
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    out.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

async function countChildren(drive, folderId) {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, mimeType)',
    pageSize: 20,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files || [];
}

async function main() {
  const rootId = process.env.GDRIVE_ROOT_FOLDER_ID;
  if (!rootId) throw new Error('GDRIVE_ROOT_FOLDER_ID belum di-set di .env');
  const drive = getWriteDrive();

  console.log(`\nRoot: ${rootId}`);
  console.log(`Mode: ${DRY ? 'DRY-RUN' : 'APPLY'}${CLEANUP ? ' + CLEANUP' : ''}\n`);

  // 1. cari pillar Marturia
  const rootKids = await listFolders(drive, rootId);
  const marturia = rootKids.find((f) => MARTURIA_PILLAR_RE.test(f.name));
  if (!marturia) throw new Error('Folder Marturia [MENTOR] tidak ditemukan di root.');
  console.log(`Marturia pillar: "${marturia.name}" (${marturia.id})`);

  // 2. pastikan Arsip Event ada di bawah Marturia
  const pillarKids = await listFolders(drive, marturia.id);
  let parent = pillarKids.find((f) => f.name.toLowerCase() === PARENT_NAME.toLowerCase());
  if (!parent) {
    console.log(`  - "${PARENT_NAME}" belum ada → akan dibuat`);
    if (APPLY) {
      const res = await drive.files.create({
        requestBody: { name: PARENT_NAME, mimeType: 'application/vnd.google-apps.folder', parents: [marturia.id] },
        fields: 'id, name',
        supportsAllDrives: true,
      });
      parent = { id: res.data.id, name: res.data.name };
      console.log(`  + Dibuat "${PARENT_NAME}" (${parent.id})`);
    } else {
      console.log('  (dry) skip create');
      parent = { id: 'dry-parent-id', name: PARENT_NAME };
    }
  } else {
    console.log(`Induk folder: "${parent.name}" (${parent.id})`);
  }

  // 3. list anak root Marturia
  console.log(`\nAnak Marturia (${pillarKids.length}):`);
  for (const f of pillarKids) {
    const tag = EV_MARTURIA_RE.test(f.name) ? '← EVENT' : (ORPHAN_NAMES.includes(f.name.toLowerCase()) ? '← YATIM?' : '');
    console.log(`  - ${f.name} ${tag}`);
  }

  // 4. kumpulkan event yang perlu dipindah (di root, belum di induk)
  const parentKids = parent.id.startsWith('dry-') ? [] : await listFolders(drive, parent.id);
  const parentEvTags = new Set(
    parentKids.filter((f) => EV_MARTURIA_RE.test(f.name))
      .map((f) => (f.name.match(/\[EV:[^\]]+\]/i) || [''])[0].toLowerCase()),
  );
  const toMove = [];
  for (const f of pillarKids) {
    if (!EV_MARTURIA_RE.test(f.name)) continue;
    const tag = (f.name.match(/\[EV:[^\]]+\]/i) || [''])[0].toLowerCase();
    if (parentEvTags.has(tag)) {
      console.log(`  = Skip duplikat (sudah ada di ${PARENT_NAME}): ${f.name}`);
    } else {
      toMove.push(f);
    }
  }

  console.log(`\n=== Rencana pindah ${toMove.length} event ke "${PARENT_NAME}" ===`);
  for (const f of toMove) console.log(`  → "${f.name}"`);
  if (!toMove.length) console.log('  (tidak ada yang perlu dipindah)');

  if (DRY) {
    console.log('\n[dry] selesai. Jalankan --apply untuk eksekusi.');
  } else {
    for (const f of toMove) {
      console.log(`\nMemindah "${f.name}" ...`);
      await drive.files.update({
        fileId: f.id,
        addParents: parent.id,
        removeParents: marturia.id,
        fields: 'id, parents',
        supportsAllDrives: true,
      });
      console.log('  ✓ dipindah (ID tetap, referensi DB aman)');
    }
  }

  // 5. cleanup yatim — HANYA yang kosong; berisi → laporkan untuk keputusan manual
  if (CLEANUP) {
    console.log('\n=== Cleanup folder yatim level-pillar (hanya yang kosong) ===');
    for (const name of ORPHAN_NAMES) {
      const target = pillarKids.find((f) => f.name.toLowerCase() === name);
      if (!target) { console.log(`  - "${name}": tidak ada → skip`); continue; }
      const kids = await countChildren(drive, target.id);
      if (kids.length > 0) {
        console.log(`  - "${target.name}" masih ada ${kids.length} item — TIDAK di-trash otomatis (keputusan manual):`);
        for (const k of kids.slice(0, 5)) console.log(`      · ${k.name} (${k.mimeType})`);
        continue;
      }
      console.log(`  - "${target.name}" kosong → trash`);
      if (DRY) {
        console.log('    (dry) skip trash');
      } else {
        await drive.files.update({ fileId: target.id, requestBody: { trashed: true }, supportsAllDrives: true });
        console.log('    ✓ di-trash (pulih 30 hari di sampah Drive)');
      }
    }
  }

  // 6. verifikasi akhir
  if (APPLY && !DRY) {
    const finalKids = await listFolders(drive, parent.id);
    console.log(`\nVerifikasi "${PARENT_NAME}" kini (${finalKids.length}):`);
    for (const f of finalKids) console.log(`  - ${f.name}`);
    console.log('\nSelesai. Struktur baru: Marturia [MENTOR]/Arsip Event/<Event> [EV:...]/Dokumentasi,Desain');
  }

  console.log('\nDone.');
}

main().catch((e) => {
  console.error('\n❌ Gagal:', e.message);
  if (e.errors) console.error(JSON.stringify(e.errors, null, 2));
  process.exit(1);
});
