import crypto from 'node:crypto';
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import {
  BAKU_TAU_SOURCE_EVENT,
  BAKU_TAU_EVENT_ID,
} from '../lib/baku-tau.mjs';
import { venueOf } from '../lib/event-venue.mjs';
import { fromDbContent } from '../lib/content-map.mjs';
import { eventSignupStats } from '../lib/event-signup-stats.mjs';
import { resolveWhatsAppUrl } from '../lib/event-question-showif.mjs';
import { findEventProgramPublic } from '../lib/event-program-public.mjs';
import {
  registrationFromWaitingPool,
  registrationFromAttendee,
  summarizeRegistrations,
  registrationsToCsv,
} from '../lib/event-registrations.mjs';

export const SLUG_TO_EVENT_ID = {
  bakutau: BAKU_TAU_EVENT_ID,
  'baku-tau-4-0': BAKU_TAU_EVENT_ID,
  [BAKU_TAU_EVENT_ID]: BAKU_TAU_EVENT_ID,
};

export async function resolveEventBySlug(prisma, slug) {
  const eventId = SLUG_TO_EVENT_ID[slug];
  if (eventId) {
    const event = await findEventProgramPublic(prisma, { id: eventId });
    return {
      event: event || { id: eventId, slug, name: BAKU_TAU_SOURCE_EVENT, status: 'ACTIVE' },
      slug,
      eventId,
      isBakutau: true,
    };
  }
  const event = await findEventProgramPublic(prisma, { slug });
  if (!event) return null;
  return { event, slug, eventId: event.id, isBakutau: false };
}

async function upsertEventAttendee(prisma, eventId, userId, metadata) {
  const existing = await prisma.eventAttendee.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });
  if (existing) {
    return prisma.eventAttendee.update({
      where: { id: existing.id },
      data: { metadata: metadata ?? existing.metadata },
    });
  }
  return prisma.eventAttendee.create({
    data: {
      id: `ea-${crypto.randomUUID()}`,
      eventId,
      userId,
      metadata: metadata ?? undefined,
    },
  });
}

function hasActiveRole(user) {
  return (user.roles || []).some((r) =>
    ['MENTEE', 'MENTOR', 'CO_MENTOR', 'COMMITTEE', 'KOMISI', 'BPMJ', 'SUPERADMIN', 'ALUMNI'].includes(r.role),
  );
}

export function registerEventsPublicRoutes(app, { wrap }) {
  // Landing Kegiatan 3 lapis — WAJIB sebelum '/api/events/:slug' agar tak tertelan param.
  // full: konten ACTIVITY terbit (+venue event tertaut). compact: event
  // PLANNING/ACTIVE bertanggal tanpa konten terbit. DONE/ARCHIVED: tidak tampil.
  app.get('/api/events/landing', wrap(async (_req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    let full = [];
    let linkedIds = [];
    try {
      const rows = await prisma.contentItem.findMany({
        where: { type: 'ACTIVITY', isPublished: true },
        orderBy: [{ isFeaturedEvent: 'desc' }, { publishedAt: 'desc' }],
        take: 20,
      });
      const items = rows.map(fromDbContent);
      linkedIds = [...new Set(items.map((c) => c.eventId).filter(Boolean))];
      const venueByEvent = {};
      const statsByEvent = {};
      if (linkedIds.length) {
        const evs = await prisma.eventProgram.findMany({ where: { id: { in: linkedIds } } }).catch(() => []);
        await Promise.all(evs.map(async (e) => {
          venueByEvent[e.id] = {
            ...venueOf(e, e.id === BAKU_TAU_EVENT_ID),
            status: e.status,
            slug: e.slug,
            name: e.name,
          };
          try {
            statsByEvent[e.id] = await eventSignupStats(prisma, e);
          } catch { /* abaikan */ }
        }));
      }
      full = items.map((c) => ({
        ...c,
        venue: c.eventId ? venueByEvent[c.eventId] || null : null,
        isBakutau: c.id === 'cnt-bakutau',
        stats: c.eventId ? statsByEvent[c.eventId] || null : null,
      }));
    } catch {
      full = [];
    }
    let compact = [];
    try {
      const evs = await prisma.eventProgram.findMany({
        where: {
          status: { in: ['PLANNING', 'ACTIVE'] },
          eventDate: { not: null },
          ...(linkedIds.length ? { id: { notIn: linkedIds } } : {}),
        },
        orderBy: { eventDate: 'asc' },
        take: 12,
        select: { id: true, name: true, status: true, kind: true, eventDate: true },
      });
      compact = evs.map((e) => ({
        id: e.id,
        name: e.name,
        status: e.status,
        kind: e.kind,
        eventDate: e.eventDate,
      }));
    } catch {
      compact = [];
    }
    res.json({ full, compact });
  }));

  // BAKU TAU exact routes registered early in index.mjs (before /api/events/:id)

  app.get('/api/events/:slug', wrap(async (req, res, next) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const slug = String(req.params.slug || '').toLowerCase();
    if (slug === 'public-archive' || slug === 'upcoming') return next();
    if (slug === 'baku-tau-4-0' || slug === 'bakutau') {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const resolved = await resolveEventBySlug(prisma, 'bakutau');
      if (!resolved) return res.status(404).json({ error: 'Event tidak ditemukan.' });
      const { event } = resolved;
      const entries = await prisma.waitingPool.findMany({
        where: { sourceEvent: BAKU_TAU_SOURCE_EVENT },
        select: { status: true, userId: true, profileCompleted: true },
      });
      const stats = {
        registered: entries.length,
        withAccount: entries.filter((e) => e.userId).length,
        profileComplete: entries.filter((e) => e.profileCompleted).length,
      };
      return res.json({
        id: event.id,
        slug: 'bakutau',
        name: event.name,
        status: event.status,
        ...venueOf(event, true),
        stats,
      });
    }

    const resolved = await resolveEventBySlug(prisma, slug);
    if (!resolved) return res.status(404).json({ error: 'Event tidak ditemukan.' });

    const { event, isBakutau } = resolved;

    let stats = null;
    if (isBakutau) {
      const entries = await prisma.waitingPool.findMany({
        where: { sourceEvent: BAKU_TAU_SOURCE_EVENT },
        select: { status: true, userId: true, profileCompleted: true },
      });
      stats = {
        registered: entries.length,
        withAccount: entries.filter((e) => e.userId).length,
        profileComplete: entries.filter((e) => e.profileCompleted).length,
      };
    } else {
      // Counter + akun: waiting_pool (sourceEvent = nama event) + attendees.
      stats = await eventSignupStats(prisma, event);
    }

    let whatsappGroupUrl = null;
    try {
      const link = await prisma.channelLink.findUnique({
        where: { kind_refId: { kind: 'EVENT', refId: event.id } },
      }).catch(() => null);
      whatsappGroupUrl = resolveWhatsAppUrl({ dbUrl: event.whatsappGroupUrl, channelUrl: link?.url || null });
    } catch { /* abaikan */ }

    res.json({
      id: event.id,
      slug: event.slug,
      name: event.name,
      status: event.status,
      ...venueOf(event, isBakutau),
      whatsappGroupUrl,
      stats,
    });
  }));

  app.get('/api/events/:slug/attendees', wrap(async (req, res) => {
    if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const resolved = await resolveEventBySlug(prisma, String(req.params.slug || '').toLowerCase());
    if (!resolved) return res.status(404).json({ error: 'Event tidak ditemukan.' });

    const rows = await prisma.eventAttendee.findMany({
      where: { eventId: resolved.eventId },
      include: {
        user: {
          select: {
            id: true, name: true, email: true, phone: true,
            gender: true, origin: true, domicileKind: true, domicileDetail: true,
          },
        },
      },
      orderBy: { registeredAt: 'desc' },
      take: 500,
    });
    res.json({ attendees: rows });
  }));

  const USER_PUBLIC_SELECT = {
    id: true, name: true, email: true, phone: true,
    gender: true, origin: true, domicileKind: true, domicileDetail: true,
  };

  async function loadEventRegistrations(prisma, resolved) {
    if (resolved.isBakutau) {
      const pool = await prisma.waitingPool.findMany({
        where: { sourceEvent: BAKU_TAU_SOURCE_EVENT },
        include: { user: { select: USER_PUBLIC_SELECT } },
        orderBy: { registeredAt: 'desc' },
        take: 500,
      });
      const registrations = pool.map(registrationFromWaitingPool);
      return {
        source: 'waiting_pool',
        registrations,
        summary: summarizeRegistrations(registrations),
      };
    }

    const rows = await prisma.eventAttendee.findMany({
      where: { eventId: resolved.eventId },
      include: { user: { select: USER_PUBLIC_SELECT } },
      orderBy: { registeredAt: 'desc' },
      take: 500,
    });
    const registrations = rows.map(registrationFromAttendee);
    return {
      source: 'event_attendee',
      registrations,
      summary: summarizeRegistrations(registrations),
    };
  }

  app.get('/api/events/:slug/registrations', requireRole('KOMISI', 'COMMITTEE', 'BPMJ'), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const resolved = await resolveEventBySlug(prisma, String(req.params.slug || '').toLowerCase());
    if (!resolved) return res.status(404).json({ error: 'Event tidak ditemukan.' });

    res.json(await loadEventRegistrations(prisma, resolved));
  }));

  app.get('/api/events/:slug/registrations/export', requireRole('KOMISI', 'COMMITTEE', 'BPMJ'), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const resolved = await resolveEventBySlug(prisma, String(req.params.slug || '').toLowerCase());
    if (!resolved) return res.status(404).json({ error: 'Event tidak ditemukan.' });

    const { registrations } = await loadEventRegistrations(prisma, resolved);
    const slug = resolved.slug || resolved.eventId;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="pendaftar-${slug}.csv"`);
    res.send(`\uFEFF${registrationsToCsv(registrations)}`);
  }));

  app.post('/api/events/:slug/register-auth', wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    if (!req.authUser) return res.status(401).json({ error: 'Login diperlukan.' });

    const resolved = await resolveEventBySlug(prisma, String(req.params.slug || '').toLowerCase());
    if (!resolved) return res.status(404).json({ error: 'Event tidak ditemukan.' });
    if (resolved.event.status === 'ARCHIVED') {
      return res.status(410).json({ error: 'Pendaftaran event sudah ditutup.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.authUser.id },
      include: { roles: true },
    });
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });

    const metadata = req.body?.metadata || {
      origin: req.body?.origin,
      domicileKind: req.body?.domicileKind,
      domicileDetail: req.body?.domicileDetail,
    };

    if (hasActiveRole(user) && !resolved.isBakutau) {
      await upsertEventAttendee(prisma, resolved.eventId, user.id, metadata);
      // Pastikan baris pool event ini agar QR tersedia — cek dulu (satu user
      // boleh ikut banyak event; jangan pakai pool event lain).
      const source = String(resolved.event.name || '').trim();
      let entry = source
        ? await prisma.waitingPool.findFirst({ where: { userId: user.id, sourceEvent: source } }).catch(() => null)
        : null;
      if (!entry && source) {
        const clash = await prisma.waitingPool.findUnique({ where: { userId: user.id } }).catch(() => null);
        if (!clash) {
          entry = await prisma.waitingPool.create({
            data: {
              id: `wp-${crypto.randomUUID()}`,
              userId: user.id,
              name: user.name,
              email: user.email,
              phone: user.phone || null,
              sourceEvent: source,
              status: 'REGISTERED',
              claimToken: crypto.randomBytes(24).toString('hex'),
            },
          }).catch(() => null);
        }
      }
      let channelUrl = null;
      try {
        const link = await prisma.channelLink.findUnique({
          where: { kind_refId: { kind: 'EVENT', refId: resolved.eventId } },
        }).catch(() => null);
        channelUrl = link?.url || null;
      } catch { /* abaikan */ }
      const { registrationCodeFor } = await import('../lib/event-qr.mjs');
      const { code, poolEntry } = await registrationCodeFor(prisma, {
        eventId: resolved.eventId,
        userId: user.id,
        sourceEvent: source,
      });
      const shown = poolEntry || entry;
      return res.json({
        ok: true,
        mode: 'attendee',
        registered: Boolean(code),
        whatsappGroupUrl: resolveWhatsAppUrl({ dbUrl: resolved.event.whatsappGroupUrl, channelUrl }),
        checkInCode: code,
        registeredAt: shown?.registeredAt || null,
      });
    }

    return res.status(400).json({ error: 'Gunakan endpoint event spesifik untuk registrasi ini.' });
  }));
}

export { upsertEventAttendee };
