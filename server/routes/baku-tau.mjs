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
  normalizePhone,
  whatsappGroupUrlFromEnv,
} from '../lib/baku-tau.mjs';
import { emptyDomicileStats, isValidDomicileKind, DOMICILE_DETAIL_REQUIRED } from '../lib/domicile.mjs';
import { claimWaitingPoolByPhone, ensureWaitingPoolForNewPemuda } from '../onboarding-sync.mjs';

const wpId = () => `wp-${crypto.randomUUID()}`;
const eaId = () => `ea-${crypto.randomUUID()}`;

async function upsertBakutauAttendee(prisma, userId, metadata) {
  const existing = await prisma.eventAttendee.findUnique({
    where: { eventId_userId: { eventId: BAKU_TAU_EVENT_ID, userId } },
  });
  if (existing) {
    return prisma.eventAttendee.update({
      where: { id: existing.id },
      data: { metadata: metadata ?? existing.metadata },
    });
  }
  return prisma.eventAttendee.create({
    data: { id: eaId(), eventId: BAKU_TAU_EVENT_ID, userId, metadata: metadata ?? undefined },
  });
}

function publicEventInfo(event) {
  return {
    id: BAKU_TAU_EVENT_ID,
    slug: 'bakutau',
    name: event?.name || BAKU_TAU_SOURCE_EVENT,
    status: event?.status || 'ACTIVE',
    eventDate: BAKU_TAU_EVENT_DATE_ISO,
    venueName: BAKU_TAU_VENUE_NAME,
    locationDetail: BAKU_TAU_LOCATION_DETAIL,
    mapUrl: BAKU_TAU_MAP_URL,
    mapEmbedQuery: BAKU_TAU_MAP_EMBED_QUERY,
  };
}

async function resolveEventInfo(prisma) {
  const event = await prisma.eventProgram.findUnique({ where: { id: BAKU_TAU_EVENT_ID } });
  return {
    ...publicEventInfo(event),
    whatsappGroupUrl: event?.whatsappGroupUrl || whatsappGroupUrlFromEnv(),
  };
}

async function bakuTauStats(prisma) {
  const where = { sourceEvent: BAKU_TAU_SOURCE_EVENT };
  const entries = await prisma.waitingPool.findMany({
    where,
    select: { status: true, userId: true, profileCompleted: true, domicileKind: true },
  });
  const byDomicile = emptyDomicileStats();
  let registered = 0;
  let withAccount = 0;
  let profileComplete = 0;
  for (const e of entries) {
    registered += 1;
    if (e.userId) withAccount += 1;
    if (e.profileCompleted) profileComplete += 1;
    if (e.domicileKind && byDomicile[e.domicileKind] !== undefined) {
      byDomicile[e.domicileKind] += 1;
    }
  }
  return { registered, withAccount, profileComplete, byDomicile };
}

/** BAKU TAU 4.0 public registration & stats */
export function registerBakuTauRoutes(app, { wrap }) {
  const sendEventPayload = async (res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const event = await prisma.eventProgram.findUnique({ where: { id: BAKU_TAU_EVENT_ID } });
    const stats = await bakuTauStats(prisma);
    res.json({ ...publicEventInfo(event), stats });
  };

  app.get('/api/events/baku-tau-4-0', wrap(async (_req, res) => sendEventPayload(res)));
  app.get('/api/events/bakutau', wrap(async (_req, res) => sendEventPayload(res)));

  app.get('/api/events/baku-tau-4-0/stats', wrap(async (_req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    res.json(await bakuTauStats(prisma));
  }));

  app.post('/api/events/baku-tau-4-0/register', wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const eventRow = await prisma.eventProgram.findUnique({ where: { id: BAKU_TAU_EVENT_ID } });
    if (eventRow?.status === 'ARCHIVED') {
      return res.status(410).json({ error: 'Pendaftaran BAKU TAU sudah ditutup.' });
    }

    const { name, phone, gender, origin, domicileKind, domicileDetail } = req.body || {};
    const authUser = req.authUser;

    if (authUser) {
      const user = await prisma.user.findUnique({ where: { id: authUser.id } });
      if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });

      let entry = await prisma.waitingPool.findUnique({ where: { userId: user.id } });
      const data = {
        name: user.name,
        email: user.email,
        phone: user.phone || phone || null,
        gender: user.gender || gender || null,
        origin: user.origin || origin || null,
        domicileKind: domicileKind || user.domicileKind || null,
        domicileDetail: domicileDetail || user.domicileDetail || null,
        sourceEvent: BAKU_TAU_SOURCE_EVENT,
        status: entry?.status === 'ROLE_ASSIGNED' ? 'ROLE_ASSIGNED' : (entry?.profileCompleted ? 'PROFILE_COMPLETED' : 'WAITING_POOL'),
      };

      if (entry) {
        entry = await prisma.waitingPool.update({ where: { id: entry.id }, data: { ...data, userId: user.id } });
      } else {
        entry = await prisma.waitingPool.create({
          data: { id: wpId(), userId: user.id, ...data },
        });
      }

      if (domicileKind || domicileDetail) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            domicileKind: domicileKind || user.domicileKind,
            domicileDetail: domicileDetail || user.domicileDetail,
            origin: origin || user.origin,
            gender: gender || user.gender,
            phone: phone || user.phone,
          },
        });
      }

      try {
        await upsertBakutauAttendee(prisma, user.id, {
          origin: origin || user.origin,
          domicileKind: domicileKind || user.domicileKind,
          domicileDetail: domicileDetail || user.domicileDetail,
        });
      } catch { /* table may not exist on old DB */ }

      const info = await resolveEventInfo(prisma);
      return res.json({
        ok: true,
        entry,
        stats: await bakuTauStats(prisma),
        whatsappGroupUrl: info.whatsappGroupUrl,
      });
    }

    if (!name?.trim() || !phone?.trim() || !gender || !origin?.trim() || !domicileKind) {
      return res.status(400).json({ error: 'Nama, WA, gender, asal, dan domisili wajib diisi.' });
    }
    if (!isValidDomicileKind(String(domicileKind))) {
      return res.status(400).json({ error: 'Domisili tidak valid.' });
    }
    if (DOMICILE_DETAIL_REQUIRED.has(String(domicileKind)) && !domicileDetail?.trim()) {
      return res.status(400).json({ error: 'Perincian domisili wajib untuk pilihan ini.' });
    }

    const normPhone = normalizePhone(phone);
    const existing = await prisma.waitingPool.findMany({
      where: { sourceEvent: BAKU_TAU_SOURCE_EVENT, userId: null },
    });
    const dup = existing.find((e) => normalizePhone(e.phone) === normPhone);
    const info = await resolveEventInfo(prisma);
    if (dup) {
      return res.json({
        ok: true,
        entry: dup,
        duplicate: true,
        stats: await bakuTauStats(prisma),
        whatsappGroupUrl: info.whatsappGroupUrl,
      });
    }

    const entry = await prisma.waitingPool.create({
      data: {
        id: wpId(),
        userId: null,
        name: String(name).trim(),
        phone: String(phone).trim(),
        gender: String(gender),
        origin: String(origin).trim(),
        domicileKind: String(domicileKind),
        domicileDetail: domicileDetail?.trim() || null,
        sourceEvent: BAKU_TAU_SOURCE_EVENT,
        status: 'REGISTERED',
        claimToken: crypto.randomBytes(24).toString('hex'),
      },
    });

    res.json({
      ok: true,
      entry,
      stats: await bakuTauStats(prisma),
      whatsappGroupUrl: info.whatsappGroupUrl,
    });
  }));

  app.post('/api/events/baku-tau-4-0/claim', wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const userId = req.authUser?.id;
    if (!userId) return res.status(401).json({ error: 'Belum login.' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });

    const phone = req.body?.phone || user.phone;
    const claimed = await claimWaitingPoolByPhone(prisma, userId, phone, BAKU_TAU_SOURCE_EVENT);
    if (!claimed) {
      await ensureWaitingPoolForNewPemuda(userId, { sourceEvent: BAKU_TAU_SOURCE_EVENT });
    }

    const entry = await prisma.waitingPool.findFirst({
      where: { userId, sourceEvent: BAKU_TAU_SOURCE_EVENT },
    }) || await prisma.waitingPool.findUnique({ where: { userId } });

    const info = await resolveEventInfo(prisma);
    res.json({ ok: true, entry, stats: await bakuTauStats(prisma), whatsappGroupUrl: info.whatsappGroupUrl });
  }));

  app.get('/api/me/baku-tau-registration', wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const userId = req.authUser?.id;
    if (!userId) return res.status(401).json({ error: 'Belum login.' });

    const entry = await prisma.waitingPool.findFirst({
      where: { userId, sourceEvent: BAKU_TAU_SOURCE_EVENT },
    });
    const info = await resolveEventInfo(prisma);
    if (!entry) {
      return res.json({
        registered: false,
        eventDate: info.eventDate,
        venueName: info.venueName,
        locationDetail: info.locationDetail,
        mapUrl: info.mapUrl,
        mapEmbedQuery: info.mapEmbedQuery,
      });
    }
    res.json({
      registered: true,
      status: entry.status,
      whatsappGroupUrl: info.whatsappGroupUrl,
      eventDate: info.eventDate,
      venueName: info.venueName,
      locationDetail: info.locationDetail,
      mapUrl: info.mapUrl,
      mapEmbedQuery: info.mapEmbedQuery,
      checkInCode: `GEHC-BT|${entry.id}|${new Date(entry.registeredAt).getTime()}`,
      registeredAt: entry.registeredAt,
      entry,
    });
  }));
}
