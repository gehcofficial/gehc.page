import crypto from 'node:crypto';
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { BAKU_TAU_EVENT_ID, BAKU_TAU_SOURCE_EVENT, normalizePhone } from '../lib/baku-tau.mjs';
import { parseCheckInCode, timestampsMatch } from '../lib/check-in-code.mjs';
import { resolveEventBySlug, SLUG_TO_EVENT_ID } from './events-public.mjs';
import { isKoinoniaOperator } from '../lib/checkin-access.mjs';

const scanId = () => `cin-${crypto.randomUUID()}`;

const SCAN_PAGE_DEFAULT = 100;
const SCAN_PAGE_MAX = 500;
const EXPORT_MAX = 20000;
/** Scan yang benar-benar menandai kehadiran, jadi bisa dibatalkan. */
const CHECKED_IN_RESULTS = new Set(['OK', 'WALK_IN']);

/**
 * Format nomor yang lazim tersimpan, supaya pencocokan walk-in bisa lewat
 * `phone IN (...)` dan tidak perlu memuat seluruh waiting_pool.
 */
function phoneVariants(normalized) {
  if (!normalized) return [];
  const local = normalized.startsWith('62') ? `0${normalized.slice(2)}` : normalized;
  const bare = normalized.startsWith('62') ? normalized.slice(2) : normalized;
  return [...new Set([normalized, `+${normalized}`, local, bare])].filter(Boolean);
}

async function resolveEvent(prisma, slugOrId) {
  const raw = String(slugOrId || '').trim();
  const lower = raw.toLowerCase();
  const mappedId = SLUG_TO_EVENT_ID[lower];
  if (mappedId) {
    const event = await prisma.eventProgram.findUnique({ where: { id: mappedId } }).catch(() => null);
    return {
      id: mappedId,
      slug: lower === 'baku-tau-4-0' ? 'bakutau' : lower,
      name: event?.name || 'BAKU TAU 4.0',
      isBakutau: true,
      event,
    };
  }
  const resolved = await resolveEventBySlug(prisma, lower).catch(() => null);
  if (resolved?.event) {
    return {
      id: resolved.eventId,
      slug: resolved.slug,
      name: resolved.event.name,
      isBakutau: !!resolved.isBakutau,
      event: resolved.event,
    };
  }
  const byId = await prisma.eventProgram.findUnique({ where: { id: raw } }).catch(() => null);
  if (byId) {
    return {
      id: byId.id,
      slug: byId.slug,
      name: byId.name,
      isBakutau: byId.id === BAKU_TAU_EVENT_ID,
      event: byId,
    };
  }
  return null;
}

async function logScan(prisma, { eventId, waitingPoolId, userId, code, result, scannedById }) {
  return prisma.eventCheckIn.create({
    data: {
      id: scanId(),
      eventId,
      waitingPoolId: waitingPoolId || null,
      userId: userId || null,
      code: String(code || '').slice(0, 190),
      result,
      scannedById,
    },
  });
}

async function markAttendee(prisma, eventId, userId, scannedById, at) {
  if (!userId) return;
  const existing = await prisma.eventAttendee.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });
  if (existing) {
    if (existing.checkedInAt) return existing;
    return prisma.eventAttendee.update({
      where: { id: existing.id },
      data: { checkedInAt: at, checkedInById: scannedById },
    });
  }
  return prisma.eventAttendee.create({
    data: {
      id: `ea-${crypto.randomUUID()}`,
      eventId,
      userId,
      checkedInAt: at,
      checkedInById: scannedById,
    },
  });
}

/** Terdaftar vs sudah masuk — dihitung dari sumber kebenaran, bukan dari daftar scan. */
async function countRegistration(prisma, resolved) {
  if (resolved.isBakutau) {
    const pools = await prisma.waitingPool.findMany({
      where: { sourceEvent: BAKU_TAU_SOURCE_EVENT },
      select: { eventCheckedInAt: true },
    });
    return {
      registered: pools.length,
      checkedIn: pools.filter((p) => p.eventCheckedInAt).length,
    };
  }
  const attendees = await prisma.eventAttendee.findMany({
    where: { eventId: resolved.id },
    select: { checkedInAt: true },
  });
  return {
    registered: attendees.length,
    checkedIn: attendees.filter((a) => a.checkedInAt).length,
  };
}

function serializeScan(s) {
  return {
    id: s.id,
    result: s.result,
    code: s.code,
    scannedAt: s.scannedAt,
    scannedById: s.scannedById,
    waitingPoolId: s.waitingPoolId,
    userId: s.userId,
    userName: s.user?.name || null,
  };
}

function csvCell(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

async function requireCheckInOp(req, res) {
  if (!req.authUser) {
    res.status(401).json({ error: 'Belum login.' });
    return false;
  }
  const ok = await isKoinoniaOperator(req.authUser);
  if (!ok) {
    res.status(403).json({ error: 'Check-in hanya untuk Komisi, Tim Kerja BOD, atau Koinonia.' });
    return false;
  }
  return true;
}

export function registerEventCheckInRoutes(app, { wrap }) {
  app.post('/api/events/:slug/check-in', requireRole('KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
    if (!(await requireCheckInOp(req, res))) return;
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const resolved = await resolveEvent(prisma, req.params.slug);
    if (!resolved) return res.status(404).json({ error: 'Event tidak ditemukan.' });

    const code = String(req.body?.code || '').trim();
    if (!code) return res.status(400).json({ error: 'Kode QR wajib.' });

    const scannedById = req.authUser.id;
    const parsed = parseCheckInCode(code);
    if (!parsed) {
      await logScan(prisma, { eventId: resolved.id, code, result: 'UNKNOWN', scannedById });
      return res.json({ result: 'UNKNOWN', message: 'Kode tidak dikenali. Pastikan QR peserta BAKU TAU.' });
    }

    const pool = await prisma.waitingPool.findUnique({ where: { id: parsed.waitingPoolId } });
    if (!pool) {
      await logScan(prisma, { eventId: resolved.id, code, waitingPoolId: parsed.waitingPoolId, result: 'UNKNOWN', scannedById });
      return res.json({ result: 'UNKNOWN', message: 'Peserta tidak ada di daftar.' });
    }

    if (resolved.isBakutau && pool.sourceEvent && pool.sourceEvent !== BAKU_TAU_SOURCE_EVENT) {
      await logScan(prisma, {
        eventId: resolved.id, code, waitingPoolId: pool.id, userId: pool.userId, result: 'MISMATCH', scannedById,
      });
      return res.json({ result: 'MISMATCH', message: 'QR bukan untuk event ini.', name: pool.name });
    }

    if (!timestampsMatch(pool.registeredAt, parsed.registeredAtMs)) {
      await logScan(prisma, {
        eventId: resolved.id, code, waitingPoolId: pool.id, userId: pool.userId, result: 'MISMATCH', scannedById,
      });
      return res.json({ result: 'MISMATCH', message: 'QR tidak cocok dengan data pendaftaran.', name: pool.name });
    }

    if (pool.eventCheckedInAt) {
      await logScan(prisma, {
        eventId: resolved.id, code, waitingPoolId: pool.id, userId: pool.userId, result: 'DUPLICATE', scannedById,
      });
      return res.json({
        result: 'DUPLICATE',
        message: 'Sudah check-in sebelumnya.',
        name: pool.name,
        checkedInAt: pool.eventCheckedInAt,
      });
    }

    const at = new Date();
    await prisma.waitingPool.update({
      where: { id: pool.id },
      data: { eventCheckedInAt: at, eventCheckedInById: scannedById },
    });
    await markAttendee(prisma, resolved.id, pool.userId, scannedById, at);
    await logScan(prisma, {
      eventId: resolved.id, code, waitingPoolId: pool.id, userId: pool.userId, result: 'OK', scannedById,
    });

    return res.json({
      result: 'OK',
      message: 'Check-in berhasil.',
      name: pool.name,
      phone: pool.phone,
      waitingPoolId: pool.id,
    });
  }));

  app.post('/api/events/:slug/check-in/walk-in', requireRole('KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
    if (!(await requireCheckInOp(req, res))) return;
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const resolved = await resolveEvent(prisma, req.params.slug);
    if (!resolved) return res.status(404).json({ error: 'Event tidak ditemukan.' });

    const name = String(req.body?.name || '').trim();
    const phone = normalizePhone(req.body?.phone || '');
    if (!name) return res.status(400).json({ error: 'Nama wajib untuk walk-in.' });

    const scannedById = req.authUser.id;
    const at = new Date();
    let pool = null;
    if (phone) {
      const base = resolved.isBakutau ? { sourceEvent: BAKU_TAU_SOURCE_EVENT } : {};
      const candidates = await prisma.waitingPool.findMany({
        where: { ...base, phone: { in: phoneVariants(phone) } },
        select: { id: true, name: true, phone: true, userId: true, eventCheckedInAt: true },
        take: 25,
      });
      pool = candidates.find((p) => normalizePhone(p.phone || '') === phone) || null;

      // Nomor dengan spasi/tanda hubung tidak tertangkap `IN`; pindai terbatas.
      if (!pool) {
        const loose = await prisma.waitingPool.findMany({
          where: base,
          select: { id: true, name: true, phone: true, userId: true, eventCheckedInAt: true },
          orderBy: { registeredAt: 'desc' },
          take: 2000,
        });
        pool = loose.find((p) => normalizePhone(p.phone || '') === phone) || null;
      }
    }

    if (pool?.eventCheckedInAt) {
      await logScan(prisma, {
        eventId: resolved.id,
        code: `WALK-IN|${name}|${phone}`,
        waitingPoolId: pool.id,
        userId: pool.userId,
        result: 'DUPLICATE',
        scannedById,
      });
      return res.json({
        result: 'DUPLICATE',
        message: 'Nomor ini sudah check-in.',
        name: pool.name,
        checkedInAt: pool.eventCheckedInAt,
      });
    }

    if (pool) {
      await prisma.waitingPool.update({
        where: { id: pool.id },
        data: { eventCheckedInAt: at, eventCheckedInById: scannedById },
      });
      await markAttendee(prisma, resolved.id, pool.userId, scannedById, at);
    }

    await logScan(prisma, {
      eventId: resolved.id,
      code: `WALK-IN|${name}|${phone}`,
      waitingPoolId: pool?.id || null,
      userId: pool?.userId || null,
      result: pool ? 'OK' : 'WALK_IN',
      scannedById,
    });

    return res.json({
      result: pool ? 'OK' : 'WALK_IN',
      message: pool ? 'Check-in berhasil (cocok dari daftar).' : 'Walk-in dicatat.',
      name: pool?.name || name,
    });
  }));

  app.get('/api/events/:slug/check-ins', requireRole('KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
    if (!(await requireCheckInOp(req, res))) return;
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const resolved = await resolveEvent(prisma, req.params.slug);
    if (!resolved) return res.status(404).json({ error: 'Event tidak ditemukan.' });

    const limit = Math.min(Math.max(Number(req.query.limit) || SCAN_PAGE_DEFAULT, 1), SCAN_PAGE_MAX);
    const cursor = String(req.query.cursor || '').trim();

    const scans = await prisma.eventCheckIn.findMany({
      where: { eventId: resolved.id },
      orderBy: { scannedAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { user: { select: { id: true, name: true } } },
    });

    const hasMore = scans.length > limit;
    const page = hasMore ? scans.slice(0, limit) : scans;

    // Breakdown dihitung di DB — bukan dari halaman yang terpotong.
    const grouped = await prisma.eventCheckIn.groupBy({
      by: ['result'],
      where: { eventId: resolved.id },
      _count: { _all: true },
    });
    const byResult = Object.fromEntries(grouped.map((g) => [g.result, g._count._all]));

    const counts = await countRegistration(prisma, resolved);

    const stats = {
      registered: counts.registered,
      checkedIn: counts.checkedIn,
      ok: byResult.OK || 0,
      duplicate: byResult.DUPLICATE || 0,
      unknown: byResult.UNKNOWN || 0,
      mismatch: byResult.MISMATCH || 0,
      walkIn: byResult.WALK_IN || 0,
      voided: byResult.VOIDED || 0,
      totalScans: grouped.reduce((sum, g) => sum + g._count._all, 0),
    };

    res.json({
      event: { id: resolved.id, slug: resolved.slug, name: resolved.name },
      stats,
      scans: page.map(serializeScan),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    });
  }));

  app.post('/api/events/:slug/check-in/:scanId/void', requireRole('KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
    if (!(await requireCheckInOp(req, res))) return;
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const resolved = await resolveEvent(prisma, req.params.slug);
    if (!resolved) return res.status(404).json({ error: 'Event tidak ditemukan.' });

    const scan = await prisma.eventCheckIn.findUnique({ where: { id: String(req.params.scanId || '') } });
    if (!scan || scan.eventId !== resolved.id) {
      return res.status(404).json({ error: 'Scan tidak ditemukan pada event ini.' });
    }
    if (scan.result === 'VOIDED') {
      return res.status(400).json({ error: 'Scan ini sudah dibatalkan.' });
    }
    if (!CHECKED_IN_RESULTS.has(scan.result)) {
      return res.status(400).json({ error: `Scan ${scan.result} tidak menandai kehadiran, tidak perlu dibatalkan.` });
    }

    const scannedById = req.authUser.id;

    if (scan.waitingPoolId) {
      await prisma.waitingPool.updateMany({
        where: { id: scan.waitingPoolId },
        data: { eventCheckedInAt: null, eventCheckedInById: null },
      });
    }
    if (scan.userId) {
      await prisma.eventAttendee.updateMany({
        where: { eventId: resolved.id, userId: scan.userId },
        data: { checkedInAt: null, checkedInById: null },
      });
    }

    await logScan(prisma, {
      eventId: resolved.id,
      waitingPoolId: scan.waitingPoolId,
      userId: scan.userId,
      code: scan.code,
      result: 'VOIDED',
      scannedById,
    });

    return res.json({ result: 'VOIDED', message: 'Check-in dibatalkan. Peserta bisa scan ulang.' });
  }));

  app.get('/api/events/:slug/check-ins/export', requireRole('KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
    if (!(await requireCheckInOp(req, res))) return;
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const resolved = await resolveEvent(prisma, req.params.slug);
    if (!resolved) return res.status(404).json({ error: 'Event tidak ditemukan.' });

    const scans = await prisma.eventCheckIn.findMany({
      where: { eventId: resolved.id },
      orderBy: { scannedAt: 'asc' },
      take: EXPORT_MAX,
      include: { user: { select: { name: true } } },
    });

    const header = 'waktu,hasil,nama,waiting_pool_id,user_id,kode,operator';
    const rows = scans.map((s) => [
      s.scannedAt.toISOString(),
      s.result,
      csvCell(s.user?.name || ''),
      s.waitingPoolId || '',
      s.userId || '',
      csvCell(s.code),
      s.scannedById,
    ].join(','));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="check-in-${resolved.slug}.csv"`);
    res.send([header, ...rows].join('\n'));
  }));
}
