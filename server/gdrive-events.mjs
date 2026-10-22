/**
 * Auto-provision event folders under pillar Drive folders.
 * Name: `<Event> [EV:<slug>:<DIV>]` plus division subfolders.
 */
import { listFolders, listAllFolders, createFolder, renameFolder, clearListCache } from './gdrive.mjs';

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
  const folders = await listAllFolders(parentId, { fresh: true });
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

  // MARTURIA: semua event masuk Marturia/Arsip Event/<Event> (rapi seperti Didaskalia/Kurikulum)
  if (division === 'MARTURIA') {
    const MARTURIA_PARENT = 'Arsip Event';
    let parent = await findNamed(pillar.id, new RegExp(`^${MARTURIA_PARENT}$`, 'i'));
    if (!parent) {
      const created = await createFolder(pillar.id, MARTURIA_PARENT);
      parent = { id: created.id, name: created.name };
    }
    parentForEvent = parent.id;
  }

  const wantName = eventFolderName(event, division);
  let eventFolder = await findNamed(parentForEvent, new RegExp(`\\[EV:${event.slug}:${division}\\]`, 'i'));
  // fallback: event lama mungkin masih di root Marturia sebelum migrasi Arsip Event
  if (!eventFolder && division === 'MARTURIA') {
    eventFolder = await findNamed(pillar.id, new RegExp(`\\[EV:${event.slug}:${division}\\]`, 'i'));
  }
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

/**
 * Rename sistemik folder event mengikuti nama baru (best-effort).
 * Cari folder by tag stabil `[EV:slug:DIV]` di semua parent yang dikenal,
 * lalu `files.update(name)`. ID folder tetap → link Drive tidak putus.
 * Return { renamed, skipped, errors }.
 */
export async function renameEventFolders(event, newName, opts = {}) {
  const out = { renamed: [], skipped: [], errors: [] };
  if (!event?.slug || !newName || event.name === newName) {
    if (!opts.archiveFolderId) return out;
  }
  const divisions = Object.keys(PILLAR_MATCH);
  const rootId = process.env.GDRIVE_ROOT_FOLDER_ID;
  if (!rootId) {
    out.errors.push('GDRIVE_ROOT_FOLDER_ID belum diisi.');
    return out;
  }
  const seen = new Set();
  const wantName = (div) => `${newName} [EV:${event.slug}:${div}]`;
  async function scanParent(parentId, division) {
    let folders = [];
    try {
      folders = await listFolders(parentId, 100);
    } catch (e) {
      out.errors.push(`List ${division}: ${e.message}`);
      return;
    }
    for (const f of folders || []) {
      if (!new RegExp(`\\[EV:${event.slug}:${division}\\]`, 'i').test(f.name || '')) continue;
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      if ((f.name || '') === wantName(division)) {
        out.skipped.push({ id: f.id, name: f.name });
        continue;
      }
      try {
        const r = await renameFolder(f.id, wantName(division));
        out.renamed.push({ id: f.id, from: f.name, to: r?.name || wantName(division), division });
      } catch (e) {
        out.errors.push(`${f.name}: ${e.message}`);
      }
    }
  }
  // Parent kanonik per divisi + fallback root pillar (event lama pra-migrasi).
  const pillarOf = {};
  try {
    const roots = await listFolders(rootId, 100);
    for (const [div, match] of Object.entries(PILLAR_MATCH)) {
      const p = (roots || []).find((f) => match.test(f.name || ''));
      if (p) pillarOf[div] = p;
    }
  } catch (e) {
    out.errors.push(`List root: ${e.message}`);
    return out;
  }
  for (const div of divisions) {
    const pillar = pillarOf[div];
    if (!pillar) continue;
    // Kumpulkan parent kandidat: kanonik (Kurikulum / Arsip Event) + root pillar.
    const parents = new Set([pillar.id]);
    try {
      const l1 = await listFolders(pillar.id, 100);
      for (const f of l1 || []) {
        if (/^(kurikulum|arsip event|kurikulum pemuridan|kurikulum & pembekalan)$/i.test(f.name || '')) parents.add(f.id);
      }
    } catch { /* abaikan */ }
    for (const pid of parents) await scanParent(pid, div);
  }
  // Arsip Marturia (satu folder per event, nama `YYYY-MM judul`) ikut tanggal efektif.
  if (opts.archiveFolderId && opts.archiveName) {
    try {
      const r = await renameFolder(opts.archiveFolderId, String(opts.archiveName).slice(0, 200));
      out.renamed.push({ id: opts.archiveFolderId, from: '(arsip)', to: r?.name || opts.archiveName, division: 'ARSIP' });
    } catch (e) {
      out.errors.push(`arsip: ${e.message}`);
    }
  }
  try { clearListCache(); } catch { /* abaikan */ }
  return out;
}
