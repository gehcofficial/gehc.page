/**
 * Provisioning struktur folder Google Drive — dari entitas TiDB.
 *
 * ⚠️ Scope TULIS hanya dipakai script ini. Runtime aplikasi tetap readonly.
 * Idempotent: folder yang sudah ada dilewati (aman dijalankan berulang).
 *
 * Prasyarat:
 *   1. Folder ROOT_GEHC di-share ke service account sebagai CONTENT MANAGER
 *      (Viewer tidak cukup untuk membuat folder).
 *   2. .env: GDRIVE_ROOT_FOLDER_ID + GOOGLE_APPLICATION_CREDENTIALS/JSON
 *
 * Sumber struktur = database aktif (.env):
 *   - groups.status=ACTIVE        → "<NAMA> [GROUP:<NAMA>]" di bawah Kelompok Mentoring
 *   - struktur_members subdivisi  → subfolder di bawah folder pillar-nya
 *   - zona statis                 → [PUBLIK] [MENTEE] [KOMISI] [BPMJ] [ALUMNI]
 *
 * Jalankan: npm run drive:provision
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { google } from 'googleapis';
import { getPrisma } from './db.mjs';

// Mirror src/lib/pantatugas.ts (didefinisikan lokal agar script jalan via node murni)
const PANTATUGAS = [
  { name: 'LITURGIA', label: 'Liturgia' },
  { name: 'DIDASKALIA', label: 'Didaskalia' },
  { name: 'KOINONIA', label: 'Koinonia' },
  { name: 'DIAKONIA', label: 'Diakonia' },
  { name: 'MARTURIA', label: 'Marturia' },
];

const WRITE_SCOPE = 'https://www.googleapis.com/auth/drive';

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
    scopes: [WRITE_SCOPE],
  });
  return google.drive({ version: 'v3', auth });
}

const PILLAR_NAMES = PANTATUGAS.map((p) => p.name);

async function buildTargetSpec(prisma) {
  // Zona statis: [nama, parentId-key]
  const spec = [
    { name: 'Event Gallery [PUBLIK]', parent: 'ROOT' },
    { name: 'Warta Publik [PUBLIK]', parent: 'ROOT' },
    { name: 'Ruang Anggota [MENTEE]', parent: 'ROOT' },
    { name: 'Kelompok Mentoring [MENTOR]', parent: 'ROOT', key: 'KELOMPOK' },
    { name: 'Laporan Internal [KOMISI]', parent: 'ROOT' },
    { name: 'Ringkasan BPMJ [BPMJ]', parent: 'ROOT' },
    { name: 'Arsip Generasi [ALUMNI]', parent: 'ROOT' },
  ];

  // Pantatugas + sub-divisi dari TiDB (sumber kebenaran)
  const subs = await prisma.strukturMember.findMany({
    where: { division: { in: PILLAR_NAMES }, NOT: { subdivision: null } },
    select: { division: true, subdivision: true },
  });
  const byPillar = new Map(PILLAR_NAMES.map((p) => [p, new Set()]));
  for (const s of subs) {
    const set = byPillar.get(s.division);
    if (set && s.subdivision?.trim()) set.add(s.subdivision.trim());
  }
  for (const p of PANTATUGAS) {
    spec.push({ name: `${p.label} [MENTOR]`, parent: 'ROOT', key: `pillar:${p.name}` });
    for (const sub of byPillar.get(p.name)) {
      spec.push({ name: sub, parent: `pillar:${p.name}` });
    }
  }

  // Grup aktif dari TiDB
  const groups = await prisma.group.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { name: 'asc' },
    select: { name: true },
  });
  for (const g of groups) {
    spec.push({ name: `${g.name} [GROUP:${g.name.toUpperCase()}]`, parent: 'KELOMPOK' });
  }

  return spec;
}

async function main() {
  const rootId = process.env.GDRIVE_ROOT_FOLDER_ID;
  if (!rootId || rootId === 'fld-root-gehc-01' || rootId.includes('drive.google.com')) {
    throw new Error('GDRIVE_ROOT_FOLDER_ID belum di-set dengan ID bare yang benar di .env');
  }

  const prisma = getPrisma();
  const drive = getWriteDrive();

  console.log('Menyusun target struktur dari TiDB…');
  const spec = await buildTargetSpec(prisma);

  // Cache anak folder per parent agar lookup cepat & idempotent
  const childrenCache = new Map(); // parentId → Map<nameLower, id>
  async function childrenOf(parentId) {
    if (childrenCache.has(parentId)) return childrenCache.get(parentId);
    const map = new Map();
    let pageToken;
    do {
      const res = await drive.files.list({
        q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'nextPageToken, files(id, name)',
        pageSize: 100,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        pageToken,
      });
      for (const f of res.data.files || []) map.set(f.name.toLowerCase(), f.id);
      pageToken = res.data.nextPageToken;
    } while (pageToken);
    childrenCache.set(parentId, map);
    return map;
  }

  async function ensureFolder(name, parentId, created) {
    const kids = await childrenOf(parentId);
    const existingId = kids.get(name.toLowerCase());
    if (existingId) {
      console.log(`  • ${name}  (sudah ada)`);
      return existingId;
    }
    const res = await drive.files.create({
      requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
      fields: 'id',
      supportsAllDrives: true,
    });
    kids.set(name.toLowerCase(), res.data.id);
    created.push(name);
    console.log(`  + ${name}`);
    return res.data.id;
  }

  const ids = new Map([['ROOT', rootId]]);
  const created = [];
  const failed = [];
  console.log(`\nMem-provision ${spec.length} folder di bawah root ${rootId}…\n`);

  // Urutkan: parent dulu (ROOT → key → anak)
  const ordered = [
    ...spec.filter((s) => s.parent === 'ROOT'),
    ...spec.filter((s) => s.parent !== 'ROOT' && s.key),
    ...spec.filter((s) => s.parent !== 'ROOT' && !s.key),
  ];

  for (const item of ordered) {
    try {
      const parentId = ids.get(item.parent);
      if (!parentId) throw new Error(`parent "${item.parent}" belum tersedia`);
      const id = await ensureFolder(item.name, parentId, created);
      if (item.key) ids.set(item.key, id);
    } catch (err) {
      const msg = err?.errors?.[0]?.message || err.message;
      if (/insufficientFilePermissions|The user does not have sufficient/i.test(msg)) {
        console.error('\n❌ IZIN KURANG: share folder root ke service account sebagai');
        console.error('   CONTENT MANAGER (bukan Viewer), lalu jalankan ulang.\n');
        throw err;
      }
      console.error(`  ✗ ${item.name}: ${msg}`);
      failed.push(item.name);
    }
  }

  console.log(`\nSelesai — dibuat baru: ${created.length}, target: ${spec.length}, gagal: ${failed.length}.`);
  if (failed.length) {
    console.error('GAGAL pada:', failed.join(', '));
    console.error('Pastikan folder root di-share ke service account sebagai CONTENT MANAGER.');
    process.exit(1);
  }
  if (created.length === 0) console.log('Semua sudah tersedia (idempotent).');
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
