import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { listOverrides, upsertOverride, deleteOverride, OVERRIDE_CONDITIONS } from '../lib/service-overrides.mjs';
import { planGeser, applyGeser } from '../lib/service-geser.mjs';
import { archiveFolderName } from '../lib/drive-folders.mjs';

function toISODate(v) {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export function registerServiceOverrideRoutes(app, { wrap }) {
  // GET /api/service-overrides?from=YYYY-MM-DD&to=YYYY-MM-DD
  // Baca dibuka untuk semua login: peta ini dipakai klien me-resolve pekan
  // materi event geseran (arah-balik GESER). Tulis tetap peran tulis di bawah.
  app.get(
    '/api/service-overrides',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const from = toISODate(req.query?.from) || '2000-01-01';
      const to = toISODate(req.query?.to) || '2100-12-31';
      const map = await listOverrides(prisma, from, to);
      res.json({
        overrides: [...map.entries()].map(([eventDate, o]) => ({ eventDate, ...o })),
        conditions: OVERRIDE_CONDITIONS,
      });
    }),
  );

  // PUT /api/service-overrides/:date — GABUNGAN (partnerLabel) | LIBUR | ALIH (linkedEventId) | GESER (newEventDate)
  app.put(
    '/api/service-overrides/:date',
    requireRole('KOMISI', 'SUPERADMIN'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const iso = toISODate(req.params.date);
      if (!iso) return res.status(400).json({ error: 'Tanggal tidak valid (YYYY-MM-DD).' });
      const condition = String(req.body?.condition || '').toUpperCase();
      const linkedEventId = req.body?.linkedEventId || null;
      const newEventDate = req.body?.newEventDate || null;
      if (condition === 'ALIH' && linkedEventId) {
        const ev = await prisma.eventProgram.findUnique({ where: { id: linkedEventId }, select: { id: true } }).catch(() => null);
        if (!ev) return res.status(404).json({ error: 'Event alihan tidak ditemukan.' });
      }
      // GESER via PUT hanya catat override — cegah override yatim: tolak bila
      // tanggal tujuan bentrok atau tidak ada sumber. Untuk pindah sistemik
      // (jadwal+event+sesi+channel+nama+Drive) pakai POST /geser dryRun:false.
      if (condition === 'GESER' && newEventDate) {
        try {
          const { preview, collisions } = await planGeser(prisma, iso, String(newEventDate).slice(0, 10));
          if (collisions.length) {
            return res.status(409).json({
              error: `Tanggal ${preview.to} sudah terisi (${collisions.length} baris: ${collisions.slice(0, 3).map((c) => c.label).join(' | ')}) — kosongkan dulu atau pakai Terapkan geser sistemik.`,
              preview,
            });
          }
          if (!preview.assignments.length && !preview.events.length && !preview.channels.length) {
            return res.status(404).json({ error: `Tidak ada jadwal/event serving pada ${preview.from}.`, preview });
          }
        } catch (e) {
          return res.status(e.status === 409 || e.status === 404 ? e.status : 400).json({ error: e.message });
        }
      }
      try {
        const saved = await upsertOverride(prisma, {
          eventDate: iso,
          condition,
          note: req.body?.note ?? null,
          partnerLabel: req.body?.partnerLabel ?? null,
          linkedEventId,
          newEventDate,
          createdById: req.authUser?.id || null,
        });
        res.json({ ok: true, override: saved });
      } catch (e) {
        res.status(400).json({ error: e.message });
      }
    }),
  );

  // DELETE /api/service-overrides/:date — kembali NORMAL
  app.delete(
    '/api/service-overrides/:date',
    requireRole('KOMISI', 'SUPERADMIN'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      try {
        res.json({ ok: true, ...(await deleteOverride(prisma, req.params.date)) });
      } catch (e) {
        res.status(400).json({ error: e.message });
      }
    }),
  );

  // POST /api/service-overrides/geser — pindah ibadah SISTEMIK ke tanggal efektif.
  // Body: { from: 'YYYY-MM-DD' (slot Minggu), to: 'YYYY-MM-DD', note?, dryRun? }
  // dryRun=true → preview semua artefak tanpa menulis. apply → override GESER +
  // pindah assignment + event (rename suffix tanggal) + sesi + jadwal petugas +
  // channel WA + konten + timeline + rename folder Drive (best-effort).
  // slug event/sesi tetap → QR/WA/check-in ikut eventId. Pekan materi tetap.
  app.post(
    '/api/service-overrides/geser',
    requireRole('KOMISI', 'SUPERADMIN'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const from = toISODate(req.body?.from);
      const to = toISODate(req.body?.to);
      // Aman secara default: preview dulu; apply hanya bila dryRun:false eksplisit.
      const dryRun = req.body?.dryRun !== false;
      if (!from) return res.status(400).json({ error: 'from wajib (YYYY-MM-DD).' });
      if (!to) return res.status(400).json({ error: 'to wajib (YYYY-MM-DD, tanggal efektif).' });
      if (from === to) return res.status(400).json({ error: 'Tanggal geser harus berbeda dari tanggal asal.' });

      try {
        const { preview } = await planGeser(prisma, from, to);
        const collisions = preview.collisions || [];
        if (collisions.length) {
          return res.status(409).json({
            error: `Tanggal ${to} sudah terisi (${collisions.length} baris: ${collisions.slice(0, 3).map((c) => c.label).join(' | ')}) — pilih tanggal lain atau kosongkan dulu.`,
            preview,
          });
        }
        if (!preview.assignments.length && !preview.events.length && !preview.channels.length) {
          return res.status(404).json({ error: `Tidak ada jadwal/event serving pada ${from}.`, preview });
        }
        if (dryRun) {
          return res.json({ ok: true, dryRun: true, preview });
        }
      } catch (e) {
        return res.status(e.status === 409 || e.status === 404 ? e.status : 400).json({ error: e.message, preview: e.preview || null });
      }

      const note = req.body?.note ? String(req.body.note).slice(0, 500) : null;
      let result;
      try {
        result = await applyGeser(prisma, { from, to, note, createdById: req.authUser?.id || null });
      } catch (e) {
        return res.status(e.status === 409 || e.status === 404 ? e.status : 400).json({ error: e.message, preview: e.preview || null });
      }
      // Rename folder Drive best-effort (ID tetap → link tidak putus).
      let drive = { renamed: [], skipped: [], errors: [] };
      try {
        const { renameEventFolders } = await import('../gdrive-events.mjs');
        for (const r of result.renamed.filter((x) => x.to)) {
          const evRow = await prisma.eventProgram.findUnique({ where: { id: r.id }, select: { id: true, slug: true, name: true, archiveFolderId: true } }).catch(() => null);
          if (!evRow) continue;
          const archiveName = evRow.archiveFolderId ? archiveFolderName(`${to}T00:00:00.000Z`, r.to) : null;
          const one = await renameEventFolders(
            { slug: evRow.slug, name: r.from },
            r.to,
            { archiveFolderId: evRow.archiveFolderId || null, archiveName },
          ).catch((e) => ({ renamed: [], skipped: [], errors: [e.message] }));
          drive.renamed.push(...(one.renamed || []));
          drive.skipped.push(...(one.skipped || []));
          drive.errors.push(...(one.errors || []));
        }
      } catch (e) {
        drive.errors.push(e.message);
      }
      res.json({ ok: true, dryRun: false, preview: result.preview, moved: result.moved, renamed: result.renamed, drive });
    }),
  );
}
