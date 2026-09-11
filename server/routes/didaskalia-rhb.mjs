import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { getDriveMode, listFiles, listFolders, createFolder, uploadFile } from '../gdrive.mjs';

async function findFolderByName(name, parentId) {
  const folders = await listFolders(parentId, 100);
  const lower = String(name || '').toLowerCase();
  return folders.find((f) => String(f.name || '').toLowerCase() === lower) || null;
}

async function findRhbFolderId() {
  // Legacy pillar path: Didaskalia/Kurikulum Pemuridan/Berkas/modul-rhb
  // Sekarang per-event: Didaskalia/Kurikulum/<Event>/03 RHB 7 Hari . Pillar fallback dipertahankan untuk arsip lama.
  const root = process.env.GDRIVE_ROOT_FOLDER_ID;
  if (!root) return null;
  let didaskalia = await findFolderByName('Didaskalia', root);
  if (!didaskalia) didaskalia = await findFolderByName('Didaskalia [MENTOR]', root);
  if (!didaskalia) {
    const all = await listFolders(root, 100);
    didaskalia = all.find((f) => String(f.name || '').toLowerCase().includes('didaskalia'));
  }
  if (!didaskalia) return null;
  // Cari Kurikulum (baru) dulu, fallback Kurikulum Pemuridan legacy
  let kurikulum = await findFolderByName('Kurikulum', didaskalia.id);
  if (!kurikulum) kurikulum = await findFolderByName('Kurikulum Pemuridan', didaskalia.id);
  if (!kurikulum) {
    const subs = await listFolders(didaskalia.id, 50);
    kurikulum = subs.find((f) => String(f.name || '').toLowerCase().includes('kurikulum'));
  }
  if (!kurikulum) return null;
  let berkas = await findFolderByName('Berkas', kurikulum.id);
  if (!berkas) {
    const subs = await listFolders(kurikulum.id, 50);
    berkas = subs.find((f) => String(f.name || '').toLowerCase() === 'berkas');
  }
  if (!berkas) return null;
  let rhb = await findFolderByName('modul-rhb', berkas.id);
  if (!rhb) {
    const subs = await listFolders(berkas.id, 50);
    rhb = subs.find((f) => String(f.name || '').toLowerCase().includes('modul'));
  }
  return rhb ? rhb.id : null;
}

export function registerDidaskaliaRhbRoutes(app, { wrap }) {
  // GET /api/didaskalia/rhb?yearMonth=2026-09&weekIndex=1&eventId=evt-...&filter=...
  app.get(
    '/api/didaskalia/rhb',
    requireRole(),
    wrap(async (req, res) => {
      if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });
      // RBAC 03 RHB hanya beyonders (fallback pillar juga) — topeng aktif bila ada
      {
        const effRoles = req.activeRole ? [req.activeRole] : (req.authUser?.roles || []).map((r) => r.role);
        const isPriv = effRoles.includes('SUPERADMIN') || effRoles.includes('KOMISI') || effRoles.includes('COMMITTEE') || effRoles.includes('BPMJ');
        const isBey = effRoles.includes('MENTOR') || effRoles.includes('CO_MENTOR') || effRoles.includes('MENTEE');
        if (!isBey && !isPriv) return res.status(403).json({ error: 'RHB hanya untuk Beyonders (mentor/mentee).', files: [] });
      }
      const yearMonth = String(req.query?.yearMonth || '').trim();
      const weekIndex = String(req.query?.weekIndex || '').trim();
      const eventId = String(req.query?.eventId || '').trim();
      const filter = String(req.query?.filter || '').trim().toLowerCase();
      // eventId → per-event 03 RHB, else pillar modul-rhb
      let folderId = null;
      let perEventHint = null;
      if (eventId) {
        try {
          const prisma = getPrisma();
          if (prisma) {
            const div = await prisma.eventDivision.findUnique({ where: { eventId_division: { eventId, division: 'DIDASKALIA' } }, select: { driveFolderId: true } });
            if (div?.driveFolderId) {
              const subs = await listFolders(div.driveFolderId, 50);
              const rhbSub = subs.find((f) => String(f.name || '').toLowerCase().includes('rhb')) || subs.find((f) => String(f.name || '').toLowerCase().includes('03'));
              if (rhbSub) folderId = rhbSub.id;
              else perEventHint = 'Subfolder 03 RHB belum ada di event ini — upload pertama akan auto-buat.';
            }
          }
        } catch {}
      }
      if (!folderId) {
        try {
          folderId = await findRhbFolderId();
        } catch (e) {
          return res.status(500).json({ error: `Gagal cari folder RHB: ${e.message}` });
        }
      }
      if (!folderId) {
        return res.json({ files: [], folderId: null, hint: perEventHint || 'Folder Didaskalia/Berkas/modul-rhb belum ada. Buat via Drive provision atau upload pertama akan auto-buat.' });
      }
      // List files fresh (per-event jika eventId ada)
      let files = [];
      try {
        files = await listFiles({ folderId, pageSize: 50, fresh: true });
      } catch (e) {
        return res.status(500).json({ error: `Gagal list RHB: ${e.message}` });
      }
      // Filter by yearMonth/weekIndex/eventId if provided (name contains)
      if (yearMonth) {
        const ym = yearMonth.toLowerCase();
        files = files.filter((f) => String(f.name || '').toLowerCase().includes(ym) || String(f.name || '').toLowerCase().includes(ym.replace('-', '')));
      }
      if (weekIndex) {
        const wi = `w${weekIndex}`;
        files = files.filter((f) => String(f.name || '').toLowerCase().includes(wi));
      }
      if (filter) {
        files = files.filter((f) => String(f.name || '').toLowerCase().includes(filter));
      }
      // Sort by name
      files.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      // Also try to resolve event's week via DB if eventId provided
      let week = null;
      if (eventId) {
        try {
          const prisma = getPrisma();
          if (prisma) {
            const ev = await prisma.eventProgram.findUnique({ where: { id: eventId }, select: { metadata: true, eventDate: true } });
            if (ev?.metadata) {
              const meta = typeof ev.metadata === 'string' ? JSON.parse(ev.metadata) : ev.metadata;
              week = { weekIndex: meta?.weekIndex, yearMonth: meta?.yearMonth };
            }
          }
        } catch {}
      }
      res.json({ files, folderId, week, count: files.length });
    })
  );

  // POST /api/didaskalia/rhb/upload — upload RHB harian ke pillar modul-rhb
  app.post(
    '/api/didaskalia/rhb/upload',
    requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'),
    wrap(async (req, res) => {
      if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });
      if (process.env.GDRIVE_WRITE !== '1') return res.status(403).json({ error: 'Upload belum diaktifkan (GDRIVE_WRITE != 1).' });
      const { filename, mimetype, data, weekLabel } = req.body || {};
      if (!filename || !data) return res.status(400).json({ error: 'filename dan data wajib.' });
      if (typeof data === 'string' && data.length > 11_000_000) return res.status(413).json({ error: 'File terlalu besar (maks ~8MB).' });
      let folderId = null;
      try {
        folderId = await findRhbFolderId();
        if (!folderId) {
          // Auto-create legacy pillar path Didaskalia/Kurikulum/Berkas/modul-rhb (fallback)
          const root = process.env.GDRIVE_ROOT_FOLDER_ID;
          let didaskalia = await findFolderByName('Didaskalia', root) || await findFolderByName('Didaskalia [MENTOR]', root);
          if (!didaskalia) throw new Error('Folder Didaskalia tidak ditemukan di Drive. Jalankan provision.');
          let kurikulum = await findFolderByName('Kurikulum', didaskalia.id) || await findFolderByName('Kurikulum Pemuridan', didaskalia.id);
          if (!kurikulum) kurikulum = await createFolder(didaskalia.id, 'Kurikulum');
          let berkas = await findFolderByName('Berkas', kurikulum.id);
          if (!berkas) berkas = await createFolder(kurikulum.id, 'Berkas');
          let rhb = await findFolderByName('modul-rhb', berkas.id);
          if (!rhb) rhb = await createFolder(berkas.id, 'modul-rhb');
          folderId = rhb.id;
        }
      } catch (e) {
        return res.status(500).json({ error: `Gagal siapkan folder RHB: ${e.message}` });
      }
      try {
        const buffer = Buffer.from(data, 'base64');
        if (buffer.length > 8_000_000) return res.status(413).json({ error: 'File >8MB.' });
        const finalName = weekLabel ? `${weekLabel} - ${filename}` : filename;
        const file = await uploadFile(folderId, { originalname: finalName, mimetype: mimetype || 'application/octet-stream', buffer });
        res.status(201).json({ file, folderId });
      } catch (e) {
        console.error('[rhb] upload failed:', e);
        res.status(500).json({ error: `Gagal upload RHB: ${String(e.message).slice(0,300)}` });
      }
    })
  );
}
