/**
 * Diakonia — readiness operasional, transport carpool, kasus mercy + kunjungan,
 * info kos perantau. Sprint A.
 *
 * Tulis: SUPERADMIN/KOMISI/COMMITTEE + anggota divisi DIAKONIA.
 * Kasus mercy: baca dibatasi peran peduli (Diakonia/Komisi/Superadmin/mentor pelapor
 * via pastoral link) — daftar umum menyembunyikan subjectRef untuk non-peduli.
 */
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { requireDivision, divisionCodesFor } from '../lib/division-access.mjs';
import { newEntityId } from '../lib/drive-ownership.mjs';

const WRITE_ROLES = ['SUPERADMIN', 'KOMISI', 'COMMITTEE'];
const AREAS = new Set(['LOGISTIK', 'KONSUMSI', 'KESEHATAN']);
const CHECK_STATUS = new Set(['BELUM', 'SIAP', 'KENDALA']);
const CASE_STATUS = new Set(['LAPOR', 'ASSESS', 'BANTUAN', 'FOLLOWUP', 'TUTUP']);
const CASE_NEXT = { LAPOR: 'ASSESS', ASSESS: 'BANTUAN', BANTUAN: 'FOLLOWUP', FOLLOWUP: 'TUTUP', TUTUP: null };
const CASE_KINDS = new Set(['SAKIT', 'DUKA', 'SUSAH', 'PERANTAU', 'LAINNYA']);
const KOST_STATUS = new Set(['USULAN', 'TAMPIL', 'ARSIP']);

async function isDiakoniaReader(authUser) {
  if (!authUser) return false;
  const roles = (authUser.roles || []).map((r) => r.role);
  if (roles.includes('SUPERADMIN') || roles.includes('KOMISI')) return true;
  try {
    const codes = await divisionCodesFor(authUser);
    return codes.includes('DIAKONIA');
  } catch {
    return false;
  }
}

function maskCase(row, canSeeSubject) {
  if (canSeeSubject) return row;
  const { subjectRef, pastoralNoteId, ...rest } = row;
  return { ...rest, subjectRef: null, pastoralNoteId: null };
}

export function registerDiakoniaRoutes(app, { wrap }) {
  const needTable = (prisma, table) => Boolean(prisma && prisma[table]);

  // ---- Readiness agregator per event ----
  app.get('/api/events/:id/diakonia/readiness', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!needTable(prisma, 'diakoniaEventCheck')) return res.json({ checks: [], transport: [], summary: { overall: 'BELUM', siap: 0, kendala: 0, belum: 3 } });
    const [checks, transport] = await Promise.all([
      prisma.diakoniaEventCheck.findMany({ where: { eventId: req.params.id } }),
      prisma.diakoniaTransport.findMany({ where: { eventId: req.params.id }, orderBy: { createdAt: 'asc' } }).catch(() => []),
    ]);
    const byArea = new Map(checks.map((c) => [c.area, c.status]));
    let siap = 0;
    let kendala = 0;
    let belum = 0;
    for (const a of ['LOGISTIK', 'KONSUMSI', 'KESEHATAN']) {
      const s = byArea.get(a) || 'BELUM';
      if (s === 'SIAP') siap += 1;
      else if (s === 'KENDALA') kendala += 1;
      else belum += 1;
    }
    const overall = kendala > 0 ? 'KENDALA' : belum > 0 ? 'BELUM' : 'SIAP';
    res.json({ checks, transport, summary: { overall, siap, kendala, belum } });
  }));

  // Upsert status satu area.
  app.post(
    '/api/events/:id/diakonia/checks',
    requireRole(...WRITE_ROLES), requireDivision('DIAKONIA'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!needTable(prisma, 'diakoniaEventCheck')) return res.status(503).json({ error: 'Database belum siap.' });
      const area = String(req.body?.area || '').toUpperCase();
      const status = String(req.body?.status || '').toUpperCase();
      if (!AREAS.has(area)) return res.status(400).json({ error: 'Area: LOGISTIK / KONSUMSI / KESEHATAN.' });
      if (!CHECK_STATUS.has(status)) return res.status(400).json({ error: 'Status: BELUM / SIAP / KENDALA.' });
      const item = await prisma.diakoniaEventCheck.upsert({
        where: { eventId_area: { eventId: req.params.id, area } },
        create: {
          id: newEntityId('dcheck'),
          eventId: req.params.id,
          area,
          status,
          note: String(req.body?.note || '').slice(0, 5000) || null,
          updatedBy: req.authUser?.id || null,
        },
        update: {
          status,
          note: String(req.body?.note || '').slice(0, 5000) || null,
          updatedBy: req.authUser?.id || null,
        },
      });
      res.json({ item });
    }),
  );

  // ---- Transport carpool ----
  app.get('/api/events/:id/diakonia/transport', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!needTable(prisma, 'diakoniaTransport')) return res.json({ items: [] });
    const items = await prisma.diakoniaTransport.findMany({
      where: { eventId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ items });
  }));

  app.post(
    '/api/events/:id/diakonia/transport',
    requireRole(...WRITE_ROLES), requireDivision('DIAKONIA'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!needTable(prisma, 'diakoniaTransport')) return res.status(503).json({ error: 'Database belum siap.' });
      const pickupPoint = String(req.body?.pickupPoint || '').trim().slice(0, 200);
      if (!pickupPoint) return res.status(400).json({ error: 'Titik jemput wajib diisi.' });
      const created = await prisma.diakoniaTransport.create({
        data: {
          id: newEntityId('dtrans'),
          eventId: req.params.id,
          pickupPoint,
          driver: String(req.body?.driver || '').slice(0, 120) || null,
          seats: Number.isFinite(Number(req.body?.seats)) ? Number(req.body.seats) : null,
          contact: String(req.body?.contact || '').slice(0, 80) || null,
          createdById: req.authUser?.id || null,
        },
      });
      res.json({ item: created });
    }),
  );

  app.delete(
    '/api/diakonia/transport/:id',
    requireRole(...WRITE_ROLES), requireDivision('DIAKONIA'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!needTable(prisma, 'diakoniaTransport')) return res.status(503).json({ error: 'Database belum siap.' });
      await prisma.diakoniaTransport.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    }),
  );

  // ---- Kasus mercy ----
  app.get('/api/diakonia/cases', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!needTable(prisma, 'diakoniaCase')) return res.json({ items: [] });
    const status = String(req.query.status || '').toUpperCase();
    const where = CASE_STATUS.has(status) ? { status } : {};
    const rows = await prisma.diakoniaCase.findMany({
      where,
      include: { visits: { orderBy: { visitedOn: 'desc' } } },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    const canSee = await isDiakoniaReader(req.authUser);
    res.json({ items: rows.map((r) => maskCase(r, canSee)), canSeeSubject: canSee });
  }));

  app.post('/api/diakonia/cases', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!needTable(prisma, 'diakoniaCase')) return res.status(503).json({ error: 'Database belum siap.' });
    const title = String(req.body?.title || '').trim().slice(0, 200);
    if (!title) return res.status(400).json({ error: 'Judul kasus wajib diisi.' });
    const kind = String(req.body?.kind || 'LAINNYA').toUpperCase();
    const created = await prisma.diakoniaCase.create({
      data: {
        id: newEntityId('dcase'),
        title,
        kind: CASE_KINDS.has(kind) ? kind : 'LAINNYA',
        subjectRef: String(req.body?.subjectRef || '').slice(0, 200) || null,
        pastoralNoteId: req.body?.pastoralNoteId ? String(req.body.pastoralNoteId) : null,
        needSummary: String(req.body?.needSummary || '').slice(0, 5000) || null,
        createdById: req.authUser?.id || null,
      },
    });
    res.json({ item: maskCase(created, true) });
  }));

  app.patch(
    '/api/diakonia/cases/:id',
    requireRole(...WRITE_ROLES), requireDivision('DIAKONIA'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!needTable(prisma, 'diakoniaCase')) return res.status(503).json({ error: 'Database belum siap.' });
      const found = await prisma.diakoniaCase.findUnique({ where: { id: req.params.id } });
      if (!found) return res.status(404).json({ error: 'Kasus tidak ditemukan.' });
      const data = {};
      const status = String(req.body?.status || '').toUpperCase();
      if (status) {
        if (!CASE_STATUS.has(status)) return res.status(400).json({ error: 'Status tidak dikenal.' });
        const expected = CASE_NEXT[found.status];
        if (status !== found.status && status !== expected) {
          return res.status(409).json({ error: `Alur kasus: ${found.status} → ${expected || '(tutup)'}.` });
        }
        data.status = status;
      }
      if (req.body?.fundingLink !== undefined) data.fundingLink = String(req.body.fundingLink || '').slice(0, 300) || null;
      if (req.body?.needSummary !== undefined) data.needSummary = String(req.body.needSummary || '').slice(0, 5000) || null;
      if (!Object.keys(data).length) return res.status(400).json({ error: 'Tidak ada perubahan.' });
      const updated = await prisma.diakoniaCase.update({ where: { id: found.id }, data });
      res.json({ item: updated });
    }),
  );

  app.delete(
    '/api/diakonia/cases/:id',
    requireRole(...WRITE_ROLES), requireDivision('DIAKONIA'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!needTable(prisma, 'diakoniaCase')) return res.status(503).json({ error: 'Database belum siap.' });
      await prisma.diakoniaCase.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    }),
  );

  app.post(
    '/api/diakonia/cases/:id/visits',
    requireRole(...WRITE_ROLES), requireDivision('DIAKONIA'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!needTable(prisma, 'diakoniaVisit')) return res.status(503).json({ error: 'Database belum siap.' });
      const visitedOn = new Date(String(req.body?.visitedOn || '').slice(0, 10));
      if (Number.isNaN(visitedOn.getTime())) return res.status(400).json({ error: 'Tanggal kunjungan tidak valid (YYYY-MM-DD).' });
      const created = await prisma.diakoniaVisit.create({
        data: {
          id: newEntityId('dvisit'),
          caseId: req.params.id,
          visitedOn,
          visitors: String(req.body?.visitors || '').slice(0, 300) || null,
          result: String(req.body?.result || '').slice(0, 5000) || null,
          createdById: req.authUser?.id || null,
        },
      });
      res.json({ visit: created });
    }),
  );

  // ---- Inventaris (master + pinjam-kembali per event) ----
  app.get('/api/diakonia/inventory', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!needTable(prisma, 'diakoniaInventory')) return res.json({ items: [] });
    const items = await prisma.diakoniaInventory.findMany({ orderBy: { name: 'asc' } });
    res.json({ items });
  }));

  app.post(
    '/api/diakonia/inventory',
    requireRole(...WRITE_ROLES), requireDivision('DIAKONIA'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!needTable(prisma, 'diakoniaInventory')) return res.status(503).json({ error: 'Database belum siap.' });
      const name = String(req.body?.name || '').trim().slice(0, 200);
      if (!name) return res.status(400).json({ error: 'Nama barang wajib diisi.' });
      const created = await prisma.diakoniaInventory.create({
        data: {
          id: newEntityId('dinv'),
          name,
          unit: String(req.body?.unit || 'PCS').toUpperCase().slice(0, 24),
          qtyTotal: Math.max(0, Number(req.body?.qtyTotal) || 0),
          condition: ['BAIK', 'RUSAK_RINGAN', 'RUSAK_BERAT'].includes(String(req.body?.condition)) ? req.body.condition : 'BAIK',
          location: String(req.body?.location || '').slice(0, 200) || null,
          createdById: req.authUser?.id || null,
        },
      });
      res.json({ item: created });
    }),
  );

  app.patch(
    '/api/diakonia/inventory/:id',
    requireRole(...WRITE_ROLES), requireDivision('DIAKONIA'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!needTable(prisma, 'diakoniaInventory')) return res.status(503).json({ error: 'Database belum siap.' });
      const data = {};
      if (req.body?.name !== undefined) {
        const name = String(req.body.name).trim().slice(0, 200);
        if (!name) return res.status(400).json({ error: 'Nama tidak boleh kosong.' });
        data.name = name;
      }
      if (req.body?.qtyTotal !== undefined) data.qtyTotal = Math.max(0, Number(req.body.qtyTotal) || 0);
      if (req.body?.condition !== undefined) {
        if (!['BAIK', 'RUSAK_RINGAN', 'RUSAK_BERAT'].includes(req.body.condition)) return res.status(400).json({ error: 'Kondisi tidak dikenal.' });
        data.condition = req.body.condition;
      }
      if (req.body?.location !== undefined) data.location = String(req.body.location).slice(0, 200) || null;
      if (!Object.keys(data).length) return res.status(400).json({ error: 'Tidak ada perubahan.' });
      const updated = await prisma.diakoniaInventory.update({ where: { id: req.params.id }, data });
      res.json({ item: updated });
    }),
  );

  app.delete(
    '/api/diakonia/inventory/:id',
    requireRole(...WRITE_ROLES), requireDivision('DIAKONIA'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!needTable(prisma, 'diakoniaInventory')) return res.status(503).json({ error: 'Database belum siap.' });
      const open = await prisma.diakoniaCheckout.count({ where: { inventoryId: req.params.id, status: 'KELUAR' } });
      if (open > 0) return res.status(409).json({ error: `Masih ${open} peminjaman keluar — kembalikan dulu.` });
      await prisma.diakoniaInventory.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    }),
  );

  app.get('/api/events/:id/diakonia/checkout', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!needTable(prisma, 'diakoniaCheckout')) return res.json({ items: [] });
    const items = await prisma.diakoniaCheckout.findMany({
      where: { eventId: req.params.id },
      include: { inventory: { select: { id: true, name: true, unit: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ items });
  }));

  app.post(
    '/api/events/:id/diakonia/checkout',
    requireRole(...WRITE_ROLES), requireDivision('DIAKONIA'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!needTable(prisma, 'diakoniaCheckout')) return res.status(503).json({ error: 'Database belum siap.' });
      const inventoryId = String(req.body?.inventoryId || '');
      const qty = Math.max(1, Number(req.body?.qty) || 1);
      const inv = await prisma.diakoniaInventory.findUnique({ where: { id: inventoryId } });
      if (!inv) return res.status(404).json({ error: 'Barang tidak ada di inventaris.' });
      const created = await prisma.diakoniaCheckout.create({
        data: {
          id: newEntityId('dco'),
          inventoryId,
          eventId: req.params.id,
          qty,
          note: String(req.body?.note || '').slice(0, 500) || null,
          checkedOutBy: req.authUser?.id || null,
        },
      });
      res.json({ item: created });
    }),
  );

  app.patch(
    '/api/diakonia/checkout/:id',
    requireRole(...WRITE_ROLES), requireDivision('DIAKONIA'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!needTable(prisma, 'diakoniaCheckout')) return res.status(503).json({ error: 'Database belum siap.' });
      const status = String(req.body?.status || '').toUpperCase();
      if (!['KEMBALI', 'RUSAK', 'HILANG'].includes(status)) {
        return res.status(400).json({ error: 'Status: KEMBALI / RUSAK / HILANG.' });
      }
      const updated = await prisma.diakoniaCheckout.update({ where: { id: req.params.id }, data: { status } });
      res.json({ item: updated });
    }),
  );

  // ---- Konsumsi terstruktur (satu baris per event) ----
  app.get('/api/events/:id/diakonia/consumption', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!needTable(prisma, 'diakoniaConsumption')) return res.json({ item: null });
    const item = await prisma.diakoniaConsumption.findUnique({ where: { eventId: req.params.id } });
    res.json({ item });
  }));

  app.post(
    '/api/events/:id/diakonia/consumption',
    requireRole(...WRITE_ROLES), requireDivision('DIAKONIA'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!needTable(prisma, 'diakoniaConsumption')) return res.status(503).json({ error: 'Database belum siap.' });
      const portions = req.body?.portions === null || req.body?.portions === '' || req.body?.portions === undefined
        ? null
        : Math.max(0, Number(req.body.portions) || 0);
      const item = await prisma.diakoniaConsumption.upsert({
        where: { eventId: req.params.id },
        create: {
          id: newEntityId('dcon'),
          eventId: req.params.id,
          menu: String(req.body?.menu || '').slice(0, 5000) || null,
          portions,
          vendor: String(req.body?.vendor || '').slice(0, 200) || null,
          distributionNote: String(req.body?.distributionNote || '').slice(0, 5000) || null,
          leftoverNote: String(req.body?.leftoverNote || '').slice(0, 5000) || null,
          updatedBy: req.authUser?.id || null,
        },
        update: {
          menu: String(req.body?.menu || '').slice(0, 5000) || null,
          portions,
          vendor: String(req.body?.vendor || '').slice(0, 200) || null,
          distributionNote: String(req.body?.distributionNote || '').slice(0, 5000) || null,
          leftoverNote: String(req.body?.leftoverNote || '').slice(0, 5000) || null,
          updatedBy: req.authUser?.id || null,
        },
      });
      res.json({ item });
    }),
  );

  // ---- Safety standby (satu baris per event) ----
  app.get('/api/events/:id/diakonia/safety', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!needTable(prisma, 'diakoniaSafety')) return res.json({ item: null });
    const item = await prisma.diakoniaSafety.findUnique({ where: { eventId: req.params.id } });
    res.json({ item });
  }));

  app.post(
    '/api/events/:id/diakonia/safety',
    requireRole(...WRITE_ROLES), requireDivision('DIAKONIA'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!needTable(prisma, 'diakoniaSafety')) return res.status(503).json({ error: 'Database belum siap.' });
      const item = await prisma.diakoniaSafety.upsert({
        where: { eventId: req.params.id },
        create: {
          id: newEntityId('dsaf'),
          eventId: req.params.id,
          standbyName: String(req.body?.standbyName || '').slice(0, 200) || null,
          kitLocation: String(req.body?.kitLocation || '').slice(0, 200) || null,
          protocolNote: String(req.body?.protocolNote || '').slice(0, 5000) || null,
          updatedBy: req.authUser?.id || null,
        },
        update: {
          standbyName: String(req.body?.standbyName || '').slice(0, 200) || null,
          kitLocation: String(req.body?.kitLocation || '').slice(0, 200) || null,
          protocolNote: String(req.body?.protocolNote || '').slice(0, 5000) || null,
          updatedBy: req.authUser?.id || null,
        },
      });
      res.json({ item });
    }),
  );

  // ---- Insiden ----
  app.get('/api/events/:id/diakonia/incidents', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!needTable(prisma, 'diakoniaIncident')) return res.json({ items: [] });
    const items = await prisma.diakoniaIncident.findMany({
      where: { eventId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ items });
  }));

  app.post(
    '/api/events/:id/diakonia/incidents',
    requireRole(...WRITE_ROLES), requireDivision('DIAKONIA'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!needTable(prisma, 'diakoniaIncident')) return res.status(503).json({ error: 'Database belum siap.' });
      const description = String(req.body?.description || '').trim().slice(0, 5000);
      if (!description) return res.status(400).json({ error: 'Deskripsi insiden wajib diisi.' });
      const severity = String(req.body?.severity || 'RINGAN').toUpperCase();
      const created = await prisma.diakoniaIncident.create({
        data: {
          id: newEntityId('dinc'),
          eventId: req.params.id,
          description,
          severity: severity === 'BERAT' ? 'BERAT' : 'RINGAN',
          createdById: req.authUser?.id || null,
        },
      });
      res.json({ item: created });
    }),
  );

  app.delete(
    '/api/diakonia/incidents/:id',
    requireRole(...WRITE_ROLES), requireDivision('DIAKONIA'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!needTable(prisma, 'diakoniaIncident')) return res.status(503).json({ error: 'Database belum siap.' });
      await prisma.diakoniaIncident.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    }),
  );

  app.patch(
    '/api/diakonia/incidents/:id',
    requireRole(...WRITE_ROLES), requireDivision('DIAKONIA'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!needTable(prisma, 'diakoniaIncident')) return res.status(503).json({ error: 'Database belum siap.' });
      const updated = await prisma.diakoniaIncident.update({
        where: { id: req.params.id },
        data: { followupCaseId: String(req.body?.followupCaseId || '').slice(0, 64) || null },
      });
      res.json({ item: updated });
    }),
  );

  // ---- Kost perantau ----
  app.get('/api/diakonia/kost', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!needTable(prisma, 'diakoniaKost')) return res.json({ items: [] });
    const onlyLive = String(req.query.live || '') === '1';
    const items = await prisma.diakoniaKost.findMany({
      where: onlyLive ? { status: 'TAMPIL' } : {},
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    res.json({ items });
  }));

  app.post('/api/diakonia/kost', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!needTable(prisma, 'diakoniaKost')) return res.status(503).json({ error: 'Database belum siap.' });
    const area = String(req.body?.area || '').trim().slice(0, 150);
    if (!area) return res.status(400).json({ error: 'Area kos wajib diisi.' });
    const created = await prisma.diakoniaKost.create({
      data: {
        id: newEntityId('dkost'),
        area,
        priceRange: String(req.body?.priceRange || '').slice(0, 100) || null,
        contact: String(req.body?.contact || '').slice(0, 120) || null,
        note: String(req.body?.note || '').slice(0, 5000) || null,
        createdById: req.authUser?.id || null,
      },
    });
    res.json({ item: created });
  }));

  app.delete(
    '/api/diakonia/kost/:id',
    requireRole(...WRITE_ROLES), requireDivision('DIAKONIA'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!needTable(prisma, 'diakoniaKost')) return res.status(503).json({ error: 'Database belum siap.' });
      await prisma.diakoniaKost.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    }),
  );

  app.patch(
    '/api/diakonia/kost/:id',
    requireRole(...WRITE_ROLES), requireDivision('DIAKONIA'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!needTable(prisma, 'diakoniaKost')) return res.status(503).json({ error: 'Database belum siap.' });
      const status = String(req.body?.status || '').toUpperCase();
      if (!KOST_STATUS.has(status)) return res.status(400).json({ error: 'Status: USULAN / TAMPIL / ARSIP.' });
      // Moderasi tampil: tim Diakonia + Komisi + BOD Tim Kerja (HoD vacant → BOD eksekusi).
      // Ditegakkan requireDivision('DIAKONIA') di middleware — sama aturan dengan checks/cases.
      const updated = await prisma.diakoniaKost.update({ where: { id: req.params.id }, data: { status } });
      res.json({ item: updated });
    }),
  );
}
