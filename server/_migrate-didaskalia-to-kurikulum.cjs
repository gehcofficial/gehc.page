/**
 * Migrasi Didaskalia: pindah event [EV:...:DIDASKALIA] dari root Didaskalia (dan legacy Kurikulum*)
 * ke Didaskalia/Kurikulum/ , lalu bersihkan folder legacy yang kosong.
 *
 * Pola baru (sesuai request):
 *   Didaskalia [MENTOR]/
 *     Kurikulum/
 *       Ibadah Pemuda Mentoring: TW1 - 06 Sep 2026 [EV:ibadah-pemuda-mentoring-tw1-06-sep-2026-mtv3o21c4v:DIDASKALIA]/
 *         01 Pembekalan Mentor - Co mentor/
 *         02 Ringkasan Khotbah/
 *         03 RHB 7 Hari/
 *
 * Idempotent, aman diulang.
 * Jalankan:
 *   node server/_migrate-didaskalia-to-kurikulum.cjs --dry           # lihat rencana
 *   node server/_migrate-didaskalia-to-kurikulum.cjs --apply         # eksekusi pindah
 *   node server/_migrate-didaskalia-to-kurikulum.cjs --apply --cleanup  # pindah + trash legacy kosong
 *
 * Env: sama seperti drive-provision (GDRIVE_ROOT_FOLDER_ID + service account)
 * Prod: dotenv -e .env.production -- node server/_migrate-didaskalia-to-kurikulum.cjs --apply
 */
require('dotenv/config');
const { readFileSync } = require('node:fs');
const { google } = require('googleapis');

const DRY = process.argv.includes('--dry');
const APPLY = process.argv.includes('--apply');
const CLEANUP = process.argv.includes('--cleanup');

if (!DRY && !APPLY) {
  console.log('Gunakan --dry atau --apply. Contoh: node server/_migrate-didaskalia-to-kurikulum.cjs --dry');
  process.exit(1);
}

const KURIKULUM_NAME = 'Kurikulum';
const LEGACY_KURIKULUM_NAMES = ['kurikulum & pembekalan', 'kurikulum pemuridan']; // lower-case
const DIDASKALIA_PILLAR_RE = /^didaskalia/i;
const EV_DIDASKALIA_RE = /\[EV:[^\]]+:DIDASKALIA\]/i;

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
  // sort for stable log
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

async function findFolder(drive, parentId, matcher) {
  const kids = await listFolders(drive, parentId);
  return kids.find((f) => matcher.test(f.name)) || null;
}

async function main() {
  const rootId = process.env.GDRIVE_ROOT_FOLDER_ID;
  if (!rootId) throw new Error('GDRIVE_ROOT_FOLDER_ID belum di-set di .env');
  const drive = getWriteDrive();

  console.log(`\nRoot: ${rootId}`);
  console.log(`Mode: ${DRY ? 'DRY-RUN' : 'APPLY'}${CLEANUP ? ' + CLEANUP' : ''}\n`);

  // 1. cari pillar Didaskalia
  const rootKids = await listFolders(drive, rootId);
  const didaskalia = rootKids.find((f) => DIDASKALIA_PILLAR_RE.test(f.name));
  if (!didaskalia) throw new Error('Folder Didaskalia [MENTOR] tidak ditemukan di root.');
  console.log(`Didaskalia pillar: "${didaskalia.name}" (${didaskalia.id})`);

  // 2. pastikan Kurikulum ada di bawah Didaskalia
  let kurikulum = await findFolder(drive, didaskalia.id, new RegExp(`^${KURIKULUM_NAME}$`, 'i'));
  if (!kurikulum) {
    console.log(`  - Kurikulum belum ada di Didaskalia → akan dibuat "${KURIKULUM_NAME}"`);
    if (APPLY) {
      const res = await drive.files.create({
        requestBody: { name: KURIKULUM_NAME, mimeType: 'application/vnd.google-apps.folder', parents: [didaskalia.id] },
        fields: 'id, name',
        supportsAllDrives: true,
      });
      kurikulum = { id: res.data.id, name: res.data.name };
      console.log(`  + Dibuat Kurikulum (${kurikulum.id})`);
    } else {
      console.log('  (dry) skip create');
      kurikulum = { id: 'dry-kurikulum-id', name: KURIKULUM_NAME };
    }
  } else {
    console.log(`Kurikulum folder: "${kurikulum.name}" (${kurikulum.id})`);
  }

  // 3. list anak Didaskalia langsung (root level)
  const didaskaliaKids = await listFolders(drive, didaskalia.id);
  console.log(`\nAnak Didaskalia (${didaskaliaKids.length}):`);
  for (const f of didaskaliaKids) console.log(`  - ${f.name} ${EV_DIDASKALIA_RE.test(f.name) ? '← EVENT' : ''}`);

  // 4. list anak di dalam legacy Kurikulum folders
  const legacyFolders = [];
  for (const legacyName of LEGACY_KURIKULUM_NAMES) {
    const lf = didaskaliaKids.find((f) => f.name.toLowerCase() === legacyName);
    if (lf) {
      legacyFolders.push(lf);
      const inside = await listFolders(drive, lf.id);
      console.log(`\nLegacy "${lf.name}" isi (${inside.length}):`);
      for (const f of inside) console.log(`  - ${f.name} ${EV_DIDASKALIA_RE.test(f.name) ? '← EVENT' : ''}`);
    }
  }

  // 5. list anak di Kurikulum baru
  const kurikulumKids = kurikulum.id.startsWith('dry-') ? [] : await listFolders(drive, kurikulum.id);
  console.log(`\nKurikulum isi (${kurikulumKids.length}):`);
  for (const f of kurikulumKids) console.log(`  - ${f.name} ${EV_DIDASKALIA_RE.test(f.name) ? '← EVENT' : ''}`);

  // 6. kumpulkan event yang perlu dipindah:
  // - event di root Didaskalia
  // - event di legacy folders
  const eventsToMove = [];
  for (const f of didaskaliaKids) {
    if (EV_DIDASKALIA_RE.test(f.name)) eventsToMove.push({ file: f, from: didaskalia });
  }
  for (const lf of legacyFolders) {
    const inside = await listFolders(drive, lf.id);
    for (const f of inside) {
      if (EV_DIDASKALIA_RE.test(f.name)) eventsToMove.push({ file: f, from: lf });
    }
  }
  // filter yang sudah di Kurikulum jangan dipindah lagi
  const kurikulumIds = new Set(kurikulumKids.map((f) => f.id));
  const alreadyInKurikulum = eventsToMove.filter((e) => kurikulumIds.has(e.file.id));
  // sebenarnya eventsToMove diambil dari root/legacy, jadi tidak mungkin sudah di kurikulum,
  // tapi cek juga duplikat nama: jika Kurikulum sudah punya event dengan EV tag sama, skip create/move
  const kurikulumEvTags = new Set(kurikulumKids.filter((f) => EV_DIDASKALIA_RE.test(f.name)).map((f) => (f.name.match(/\[EV:[^\]]+\]/i) || [''])[0].toLowerCase()));
  const filteredMove = [];
  for (const e of eventsToMove) {
    const tag = (e.file.name.match(/\[EV:[^\]]+\]/i) || [''])[0].toLowerCase();
    if (kurikulumEvTags.has(tag)) {
      console.log(`  = Skip (sudah ada di Kurikulum): ${e.file.name}`);
    } else {
      filteredMove.push(e);
    }
  }

  console.log(`\n=== Rencana pindah ${filteredMove.length} event ke Kurikulum ===`);
  for (const e of filteredMove) {
    console.log(`  → "${e.file.name}"  dari "${e.from.name}" → Kurikulum`);
  }
  if (filteredMove.length === 0) console.log('  (tidak ada yang perlu dipindah)');

  if (DRY) {
    console.log('\n[dry] selesai. Jalankan --apply untuk eksekusi.');
  } else {
    for (const e of filteredMove) {
      console.log(`\nMemindah "${e.file.name}" ...`);
      await drive.files.update({
        fileId: e.file.id,
        addParents: kurikulum.id,
        removeParents: e.from.id,
        fields: 'id, parents',
        supportsAllDrives: true,
      });
      console.log('  ✓ dipindah');
    }
  }

  // 7. cleanup legacy kosong (opsional)
  if (CLEANUP) {
    console.log('\n=== Cleanup legacy folder kosong ===');
    for (const lf of legacyFolders) {
      const inside = await listFolders(drive, lf.id);
      // hanya hapus jika kosong setelah move, atau hanya berisi folder bukan event yang sudah kosong
      // cek apakah ada file/folder tersisa; jika kosong → trash
      const remaining = await listFolders(drive, lf.id);
      // juga cek file non-folder?
      const filesRes = await drive.files.list({
        q: `'${lf.id}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType)',
        pageSize: 10,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      const hasContent = (filesRes.data.files || []).length > 0;
      if (!hasContent) {
        console.log(`  - "${lf.name}" kosong → trash`);
        if (APPLY) {
          await drive.files.update({ fileId: lf.id, requestBody: { trashed: true }, supportsAllDrives: true });
          console.log('    ✓ di-trash');
        } else {
          console.log('    (dry) skip trash');
        }
      } else {
        console.log(`  - "${lf.name}" masih ada isi (${(filesRes.data.files || []).length} item) → skip trash`);
        for (const f of (filesRes.data.files || []).slice(0,5)) console.log(`      · ${f.name} (${f.mimeType})`);
      }
    }
  } else if (legacyFolders.length) {
    console.log('\nTip: jalankan --apply --cleanup untuk trash legacy folder yang sudah kosong setelah pindah.');
  }

  // 8. verifikasi akhir
  if (APPLY && !DRY) {
    const finalKurikulumKids = await listFolders(drive, kurikulum.id);
    console.log(`\nVerifikasi Kurikulum kini (${finalKurikulumKids.length}):`);
    for (const f of finalKurikulumKids) console.log(`  - ${f.name}`);
    console.log('\nSelesai. Struktur baru: Didaskalia [MENTOR]/Kurikulum/<Event> [EV:...]/01..03');
    console.log('ACL tetap via tag [EV:...:DIDASKALIA] — tidak perlu ubah policy.');
  }

  console.log('\nDone.');
}

main().catch((e) => {
  console.error('\n❌ Gagal:', e.message);
  if (e.errors) console.error(JSON.stringify(e.errors, null, 2));
  process.exit(1);
});
