/**
 * Auto-provision event folders under pillar Drive folders.
 * Name: `<Event> [EV:<slug>:<DIV>]` plus division subfolders.
 */
import { listFolders, createFolder } from './gdrive.mjs';

const PILLAR_MATCH = {
  LITURGIA: /^liturgia/i,
  DIDASKALIA: /^didaskalia/i,
  KOINONIA: /^koinonia/i,
  DIAKONIA: /^diakonia/i,
  MARTURIA: /^marturia/i,
  BENZARPR: /benzar/i,
};

const CHILD_FOLDERS = {
  LITURGIA: ['Rundown ibadah', 'Rehearsal'],
  // Kurikulum - Event - 3 sub: Pembekalan, Ringkasan, RHB (sesuai request user)
  DIDASKALIA: ['01 Pembekalan Mentor - Co mentor', '02 Ringkasan Khotbah', '03 RHB 7 Hari'],
  KOINONIA: ['Check-in', 'Welcome', 'Rundown'],
  DIAKONIA: ['Logistik', 'Konsumsi'],
  MARTURIA: ['Dokumentasi', 'Desain'],
  BENZARPR: ['Kasir'],
};

function eventFolderName(event, division) {
  return `${event.name} [EV:${event.slug}:${division}]`;
}

async function findNamed(parentId, matcher) {
  const folders = await listFolders(parentId, 100);
  return folders.find((f) => matcher.test(f.name)) || null;
}

async function ensureChild(parentId, name) {
  const existing = await findNamed(parentId, new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
  if (existing) return existing.id;
  const created = await createFolder(parentId, name);
  return created?.id || null;
}

export async function createEventFolder(event, division) {
  const rootId = process.env.GDRIVE_ROOT_FOLDER_ID;
  if (!rootId) throw new Error('GDRIVE_ROOT_FOLDER_ID belum diisi.');
  const match = PILLAR_MATCH[division];
  if (!match) throw new Error(`Divisi Drive tidak dikenal: ${division}`);

  const pillar = await findNamed(rootId, match);
  if (!pillar) throw new Error(`Folder pillar ${division} tidak ditemukan di Drive.`);

  // DIDASKALIA: semua event masuk Didaskalia/Kurikulum/<Event> → 3 sub
  let parentForEvent = pillar.id;
  if (division === 'DIDASKALIA') {
    const DIDASKALIA_KURIKULUM = 'Kurikulum';
    let kurikulum = await findNamed(pillar.id, new RegExp(`^${DIDASKALIA_KURIKULUM}$`, 'i'));
    // alias legacy — kenali folder lama agar tidak buat duplikat sebelum migrasi
    if (!kurikulum) kurikulum = await findNamed(pillar.id, /^kurikulum pemuridan$/i);
    if (!kurikulum) kurikulum = await findNamed(pillar.id, /^kurikulum & pembekalan$/i);
    if (!kurikulum) kurikulum = await findNamed(pillar.id, /^kurikulum$/i);
    if (!kurikulum) {
      const createdKur = await createFolder(pillar.id, DIDASKALIA_KURIKULUM);
      kurikulum = { id: createdKur.id, name: createdKur.name };
    } else if (kurikulum.name !== DIDASKALIA_KURIKULUM) {
      // biarkan nama lama tetap sampai migrasi rename; parentForEvent tetap folder legacy yang ada
      // migrasi terpisah akan me-rename/move ke "Kurikulum"
    }
    // bila folder yang ditemukan adalah legacy (bukan "Kurikulum"), tetap pakai itu
    // tapi jika ada juga folder "Kurikulum" yang kosong, migrasi akan konsolidasi
    // cek apakah ada folder "Kurikulum" terpisah — prioritaskan yang exact
    const exactKurikulum = await findNamed(pillar.id, new RegExp(`^${DIDASKALIA_KURIKULUM}$`, 'i'));
    parentForEvent = (exactKurikulum || kurikulum).id;
  }

  const wantName = eventFolderName(event, division);
  let eventFolder = await findNamed(parentForEvent, new RegExp(`\\[EV:${event.slug}:${division}\\]`, 'i'));
  // fallback: event lama mungkin masih di root Didaskalia atau di folder legacy sebelum migrasi
  if (!eventFolder && division === 'DIDASKALIA') {
    eventFolder = await findNamed(pillar.id, new RegExp(`\\[EV:${event.slug}:${division}\\]`, 'i'));
    if (eventFolder) {
      // temukan di root — biarkan dipakai apa adanya (migrasi akan pindahkan ke Kurikulum)
      // jangan buat duplikat
    } else {
      // cari juga di alias Kurikulum legacy bila parentForEvent bukan di sana
      for (const legacyRe of [/^kurikulum pemuridan$/i, /^kurikulum & pembekalan$/i]) {
        const legacy = await findNamed(pillar.id, legacyRe);
        if (!legacy || legacy.id === parentForEvent) continue;
        const found = await findNamed(legacy.id, new RegExp(`\\[EV:${event.slug}:${division}\\]`, 'i'));
        if (found) { eventFolder = found; break; }
      }
    }
  }
  if (!eventFolder) {
    const created = await createFolder(parentForEvent, wantName);
    eventFolder = { id: created.id, name: created.name };
  }

  const kids = CHILD_FOLDERS[division] || [];
  for (const child of kids) {
    await ensureChild(eventFolder.id, child);
  }
  return eventFolder.id;
}
