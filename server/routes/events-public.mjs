import crypto from 'node:crypto';
import { getPrisma } from '../db.mjs';
import {
  BAKU_TAU_SOURCE_EVENT,
  BAKU_TAU_EVENT_ID,
  BAKU_TAU_EVENT_DATE_ISO,
  BAKU_TAU_VENUE_NAME,
  BAKU_TAU_LOCATION_DETAIL,
  BAKU_TAU_MAP_URL,
  BAKU_TAU_MAP_EMBED_QUERY,
  whatsappGroupUrlFromEnv,
} from '../lib/baku-tau.mjs';

const SLUG_TO_EVENT_ID = {
  bakutau: BAKU_TAU_EVENT_ID,
  'baku-tau-4-0': BAKU_TAU_EVENT_ID,
};

async function resolveEventBySlug(prisma, slug) {
  const eventId = SLUG_TO_EVENT_ID[slug];
  if (eventId) {
    const event = await prisma.eventProgram.findUnique({ where: { id: eventId } });
    return { event, slug, eventId, isBakutau: true };
  }
  const event = await prisma.eventProgram.findUnique({ where: { slug } });
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
  // BAKU TAU exact routes registered early in index.mjs (before /api/events/:id)

  app.get('/api/events/:slug', wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const slug = String(req.params.slug || '').toLowerCase();
    if (slug === 'baku-tau-4-0' || slug === 'bakutau') {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const resolved = await resolveEventBySlug(prisma, 'bakutau');
      if (!resolved) return res.status(404).json({ error: 'Event tidak ditemukan.' });
      const { event, isBakutau } = resolved;
      const whatsappGroupUrl = event.whatsappGroupUrl || whatsappGroupUrlFromEnv();
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
        eventDate: BAKU_TAU_EVENT_DATE_ISO,
        venueName: BAKU_TAU_VENUE_NAME,
        locationDetail: BAKU_TAU_LOCATION_DETAIL,
        mapUrl: BAKU_TAU_MAP_URL,
        mapEmbedQuery: BAKU_TAU_MAP_EMBED_QUERY,
        whatsappGroupUrl,
        stats,
      });
    }

    const resolved = await resolveEventBySlug(prisma, slug);
    if (!resolved) return res.status(404).json({ error: 'Event tidak ditemukan.' });

    const { event, isBakutau } = resolved;
    const whatsappGroupUrl = event.whatsappGroupUrl || (isBakutau ? whatsappGroupUrlFromEnv() : null);

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
      const count = await prisma.eventAttendee.count({ where: { eventId: event.id } });
      stats = { registered: count, withAccount: count, profileComplete: count };
    }

    res.json({
      id: event.id,
      slug: event.slug,
      name: event.name,
      status: event.status,
      eventDate: isBakutau ? BAKU_TAU_EVENT_DATE_ISO : event.startDate?.toISOString?.() || null,
      venueName: isBakutau ? BAKU_TAU_VENUE_NAME : null,
      locationDetail: isBakutau ? BAKU_TAU_LOCATION_DETAIL : event.description,
      mapUrl: isBakutau ? BAKU_TAU_MAP_URL : null,
      mapEmbedQuery: isBakutau ? BAKU_TAU_MAP_EMBED_QUERY : null,
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
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
      orderBy: { registeredAt: 'desc' },
      take: 500,
    });
    res.json({ attendees: rows });
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
      return res.json({ ok: true, mode: 'attendee' });
    }

    return res.status(400).json({ error: 'Gunakan endpoint event spesifik untuk registrasi ini.' });
  }));
}

export { upsertEventAttendee, resolveEventBySlug };
