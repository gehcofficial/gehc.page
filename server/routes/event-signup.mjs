import crypto from 'node:crypto';
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { normalizePhone } from '../lib/baku-tau.mjs';
import { resolveWhatsAppUrl } from '../lib/event-question-showif.mjs';
import { venueOf } from '../lib/event-venue.mjs';
import { findEventProgramPublic } from '../lib/event-program-public.mjs';
import { buildCheckInCode } from '../lib/check-in-code.mjs';
import { claimWaitingPoolByPhone } from '../onboarding-sync.mjs';
import { eventSignupStats, sourceEventOf } from '../lib/event-signup-stats.mjs';
import { registrationCodeFor } from '../lib/event-qr.mjs';
import { resolveEventBySlug } from './events-public.mjs';

const wpId = () => `wp-${crypto.randomUUID()}`;
const eaId = () => `ea-${crypto.randomUUID()}`;

function hasActiveRole(user) {
  return (user.roles || []).some((r) =>
    ['MENTEE', 'MENTOR', 'CO_MENTOR', 'COMMITTEE', 'KOMISI', 'BPMJ', 'SUPERADMIN', 'ALUMNI'].includes(r.role),
  );
}

async function eventWaUrl(prisma, event) {
  let channelUrl = null;
  try {
    const link = await prisma.channelLink.findUnique({
      where: { kind_refId: { kind: 'EVENT', refId: event.id } },
    });
    channelUrl = link?.url || null;
  } catch { /* ChannelLink belum ada */ }
  return resolveWhatsAppUrl({ dbUrl: event?.whatsappGroupUrl, channelUrl });
}

async function payloadFor(prisma, { event, userId, poolEntry }, info) {
  const base = {
    eventDate: info.eventDate,
    venueName: info.venueName,
    locationDetail: info.locationDetail,
    mapUrl: info.mapUrl,
    mapEmbedQuery: info.mapEmbedQuery,
  };
  // Counter tanpa akun: baris pool yatim milik event ini → kode pool.
  if (poolEntry && !poolEntry.userId) {
    return {
      registered: true,
      status: poolEntry.status,
      whatsappGroupUrl: info.whatsappGroupUrl || null,
      ...base,
      checkInCode: buildCheckInCode(poolEntry.id, poolEntry.registeredAt || Date.now()),
      registeredAt: poolEntry.registeredAt,
      entry: poolEntry,
    };
  }
  // Akun login: kode dari baris milik event ini (pool event / attendee) —
  // tidak pernah dari pool event lain (multi-event aman).
  const { code, poolEntry: mine } = await registrationCodeFor(prisma, {
    eventId: event.id,
    userId,
    sourceEvent: sourceEventOf(event),
  });
  if (!code) return { registered: false, ...base, whatsappGroupUrl: null, checkInCode: null };
  return {
    registered: true,
    status: mine?.status || 'REGISTERED',
    whatsappGroupUrl: info.whatsappGroupUrl || null,
    ...base,
    checkInCode: code,
    registeredAt: mine?.registeredAt || null,
    entry: mine,
  };
}

async function findPoolEntry(prisma, userId, source) {
  const entry = await prisma.waitingPool.findFirst({ where: { userId, sourceEvent: source } });
  return entry || null;
}

export function registerEventSignupRoutes(app, { wrap }) {
  async function resolveOr404(prisma, slugOrId, res) {
    const resolved = await resolveEventBySlug(prisma, String(slugOrId || '').toLowerCase()).catch(() => null);
    if (!resolved?.event) {
      res.status(404).json({ error: 'Event tidak ditemukan.' });
      return null;
    }
    return resolved;
  }

  // Daftar kehadiran: login maupun counter nama+WA. sourceEvent = nama event.
  app.post('/api/events/:slug/register', wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const resolved = await resolveOr404(prisma, req.params.slug, res);
    if (!resolved) return;
    const { event } = resolved;
    if (event.status === 'ARCHIVED') {
      return res.status(410).json({ error: `Pendaftaran ${event.name} sudah ditutup.` });
    }
    const source = sourceEventOf(event);
    const authUser = req.authUser;

    if (authUser) {
      const user = await prisma.user.findUnique({ where: { id: authUser.id }, include: { roles: true } });
      if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });
      if (!hasActiveRole(user)) return res.status(403).json({ error: 'Akun belum punya peran jemaat.' });
      // Cek-dulu-baru-buat: user boleh punya pool event lain tanpa bentrok unik.
      let entry = await prisma.waitingPool.findFirst({ where: { userId: user.id, sourceEvent: source } });
      if (entry) {
        entry = await prisma.waitingPool.update({
          where: { id: entry.id },
          data: { name: user.name, email: user.email, phone: user.phone || entry.phone },
        });
      } else {
        const clash = await prisma.waitingPool.findUnique({ where: { userId: user.id } }).catch(() => null);
        if (!clash) {
          entry = await prisma.waitingPool.create({
            data: {
              id: wpId(),
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
      await prisma.eventAttendee.upsert({
        where: { eventId_userId: { eventId: event.id, userId: user.id } },
        create: { id: eaId(), eventId: event.id, userId: user.id },
        update: {},
      }).catch(() => null);
      const info = { ...venueOf(event, false), whatsappGroupUrl: await eventWaUrl(prisma, event) };
      const out = await payloadFor(prisma, { event, userId: user.id, poolEntry: entry }, info);
      return res.json({ ok: true, entry: out.entry || entry, stats: await eventSignupStats(prisma, event), ...out });
    }

    const { name, phone } = req.body || {};
    if (!String(name || '').trim() || !String(phone || '').trim()) {
      return res.status(400).json({ error: 'Nama dan nomor WhatsApp wajib diisi.' });
    }
    const normPhone = normalizePhone(phone);
    const existing = await prisma.waitingPool.findMany({ where: { sourceEvent: source, userId: null } });
    const dup = existing.find((e) => normalizePhone(e.phone) === normPhone);
    const info = { ...venueOf(event, false), whatsappGroupUrl: await eventWaUrl(prisma, event) };
    if (dup) {
      return res.json({ ok: true, entry: dup, duplicate: true, stats: await eventSignupStats(prisma, event), ...await payloadFor(prisma, { event, userId: null, poolEntry: dup }, info) });
    }
    const entry = await prisma.waitingPool.create({
      data: {
        id: wpId(),
        userId: null,
        name: String(name).trim(),
        phone: String(phone).trim(),
        sourceEvent: source,
        status: 'REGISTERED',
        claimToken: crypto.randomBytes(24).toString('hex'),
      },
    });
    res.json({ ok: true, entry, stats: await eventSignupStats(prisma, event), ...await payloadFor(prisma, { event, userId: null, poolEntry: entry }, info) });
  }));

  // Tautkan baris counter (nama+WA) ke akun login.
  app.post('/api/events/:slug/claim', wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const userId = req.authUser?.id;
    if (!userId) return res.status(401).json({ error: 'Belum login.' });
    const resolved = await resolveOr404(prisma, req.params.slug, res);
    if (!resolved) return;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });
    const claimed = await claimWaitingPoolByPhone(prisma, userId, req.body?.phone || user.phone, sourceEventOf(resolved.event));
    if (!claimed) return res.status(404).json({ error: 'Data counter tidak ditemukan untuk nomor ini.' });
    await prisma.eventAttendee.upsert({
      where: { eventId_userId: { eventId: resolved.event.id, userId } },
      create: { id: eaId(), eventId: resolved.event.id, userId },
      update: {},
    }).catch(() => null);
    const info = { ...venueOf(resolved.event, false), whatsappGroupUrl: await eventWaUrl(prisma, resolved.event) };
    res.json({ ok: true, ...await payloadFor(prisma, { event: resolved.event, userId, poolEntry: claimed }, info) });
  }));

  // Status pendaftaran milikku untuk event ini (QR + WA).
  app.get('/api/events/:slug/my-registration', wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const userId = req.authUser?.id;
    if (!userId) return res.status(401).json({ error: 'Belum login.' });
    const resolved = await resolveOr404(prisma, req.params.slug, res);
    if (!resolved) return;
    const source = sourceEventOf(resolved.event);
    const entry = await findPoolEntry(prisma, userId, source);
    const info = { ...venueOf(resolved.event, false), whatsappGroupUrl: await eventWaUrl(prisma, resolved.event) };
    res.json(await payloadFor(prisma, { event: resolved.event, userId, poolEntry: entry }, info));
  }));
}
