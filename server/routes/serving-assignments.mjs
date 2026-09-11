import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { sundayInstant } from '../lib/service-events.mjs';
import { sundaysInMonth } from '../lib/church-year.mjs';
import { SERVING_PAIRS, resolvePairIds } from '../lib/serving-cycle.mjs';
import { listOverrides } from '../lib/service-overrides.mjs';

function toDateOnly(d) {
  if (!d) return null;
  const s = String(d).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return new Date(`${s}T00:00:00Z`);
}

/**
 * Eksekusi tukar jadwal (dipakai swap langsung + approve request).
 * Melempar Error dengan pesan siap tampil bila prasyarat gagal.
 */
export async function executeServingSwap(prisma, { aDate, bDate, scope = 'PAIR', reason }) {
  const [a, b] = await Promise.all([
    prisma.servingAssignment.findFirst({ where: { eventDate: aDate } }),
    prisma.servingAssignment.findFirst({ where: { eventDate: bDate } }),
  ]);
  if (!a || !b) {
    const err = new Error('Salah satu tanggal belum punya jadwal Serving (generate dulu atau tolak request).');
    err.status = 404;
    throw err;
  }

  const tag = scope === 'PAIR' ? reason : `[${scope === 'RESPONSIBLE' ? 'penanggung' : 'tuan rumah'}] ${reason}`;
  const aData = { isSwapped: true, swapReason: tag };
  const bData = { isSwapped: true, swapReason: tag };
  if (scope === 'PAIR' || scope === 'RESPONSIBLE') {
    aData.responsibleGroupId = b.responsibleGroupId;
    bData.responsibleGroupId = a.responsibleGroupId;
    aData.cycleIndex = b.cycleIndex;
    bData.cycleIndex = a.cycleIndex;
  }
  if (scope === 'PAIR' || scope === 'HOST') {
    aData.hostGroupId = b.hostGroupId;
    bData.hostGroupId = a.hostGroupId;
  }

  await prisma.$transaction([
    prisma.servingAssignment.update({ where: { id: a.id }, data: aData }),
    prisma.servingAssignment.update({ where: { id: b.id }, data: bData }),
  ]);

  return prisma.servingAssignment.findMany({
    where: { eventDate: { in: [aDate, bDate] } },
    include: {
      responsibleGroup: { select: { id: true, name: true } },
      hostGroup: { select: { id: true, name: true } },
      event: { select: { id: true, name: true } },
    },
    orderBy: { eventDate: 'asc' },
  });
}

export function registerServingAssignmentRoutes(app, { wrap }) {
  // GET /api/serving-assignments?from=YYYY-MM-DD&to=YYYY-MM-DD&horizon=3|4&includeVirtual=1
  // Read-only untuk semua peran gereja (tab Jadwal Pelayanan per grup butuh ini)
  app.get(
    '/api/serving-assignments',
    requireRole('KOMISI', 'COMMITTEE', 'SUPERADMIN', 'BPMJ', 'MENTOR', 'CO_MENTOR', 'MENTEE', 'ALUMNI'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      let from = toDateOnly(req.query?.from);
      let to = toDateOnly(req.query?.to);
      const horizon = Math.min(6, Math.max(1, Number(req.query?.horizon) || 4));
      const includeVirtual = String(req.query?.includeVirtual ?? '1') !== '0';
      // default horizon 4 bulan dari from atau hari ini
      if (!from && !to) {
        from = toDateOnly(new Date().toISOString().slice(0, 10));
        // bulatkan ke 1 Sep 2026 jika belum lewat untuk demo 4 bulan Sep-Des
      }
      if (includeVirtual && from) {
        // Tentukan to dari horizon bulan bila to belum diisi
        if (!to) {
          const y = from.getUTCFullYear();
          const m = from.getUTCMonth() + 1;
          let tY = y, tM = m + horizon - 1;
          while (tM > 12) { tM -= 12; tY += 1; }
          const lastSundays = sundaysInMonth(tY, tM);
          const last = lastSundays[lastSundays.length - 1];
          to = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate()));
        }
      }
      const where = {};
      if (from || to) {
        where.eventDate = {};
        if (from) where.eventDate.gte = from;
        if (to) where.eventDate.lte = to;
      }
      const rows = await prisma.servingAssignment.findMany({
        where,
        orderBy: { eventDate: 'asc' },
        include: {
          responsibleGroup: { select: { id: true, name: true, color: true } },
          hostGroup: { select: { id: true, name: true, color: true } },
          event: { select: { id: true, name: true, status: true, eventDate: true, venueName: true } },
        },
        take: 80,
      });
      if (!includeVirtual || !from || !to) {
        return res.json({ assignments: rows.map((r) => ({ ...r, expectedCycleIndex: null, needsSync: false, override: null })), virtual: [], specials: [], overrides: [] });
      }
      // Bangun kalender Minggu serving virtual untuk tanggal yang belum punya assignment
      const byDate = new Map(rows.map((r) => [new Date(r.eventDate).toISOString().slice(0, 10), r]));
      const groups = await prisma.group.findMany({ select: { id: true, name: true, color: true } }).catch(() => []);
      // base cycle index = jumlah serving yang sudah ada sebelum from (untuk kontinuitas)
      let baseIdx = 0;
      try {
        baseIdx = await prisma.servingAssignment.count({ where: { eventDate: { lt: from } } });
      } catch {}
      // Kumpulkan semua Minggu serving (bukan W1 mentoring) di rentang
      const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
      const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
      const sundays = [];
      for (let y = start.getUTCFullYear(), m = start.getUTCMonth() + 1; y < end.getUTCFullYear() || (y === end.getUTCFullYear() && m <= end.getUTCMonth() + 1); ) {
        for (const s of sundaysInMonth(y, m)) sundays.push(s);
        m += 1; if (m > 12) { m = 1; y += 1; }
        if (sundays.length > 40) break;
      }
      // Filter hanya yang dalam range from-to dan bukan W1 (first sunday of month = mentoring)
      const servingSundays = sundays.filter((d) => {
        const iso = d.toISOString().slice(0, 10);
        const dt = new Date(`${iso}T00:00:00Z`);
        if (dt < from || dt > to) return false;
        const m = dt.getUTCMonth() + 1, y = dt.getUTCFullYear();
        const first = sundaysInMonth(y, m)[0];
        if (first && dt.getTime() === first.getTime()) return false; // mentoring
        return true;
      });
      // Override kondisi khusus: LIBUR/ALIH/GABUNGAN tidak consume cycle index.
      const overrides = await listOverrides(
        prisma,
        from.toISOString().slice(0, 10),
        to.toISOString().slice(0, 10),
      );
      const todayISO = new Date().toISOString().slice(0, 10);
      const virtual = [];
      const specials = [];
      let seq = 0; // minggu consuming yang sudah diproses (real + virtual)
      // Urutkan servingSundays kronologis
      servingSundays.sort((a, b) => a.getTime() - b.getTime());
      for (const s of servingSundays) {
        const iso = s.toISOString().slice(0, 10);
        const ov = overrides.get(iso);
        if (ov) {
          const real = byDate.get(iso);
          if (real) real._override = ov; // chip info; idx tidak dibandingkan di minggu override
          specials.push({
            id: `special-${iso}`,
            eventDate: new Date(`${iso}T00:00:00Z`),
            serviceType: 'SERVING_DAY',
            condition: ov.condition,
            note: ov.note,
            partnerLabel: ov.partnerLabel,
            linkedEventId: ov.linkedEventId,
            cycleIndex: null,
            responsibleGroupId: null,
            hostGroupId: null,
            responsibleGroup: null,
            hostGroup: null,
            event: real?.event || null,
            isVirtual: true,
            isSpecial: true,
          });
          continue; // tidak consume idx
        }
        const expected = (baseIdx + seq) % 10;
        const real = byDate.get(iso);
        if (real) {
          real._expectedCycleIndex = expected;
          if (!real.isSwapped && real.cycleIndex !== expected && iso >= todayISO) {
            real._needsSync = true; // badge review + kandidat rebase
          }
          seq += 1;
          continue;
        }
        const cycleIndex = expected;
        const pair = resolvePairIds(cycleIndex, groups);
        virtual.push({
          id: `virtual-${iso}`,
          eventDate: new Date(`${iso}T00:00:00Z`),
          serviceType: 'SERVING_DAY',
          cycleIndex,
          responsibleGroupId: pair.responsibleGroupId,
          hostGroupId: pair.hostGroupId,
          responsibleGroup: groups.find((g) => g.id === pair.responsibleGroupId) || { id: pair.responsibleGroupId, name: pair.responsibleName, color: null },
          hostGroup: groups.find((g) => g.id === pair.hostGroupId) || { id: pair.hostGroupId, name: pair.hostName, color: null },
          event: null,
          isVirtual: true,
        });
        seq += 1;
      }
      const serializeRow = (r) => ({
        ...r,
        eventDate: r.eventDate,
        expectedCycleIndex: r._expectedCycleIndex ?? null,
        needsSync: Boolean(r._needsSync),
        override: r._override || null,
      });
      res.json({
        assignments: rows.map(serializeRow),
        virtual,
        specials,
        overrides: [...overrides.entries()].map(([eventDate, o]) => ({ eventDate, ...o })),
        horizon,
        from: from?.toISOString().slice(0, 10),
        to: to?.toISOString().slice(0, 10),
      });
    })
  );

  // GET single by date (YYYY-MM-DD)
  app.get(
    '/api/serving-assignments/:date',
    requireRole('KOMISI', 'COMMITTEE', 'SUPERADMIN'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const d = toDateOnly(req.params.date);
      if (!d) return res.status(400).json({ error: 'Tanggal tidak valid (YYYY-MM-DD).' });
      const row = await prisma.servingAssignment.findFirst({
        where: { eventDate: d },
        include: {
          responsibleGroup: { select: { id: true, name: true } },
          hostGroup: { select: { id: true, name: true } },
          event: { select: { id: true, name: true, status: true } },
        },
      });
      if (!row) return res.status(404).json({ error: 'Jadwal tidak ditemukan.' });
      res.json({ assignment: row });
    })
  );

  // POST /api/serving-assignments/swap — tukar dua jadwal
  // Body: { aEventDate, bEventDate, reason, scope: 'PAIR'|'RESPONSIBLE'|'HOST' }
  // PAIR = sepasang utuh (kompatibel lama). RESPONSIBLE = penanggung saja
  // (cycleIndex ikut penanggung). HOST = tuan rumah saja (cycleIndex tetap).
  app.post(
    '/api/serving-assignments/swap',
    requireRole('KOMISI', 'SUPERADMIN'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const aDate = toDateOnly(req.body?.aEventDate);
      const bDate = toDateOnly(req.body?.bEventDate);
      const reason = String(req.body?.reason || '').trim().slice(0, 500);
      const scope = String(req.body?.scope || 'PAIR').toUpperCase();
      if (!aDate || !bDate) return res.status(400).json({ error: 'aEventDate dan bEventDate wajib (YYYY-MM-DD).' });
      if (aDate.getTime() === bDate.getTime()) return res.status(400).json({ error: 'Tidak bisa tukar dengan tanggal yang sama.' });
      if (!reason) return res.status(400).json({ error: 'Alasan tukar wajib diisi.' });
      if (!['PAIR', 'RESPONSIBLE', 'HOST'].includes(scope)) {
        return res.status(400).json({ error: 'scope harus PAIR, RESPONSIBLE, atau HOST.' });
      }

      const updated = await executeServingSwap(prisma, { aDate, bDate, scope, reason });
      res.json({ ok: true, scope, swapped: updated });
    })
  );

  // POST /api/serving-assignments/rebase — selaraskan ulang cycleIndex baris
  // future non-swap setelah minggu LIBUR/ALIH. Idempoten (re-run = 0 update).
  // Body opsional: { from: 'YYYY-MM-DD' } — samakan dengan anchor tampilan
  // (FE kirim from yang sama dengan GET) agar badge needsSync dan hasil klop.
  // Hanya eventDate >= hari ini yang ditulis; baris swap dan baris di tanggal
  // override dilewati (manual).
  app.post(
    '/api/serving-assignments/rebase',
    requireRole('KOMISI', 'SUPERADMIN'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const todayISO = new Date().toISOString().slice(0, 10);
      const fromParam = toDateOnly(req.body?.from) || new Date(`${todayISO}T00:00:00Z`);
      const liburDates = await prisma.$queryRawUnsafe(
        "SELECT event_date AS eventDate FROM service_week_overrides WHERE `condition` IN ('LIBUR','ALIH')",
      ).then((rows) => new Set((rows || []).map((r) => String(r.eventDate instanceof Date ? r.eventDate.toISOString().slice(0, 10) : r.eventDate).slice(0, 10)))).catch(() => new Set());
      if (!liburDates.size) return res.json({ ok: true, updated: 0, note: 'Tidak ada minggu LIBUR/ALIH.' });

      const startCount = await prisma.servingAssignment.count({ where: { eventDate: { lt: fromParam } } }).catch(() => 0);
      const rows = await prisma.servingAssignment.findMany({
        where: { eventDate: { gte: fromParam } },
        orderBy: { eventDate: 'asc' },
        take: 200,
      });
      let seq = 0;
      const ops = [];
      for (const row of rows) {
        const iso = new Date(row.eventDate).toISOString().slice(0, 10);
        if (liburDates.has(iso)) continue; // minggu override: biarkan manual, tidak consume
        const expected = (startCount + seq) % 10;
        seq += 1;
        if (iso < todayISO || row.isSwapped) continue; // riwayat & swap: manual
        if (row.cycleIndex !== expected) {
          ops.push(prisma.servingAssignment.update({ where: { id: row.id }, data: { cycleIndex: expected } }));
        }
      }
      if (ops.length) await prisma.$transaction(ops);
      res.json({ ok: true, updated: ops.length, from: fromParam.toISOString().slice(0, 10) });
    })
  );
}
