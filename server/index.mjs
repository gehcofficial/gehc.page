import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import { getDriveMode, listFolders, listFiles, getFileStream, testConnection as testDrive, getFolderChain, listFolderTree } from './gdrive.mjs';
import { resolveAccess, matrixForUser, parseTag } from './gdrive-policy.mjs';
import { getPrisma, isDbConfigured, testConnection as testDb, resetPrisma, isTransientDbError, getDbLabel, getDbTarget } from './db.mjs';
import {
  sendPushNotification,
  broadcastPushNotification,
  notifyNewWarta,
  notifyNewGallery,
  notifyNewSchedule,
  notifyOrderUpdate,
} from './push.mjs';
import {
  attachUser,
  requireRole,
  setSessionCookie,
  clearSessionCookie,
  loginWithGoogleCredential,
  claimWithGoogleCredential,
  linkGoogleToSessionUser,
  newClaimToken,
  verifyGoogleCredential,
  hashPassword,
  verifyPassword,
  loginLocal,
  isSuperadminEmail,
  ensureSuperadminRole,
  applySuperadminSession,
} from './auth.mjs';
import {
  getDashboard,
  runScan,
  recommendPlacement,
  recommendPlacementAdvanced,
  executeSplit,
  executeMerge,
  shuffleRole,
  markAlumni,
  capacityOf,
  calculateGiftDiversity,
} from './engine.mjs';
import { narrateDashboard, analyzePlacementRecommendations } from './jethro-ai.mjs';
import {
  createPlacementBatch,
  getPlacementBatch,
  listPlacementBatches,
  updatePlacementItem,
  bulkApprovePlacementBatch,
  commitPlacementBatch,
  getEligibleNewcomers,
} from './jethro-placement.mjs';
import {
  applyLifeAddressFields,
  reminderDue,
  profileSegments,
  COMMON_MAJORS,
} from './profile-fields.mjs';
import { syncWaitingPoolFromUser, ensureWaitingPoolForNewPemuda, claimWaitingPoolByPhone } from './onboarding-sync.mjs';
import { assignRoleToUser, revokeRoleAssignment } from './role-assign.mjs';
import { normalizeGiftsTop5 } from './gift-normalize.mjs';
import { enrichUserDemographics, parseBirthDateInput, isBirthdayWithinDays } from './demographics.mjs';
import { registerAdminRoutes } from './routes/admin.mjs';
import { registerOnboardingRoutes } from './routes/onboarding.mjs';
import { registerOrgRoutes } from './routes/org.mjs';
import { registerEventsPublicRoutes } from './routes/events-public.mjs';
import { BAKU_TAU_SOURCE_EVENT, BAKU_TAU_EVENT_DATE_ISO, BAKU_TAU_MAP_URL, BAKU_TAU_MAP_EMBED_QUERY, BAKU_TAU_VENUE_NAME } from './lib/baku-tau.mjs';
import { assignOrgSlot } from './services/org-assign.mjs';
import { createApp } from './createApp.mjs';
import { KOMISION, KOMISION_CORE } from './lib/rbac-constants.mjs';

const app = createApp();
const PORT = Number(process.env.PORT || 8787);

const wrap = (fn) => (req, res) => fn(req, res).catch(async (err) => {
  console.error(`[api] ${req.method} ${req.path} →`, err.message);
  if (isTransientDbError(err)) {
    await resetPrisma();
    return res.status(503).json({ error: 'Database sedang reconnect. Muat ulang sebentar.', retry: true });
  }
  res.status(500).json({ error: err.message });
});

// ---------- Auth: Google SSO ----------
app.get('/api/auth/config', (req, res) => {
  res.json({
    clientId: process.env.GOOGLE_CLIENT_ID || null,
    mapsKey: process.env.GOOGLE_MAPS_API_KEY || null,
    configured: Boolean(process.env.GOOGLE_CLIENT_ID) && isDbConfigured(),
  });
});

const WILAYAH_CACHE = new Map();
app.get('/api/wilayah/:kind', wrap(async (req, res) => {
  const kind = String(req.params.kind || '');
  if (!['provinces'].includes(kind)) return res.status(400).json({ error: 'Jenis wilayah tidak valid.' });
  const cacheKey = kind;
  const hit = WILAYAH_CACHE.get(cacheKey);
  if (hit && Date.now() - hit.at < 86400000) return res.json(hit.data);
  const r = await fetch(`https://wilayah.id/api/${kind}.json`);
  if (!r.ok) return res.status(502).json({ error: 'Gagal memuat data wilayah.' });
  const data = await r.json();
  WILAYAH_CACHE.set(cacheKey, { at: Date.now(), data });
  res.json(data);
}));

app.get('/api/wilayah/:kind/:code', wrap(async (req, res) => {
  const kind = String(req.params.kind || '');
  const code = String(req.params.code || '');
  if (!['regencies', 'districts', 'villages'].includes(kind)) {
    return res.status(400).json({ error: 'Jenis wilayah tidak valid.' });
  }
  if (!/^[0-9.]+$/.test(code)) return res.status(400).json({ error: 'Kode wilayah tidak valid.' });
  const cacheKey = `${kind}:${code}`;
  const hit = WILAYAH_CACHE.get(cacheKey);
  if (hit && Date.now() - hit.at < 86400000) return res.json(hit.data);
  const r = await fetch(`https://wilayah.id/api/${kind}/${encodeURIComponent(code)}.json`);
  if (!r.ok) return res.status(502).json({ error: 'Gagal memuat data wilayah.' });
  const data = await r.json();
  WILAYAH_CACHE.set(cacheKey, { at: Date.now(), data });
  res.json(data);
}));

app.post('/api/auth/google', wrap(async (req, res) => {
  const credential = req.body?.credential;
  if (!credential) return res.status(400).json({ error: 'credential (ID token Google) wajib dikirim.' });
  try {
    const user = await loginWithGoogleCredential(credential);
    setSessionCookie(res, { uid: user.id, email: user.email });
    res.json({ user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar, accountStatus: user.accountStatus, roles: user.roles } });
  } catch (err) {
    console.error('[auth] login gagal:', err.message);
    res.status(401).json({ error: err.message });
  }
}));

app.get('/api/auth/me', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const u = req.authUser;
  res.json({
    user: u,
    reminderDue: reminderDue(u),
    segments: profileSegments(u),
  });
}));

app.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

function meInclude() {
  return {
    roles: true,
    kolom: true,
    institution: true,
    recreational: { include: { group: true } },
  };
}

app.get('/api/me/profile', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const user = await prisma.user.findUnique({
    where: { id: req.authUser.id },
    include: meInclude(),
  });
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });
  const recreationalIds = (user.recreational || []).map((m) => m.groupId);
  const view = { ...user, recreational: (user.recreational || []).map((m) => m.group), recreationalIds };
  let recreationalSuggestions = [];
  try {
    recreationalSuggestions = await prisma.recreationalSuggestion.findMany({
      where: { userId: req.authUser.id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
  } catch { /* table may not exist yet */ }
  let churchDataRequest = null;
  try {
    churchDataRequest = await prisma.profileChurchDataRequest.findFirst({
      where: { userId: req.authUser.id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
  } catch { /* table may not exist yet */ }
  res.json({
    user: view,
    demographics: enrichUserDemographics(view),
    reminderDue: reminderDue(user),
    segments: profileSegments({ ...view, recreationalIds }),
    recreationalSuggestions,
    churchDataRequest,
  });
}));

app.patch('/api/me/profile', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const body = req.body || {};
  const data = {};
  if (body.gender !== undefined) data.gender = body.gender ? String(body.gender) : null;
  if (body.phone !== undefined) data.phone = body.phone ? String(body.phone) : null;
  if (body.birthDate !== undefined) {
    const parsed = parseBirthDateInput(body.birthDate);
    if (body.birthDate && !parsed) return res.status(400).json({ error: 'Tanggal lahir tidak valid.' });
    data.birthDate = parsed;
  }
  const err = applyLifeAddressFields(body, data);
  if (err) return res.status(400).json({ error: err });
  if (body.giftsTop5 !== undefined) {
    if (!Array.isArray(body.giftsTop5)) return res.status(400).json({ error: 'giftsTop5 harus array.' });
    data.giftsTop5 = body.giftsTop5;
  }
  if (Object.keys(data).length === 0 && body.recreationalIds === undefined) {
    return res.status(400).json({ error: 'Tidak ada field untuk diupdate.' });
  }
  data.lastProfileUpdate = new Date();
  if (Object.keys(data).length) {
    await prisma.user.update({ where: { id: req.authUser.id }, data });
  }
  if (Array.isArray(body.recreationalIds)) {
    await prisma.recreationalMembership.deleteMany({ where: { userId: req.authUser.id } });
    const ids = body.recreationalIds.filter(Boolean);
    if (ids.length) {
      await prisma.recreationalMembership.createMany({
        data: ids.map((groupId) => ({ userId: req.authUser.id, groupId })),
      });
    }
  }
  const user = await prisma.user.findUnique({ where: { id: req.authUser.id }, include: meInclude() });
  const recreationalIds = (user.recreational || []).map((m) => m.groupId);
  const view = { ...user, recreational: (user.recreational || []).map((m) => m.group), recreationalIds };
  try { await syncWaitingPoolFromUser(req.authUser.id); } catch { /* non-blocking */ }
  res.json({
    user: view,
    demographics: enrichUserDemographics(view),
    reminderDue: false,
    segments: profileSegments({ ...view, recreationalIds }),
  });
}));

app.post('/api/me/profile/confirm', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  await prisma.user.update({
    where: { id: req.authUser.id },
    data: { lastProfileUpdate: new Date() },
  });
  try { await syncWaitingPoolFromUser(req.authUser.id); } catch { /* non-blocking */ }
  res.json({ ok: true, reminderDue: false });
}));

const CHURCH_BIPRA_VALUES = ['BAPAK', 'IBU', 'PEMUDA', 'REMAJA', 'ANAK'];

app.post('/api/me/profile/church-data-request', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const user = await prisma.user.findUnique({ where: { id: req.authUser.id } });
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });

  const pending = await prisma.profileChurchDataRequest.findFirst({
    where: { userId: req.authUser.id, status: 'PENDING' },
  }).catch(() => null);
  if (pending) {
    return res.status(400).json({ error: 'Anda sudah punya permintaan perubahan yang menunggu persetujuan admin.' });
  }

  const body = req.body || {};
  let changeName = false;
  let changeBipra = false;
  let changeKolom = false;
  let requestedName = null;
  let requestedBipra = null;
  let requestedKolomId = null;

  if (body.requestedName !== undefined && body.requestedName !== null) {
    const n = String(body.requestedName).trim();
    if (!n) return res.status(400).json({ error: 'Nama tidak boleh kosong.' });
    if (n !== user.name) {
      changeName = true;
      requestedName = n;
    }
  }
  if (body.requestedBipra !== undefined && body.requestedBipra !== null && body.requestedBipra !== '') {
    const b = String(body.requestedBipra).toUpperCase();
    if (!CHURCH_BIPRA_VALUES.includes(b)) return res.status(400).json({ error: 'BIPRA tidak valid.' });
    if (b !== user.bipra) {
      changeBipra = true;
      requestedBipra = b;
    }
  }
  if (body.requestedKolomId !== undefined) {
    const kid = body.requestedKolomId ? String(body.requestedKolomId) : null;
    if (kid !== user.kolomId) {
      if (kid) {
        const kol = await prisma.kolom.findUnique({ where: { id: kid } });
        if (!kol) return res.status(404).json({ error: 'Kolom tidak ditemukan.' });
      }
      changeKolom = true;
      requestedKolomId = kid;
    }
  }

  if (!changeName && !changeBipra && !changeKolom) {
    return res.status(400).json({ error: 'Isi minimal satu field yang berbeda dari data saat ini.' });
  }

  const reason = body.reason ? String(body.reason).trim().slice(0, 500) : null;
  const churchDataRequest = await prisma.profileChurchDataRequest.create({
    data: {
      id: `pcdr-${crypto.randomBytes(6).toString('hex')}`,
      userId: req.authUser.id,
      changeName,
      changeBipra,
      changeKolom,
      requestedName,
      requestedBipra,
      requestedKolomId,
      reason,
      status: 'PENDING',
    },
  });
  res.json({ churchDataRequest });
}));

app.get('/api/institutions', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const kind = String(req.query.kind || 'UNIVERSITY');
  const institutions = await prisma.institution.findMany({
    where: { kind },
    orderBy: { name: 'asc' },
  });
  res.json({ institutions, majors: COMMON_MAJORS });
}));

app.post('/api/institutions', requireRole(...['SUPERADMIN', 'KOMISI']), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Nama kampus/sekolah wajib.' });
  const kind = req.body?.kind === 'SCHOOL' ? 'SCHOOL' : 'UNIVERSITY';
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'kampus';
  const institution = await prisma.institution.create({
    data: {
      id: `inst-${crypto.randomBytes(6).toString('hex')}`,
      slug: `${slug}-${crypto.randomBytes(2).toString('hex')}`,
      name,
      kind,
      city: req.body?.city ? String(req.body.city) : null,
    },
  });
  res.json({ institution });
}));

app.get('/api/kolom', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const kolom = await prisma.kolom.findMany({ orderBy: { number: 'asc' } });
  res.json({ kolom, bipra: ['BAPAK', 'IBU', 'PEMUDA', 'REMAJA', 'ANAK'] });
}));

app.post('/api/auth/claim', wrap(async (req, res) => {
  const { credential, token } = req.body || {};
  if (!credential || !token) return res.status(400).json({ error: 'credential dan token taut wajib.' });
  try {
    const user = await claimWithGoogleCredential(credential, token);
    setSessionCookie(res, { uid: user.id, email: user.email || '' });
    res.json({ user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar, accountStatus: user.accountStatus, roles: user.roles } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));

app.post('/api/me/link-google', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const { credential } = req.body || {};
  if (!credential) return res.status(400).json({ error: 'credential wajib.' });
  try {
    const user = await linkGoogleToSessionUser(req.authUser.id, credential);
    res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        linkStatus: user.linkStatus,
        authProvider: user.authProvider,
        accountStatus: user.accountStatus,
        roles: user.roles,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));

// Contoh proteksi endpoint RBAC (dipakai fitur portal lanjutan):
app.get('/api/auth/admin-check', requireRole('SUPERADMIN'), (req, res) => {
  res.json({ ok: true, email: req.authUser.email });
});

// GET /api/users/search?q=... — search users for @mention
app.get('/api/users/search', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ users: [] });

  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { email: { contains: q } },
        ],
      },
      select: { id: true, name: true, email: true },
      take: 10,
    });

    // Enrich with division info from struktur_members
    const enriched = await Promise.all(
      users.map(async (u) => {
        let division = null;
        try {
          const sm = await prisma.strukturMember.findFirst({ where: { email: u.email || '' } });
          if (sm?.division) division = sm.division;
        } catch { /* skip */ }
        return { ...u, division };
      })
    );

    res.json({ users: enriched });
  } catch (e) {
    res.json({ users: [] });
  }
}));

// GET /api/users — list all users (for admin panels)
app.get('/api/users', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, avatar: true, accountStatus: true },
    orderBy: { name: 'asc' },
  });

  res.json({ users });
}));

// ---------- Notifications ----------
// GET /api/notifications — get current user's notifications
app.get('/api/notifications', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  try {
    // Get notifications where user is mentioned (payload.authorId != user AND user is mentioned)
    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          // MENTION notifications where user was mentioned
          {
            type: 'MENTION',
            status: 'OPEN',
            // Check if the mentioned user ID is in the payload or title contains user name
          },
          // Other notification types
          {
            type: { not: 'MENTION' },
            status: 'OPEN',
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Filter MENTION notifications to only show ones relevant to current user
    const filtered = notifications.filter((n) => {
      if (n.type !== 'MENTION') return true;
      const payload = n.payload || {};
      // Show if user was mentioned (not the author)
      return payload.authorId !== req.authUser.id;
    });

    const unread = filtered.filter((n) => n.status === 'OPEN').length;
    res.json({ notifications: filtered, unread });
  } catch (e) {
    res.json({ notifications: [], unread: 0 });
  }
}));

// PATCH /api/notifications/:id/read — mark as read
app.patch('/api/notifications/:id/read', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  try {
    await prisma.notification.update({
      where: { id: req.params.id },
      data: { status: 'ACKNOWLEDGED', resolvedAt: new Date() },
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Gagal update notifikasi.' });
  }
}));

// POST /api/notifications/read-all — mark all as read
app.post('/api/notifications/read-all', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  try {
    await prisma.notification.updateMany({
      where: { status: 'OPEN' },
      data: { status: 'ACKNOWLEDGED', resolvedAt: new Date() },
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Gagal update notifikasi.' });
  }
}));

// ---------- Division Analytics ----------
// GET /api/events/:eventId/analytics — get analytics for an event
app.get('/api/events/:eventId/analytics', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum tersedia.' });

  const { eventId } = req.params;

  try {
    const divisions = await prisma.eventDivision.findMany({
      where: { eventId },
      include: {
        members: true,
        updates: true,
        approvalLogs: { orderBy: { createdAt: 'desc' } },
      },
    });

    const meetings = await prisma.eventMeeting.findMany({
      where: { eventId },
    });

    const stats = {
      totalDivisions: divisions.length,
      totalMembers: divisions.reduce((sum, d) => sum + d.members.length, 0),
      totalUpdates: divisions.reduce((sum, d) => sum + d.updates.length, 0),
      totalMeetings: meetings.length,
      statusBreakdown: {
        DRAFT: divisions.filter((d) => d.approvalStatus === 'DRAFT').length,
        IN_REVIEW: divisions.filter((d) => d.approvalStatus === 'IN_REVIEW').length,
        APPROVED: divisions.filter((d) => d.approvalStatus === 'APPROVED').length,
        REJECTED: divisions.filter((d) => d.approvalStatus === 'REJECTED').length,
        PUBLISHED: divisions.filter((d) => d.approvalStatus === 'PUBLISHED').length,
      },
      divisionStats: divisions.map((d) => ({
        division: d.division,
        status: d.approvalStatus,
        members: d.members.length,
        updates: d.updates.length,
        lastActivity: d.updates.length > 0
          ? d.updates[d.updates.length - 1].createdAt
          : d.createdAt,
      })),
      recentActivity: divisions
        .flatMap((d) =>
          d.updates.map((u) => ({
            ...u,
            division: d.division,
          }))
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10),
    };

    res.json({ stats });
  } catch (e) {
    res.status(500).json({ error: `Gagal memuat analytics: ${e.message}` });
  }
}));

// GET /api/events/:eventId/divisions/:div/analytics — get analytics for a specific division
app.get('/api/events/:eventId/divisions/:div/analytics', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum tersedia.' });

  const { eventId, div } = req.params;

  try {
    const division = await prisma.eventDivision.findUnique({
      where: { eventId_division: { eventId, division: div.toUpperCase() } },
      include: {
        members: true,
        updates: true,
        approvalLogs: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!division) return res.status(404).json({ error: 'Divisi tidak ditemukan.' });

    const meetings = await prisma.eventMeeting.findMany({
      where: { eventId, division: div.toUpperCase() },
    });

    const stats = {
      division: div.toUpperCase(),
      status: division.approvalStatus,
      totalMembers: division.members.length,
      totalUpdates: division.updates.length,
      totalMeetings: meetings.length,
      memberRoles: {
        LEAD: division.members.filter((m) => m.role === 'LEAD').length,
        CO_LEAD: division.members.filter((m) => m.role === 'CO_LEAD').length,
        MEMBER: division.members.filter((m) => m.role === 'MEMBER').length,
        VIEWER: division.members.filter((m) => m.role === 'VIEWER').length,
      },
      recentUpdates: division.updates.slice(-5),
      recentApprovals: division.approvalLogs.slice(0, 5),
    };

    res.json({ stats });
  } catch (e) {
    res.status(500).json({ error: `Gagal memuat analytics: ${e.message}` });
  }
}));

// ---------- Demo personas (STAGING ONLY) ----------
// Aktif hanya jika ENABLE_DEMO_PERSONAS=true — JANGAN pernah diaktifkan di produksi.
const demoEnabled = () => process.env.ENABLE_DEMO_PERSONAS === 'true';

app.get('/api/demo/personas', wrap(async (req, res) => {
  if (!demoEnabled()) return res.status(404).json({ error: 'Demo personas tidak aktif.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const all = await prisma.user.findMany({
    include: { roles: true, _count: { select: { groupMembers: true } } },
    orderBy: { name: 'asc' },
  });
  // Ramping: hanya akun inti (L1-L3) + yang ter-link kelompok (mentor/co-mentor/
  // mentee/alumni). PIC sub-divisi & penopang tetap ada di DB namun tak memenuhi UI.
  const CORE = new Set(['SUPERADMIN', 'BPMJ', 'KOMISI']);
  const users = all
    .filter((u) => u._count.groupMembers > 0 || (u.roles || []).some((r) => CORE.has(r.role)))
    .map(({ _count, ...u }) => u);
  res.json({ users });
}));

app.post('/api/demo/impersonate', wrap(async (req, res) => {
  if (!demoEnabled()) return res.status(404).json({ error: 'Demo personas tidak aktif.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const email = String(req.body?.email || '').toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email }, include: { roles: true } });
  if (!user) return res.status(404).json({ error: 'Akun dummy tidak ditemukan.' });
  const ready = applySuperadminSession(user);
  setSessionCookie(res, { uid: ready.id, email: ready.email });
  res.json({ user: { id: ready.id, email: ready.email, name: ready.name, avatar: ready.avatar, accountStatus: ready.accountStatus, roles: ready.roles } });
}));

// ---------- Health & Config ----------
app.get('/api/health', wrap(async (req, res) => {
  let dbConnected = false;
  if (isDbConfigured()) {
    try { dbConnected = await testDb(); } catch { dbConnected = false; }
  }
  res.json({
    ok: true,
    ts: new Date().toISOString(),
    frontend: true,
    backend: true,
    db: {
      configured: isDbConfigured(),
      connected: dbConnected,
      target: getDbTarget(),
      label: getDbLabel(),
    },
  });
}));

app.get('/api/config', wrap(async (req, res) => {
  let dbConnected = false;
  if (isDbConfigured()) {
    try { dbConnected = await testDb(); } catch { dbConnected = false; }
  }
  res.json({
    driveConfigured: Boolean(getDriveMode()),
    driveMode: getDriveMode(),
    dbConfigured: isDbConfigured(),
    dbConnected,
    dbTarget: getDbTarget(),
    dbLabel: getDbLabel(),
    rootFolderId: process.env.GDRIVE_ROOT_FOLDER_ID || null,
  });
}));

// ---------- Google Drive (role-gated via gdrive-policy) ----------
async function guardDriveFolder(req, res, folderId) {
  if (!getDriveMode()) {
    res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });
    return null;
  }
  const chain = await getFolderChain(folderId);
  const verdict = await resolveAccess(chain, req.authUser);
  if (!verdict.allowed) {
    res.status(403).json({ error: `Akses ditolak: ${verdict.reason}`, tag: verdict.tag });
    return null;
  }
  return chain;
}

const DRIVE_ROOT = () => process.env.GDRIVE_ROOT_FOLDER_ID || 'root';

app.get('/api/drive/folders', wrap(async (req, res) => {
  const target = req.query.parentId || DRIVE_ROOT();
  try {
    if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });
    // Listing = discovery: SEMUA folder boleh ditelusuri, tapi anak difilter
    // berdasarkan kebijakan masing-masing (nama folder terlarang tidak bocor).
    // Akses konten tetap ketat di /api/drive/files & /file/:id/content.
    const folders = await listFolders(req.query.parentId);
    const enriched = [];
    for (const f of folders) {
      const childChain = await getFolderChain(f.id);
      const v = await resolveAccess(childChain, req.authUser);
      enriched.push({
        ...f,
        accessAllowed: v.allowed,
        zoneTag: v.tag,
        reason: v.reason,
      });
    }
    // Visibilitas: (a) tag mengizinkan, ATAU (b) user login boleh menelusuri
    // sebagai kontainer untuk menemukan anak ber-scoping ([GROUP:x]).
    // Tamu hanya melihat rantai yang benar-benar publik.
    res.json({ folders: enriched.filter((f) => f.accessAllowed || Boolean(req.authUser)) });
  } catch (err) {
    const s = typeof err?.status === 'number' && err.status >= 400 ? err.status : 502;
    res.status(s).json({ error: `Gagal membaca Drive: ${err.message}` });
  }
}));

app.get('/api/drive/files', wrap(async (req, res) => {
  const target = req.query.folderId || DRIVE_ROOT();
  try {
    // Root tanpa tag: file langsung di root dianggap non-publik (default deny)
    if (!(await guardDriveFolder(req, res, target))) return;
    const files = await listFiles({
      folderId: req.query.folderId,
      query: req.query.q,
      pageSize: Number(req.query.pageSize || 24),
    });
    res.json({ files });
  } catch (err) {
    res.status(502).json({ error: `Gagal membaca Drive: ${err.message}` });
  }
}));

// Galeri grup publik — kurasi khusus: tamu tidak perlu menelusuri parent
// [MENTOR]; policy dievaluasi pada folder tujuan (tag GROUP terdekat menang).
app.get('/api/drive/group-files/:groupName', wrap(async (req, res) => {
  if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });
  const groupName = String(req.params.groupName || '').trim();
  if (!groupName) return res.status(400).json({ error: 'Nama grup wajib diisi.' });
  try {
    // 1) Folder kontainer "Kelompok Mentoring [MENTOR]" di root.
    const rootFolders = await listFolders();
    const container = rootFolders.find((f) => /^kelompok mentoring/i.test(f.name));
    if (!container) return res.status(404).json({ error: 'Folder Kelompok Mentoring tidak ditemukan.' });

    // 2) Folder grup: tag [GROUP:<NAMA>] atau nama mengandung [nama].
    const kids = await listFolders(container.id);
    const target = kids.find(
      (k) =>
        (parseTag(k.name) || '').toUpperCase() === `GROUP:${groupName.toUpperCase()}` ||
        k.name.toLowerCase().includes(`[${groupName.toLowerCase()}]`)
    );
    if (!target) return res.status(404).json({ error: `Folder galeri untuk grup "${groupName}" belum dibuat.` });

    // 3) Policy pada folder tujuan — nearest tag wins, GROUP mengizinkan tamu baca.
    const chain = await getFolderChain(target.id);
    const verdict = await resolveAccess(chain, req.authUser);
    if (!verdict.allowed) return res.status(403).json({ error: verdict.reason });

    const files = await listFiles({ folderId: target.id, pageSize: 24 });
    res.json({ folder: { id: target.id, name: target.name }, files });
  } catch (err) {
    res.status(502).json({ error: `Gagal membaca Drive: ${err.message}` });
  }
}));

app.get('/api/drive/file/:id/content', wrap(async (req, res) => {
  if (!(await guardDriveFolder(req, res, req.params.id))) return;
  const { meta, stream } = await getFileStream(req.params.id);
  if (meta.mimeType) res.setHeader('Content-Type', meta.mimeType);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  stream.pipe(res);
}));

app.get('/api/drive/test', wrap(async (req, res) => {
  res.json({ connected: await testDrive(), mode: getDriveMode() });
}));

// Matriks akses zona untuk user saat ini (UI audit ManageIntegrations)
app.get('/api/drive/policy', wrap(async (req, res) => {
  if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });
  res.json({ matrix: matrixForUser(req.authUser), authenticated: Boolean(req.authUser) });
}));

// Audit sinkronisasi DB ↔ Drive: grup & subdivisi pantatugas vs folder aktual
app.get('/api/drive/audit', requireRole('SUPERADMIN'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const tree = await listFolderTree(3);
  const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

  // Warisan tag: anak mewarisi zona induk terdekat (logika sama dgn gdrive-policy)
  const byId = new Map(tree.map((f) => [f.id, f]));
  const inheritedTag = (f) => {
    const own = f.name.match(/\[([A-Z][^\]]*)\]/i)?.[1];
    if (own) return own.toUpperCase();
    let p = f.parentId ? byId.get(f.parentId) : null;
    while (p) {
      const t = p.name.match(/\[([A-Z][^\]]*)\]/i)?.[1];
      if (t) return t.toUpperCase();
      p = p.parentId ? byId.get(p.parentId) : null;
    }
    return null;
  };

  // (a) Grup aktif → folder [GROUP:<nama>]
  const groups = await prisma.group.findMany({ where: { status: 'ACTIVE' }, select: { name: true } });
  const groupFolders = tree.filter((f) => /\[GROUP:[^\]]+\]/i.test(f.name));
  const matchedGroupTokens = new Set(
    groupFolders.map((f) => (f.name.match(/\[GROUP:([^\]]+)\]/i)?.[1] || '').trim().toLowerCase())
  );
  const groupAudit = groups.map((g) => ({
    name: g.name,
    ok: matchedGroupTokens.has(g.name.toLowerCase()),
    hint: `[GROUP:${g.name.toUpperCase()}]`,
  }));
  const extraGroups = groupFolders.filter((f) => {
    const tok = (f.name.match(/\[GROUP:([^\]]+)\]/i)?.[1] || '').trim().toLowerCase();
    return !groups.some((g) => g.name.toLowerCase() === tok);
  }).map((f) => f.name);

  // (b) Subdivisi pantatugas → folder di bawah folder induk bernama <Pillar>
  const subs = await prisma.strukturMember.findMany({
    where: { division: { in: ['LITURGIA', 'DIDASKALIA', 'KOINONIA', 'DIAKONIA', 'MARTURIA'] }, NOT: { subdivision: null } },
    select: { division: true, subdivision: true },
  });
  const pillarParents = new Map(); // pillarLabel(lower) → array nama folder anak
  for (const f of tree) {
    const m = f.name.match(/^(.*?)\s*\[[^\]]+\]$/);
    if (!m) continue;
    const base = norm(m[1]);
    for (const p of ['liturgia', 'didaskalia', 'koinonia', 'diakonia', 'marturia']) {
      if (base === p) {
        if (!pillarParents.has(p)) pillarParents.set(p, new Set());
        break;
      }
    }
  }
  for (const f of tree) {
    if (!f.parentId) continue;
    const parent = tree.find((t) => t.id === f.parentId);
    if (!parent) continue;
    const pm = parent.name.match(/^(.*?)\s*\[[^\]]+\]$/);
    if (!pm) continue;
    const key = norm(pm[1]);
    if (pillarParents.has(key)) pillarParents.get(key).add(norm(f.name.replace(/\[[^\]]+\]/g, '').trim()));
  }
  const seen = new Map();
  for (const s of subs) {
    const key = s.division.toLowerCase();
    const set = seen.get(key) || new Set();
    set.add(norm(s.subdivision));
    seen.set(key, set);
  }
  const pillarAudit = [];
  for (const [pillar, expectedSet] of seen.entries()) {
    const actual = pillarParents.get(pillar) || new Set();
    for (const sub of expectedSet) {
      pillarAudit.push({ pillar, name: sub, ok: actual.has(sub) });
    }
  }

  const untagged = tree.filter((f) => !inheritedTag(f)).map((f) => f.name);

  res.json({
    generatedAt: new Date().toISOString(),
    totalFoldersScanned: tree.length,
    groups: { items: groupAudit, missing: groupAudit.filter((g) => !g.ok).length },
    pillars: { items: pillarAudit, missing: pillarAudit.filter((p) => !p.ok).length },
    extraGroupFolders: extraGroups,
    untaggedFolders: untagged.slice(0, 30),
  });
}));

// ---------- TiDB Cloud (Prisma) ----------
app.get('/api/db/status', wrap(async (req, res) => {
  const connected = await testDb();
  res.json({ configured: isDbConfigured(), connected });
}));

// Family tree semua grup + batch regenerasi
app.get('/api/db/groups', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const groups = await prisma.group.findMany({
    orderBy: { name: 'asc' },
    include: {
      batches: { orderBy: { period: 'desc' } },
      members: { orderBy: [{ batchPeriod: 'desc' }, { name: 'asc' }] },
    },
  });
  res.json({ groups });
}));

// History family tree per grup
app.get('/api/db/groups/:id/batches', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const batches = await prisma.groupBatch.findMany({
    where: { groupId: req.params.id },
    orderBy: { period: 'desc' },
  });
  res.json({ batches });
}));

// Anggota/mentee per grup & batch
app.get('/api/db/groups/:id/members', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const members = await prisma.groupMember.findMany({
    where: { groupId: req.params.id, ...(req.query.period ? { batchPeriod: req.query.period } : {}) },
    orderBy: [{ batchPeriod: 'desc' }, { name: 'asc' }],
  });
  res.json({ members });
}));

// Riwayat absensi grup (opsional filter ?date= atau ?since=)
app.get('/api/db/groups/:id/attendance', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const where = { groupId: req.params.id };
  if (req.query.date) {
    const d = new Date(String(req.query.date));
    if (!Number.isNaN(d.getTime())) where.date = d;
  } else if (req.query.since) {
    const s = new Date(String(req.query.since));
    if (!Number.isNaN(s.getTime())) where.date = { gte: s };
  }
  const records = await prisma.attendanceRecord.findMany({
    where,
    orderBy: { date: 'desc' },
    include: { member: { select: { name: true } }, recorder: { select: { name: true } } },
  });
  res.json({ records });
}));

// Sinkronisasi data family tree dari frontend/portal → TiDB (upsert per id)
app.post('/api/db/sync-batches', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const batches = Array.isArray(req.body?.batches) ? req.body.batches : [];
  let synced = 0;
  for (const b of batches) {
    await prisma.groupBatch.upsert({
      where: { id: b.id },
      create: {
        id: b.id,
        groupId: b.group_id ?? b.groupId,
        period: b.period,
        batchLabel: b.batchLabel ?? b.batch_label,
        mentorName: b.mentor,
        comentorName: b.comentor,
        theme: b.theme,
        isCurrent: Boolean(b.isCurrent),
      },
      update: {
        batchLabel: b.batchLabel ?? b.batch_label,
        mentorName: b.mentor,
        comentorName: b.comentor,
        theme: b.theme,
        isCurrent: Boolean(b.isCurrent),
      },
    });
    synced += 1;
  }
  res.json({ synced });
}));

// ---------- Mentor Transition (Phase 6) ----------
// GET: List mentor transitions for a group
app.get('/api/groups/:id/mentor-transitions', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const transitions = await prisma.mentorTransition.findMany({
    where: { groupId: req.params.id },
    orderBy: { effectiveDate: 'desc' },
    include: {
      outgoingUser: { select: { id: true, name: true, email: true, avatar: true } },
      incomingUser: { select: { id: true, name: true, email: true, avatar: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  res.json({ transitions });
}));

// POST: Create mentor transition (resignation, batch change, etc.)
app.post('/api/groups/:id/mentor-transitions', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE', 'MENTOR'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });

  const { outgoingUserId, incomingUserId, outgoingRole, incomingRole, effectiveDate, reason, note } = req.body || {};
  if (!outgoingUserId || !outgoingRole || !effectiveDate) {
    return res.status(400).json({ error: 'outgoingUserId, outgoingRole, dan effectiveDate wajib diisi.' });
  }

  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) return res.status(404).json({ error: 'Grup tidak ditemukan.' });

  const outgoingUser = await prisma.user.findUnique({ where: { id: outgoingUserId } });
  if (!outgoingUser) return res.status(404).json({ error: 'Outgoing user tidak ditemukan.' });

  let incomingUser = null;
  if (incomingUserId) {
    incomingUser = await prisma.user.findUnique({ where: { id: incomingUserId } });
    if (!incomingUser) return res.status(404).json({ error: 'Incoming user tidak ditemukan.' });
  }

  const transition = await prisma.mentorTransition.create({
    data: {
      id: `mt-${crypto.randomUUID()}`,
      groupId: req.params.id,
      outgoingUserId,
      incomingUserId: incomingUserId ?? null,
      outgoingRole,
      incomingRole: incomingRole ?? null,
      effectiveDate: new Date(effectiveDate),
      reason: reason ?? null,
      note: note ?? null,
      createdById: req.authUser.id,
    },
    include: {
      outgoingUser: { select: { id: true, name: true, email: true, avatar: true } },
      incomingUser: { select: { id: true, name: true, email: true, avatar: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  // If resignation (no incoming), update outgoing user's struktur member role to MENTEE
  if (!incomingUserId) {
    await prisma.strukturMember.updateMany({
      where: { userId: outgoingUserId, role: outgoingRole },
      data: { role: 'MENTEE', roleOrder: 99 },
    });
  }

  // If batch change with new mentor, update struktur members
  if (incomingUserId && incomingRole) {
    await prisma.strukturMember.upsert({
      where: { id: `sm-${incomingUserId}-${req.params.id}` },
      create: {
        id: `sm-${incomingUserId}-${req.params.id}`,
        userId: incomingUserId,
        name: incomingUser.name,
        position: incomingRole === 'MENTOR' ? 'Mentor' : 'Co-Mentor',
        division: 'MENTOR',
        subdivision: group.name,
        role: incomingRole,
        roleOrder: incomingRole === 'MENTOR' ? 10 : 20,
        isDoubleRole: false,
        groupId: req.params.id,
      },
      update: {
        role: incomingRole,
        roleOrder: incomingRole === 'MENTOR' ? 10 : 20,
        groupId: req.params.id,
      },
    });
  }

  res.json({ ok: true, transition });
}));

// PATCH: Update mentor transition
app.patch('/api/mentor-transitions/:transitionId', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { incomingUserId, incomingRole, effectiveDate, reason, note } = req.body || {};
  const transition = await prisma.mentorTransition.update({
    where: { id: req.params.transitionId },
    data: {
      incomingUserId: incomingUserId ?? undefined,
      incomingRole: incomingRole ?? undefined,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : undefined,
      reason: reason ?? undefined,
      note: note ?? undefined,
    },
    include: {
      outgoingUser: { select: { id: true, name: true, email: true, avatar: true } },
      incomingUser: { select: { id: true, name: true, email: true, avatar: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  res.json({ ok: true, transition });
}));

// POST: Resign mentor/co-mentor (convenience endpoint)
app.post('/api/groups/:id/mentor-resign', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });

  const { userId, effectiveDate, reason } = req.body || {};
  if (!userId || !effectiveDate) {
    return res.status(400).json({ error: 'userId dan effectiveDate wajib diisi.' });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });

  // Find current mentor/co-mentor role for this user in this group
  const sm = await prisma.strukturMember.findFirst({
    where: { userId, groupId: req.params.id, role: { in: ['MENTOR', 'CO_MENTOR'] } },
  });
  const outgoingRole = sm?.role || 'MENTOR';

  const transition = await prisma.mentorTransition.create({
    data: {
      id: `mt-${crypto.randomUUID()}`,
      groupId: req.params.id,
      outgoingUserId: userId,
      incomingUserId: null,
      outgoingRole,
      incomingRole: null,
      effectiveDate: new Date(effectiveDate),
      reason: reason ?? 'Pengunduran diri',
      note: null,
      createdById: req.authUser.id,
    },
  });

  // Update struktur member to MENTEE
  await prisma.strukturMember.updateMany({
    where: { userId, groupId: req.params.id, role: { in: ['MENTOR', 'CO_MENTOR'] } },
    data: { role: 'MENTEE', roleOrder: 99 },
  });

  res.json({ ok: true, transition });
}));

// DELETE: Delete mentor transition
app.delete('/api/mentor-transitions/:transitionId', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  await prisma.mentorTransition.delete({ where: { id: req.params.transitionId } });
  res.json({ ok: true });
}));

// ---------- AI Regenerasi Distribution (Phase 6) ----------
// POST: Generate regeneration plan preview
app.post('/api/regeneration/preview', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { menteeUserIds, groupIds, options } = req.body || {};
  if (!Array.isArray(menteeUserIds) || !Array.isArray(groupIds)) {
    return res.status(400).json({ error: 'menteeUserIds dan groupIds harus array.' });
  }

  // Fetch mentee gift data
  const mentees = await prisma.user.findMany({
    where: { id: { in: menteeUserIds } },
    select: { id: true, name: true, giftsTop5: true, giftsScores: true },
  });

  const menteeGifts = mentees.map((m) => ({
    userId: m.id,
    name: m.name,
    giftsTop5: Array.isArray(m.giftsTop5) ? m.giftsTop5 : [],
    giftsScores: m.giftsScores || {},
  }));

  // Fetch groups with current members
  const groups = await prisma.group.findMany({
    where: { id: { in: groupIds } },
    include: {
      members: {
        include: { user: { select: { id: true, giftsTop5: true, giftsScores: true } } },
      },
    },
  });

  const ALL_GIFTS = [
    'Teaching', 'Administration', 'Hospitality', 'Music', 'Mercy',
    'Evangelism', 'Prophecy', 'Discernment', 'Faith', 'Healing',
    'Wisdom', 'Knowledge', 'Speaking in Tongues', 'Intercession', 'Giving',
    'Craftsmanship', 'Shepherding', 'Apostleship', 'Exhortation', 'Service',
  ];

  function calculateGiftDiversity(groupGifts) {
    const represented = Object.keys(groupGifts).filter((g) => groupGifts[g] > 0).length;
    return represented / ALL_GIFTS.length;
  }

  function calculateGiftContribution(userGifts, groupGifts) {
    let score = 0;
    for (const gift of userGifts) {
      const current = groupGifts[gift] || 0;
      score += 1 / (current + 1);
    }
    return score;
  }

  const groupAssignments = groups.map((g) => {
    const memberGifts = {};
    for (const m of g.members) {
      if (m.user?.giftsTop5) {
        for (const gift of m.user.giftsTop5) {
          memberGifts[gift] = (memberGifts[gift] || 0) + 1;
        }
      }
    }
    return {
      groupId: g.id,
      groupName: g.name,
      currentMembers: g.members.length,
      suggestedMembers: [],
      giftCoverage: memberGifts,
      diversityScore: calculateGiftDiversity(memberGifts),
    };
  });

  // Calculate gift frequency for rarity sorting
  const giftFrequency = {};
  for (const mg of menteeGifts) {
    for (const gift of mg.giftsTop5) {
      giftFrequency[gift] = (giftFrequency[gift] || 0) + 1;
    }
  }

  const sortedMentees = [...menteeGifts].sort((a, b) => {
    const aRarity = a.giftsTop5.reduce((sum, g) => sum + (1 / (giftFrequency[g] || 1)), 0);
    const bRarity = b.giftsTop5.reduce((sum, g) => sum + (1 / (giftFrequency[g] || 1)), 0);
    return bRarity - aRarity;
  });

  const maxPerGroup = options?.maxPerGroup ?? 15;
  const prioritizeDiversity = options?.prioritizeDiversity !== false;

  for (const mentee of sortedMentees) {
    let bestGroup = null;
    let bestScore = -Infinity;

    for (const group of groupAssignments) {
      const groupSize = group.currentMembers + group.suggestedMembers.length;
      if (groupSize >= maxPerGroup) continue;

      let score = 0;
      const avgTarget = Math.ceil(menteeUserIds.length / groupIds.length);
      score -= Math.abs(groupSize - avgTarget) * 0.5;

      if (prioritizeDiversity) {
        score += calculateGiftContribution(mentee.giftsTop5, group.giftCoverage) * 10;
      }

      for (const gift of mentee.giftsTop5.slice(0, 3)) {
        if (!group.giftCoverage[gift] || group.giftCoverage[gift] === 0) {
          score += 5;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestGroup = group;
      }
    }

    if (bestGroup) {
      bestGroup.suggestedMembers.push(mentee.userId);
      for (const gift of mentee.giftsTop5) {
        bestGroup.giftCoverage[gift] = (bestGroup.giftCoverage[gift] || 0) + 1;
      }
      bestGroup.diversityScore = calculateGiftDiversity(bestGroup.giftCoverage);
    }
  }

  const assignedIds = new Set(groupAssignments.flatMap((g) => g.suggestedMembers));
  const unassigned = menteeUserIds.filter((id) => !assignedIds.has(id));

  const sizes = groupAssignments.map((g) => g.currentMembers + g.suggestedMembers.length);
  const totalMentees = menteeUserIds.length;
  const totalGroups = groupIds.length;

  res.json({
    assignments: groupAssignments,
    unassigned,
    stats: {
      totalMentees,
      totalGroups,
      avgPerGroup: totalGroups > 0 ? totalMentees / totalGroups : 0,
      minGroupSize: sizes.length > 0 ? Math.min(...sizes) : 0,
      maxGroupSize: sizes.length > 0 ? Math.max(...sizes) : 0,
      giftDiversityIndex: groupAssignments.length > 0
        ? groupAssignments.reduce((sum, g) => sum + g.diversityScore, 0) / groupAssignments.length
        : 0,
    },
  });
}));

// POST: Apply regeneration plan
app.post('/api/regeneration/apply', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { assignments, period } = req.body || {};
  if (!Array.isArray(assignments) || !period) {
    return res.status(400).json({ error: 'assignments array dan period wajib diisi.' });
  }

  for (const assignment of assignments) {
    const { groupId, suggestedMembers } = assignment;
    if (!Array.isArray(suggestedMembers)) continue;

    for (const userId of suggestedMembers) {
      await prisma.groupMember.create({
        data: {
          id: `gm-${crypto.randomUUID()}`,
          groupId,
          userId,
          batchPeriod: period,
          role: 'MENTEE',
        },
      });
    }

    const currentCount = await prisma.groupMember.count({ where: { groupId, batchPeriod: period } });
    await prisma.group.update({
      where: { id: groupId },
      data: { memberCount: currentCount },
    });
  }

  res.json({ ok: true, message: 'Regenerasi berhasil diterapkan.' });
}));

// ---------- Division Drive Browser ----------
import { createFolder as gdriveCreateFolder, uploadFile as gdriveUploadFile, deleteFile as gdriveDeleteFile, getFileInfo as gdriveGetFileInfo } from './gdrive.mjs';

// GET /api/events/:eventId/divisions/:div/drive — list files in division's Drive folder
app.get('/api/events/:eventId/divisions/:div/drive', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum tersedia.' });

  if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });

  const { eventId, div } = req.params;
  const division = await prisma.eventDivision.findUnique({
    where: { eventId_division: { eventId, division: div.toUpperCase() } },
  });
  if (!division) return res.status(404).json({ error: 'Divisi tidak ditemukan.' });

  if (!division.driveFolderId) {
    return res.json({ files: [], folders: [], folderId: null, message: 'Belum ada folder Drive untuk divisi ini.' });
  }

  try {
    const [files, folders] = await Promise.all([
      listFiles({ folderId: division.driveFolderId, pageSize: 50 }),
      listFolders(division.driveFolderId, 50),
    ]);
    res.json({ files, folders, folderId: division.driveFolderId });
  } catch (e) {
    res.status(500).json({ error: `Gagal memuat Drive: ${e.message}` });
  }
}));

// POST /api/events/:eventId/divisions/:div/drive/folder — create subfolder
app.post('/api/events/:eventId/divisions/:div/drive/folder', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum tersedia.' });

  if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });

  const { eventId, div } = req.params;
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name wajib.' });

  const division = await prisma.eventDivision.findUnique({
    where: { eventId_division: { eventId, division: div.toUpperCase() } },
  });
  if (!division) return res.status(404).json({ error: 'Divisi tidak ditemukan.' });

  if (!division.driveFolderId) {
    return res.status(400).json({ error: 'Divisi belum memiliki folder Drive.' });
  }

  try {
    const folder = await gdriveCreateFolder(division.driveFolderId, name);
    res.status(201).json({ folder });
  } catch (e) {
    res.status(500).json({ error: `Gagal membuat folder: ${e.message}` });
  }
}));

// POST /api/events/:eventId/divisions/:div/drive/upload — upload file
app.post('/api/events/:eventId/divisions/:div/drive/upload', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum tersedia.' });

  if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });
  if (process.env.GDRIVE_WRITE !== '1') return res.status(403).json({ error: 'Upload belum diaktifkan (GDRIVE_WRITE != 1).' });

  const { eventId, div } = req.params;
  const division = await prisma.eventDivision.findUnique({
    where: { eventId_division: { eventId, division: div.toUpperCase() } },
  });
  if (!division) return res.status(404).json({ error: 'Divisi tidak ditemukan.' });

  if (!division.driveFolderId) {
    return res.status(400).json({ error: 'Divisi belum memiliki folder Drive.' });
  }

  // Expect multipart form data — use multer or manual parse
  // For now, expect JSON with base64 file data
  const { filename, mimetype, data } = req.body || {};
  if (!filename || !data) return res.status(400).json({ error: 'filename dan data wajib.' });

  try {
    const buffer = Buffer.from(data, 'base64');
    const file = await gdriveUploadFile(division.driveFolderId, {
      originalname: filename,
      mimetype: mimetype || 'application/octet-stream',
      buffer,
    });
    res.status(201).json({ file });
  } catch (e) {
    res.status(500).json({ error: `Gagal upload: ${e.message}` });
  }
}));

// DELETE /api/drive/files/:fileId — delete file/folder
app.delete('/api/drive/files/:fileId', requireRole('SUPERADMIN', 'KOMISI'), wrap(async (req, res) => {
  if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });
  if (process.env.GDRIVE_WRITE !== '1') return res.status(403).json({ error: 'Delete belum diaktifkan (GDRIVE_WRITE != 1).' });

  try {
    await gdriveDeleteFile(req.params.fileId);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: `Gagal menghapus: ${e.message}` });
  }
}));

// GET /api/drive/files/:fileId — get file info
app.get('/api/drive/files/:fileId', wrap(async (req, res) => {
  if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });

  try {
    const info = await gdriveGetFileInfo(req.params.fileId);
    res.json({ file: info });
  } catch (e) {
    res.status(500).json({ error: `Gagal memuat info file: ${e.message}` });
  }
}));

// ---------- Event Workspace Migration (ad hoc) ----------
app.post('/api/migrate/events', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL tidak tersedia.' });

  // Jalankan perintah DDL per baris — aman untuk tabel baru.
  const ddl = [
    "CREATE TABLE IF NOT EXISTS `EventProgram` (`id` VARCHAR(64) NOT NULL,`tenant_id` VARCHAR(16) NOT NULL,`slug` VARCHAR(60) NOT NULL,`name` VARCHAR(160) NOT NULL,`description` TEXT NULL,`status` VARCHAR(16) NOT NULL DEFAULT 'PLANNING',`start_date` DATETIME(3) NULL,`end_date` DATETIME(3) NULL,`drive_folder_id` VARCHAR(128) NULL,`gmeet_link` VARCHAR(512) NULL,`created_by_id` VARCHAR(64) NOT NULL,`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),`updated_at` DATETIME(3) NOT NULL, UNIQUE INDEX `EventProgram_slug_key`(`slug`), INDEX `EventProgram_tenant_id_idx`(`tenant_id`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    "CREATE TABLE IF NOT EXISTS `EventDivision` (`id` VARCHAR(64) NOT NULL,`event_id` VARCHAR(64) NOT NULL,`division` VARCHAR(24) NOT NULL,`drive_folder_id` VARCHAR(128) NULL,`extra_user_ids` JSON NULL,`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE INDEX `EventDivision_event_id_division_key`(`event_id`, `division`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    "CREATE TABLE IF NOT EXISTS `EventMeeting` (`id` VARCHAR(64) NOT NULL,`event_id` VARCHAR(64) NOT NULL,`division` VARCHAR(24) NULL,`title` VARCHAR(200) NOT NULL,`scheduled_at` DATETIME(3) NOT NULL,`gmeet_link` VARCHAR(512) NULL,`notes` TEXT NULL,`created_by_id` VARCHAR(64) NOT NULL,`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), INDEX `EventMeeting_event_id_idx`(`event_id`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    "CREATE TABLE IF NOT EXISTS `EventUpdate` (`id` VARCHAR(64) NOT NULL,`event_division_id` VARCHAR(64) NOT NULL,`author_id` VARCHAR(64) NOT NULL,`body` TEXT NOT NULL,`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), INDEX `EventUpdate_event_division_id_idx`(`event_division_id`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    "ALTER TABLE `EventDivision` ADD CONSTRAINT `EventDivision_event_id_fkey` FOREIGN KEY (`event_id`) REFERENCES `EventProgram`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;",
    "ALTER TABLE `EventMeeting` ADD CONSTRAINT `EventMeeting_event_id_fkey` FOREIGN KEY (`event_id`) REFERENCES `EventProgram`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;",
    "ALTER TABLE `EventUpdate` ADD CONSTRAINT `EventUpdate_event_division_id_fkey` FOREIGN KEY (`event_division_id`) REFERENCES `EventDivision`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;",
    // Phase 1: Approval workflow columns
    "ALTER TABLE `EventDivision` ADD COLUMN `approval_status` VARCHAR(16) NOT NULL DEFAULT 'DRAFT' AFTER `extra_user_ids`;",
    "ALTER TABLE `EventDivision` ADD COLUMN `approved_by_id` VARCHAR(64) NULL AFTER `approval_status`;",
    "ALTER TABLE `EventDivision` ADD COLUMN `approved_at` DATETIME(3) NULL AFTER `approved_by_id`;",
    "ALTER TABLE `EventDivision` ADD COLUMN `reject_reason` TEXT NULL AFTER `approved_at`;",
    "ALTER TABLE `EventDivision` ADD COLUMN `published_at` DATETIME(3) NULL AFTER `reject_reason`;",
    "ALTER TABLE `EventDivision` ADD COLUMN `content_item_id` VARCHAR(64) NULL AFTER `published_at`, ADD UNIQUE INDEX `EventDivision_content_item_id_key`(`content_item_id`);",
    "ALTER TABLE `EventDivision` ADD INDEX `EventDivision_approval_status_idx`(`approval_status`);",
    // Phase 1: New tables — EventDivisionMember, EventApprovalLog
    "CREATE TABLE IF NOT EXISTS `EventDivisionMember` (`id` VARCHAR(64) NOT NULL,`event_division_id` VARCHAR(64) NOT NULL,`user_id` VARCHAR(64) NOT NULL,`role` VARCHAR(16) NOT NULL DEFAULT 'MEMBER',`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE INDEX `EventDivisionMember_event_division_id_user_id_key`(`event_division_id`, `user_id`), INDEX `EventDivisionMember_user_id_idx`(`user_id`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    "CREATE TABLE IF NOT EXISTS `EventApprovalLog` (`id` VARCHAR(64) NOT NULL,`event_division_id` VARCHAR(64) NOT NULL,`action` VARCHAR(20) NOT NULL,`actor_id` VARCHAR(64) NOT NULL,`actor_role` VARCHAR(30) NOT NULL,`comment` TEXT NULL,`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), INDEX `EventApprovalLog_event_division_id_idx`(`event_division_id`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    "ALTER TABLE `EventDivisionMember` ADD CONSTRAINT `EventDivisionMember_event_division_id_fkey` FOREIGN KEY (`event_division_id`) REFERENCES `EventDivision`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;",
    "ALTER TABLE `EventApprovalLog` ADD CONSTRAINT `EventApprovalLog_event_division_id_fkey` FOREIGN KEY (`event_division_id`) REFERENCES `EventDivision`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;",
    // Phase 3: Reply threading for discussions
    "ALTER TABLE `EventUpdate` ADD COLUMN `parent_update_id` VARCHAR(64) NULL AFTER `body`;",
    "ALTER TABLE `EventUpdate` ADD INDEX `EventUpdate_parent_update_id_idx`(`parent_update_id`);",
    // Phase 7: MENTION notification type (enum value added in schema)
    "ALTER TABLE `Notification` MODIFY COLUMN `type` ENUM('IDLE_FLAG','MITOSIS_ALERT','MERGER_SUGGESTION','MENTION') NOT NULL;",
    // Benzarpreneurship E-commerce: Products, Orders, OrderItems
    "CREATE TABLE IF NOT EXISTS `products` (`id` VARCHAR(64) NOT NULL,`name` VARCHAR(200) NOT NULL,`description` TEXT NULL,`price` INT NOT NULL,`stock` INT NOT NULL DEFAULT 0,`images` JSON NULL,`category` VARCHAR(20) NOT NULL,`is_active` BOOLEAN NOT NULL DEFAULT true,`sort_order` INT NOT NULL DEFAULT 0,`created_by_id` VARCHAR(64) NOT NULL,`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),`updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`), INDEX `products_category_active_idx`(`category`, `is_active`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    "CREATE TABLE IF NOT EXISTS `orders` (`id` VARCHAR(64) NOT NULL,`order_code` VARCHAR(20) NOT NULL,`user_id` VARCHAR(64) NOT NULL,`items` JSON NOT NULL,`total` INT NOT NULL,`status` VARCHAR(16) NOT NULL DEFAULT 'PENDING',`shipping` VARCHAR(16) NOT NULL DEFAULT 'PICKUP',`shipping_addr` JSON NULL,`notes` TEXT NULL,`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),`updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`), UNIQUE INDEX `orders_order_code_key`(`order_code`), INDEX `orders_user_id_status_idx`(`user_id`, `status`), INDEX `orders_status_idx`(`status`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    "CREATE TABLE IF NOT EXISTS `order_items` (`id` VARCHAR(64) NOT NULL,`order_id` VARCHAR(64) NOT NULL,`product_id` VARCHAR(64) NOT NULL,`qty` INT NOT NULL,`price` INT NOT NULL,`name` VARCHAR(200) NOT NULL, PRIMARY KEY (`id`), UNIQUE INDEX `order_items_order_id_product_id_key`(`order_id`, `product_id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    "ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;",
    "ALTER TABLE `order_items` ADD CONSTRAINT `order_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE CASCADE;",
    // Penatalayan & Division Meetings
    "CREATE TABLE IF NOT EXISTS `service_roles` (`id` VARCHAR(64) NOT NULL,`name` VARCHAR(100) NOT NULL,`division` VARCHAR(20) NOT NULL,`description` TEXT NULL,`is_active` BOOLEAN NOT NULL DEFAULT true,`sort_order` INT NOT NULL DEFAULT 0,`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),`updated_at` DATETIME(3) NOT NULL, UNIQUE INDEX `service_roles_name_key`(`name`), INDEX `service_roles_division_active_idx`(`division`, `is_active`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    "CREATE TABLE IF NOT EXISTS `service_schedules` (`id` VARCHAR(64) NOT NULL,`service_role_id` VARCHAR(64) NOT NULL,`user_id` VARCHAR(64) NOT NULL,`event_id` VARCHAR(64) NULL,`date` DATE NOT NULL,`time_start` VARCHAR(10) NULL,`time_end` VARCHAR(10) NULL,`status` VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',`notes` TEXT NULL,`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),`updated_at` DATETIME(3) NOT NULL, INDEX `service_schedules_date_status_idx`(`date`, `status`), INDEX `service_schedules_user_id_date_idx`(`user_id`, `date`), INDEX `service_schedules_service_role_id_date_idx`(`service_role_id`, `date`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    "CREATE TABLE IF NOT EXISTS `division_meetings` (`id` VARCHAR(64) NOT NULL,`division` VARCHAR(20) NOT NULL,`meeting_date` DATE NOT NULL,`title` VARCHAR(200) NULL,`agenda` JSON NULL,`attendees` JSON NULL,`notes` TEXT NULL,`status` VARCHAR(20) NOT NULL DEFAULT 'PLANNED',`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),`updated_at` DATETIME(3) NOT NULL, INDEX `division_meetings_division_meeting_date_idx`(`division`, `meeting_date`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    "CREATE TABLE IF NOT EXISTS `division_agenda_items` (`id` VARCHAR(64) NOT NULL,`meeting_id` VARCHAR(64) NOT NULL,`title` VARCHAR(200) NOT NULL,`description` TEXT NULL,`division` VARCHAR(20) NOT NULL,`component` VARCHAR(100) NULL,`person_in_charge_id` VARCHAR(64) NULL,`deadline` DATE NULL,`status` VARCHAR(20) NOT NULL DEFAULT 'TODO',`drive_folder_id` VARCHAR(64) NULL,`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),`updated_at` DATETIME(3) NOT NULL, INDEX `division_agenda_items_meeting_id_status_idx`(`meeting_id`, `status`), INDEX `division_agenda_items_division_status_idx`(`division`, `status`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    // Warta Publik & Event Gallery
    "CREATE TABLE IF NOT EXISTS `warta_publik` (`id` VARCHAR(64) NOT NULL,`event_id` VARCHAR(64) NULL,`week_date` DATE NOT NULL,`title` VARCHAR(200) NOT NULL,`status` VARCHAR(20) NOT NULL DEFAULT 'DRAFT',`content_json` JSON NULL,`pdf_url` VARCHAR(500) NULL,`png_url` VARCHAR(500) NULL,`drive_folder_id` VARCHAR(64) NULL,`reject_reason` TEXT NULL,`created_by_id` VARCHAR(64) NULL,`reviewed_by_id` VARCHAR(64) NULL,`published_at` DATETIME(3) NULL,`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),`updated_at` DATETIME(3) NOT NULL, INDEX `warta_publik_week_date_idx`(`week_date`), INDEX `warta_publik_status_idx`(`status`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    "CREATE TABLE IF NOT EXISTS `event_gallery` (`id` VARCHAR(64) NOT NULL,`event_id` VARCHAR(64) NOT NULL,`title` VARCHAR(200) NOT NULL,`description` TEXT NULL,`media_url` VARCHAR(500) NOT NULL,`media_type` VARCHAR(20) NOT NULL,`thumb_url` VARCHAR(500) NULL,`uploaded_by_id` VARCHAR(64) NOT NULL,`division` VARCHAR(20) NULL,`status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',`approved_by_id` VARCHAR(64) NULL,`approved_at` DATETIME(3) NULL,`reject_reason` TEXT NULL,`drive_file_id` VARCHAR(64) NULL,`sort_order` INT NOT NULL DEFAULT 0,`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),`updated_at` DATETIME(3) NOT NULL, INDEX `event_gallery_event_id_status_idx`(`event_id`, `status`), INDEX `event_gallery_division_status_idx`(`division`, `status`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    // User & WaitlistEntry new columns
    "ALTER TABLE `users` ADD COLUMN `gender` VARCHAR(20) NULL AFTER `account_status`;",
    "ALTER TABLE `users` ADD COLUMN `emergency_contact_name` VARCHAR(150) NULL AFTER `gender`;",
    "ALTER TABLE `users` ADD COLUMN `emergency_contact_relation` VARCHAR(50) NULL AFTER `emergency_contact_name`;",
    "ALTER TABLE `users` ADD COLUMN `emergency_contact_phone` VARCHAR(40) NULL AFTER `emergency_contact_relation`;",
    "ALTER TABLE `users` ADD COLUMN `emergency_contact_address` TEXT NULL AFTER `emergency_contact_phone`;",
    "ALTER TABLE `users` ADD COLUMN `last_profile_update` DATETIME(3) NULL AFTER `emergency_contact_address`;",
    "ALTER TABLE `users` ADD COLUMN `profile_reminder_days` INT NOT NULL DEFAULT 60 AFTER `last_profile_update`;",
    "ALTER TABLE `waitlist_entries` ADD COLUMN `gender` VARCHAR(20) NULL AFTER `status`;",
    "ALTER TABLE `waitlist_entries` ADD COLUMN `emergency_contact_name` VARCHAR(150) NULL AFTER `gender`;",
    "ALTER TABLE `waitlist_entries` ADD COLUMN `emergency_contact_relation` VARCHAR(50) NULL AFTER `emergency_contact_name`;",
    "ALTER TABLE `waitlist_entries` ADD COLUMN `emergency_contact_phone` VARCHAR(40) NULL AFTER `emergency_contact_relation`;",
    "ALTER TABLE `waitlist_entries` ADD COLUMN `emergency_contact_address` TEXT NULL AFTER `emergency_contact_phone`;",
    // StrukturMember new columns
    "ALTER TABLE `struktur_members` ADD COLUMN `role` VARCHAR(20) NOT NULL DEFAULT 'MENTEE' AFTER `is_open_role`;",
    "ALTER TABLE `struktur_members` ADD COLUMN `role_order` INT NOT NULL DEFAULT 0 AFTER `role`;",
    "ALTER TABLE `struktur_members` ADD COLUMN `is_double_role` BOOLEAN NOT NULL DEFAULT false AFTER `role_order`;",
    "ALTER TABLE `struktur_members` ADD COLUMN `sub_role_id` VARCHAR(64) NULL AFTER `is_double_role`;",
    "ALTER TABLE `struktur_members` ADD COLUMN `group_id` VARCHAR(64) NULL AFTER `sub_role_id`;",
    // Group new columns (relation handled by Prisma)
    // MentorTransition table
    "CREATE TABLE IF NOT EXISTS `mentor_transitions` (`id` VARCHAR(64) NOT NULL,`group_id` VARCHAR(64) NOT NULL,`outgoing_user_id` VARCHAR(64) NOT NULL,`incoming_user_id` VARCHAR(64) NULL,`outgoing_role` VARCHAR(20) NOT NULL,`incoming_role` VARCHAR(20) NULL,`effective_date` DATE NOT NULL,`reason` TEXT NULL,`note` TEXT NULL,`created_by_id` VARCHAR(64) NOT NULL,`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), INDEX `mentor_transitions_group_id_effective_date_idx`(`group_id`, `effective_date`), PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    "ALTER TABLE `mentor_transitions` ADD CONSTRAINT `mentor_transitions_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;",
    "ALTER TABLE `mentor_transitions` ADD CONSTRAINT `mentor_transitions_outgoing_user_id_fkey` FOREIGN KEY (`outgoing_user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE;",
    "ALTER TABLE `mentor_transitions` ADD CONSTRAINT `mentor_transitions_incoming_user_id_fkey` FOREIGN KEY (`incoming_user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE;",
    "ALTER TABLE `mentor_transitions` ADD CONSTRAINT `mentor_transitions_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE;",
  ];

  let applied = 0;
  const errors = [];
  for (const stmt of ddl) {
    try {
      await prisma.$executeRawUnsafe(stmt);
      applied++;
    } catch (e) {
      // Tabel/index sudah ada → skip
      if (!String(e.message || '').includes('already exists')) {
        errors.push({ stmt: stmt.slice(0, 80) + '...', error: String(e.message || e).slice(0, 120) });
      } else {
        applied++;
      }
    }
  }
  const result = { applied, errors, total: ddl.length };

  // Auto-seed: jika tabel kosong, buat BAKU TAU 4.0 dengan 6 divisi
  try {
    const count = await prisma.eventProgram.count();
    if (count === 0) {
      const slug = 'baku-tau-4-0';
      const id = 'evt-baku-tau-4-0';
      const ev = await prisma.eventProgram.create({
        data: {
          id,
          tenantId: 'tenant-youth',
          slug,
          name: 'BAKU TAU 4.0',
          description: 'Program Kerja & Event Tahunan GEHC 2026 — 6 divisi, kick-off & diskusi aktif.',
          status: 'ACTIVE',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          createdById: 'usr-tech',
        },
      });
      // 6 divisi: 5 Panca Tugas + Benzarpreneurship
      const divisions = ['LITURGIA', 'DIDASKALIA', 'KOINONIA', 'DIAKONIA', 'MARTURIA', 'BENZARPR'];
      for (const div of divisions) {
        await prisma.eventDivision.create({
          data: {
            id: `evd-${slug}-${div}`,
            eventId: ev.id,
            division: div,
            approvalStatus: 'APPROVED',
            approvedById: 'usr-tech',
            approvedAt: new Date(),
            publishedAt: new Date(),
          },
        });
      }
      // Kick-off meeting
      await prisma.eventMeeting.create({
        data: {
          id: `evtmt-${slug}-kickoff`,
          eventId: ev.id,
          title: 'Kick-Off BAKU TAU 4.0',
          scheduledAt: new Date('2026-01-15T09:00:00+07:00'),
          notes: 'Pertemuan awal seluruh divisi — preview program tahunan.',
          createdById: 'usr-tech',
        },
      });
      await prisma.eventMeeting.create({
        data: {
          id: `evtmt-${slug}-welcome-night`,
          eventId: ev.id,
          title: 'BAKU TAU 4.0 — Bakudapa di Rantau',
          scheduledAt: new Date('2026-09-12T15:00:00+07:00'),
          notes: 'Malam penyambutan mahasiswa baru — GMIM Eben Haezer Cikarang, 15.00 WIB',
          createdById: 'usr-tech',
        },
      });
      result.seeded = { event: ev.id, divisions: divisions.length, meetings: 1 };
    }
  } catch (e) {
    result.seedError = String(e.message || e).slice(0, 120);
  }

  res.json(result);
}));

// POST /api/seed/events — seed BAKU TAU 4.0 via raw SQL (idempotent)
app.post('/api/seed/events', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  try {
    // Cek apakah sudah ada event
    const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as cnt FROM EventProgram`);
    const cnt = Number(rows[0]?.cnt ?? 0);
    if (cnt > 0) {
      // Show existing
      const existing = await prisma.$queryRawUnsafe(`SELECT id, name, status FROM EventProgram`);
      return res.json({ ok: true, message: `Sudah ada ${cnt} event, skip seed.`, existing });
    }

    // Insert BAKU TAU 4.0
    await prisma.$executeRawUnsafe(
      `INSERT INTO EventProgram (id, tenant_id, slug, name, description, status, start_date, end_date, created_by_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
      'evt-baku-tau-4-0', 'tenant-youth', 'baku-tau-4-0', 'BAKU TAU 4.0',
      'Program Kerja & Event Tahunan GEHC 2026 — 6 divisi, kick-off & diskusi aktif.',
      'ACTIVE', '2026-01-01', '2026-12-31', 'usr-tech'
    );

    // 6 divisi: 5 Panca Tugas + Benzarpreneurship
    const divisions = ['LITURGIA', 'DIDASKALIA', 'KOINONIA', 'DIAKONIA', 'MARTURIA', 'BENZARPR'];
    for (const div of divisions) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO EventDivision (id, event_id, division, approval_status, approved_by_id, approved_at, published_at, created_at)
         VALUES (?, ?, ?, 'APPROVED', 'usr-tech', NOW(3), NOW(3), NOW(3))`,
        `evd-baku-tau-4-0-${div}`, 'evt-baku-tau-4-0', div
      );
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO EventMeeting (id, event_id, title, scheduled_at, notes, created_by_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
      'evtmt-baku-tau-4-0-kickoff', 'evt-baku-tau-4-0',
      'Kick-Off BAKU TAU 4.0', '2026-01-15T09:00:00',
      'Pertemuan awal seluruh divisi — preview program tahunan.', 'usr-tech'
    );

    res.json({ ok: true, seeded: { event: 'evt-baku-tau-4-0', divisions: divisions.length, meetings: 1 } });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}));

// ---------- Event Workspace ----------
// Slug util: lower-case hyphen, max 50 char
function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

// Helper: divisi yang bisa diakses user berdasarkan struktur_members
async function canSeeEventDivision(authUser, division) {
  if (!authUser) return false;
  const roles = (authUser.roles || []).map((r) => r.role);
  if (roles.includes('SUPERADMIN') || roles.includes('KOMISI')) return true;

  // COMMITTEE — bedakan BOD vs PIC
  if (roles.includes('COMMITTEE')) {
    const prisma = getPrisma();
    const sm = prisma ? await prisma.strukturMember.findFirst({ where: { email: authUser.email || '' } }) : null;
    const smDiv = (sm?.division || '').toUpperCase();
    // BOD = struktur division TIMKERJA (atau kosong) → semua event
    if (!smDiv || smDiv === 'TIMKERJA') return true;
    // PIC → scoped
    return smDiv === division;
  }

  // MENTOR / CO_MENTOR / MENTEE → cek struktur
  const prisma = getPrisma();
  const sm = prisma ? await prisma.strukturMember.findFirst({ where: { email: authUser.email || '' } }) : null;
  return (sm?.division || '').toUpperCase() === division;
}

// GET /api/events — daftar event (filtered by visibility)
app.get('/api/events', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  let events;
  try {
    events = await prisma.eventProgram.findMany({
      orderBy: { startDate: 'desc' },
      include: { divisions: true, meetings: true },
    });
  } catch (prismaErr) {
    // Fallback: Prisma model belum ada → raw SQL
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT e.*,
          (SELECT JSON_ARRAYAGG(JSON_OBJECT('id',d.id,'eventId',d.event_id,'division',d.division,'driveFolderId',d.drive_folder_id,'approvalStatus',d.approval_status,'publishedAt',d.published_at,'createdAt',d.created_at))
           FROM EventDivision d WHERE d.event_id = e.id) as divisions,
          (SELECT JSON_ARRAYAGG(JSON_OBJECT('id',m.id,'title',m.title,'scheduledAt',m.scheduled_at,'division',m.division))
           FROM EventMeeting m WHERE m.event_id = e.id) as meetings
         FROM EventProgram e ORDER BY e.start_date DESC`
      );
      events = (rows || []).map((r) => ({
        id: r.id,
        tenantId: r.tenant_id,
        slug: r.slug,
        name: r.name,
        description: r.description,
        status: r.status,
        startDate: r.start_date,
        endDate: r.end_date,
        driveFolderId: r.drive_folder_id,
        gmeetLink: r.gmeet_link,
        createdById: r.created_by_id,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        divisions: Array.isArray(r.divisions) ? r.divisions.map((d) => ({
          id: d.id, eventId: d.eventId, division: d.division, driveFolderId: d.driveFolderId,
          approvalStatus: d.approvalStatus, publishedAt: d.publishedAt, createdAt: d.createdAt,
        })) : [],
        meetings: Array.isArray(r.meetings) ? r.meetings.map((m) => ({
          id: m.id, title: m.title, scheduledAt: m.scheduledAt, division: m.division,
        })) : [],
      }));
    } catch (sqlErr) {
      // Tabel belum ada → return empty (bukan error)
      const msg = String(sqlErr.message || sqlErr);
      if (msg.includes("doesn't exist") || msg.includes('does not exist') || msg.includes('Table') || msg.includes('Undefined table')) {
        return res.json({ events: [] });
      }
      return res.status(500).json({ error: `Event query gagal: ${msg.slice(0, 200)}` });
    }
  }

  // Filter berdasarkan role
  const roles = (req.authUser?.roles || []).map((r) => r.role);
  const isKomsaOrBod = roles.includes('SUPERADMIN') || roles.includes('KOMISI');
  let isBodTimkerja = false;
  try {
    isBodTimkerja = roles.includes('COMMITTEE') && await (async () => {
      const sm = await prisma.strukturMember.findFirst({ where: { email: req.authUser?.email || '' } });
      return !(sm?.division) || sm.division.toUpperCase() === 'TIMKERJA';
    })();
  } catch { /* strukturMember query failed, skip */ }

  if (isKomsaOrBod || isBodTimkerja) {
    return res.json({ events });
  }

  // Filter: hanya event yang punya division yang bisa diakses user
  const accessible = [];
  try {
    for (const ev of events) {
      for (const d of ev.divisions) {
        if (await canSeeEventDivision(req.authUser, d.division)) {
          accessible.push(ev);
          break;
        }
      }
    }
  } catch(e) { /* canSeeEventDivision failed, return empty */ }
  res.json({ events: accessible });
}));

// POST /api/events — buat event baru + provision folder
app.post('/api/events', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { name, description, divisions, startDate, endDate } = req.body || {};
  if (!name || !Array.isArray(divisions) || divisions.length === 0) {
    return res.status(400).json({ error: 'name dan divisions[] wajib.' });
  }

  const slug = slugify(name) + '-' + Date.now().toString(36);
  const id = `evt-${slug}`;
  const createdById = req.authUser?.id || 'unknown';

  const ev = await prisma.eventProgram.create({
    data: {
      id,
      tenantId: 'tenant-youth',
      slug,
      name,
      description: description || null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      createdById,
    },
  });

  // Buat divisi + provision folder di Drive
  const provisioned = [];
  for (const div of divisions) {
    const divId = `evd-${slug}-${div}`;
    await prisma.eventDivision.create({
      data: {
        id: divId,
        eventId: ev.id,
        division: div,
      },
    });
    // Provision Drive folder jika write mode aktif
    if (process.env.GDRIVE_WRITE === '1' && process.env.GDRIVE_ROOT_FOLDER_ID) {
      try {
        const { createEventFolder } = await import('./gdrive-events.mjs');
        const fid = await createEventFolder(ev, div);
        if (fid) {
          await prisma.eventDivision.update({ where: { id: divId }, data: { driveFolderId: fid } });
          provisioned.push({ division: div, folderId: fid });
        }
      } catch (e) {
        console.warn(`[event] provisioning ${div} gagal:`, e.message);
      }
    }
  }

  res.status(201).json({ event: ev, provisioned });
}));

// GET /api/events/:id — detail event + divisi
app.get('/api/events/:id', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  let ev;
  try {
    ev = await prisma.eventProgram.findUnique({
      where: { id: req.params.id },
      include: { divisions: true, meetings: { orderBy: { scheduledAt: 'desc' } } },
    });
  } catch (prismaErr) {
    // Fallback: raw SQL
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT * FROM EventProgram WHERE id = ?`, req.params.id
      );
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'Event tidak ditemukan.' });
      const r = rows[0];
      const divRows = await prisma.$queryRawUnsafe(
        `SELECT * FROM EventDivision WHERE event_id = ?`, r.id
      );
      const mtRows = await prisma.$queryRawUnsafe(
        `SELECT * FROM EventMeeting WHERE event_id = ? ORDER BY scheduled_at DESC`, r.id
      );
      ev = {
        id: r.id, tenantId: r.tenant_id, slug: r.slug, name: r.name, description: r.description,
        status: r.status, startDate: r.start_date, endDate: r.end_date,
        driveFolderId: r.drive_folder_id, gmeetLink: r.gmeet_link,
        createdById: r.created_by_id, createdAt: r.created_at, updatedAt: r.updated_at,
        divisions: (divRows || []).map((d) => ({
          id: d.id, eventId: d.event_id, division: d.division, driveFolderId: d.drive_folder_id,
          extraUserIds: d.extra_user_ids, approvalStatus: d.approval_status,
          approvedById: d.approved_by_id, approvedAt: d.approved_at,
          rejectReason: d.reject_reason, publishedAt: d.published_at,
          contentItemId: d.content_item_id, createdAt: d.created_at,
        })),
        meetings: (mtRows || []).map((m) => ({
          id: m.id, eventId: m.event_id, division: m.division, title: m.title,
          scheduledAt: m.scheduled_at, gmeetLink: m.gmeet_link, notes: m.notes,
          createdById: m.created_by_id, createdAt: m.created_at,
        })),
      };
    } catch (sqlErr) {
      const msg = String(sqlErr.message || sqlErr);
      if (msg.includes("doesn't exist") || msg.includes('does not exist') || msg.includes('Table') || msg.includes('Undefined table')) {
        return res.status(404).json({ error: 'Event tidak ditemukan.' });
      }
      return res.status(500).json({ error: `Event detail gagal: ${msg.slice(0, 200)}` });
    }
  }
  if (!ev) return res.status(404).json({ error: 'Event tidak ditemukan.' });
  res.json({ event: ev });
}));

// PATCH /api/events/:id — edit meta + divisions
app.patch('/api/events/:id', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { name, description, startDate, endDate, status, divisions } = req.body || {};
  const data = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
  if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
  if (status !== undefined) data.status = status;

  const ev = await prisma.eventProgram.update({ where: { id: req.params.id }, data });
  res.json({ event: ev });
}));

// POST /api/events/:id/divisions/:div/updates — tambah diskusi/progres (supports replies)
app.post('/api/events/:id/divisions/:div/updates', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { body: text, parentUpdateId } = req.body || {};
  if (!text) return res.status(400).json({ error: 'body wajib.' });

  const div = await prisma.eventDivision.findUnique({ where: { eventId_division: { eventId: req.params.id, division: req.params.div.toUpperCase() } } });
  if (!div) return res.status(404).json({ error: 'Divisi event tidak ditemukan.' });

  const canSee = await canSeeEventDivision(req.authUser, req.params.div.toUpperCase());
  if (!canSee) return res.status(403).json({ error: 'Tidak punya akses ke divisi ini.' });

  // Validate parent if reply
  if (parentUpdateId) {
    const parent = await prisma.eventUpdate.findUnique({ where: { id: parentUpdateId } });
    if (!parent || parent.eventDivisionId !== div.id) {
      return res.status(400).json({ error: 'Parent update tidak valid.' });
    }
  }

  const update = await prisma.eventUpdate.create({
    data: {
      id: `evu-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      eventDivisionId: div.id,
      authorId: req.authUser?.id || 'unknown',
      body: text,
      parentUpdateId: parentUpdateId || null,
    },
  });

  // Resolve author name
  let authorName = update.authorId;
  try {
    const user = await prisma.user.findUnique({ where: { id: update.authorId }, select: { name: true } });
    if (user?.name) authorName = user.name;
  } catch { /* skip */ }

  // Extract @mentions and create notifications
  try {
    const mentionRegex = /@(\w[\w\s]*?\w(?=\s|$|[^a-zA-Z0-9]))/g;
    const mentionNames = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      mentionNames.push(match[1].trim());
    }

    if (mentionNames.length > 0) {
      // Find mentioned users by name
      const mentionedUsers = await prisma.user.findMany({
        where: {
          OR: mentionNames.map((name) => ({ name: { contains: name } })),
        },
        select: { id: true, name: true },
      });

      // Create notifications for each mentioned user (skip author)
      for (const mu of mentionedUsers) {
        if (mu.id === update.authorId) continue; // don't notify self

        await prisma.notification.create({
          data: {
            id: `notif-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            type: 'MENTION',
            title: `Anda di-mention oleh ${authorName}`,
            message: `di divisi ${req.params.div.toUpperCase()}: "${text.slice(0, 100)}${text.length > 100 ? '...' : ''}"`,
            payload: {
              eventId: req.params.id,
              division: req.params.div.toUpperCase(),
              updateId: update.id,
              authorId: update.authorId,
              authorName,
            },
            status: 'OPEN',
          },
        });
      }
    }
  } catch (e) {
    console.error('[MENTION] Failed to create notifications:', e.message);
  }

  res.status(201).json({ update: { ...update, authorName } });
}));

// GET /api/events/:id/divisions/:div/updates — baca diskusi (threaded)
app.get('/api/events/:id/divisions/:div/updates', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const canSee = await canSeeEventDivision(req.authUser, req.params.div.toUpperCase());
  if (!canSee) return res.status(403).json({ error: 'Tidak punya akses ke divisi ini.' });

  const div = await prisma.eventDivision.findUnique({ where: { eventId_division: { eventId: req.params.id, division: req.params.div.toUpperCase() } } });
  if (!div) return res.status(404).json({ error: 'Divisi event tidak ditemukan.' });

  const updates = await prisma.eventUpdate.findMany({
    where: { eventDivisionId: div.id },
    orderBy: { createdAt: 'asc' },
  });

  // Resolve author names
  const authorIds = [...new Set(updates.map((u) => u.authorId))];
  const authorMap = new Map();
  for (const aid of authorIds) {
    try {
      const user = await prisma.user.findUnique({ where: { id: aid }, select: { name: true, email: true } });
      authorMap.set(aid, user?.name || user?.email || aid);
    } catch {
      authorMap.set(aid, aid);
    }
  }

  // Build threaded structure
  const enriched = updates.map((u) => ({ ...u, authorName: authorMap.get(u.authorId) || u.authorId }));
  const topLevel = enriched.filter((u) => !u.parentUpdateId);
  const replies = enriched.filter((u) => u.parentUpdateId);
  const threaded = topLevel.map((t) => ({
    ...t,
    replies: replies.filter((r) => r.parentUpdateId === t.id),
  }));

  res.json({ updates: threaded, total: updates.length });
}));

// POST /api/events/:id/meetings — tambah rapat
app.post('/api/events/:id/meetings', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { title, scheduledAt, gmeetLink, notes, division } = req.body || {};
  if (!title || !scheduledAt) return res.status(400).json({ error: 'title dan scheduledAt wajib.' });

  const meeting = await prisma.eventMeeting.create({
    data: {
      id: `evm-${Date.now().toString(36)}`,
      eventId: req.params.id,
      division: division || null,
      title,
      scheduledAt: new Date(scheduledAt),
      gmeetLink: gmeetLink || null,
      notes: notes || null,
      createdById: req.authUser?.id || 'unknown',
    },
  });
  res.status(201).json({ meeting });
}));

// GET /api/events/:id/meetings — daftar rapat
app.get('/api/events/:id/meetings', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const meetings = await prisma.eventMeeting.findMany({ where: { eventId: req.params.id }, orderBy: { scheduledAt: 'desc' } });
  res.json({ meetings });
}));

// GET /api/events/meetings/:mid/ics — generate .ics file
app.get('/api/events/meetings/:mid/ics', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const m = await prisma.eventMeeting.findUnique({ where: { id: req.params.mid } });
  if (!m) return res.status(404).json({ error: 'Meeting tidak ditemukan.' });

  const dtStart = new Date(m.scheduledAt).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dtEnd   = new Date(new Date(m.scheduledAt).getTime() + 60 * 60 * 1000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const uid = `${m.id}@gehc.page`;

  let ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//GEHC//Event\n`;
  ics += `BEGIN:VEVENT\nDTSTART:${dtStart}\nDTEND:${dtEnd}\n`;
  ics += `SUMMARY:${m.title.replace(/\n/g, '\\n')}\n`;
  if (m.notes) ics += `DESCRIPTION:${m.notes.replace(/\n/g, '\\n')}\n`;
  if (m.gmeetLink) ics += `URL:${m.gmeetLink}\nLOCATION:${m.gmeetLink}\n`;
  ics += `UID:${uid}\nEND:VEVENT\nEND:VCALENDAR`;

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${(m.title || 'meeting').replace(/[^a-zA-Z0-9]/g, '-')}.ics"`);
  res.send(ics);
}));

// ---------- Division Approval Workflow ----------
import {
  canSubmitDivision, canApproveDivision, canPublishDivision,
  canEditDivision, isValidTransition, logApprovalAction,
} from './division-rbac.mjs';

// POST /api/events/:eventId/divisions/:div/submit — submit division for review
app.post('/api/events/:eventId/divisions/:div/submit', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum tersedia.' });

  const { eventId, div } = req.params;
  const division = await prisma.eventDivision.findUnique({
    where: { eventId_division: { eventId, division: div.toUpperCase() } },
  });
  if (!division) return res.status(404).json({ error: 'Divisi tidak ditemukan.' });

  const allowed = await canSubmitDivision(req.authUser, division);
  if (!allowed) return res.status(403).json({ error: 'Tidak punya hak submit divisi ini.' });

  const updated = await prisma.eventDivision.update({
    where: { id: division.id },
    data: { approvalStatus: 'IN_REVIEW' },
  });

  await logApprovalAction(division.id, 'SUBMIT', req.authUser, req.body?.comment);
  res.json({ division: updated });
}));

// POST /api/events/:eventId/divisions/:div/approve — approve division
app.post('/api/events/:eventId/divisions/:div/approve', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum tersedia.' });

  const { eventId, div } = req.params;
  const division = await prisma.eventDivision.findUnique({
    where: { eventId_division: { eventId, division: div.toUpperCase() } },
  });
  if (!division) return res.status(404).json({ error: 'Divisi tidak ditemukan.' });

  const allowed = await canApproveDivision(req.authUser, division);
  if (!allowed) return res.status(403).json({ error: 'Tidak punya hak approve divisi ini.' });

  const updated = await prisma.eventDivision.update({
    where: { id: division.id },
    data: {
      approvalStatus: 'APPROVED',
      approvedById: req.authUser.id,
      approvedAt: new Date(),
      rejectReason: null,
    },
  });

  await logApprovalAction(division.id, 'APPROVE', req.authUser, req.body?.comment);
  res.json({ division: updated });
}));

// POST /api/events/:eventId/divisions/:div/reject — reject division
app.post('/api/events/:eventId/divisions/:div/reject', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum tersedia.' });

  const { eventId, div } = req.params;
  const division = await prisma.eventDivision.findUnique({
    where: { eventId_division: { eventId, division: div.toUpperCase() } },
  });
  if (!division) return res.status(404).json({ error: 'Divisi tidak ditemukan.' });

  const allowed = await canApproveDivision(req.authUser, division);
  if (!allowed) return res.status(403).json({ error: 'Tidak punya hak reject divisi ini.' });

  const reason = req.body?.reason || null;
  const updated = await prisma.eventDivision.update({
    where: { id: division.id },
    data: {
      approvalStatus: 'REJECTED',
      rejectReason: reason,
      approvedById: null,
      approvedAt: null,
    },
  });

  await logApprovalAction(division.id, 'REJECT', req.authUser, reason);
  res.json({ division: updated });
}));

// POST /api/events/:eventId/divisions/:div/publish — publish division to website
app.post('/api/events/:eventId/divisions/:div/publish', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum tersedia.' });

  const { eventId, div } = req.params;
  const division = await prisma.eventDivision.findUnique({
    where: { eventId_division: { eventId, division: div.toUpperCase() } },
    include: { event: true },
  });
  if (!division) return res.status(404).json({ error: 'Divisi tidak ditemukan.' });

  const allowed = await canPublishDivision(req.authUser, division);
  if (!allowed) return res.status(403).json({ error: 'Tidak punya hak publish divisi ini.' });

  // Auto-sync: create/update ContentItem from division
  let contentItemId = division.contentItemId;
  try {
    const contentData = {
      tenantId: division.event.tenantId,
      type: 'ACTIVITY',
      title: `${division.event.name} — ${div}`,
      subtitle: division.event.description || '',
      category: `Program Kerja — ${div}`,
      schedule: division.event.startDate ? new Date(division.event.startDate).toLocaleDateString('id-ID') : '',
      location: 'GEHC Youth Portal',
      targetAudience: 'Seluruh Pemuda & Jemaat',
      tags: [div, division.event.name, 'Program Kerja'],
      isPublished: true,
      author: 'Komisi Pelayanan Pemuda',
      driveFolderId: division.driveFolderId,
    };

    if (contentItemId) {
      // Update existing
      await prisma.contentItem.update({
        where: { id: contentItemId },
        data: contentData,
      });
    } else {
      // Create new
      const ci = await prisma.contentItem.create({
        data: { id: `ci-${div.toLowerCase()}-${Date.now()}`, ...contentData },
      });
      contentItemId = ci.id;
    }
  } catch (e) {
    console.error('[PUBLISH] ContentItem sync failed:', e.message);
  }

  const updated = await prisma.eventDivision.update({
    where: { id: division.id },
    data: {
      approvalStatus: 'PUBLISHED',
      publishedAt: new Date(),
      contentItemId,
    },
  });

  await logApprovalAction(division.id, 'PUBLISH', req.authUser, 'Published to website');
  res.json({ division: updated, contentItemId });
}));

// GET /api/events/:eventId/divisions/:div/approval-logs — get approval history
app.get('/api/events/:eventId/divisions/:div/approval-logs', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum tersedia.' });

  const { eventId, div } = req.params;
  const division = await prisma.eventDivision.findUnique({
    where: { eventId_division: { eventId, division: div.toUpperCase() } },
  });
  if (!division) return res.status(404).json({ error: 'Divisi tidak ditemukan.' });

  const logs = await prisma.eventApprovalLog.findMany({
    where: { eventDivisionId: division.id },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ logs });
}));

// ---------- Division Members ----------
// GET /api/events/:eventId/divisions/:div/members
app.get('/api/events/:eventId/divisions/:div/members', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum tersedia.' });

  const { eventId, div } = req.params;
  const division = await prisma.eventDivision.findUnique({
    where: { eventId_division: { eventId, division: div.toUpperCase() } },
  });
  if (!division) return res.status(404).json({ error: 'Divisi tidak ditemukan.' });

  const members = await prisma.eventDivisionMember.findMany({
    where: { eventDivisionId: division.id },
  });

  res.json({ members });
}));

// POST /api/events/:eventId/divisions/:div/members — add/update member
app.post('/api/events/:eventId/divisions/:div/members', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const roles = (req.authUser.roles || []).map((r) => r.role);
  if (!roles.includes('SUPERADMIN') && !roles.includes('KOMISI') && !roles.includes('COMMITTEE')) {
    return res.status(403).json({ error: 'Hanya Superadmin/Komisi/BOD yang bisa mengelola anggota divisi.' });
  }

  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum tersedia.' });

  const { eventId, div } = req.params;
  const division = await prisma.eventDivision.findUnique({
    where: { eventId_division: { eventId, division: div.toUpperCase() } },
  });
  if (!division) return res.status(404).json({ error: 'Divisi tidak ditemukan.' });

  const { userId, role } = req.body;
  if (!userId || !['LEAD', 'CO_LEAD', 'MEMBER', 'VIEWER'].includes(role)) {
    return res.status(400).json({ error: 'userId dan role valid diperlukan.' });
  }

  const member = await prisma.eventDivisionMember.upsert({
    where: {
      eventDivisionId_userId: { eventDivisionId: division.id, userId },
    },
    create: {
      id: `edm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      eventDivisionId: division.id,
      userId,
      role,
    },
    update: { role },
  });

  res.json({ member });
}));

// DELETE /api/events/:eventId/divisions/:div/members/:userId — remove member
app.delete('/api/events/:eventId/divisions/:div/members/:userId', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const roles = (req.authUser.roles || []).map((r) => r.role);
  if (!roles.includes('SUPERADMIN') && !roles.includes('KOMISI') && !roles.includes('COMMITTEE')) {
    return res.status(403).json({ error: 'Hanya Superadmin/Komisi/BOD yang bisa mengelola anggota divisi.' });
  }

  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum tersedia.' });

  const { eventId, div, userId } = req.params;
  const division = await prisma.eventDivision.findUnique({
    where: { eventId_division: { eventId, division: div.toUpperCase() } },
  });
  if (!division) return res.status(404).json({ error: 'Divisi tidak ditemukan.' });

  await prisma.eventDivisionMember.deleteMany({
    where: { eventDivisionId: division.id, userId },
  });

  res.json({ ok: true });
}));

// ---------- Absensi (Parameter 3) ----------
// Mentor/Co-Mentor hanya boleh untuk grup binaannya; L1/L3/L4 bebas.
app.post('/api/db/attendance', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const roles = req.authUser.roles || [];
  const roleNames = roles.map((r) => r.role);
  const groupId = req.body?.groupId;
  const privileged = ['SUPERADMIN', 'KOMISI', 'COMMITTEE'].some((r) => roleNames.includes(r));
  const scopedRole = roles.find((r) => ['MENTOR', 'CO_MENTOR'].includes(r.role));
  const scoped = scopedRole && scopedRole.groupId === groupId;
  if (!privileged && !scoped) {
    return res.status(403).json({ error: 'Hanya Mentor/Co-Mentor grup binaan atau Komisi/Tim Kerja.' });
  }

  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const date = new Date(req.body?.date);
  if (Number.isNaN(date.getTime())) return res.status(400).json({ error: 'date tidak valid.' });
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
  let saved = 0;
  for (const e of entries) {
    if (!e?.groupMemberId || !['HADIR', 'IZIN', 'SAKIT', 'TANPA_KABAR'].includes(e.status)) continue;
    await prisma.attendanceRecord.upsert({
      where: { groupMemberId_date: { groupMemberId: e.groupMemberId, date } },
      create: {
        id: `att-${crypto.randomUUID()}`,
        groupId,
        groupMemberId: e.groupMemberId,
        date,
        status: e.status,
        note: e.note || null,
        recordedById: req.authUser.id,
      },
      update: { status: e.status, note: e.note || null, recordedById: req.authUser.id },
    });
    saved += 1;
  }
  res.json({ saved });
}));

// Struktur organisasi (publik — dipakai landing pohon pantatugas)
app.get('/api/db/struktur', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const members = await prisma.strukturMember.findMany({ orderBy: { sortOrder: 'asc' } });
  res.json({ members });
}));

// Sinkronisasi struktur dari portal (replace-all: upsert semua, hapus yang tidak dikirim)
app.post('/api/db/sync-struktur', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const list = Array.isArray(req.body?.members) ? req.body.members : [];
  for (const [i, m] of list.entries()) {
    if (!m?.id || !m?.name) continue;
    const data = {
      name: m.name,
      position: m.position ?? null,
      division: m.division ?? null,
      subdivision: m.subdivision ?? null,
      period: m.period ?? null,
      photoUrl: m.photoUrl ?? null,
      bio: m.bio ?? null,
      phone: m.phone ?? null,
      email: m.email ?? null,
      sortOrder: Number.isFinite(m.order) ? m.order : i,
      isOpenRole: Boolean(m.isOpenRole ?? m.is_open_role),
      role: m.role ?? null,
      roleOrder: Number.isFinite(m.roleOrder) ? m.roleOrder : 0,
      isDoubleRole: Boolean(m.isDoubleRole ?? false),
      subRoleId: m.subRoleId ?? null,
      groupId: m.groupId ?? null,
    };
    await prisma.strukturMember.upsert({ where: { id: m.id }, create: { id: m.id, ...data }, update: data });
  }
  const keepIds = list.map((m) => m.id).filter(Boolean);
  const removed = await prisma.strukturMember.deleteMany({
    where: keepIds.length ? { id: { notIn: keepIds } } : {},
  });
  res.json({ synced: list.length, removed: removed.count });
}));

// ---------- Jethro Engine (Dashboard Komisi) ----------

// ---------- Groups List (for Jethro Placement Review) ----------
app.get('/api/groups', requireRole(...KOMISION, 'BPMJ', 'COMMITTEE', 'MENTOR'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const groups = await prisma.group.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      color: true,
      icon: true,
      description: true,
      memberCount: true,
      foundedPeriod: true,
      parentGroupId: true,
    },
    orderBy: { name: 'asc' },
  });
  res.json({ groups });
}));

app.get('/api/jethro/dashboard', requireRole(...KOMISION, 'BPMJ'), wrap(async (req, res) => {
  res.json(await getDashboard());
}));

app.post('/api/jethro/scan', requireRole(...KOMISION), wrap(async (req, res) => {
  res.json(await runScan());
}));

app.get('/api/jethro/narrate', requireRole(...KOMISION, 'BPMJ'), wrap(async (req, res) => {
  try {
    res.json(await narrateDashboard());
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
}));

app.get('/api/jethro/placement', requireRole(...KOMISION), wrap(async (req, res) => {
  const count = Number(req.query.count || 0);
  if (!Number.isFinite(count) || count < 1 || count > 500) {
    return res.status(400).json({ error: 'query count harus angka 1-500.' });
  }
  res.json(await recommendPlacement(Math.floor(count)));
}));

/** Advanced placement with 4-factor scoring for specific newcomers */
app.get('/api/jethro/placement/advanced', requireRole(...KOMISION), wrap(async (req, res) => {
  const prisma = getPrisma();
  const ids = (req.query.ids || '').split(',').filter(Boolean);
  if (ids.length === 0) return res.status(400).json({ error: 'query ids (comma-separated) wajib.' });
  // Fetch newcomer details from WaitingPool - accept both WaitingPool IDs and User IDs
  const newcomers = await getEligibleNewcomers();
  // Try to match by userId first, then by WaitingPool ID (p.id)
  const filtered = newcomers.filter((n) => ids.includes(n.id));
  // If no matches by userId, try matching by WaitingPool ID via a separate query
  if (filtered.length === 0) {
    const poolEntries = await prisma.waitingPool.findMany({
      where: { id: { in: ids }, status: 'PROFILE_COMPLETED', giftTestDone: true, gender: { not: null } },
      select: { id: true, userId: true, name: true, email: true, gender: true, giftsTop5: true, giftsScores: true },
    });
    const filtered2 = poolEntries
      .filter(p => p.userId && p.giftTestDone && p.gender)
      .map(p => ({
        id: p.userId,
        name: p.name,
        gender: p.gender,
        giftsTop5: normalizeGiftsTop5(Array.isArray(p.giftsTop5) ? p.giftsTop5 : []),
        giftsScores: p.giftsScores || {},
        maturityScore: 0,
      }));
    if (filtered2.length > 0) {
      res.json(await recommendPlacementAdvanced(filtered2));
      return;
    }
  }
  if (filtered.length === 0) return res.status(404).json({ error: 'Tidak ada newcomer valid.' });
  res.json(await recommendPlacementAdvanced(filtered));
}));

/** AI Analysis for placement recommendations */
app.post('/api/jethro/placement/ai-analysis', requireRole(...KOMISION), wrap(async (req, res) => {
  const { recommendations, batchId } = req.body || {};
  if (!Array.isArray(recommendations) || recommendations.length === 0) {
    return res.status(400).json({ error: 'recommendations array wajib.' });
  }

  // Fetch group states for context
  const prisma = getPrisma();
  const groups = await prisma.group.findMany({
    where: { status: 'ACTIVE' },
    include: {
      members: {
        where: { status: 'ACTIVE' },
        include: { user: { select: { id: true, gender: true, giftsTop5: true, giftsScores: true } } },
      },
    },
    orderBy: { name: 'asc' },
  });

  const groupStates = groups.map((g) => {
    const activeMembers = g.members.filter((m) => m.status === 'ACTIVE');
    const capacity = capacityOf(g);
    let laki = 0, perempuan = 0;
    for (const m of activeMembers) {
      const gdr = m.user?.gender || m.gender;
      if (gdr === 'LAKI-LAKI') laki++;
      else if (gdr === 'PEREMPUAN') perempuan++;
    }
    const giftCoverage = {};
    for (const m of activeMembers) {
      const gifts = m.user?.giftsTop5 || [];
      for (const gift of gifts) {
        giftCoverage[gift] = (giftCoverage[gift] || 0) + 1;
      }
    }
    let mentorCount = 0, comentorCount = 0;
    for (const m of activeMembers) {
      if (m.familyRole === 'MENTOR') mentorCount++;
      else if (m.familyRole === 'COMENTOR') comentorCount++;
    }
    return {
      id: g.id,
      name: g.name,
      freeSlots: capacity.freeSlots,
      activeCount: capacity.activeCount,
      genderRatio: { laki, perempuan },
      diversityScore: calculateGiftDiversity(giftCoverage),
      mentorCount,
      comentorCount,
    };
  });

  try {
    const result = await analyzePlacementRecommendations(recommendations, groupStates);
    res.json(result);
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
}));

/** Create placement batch from recommendations */
app.post('/api/jethro/placement/batch', requireRole(...KOMISION), wrap(async (req, res) => {
  const { recommendations } = req.body || {};
  if (!Array.isArray(recommendations) || recommendations.length === 0) {
    return res.status(400).json({ error: 'recommendations array wajib.' });
  }
  const batch = await createPlacementBatch({ createdBy: req.authUser.id, recommendations });
  res.json(batch);
}));

/** List placement batches */
app.get('/api/jethro/placement/batches', requireRole(...KOMISION, 'BPMJ'), wrap(async (req, res) => {
  const { status, limit = '50', offset = '0' } = req.query;
  const data = await listPlacementBatches({ status, limit: Number(limit), offset: Number(offset) });
  res.json(data);
}));

/** Get single batch with items */
app.get('/api/jethro/placement/batch/:id', requireRole(...KOMISION), wrap(async (req, res) => {
  const batch = await getPlacementBatch(req.params.id);
  if (!batch) return res.status(404).json({ error: 'Batch tidak ditemukan.' });
  res.json(batch);
}));

/** Update single placement item (approve/revise/reject/individu) */
app.patch('/api/jethro/placement/item/:id', requireRole(...KOMISION), wrap(async (req, res) => {
  const { status, finalGroupId, finalRole, finalIsIndividu } = req.body || {};
  if (!status) return res.status(400).json({ error: 'status wajib.' });
  const item = await updatePlacementItem({
    itemId: req.params.id,
    status,
    finalGroupId,
    finalRole,
    finalIsIndividu,
    reviewedBy: req.authUser.id,
  });
  res.json(item);
}));

/** Bulk approve all pending items in batch */
app.patch('/api/jethro/placement/batch/:id/bulk-approve', requireRole(...KOMISION), wrap(async (req, res) => {
  const result = await bulkApprovePlacementBatch({ batchId: req.params.id, reviewedBy: req.authUser.id });
  res.json(result);
}));

/** Commit batch → create RoleAssignments */
app.post('/api/jethro/placement/batch/:id/commit', requireRole(...KOMISION), wrap(async (req, res) => {
  const result = await commitPlacementBatch({ batchId: req.params.id, committedBy: req.authUser.id });
  res.json(result);
}));

/** Get eligible newcomers for placement */
app.get('/api/jethro/placement/eligible', requireRole(...KOMISION), wrap(async (req, res) => {
  const newcomers = await getEligibleNewcomers();
  res.json({ newcomers });
}));

app.post('/api/jethro/split', requireRole(...KOMISION), wrap(async (req, res) => {
  res.json(await executeSplit(req.body || {}));
}));

app.post('/api/jethro/merge', requireRole(...KOMISION), wrap(async (req, res) => {
  res.json(await executeMerge(req.body || {}));
}));

app.patch('/api/jethro/member/:id/role', requireRole(...KOMISION), wrap(async (req, res) => {
  res.json(await shuffleRole(req.params.id, req.body?.familyRole));
}));

app.patch('/api/jethro/member/:id/alumni', requireRole(...KOMISION), wrap(async (req, res) => {
  res.json(await markAlumni(req.params.id, req.body?.note));
}));

// Notifikasi: tinjau / tutup
app.get('/api/db/notifications', requireRole(...KOMISION, 'BPMJ'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const notifications = await prisma.notification.findMany({
    where: req.query.status ? { status: String(req.query.status).toUpperCase() } : {},
    orderBy: { createdAt: 'desc' },
  });
  res.json({ notifications });
}));

app.patch('/api/db/notifications/:id', requireRole(...KOMISION), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const status = String(req.body?.status || '').toUpperCase();
  if (!['OPEN', 'ACKNOWLEDGED', 'RESOLVED'].includes(status)) {
    return res.status(400).json({ error: "status harus OPEN | ACKNOWLEDGED | RESOLVED." });
  }
  const updated = await prisma.notification.update({
    where: { id: req.params.id },
    data: { status, resolvedAt: status === 'RESOLVED' ? new Date() : null },
  });
  res.json(updated);
}));

// Login akun lokal (email + password)
app.post('/api/auth/local', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  try {
    const user = await loginLocal(req.body?.email, req.body?.password);
    setSessionCookie(res, { uid: user.id, email: user.email });
    res.json({
      status: user.accountStatus,
      user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar, roles: user.roles },
    });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
}));

// ---------- Join Flow: Waitlist · Invites · People · GiftTest ----------

const wlPublic = (w) => ({
  id: w.id,
  name: w.name,
  phone: w.phone,
  email: w.email,
  origin: w.origin,
  address: w.address,
  gender: w.gender,
  emergencyContactName: w.emergencyContactName,
  emergencyContactRelation: w.emergencyContactRelation,
  emergencyContactPhone: w.emergencyContactPhone,
  emergencyContactAddress: w.emergencyContactAddress,
  giftsTop5: w.giftsTop5,
  talents: w.talents,
  status: w.status,
  sourceEventId: w.sourceEventId,
  assignedGroupId: w.assignedGroupId,
  promoteToken: w.promoteToken,
  createdAt: w.createdAt,
});

// Tahap A — daftar cepat (publik, tanpa login)
app.post('/api/waitlist', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const { name, phone, email, origin, sourceEventId, gender, emergencyContactName, emergencyContactRelation, emergencyContactPhone, emergencyContactAddress } = req.body || {};
  if (!name?.trim() || !phone?.trim() || !gender || !emergencyContactName?.trim() || !emergencyContactRelation || !emergencyContactPhone?.trim() || !emergencyContactAddress?.trim()) {
    return res.status(400).json({ error: 'Nama, WhatsApp, jenis kelamin, dan kontak darurat wajib diisi.' });
  }
  const entry = await prisma.waitlistEntry.create({
    data: {
      id: `wl-${crypto.randomUUID()}`,
      name: String(name).trim().slice(0, 150),
      phone: String(phone).trim().slice(0, 40),
      email: email ? String(email).toLowerCase().trim() : null,
      origin: origin ? String(origin).slice(0, 190) : null,
      status: 'WAITLISTED',
      sourceEventId: sourceEventId ? String(sourceEventId).slice(0, 64) : null,
      promoteToken: crypto.randomBytes(24).toString('hex'),
      gender: gender ? String(gender).slice(0, 20) : null,
      emergencyContactName: emergencyContactName ? String(emergencyContactName).trim().slice(0, 150) : null,
      emergencyContactRelation: emergencyContactRelation ? String(emergencyContactRelation).slice(0, 50) : null,
      emergencyContactPhone: emergencyContactPhone ? String(emergencyContactPhone).trim().slice(0, 40) : null,
      emergencyContactAddress: emergencyContactAddress ? String(emergencyContactAddress).trim() : null,
    },
  });
  res.json({ ok: true, entry: wlPublic(entry) });
}));

// Baca satu entri via token rahasia (link pelengkap profil tahap B)
app.get('/api/waitlist/by-token/:token', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const w = await prisma.waitlistEntry.findUnique({ where: { promoteToken: req.params.token } });
  if (!w) return res.status(404).json({ error: 'Link tidak valid atau sudah kedaluwarsa.' });
  res.json({ entry: wlPublic(w) });
}));

// Tahap B — lengkapi profil via token
app.patch('/api/waitlist/by-token/:token', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const w = await prisma.waitlistEntry.findUnique({ where: { promoteToken: req.params.token } });
  if (!w) return res.status(404).json({ error: 'Link tidak valid.' });
  const b = req.body || {};
  const updated = await prisma.waitlistEntry.update({
    where: { id: w.id },
    data: {
      address: b.address ?? w.address,
      origin: b.origin ?? w.origin,
      email: b.email ?? w.email,
      gender: b.gender ?? w.gender,
      emergencyContactName: b.emergencyContactName ?? w.emergencyContactName,
      emergencyContactRelation: b.emergencyContactRelation ?? w.emergencyContactRelation,
      emergencyContactPhone: b.emergencyContactPhone ?? w.emergencyContactPhone,
      emergencyContactAddress: b.emergencyContactAddress ?? w.emergencyContactAddress,
      giftsTop5: b.giftsTop5 ?? undefined,
      giftsScores: b.giftsScores ?? undefined,
      talents: b.talents ?? undefined,
      status: w.status === 'WAITLISTED' && (b.address || b.giftsTop5) ? 'PROFILED' : w.status,
    },
  });
  res.json({ ok: true, entry: wlPublic(updated) });
}));

// Panel: daftar waitlist
app.get('/api/waitlist', requireRole(...KOMISION), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const entries = await prisma.waitlistEntry.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ entries: entries.map(wlPublic) });
}));

// Panel: assign ke rumah (mentee baru) — deprecated, gunakan Onboarding Pipeline
app.post('/api/waitlist/:id/assign', requireRole(...KOMISION_CORE), wrap(async (_req, res) => {
  res.status(410).json({
    error: 'Waitlist assign sudah tidak dipakai. Gunakan Onboarding Pipeline → Jethro Placement Review.',
    redirect: 'onboarding',
  });
}));

// ---------- Invites ----------
app.get('/api/invites', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const invites = await prisma.inviteCode.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ invites: invites.map((i) => ({ ...i, maxUses: Number(i.maxUses), uses: Number(i.uses) })) });
}));

app.post('/api/invites', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const type = ['SINGLE', 'TEAM'].includes(req.body?.type) ? req.body.type : 'SINGLE';
  const defaultRole = ['SUPERADMIN', 'BPMJ', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR', 'MENTEE', 'ALUMNI']
    .includes(req.body?.defaultRole) ? req.body.defaultRole : 'MENTEE';
  const maxUses = Math.max(1, Math.min(500, Number(req.body?.maxUses || (type === 'SINGLE' ? 1 : 25))));
  const expiresDays = Math.max(1, Math.min(90, Number(req.body?.expiresDays || 14)));
  const code = `GEHC-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const invite = await prisma.inviteCode.create({
    data: {
      code,
      type,
      defaultRole,
      maxUses,
      expiresAt: new Date(Date.now() + expiresDays * 86400000),
      createdBy: req.authUser?.email || null,
    },
  });
  res.json({ invite: { ...invite, maxUses: Number(invite.maxUses), uses: Number(invite.uses) } });
}));

app.delete('/api/invites/:code', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  await prisma.inviteCode.delete({ where: { code: req.params.code.toUpperCase() } }).catch(() => {});
  res.json({ ok: true });
}));

// ---------- Join via invite (Google SSO + profil) ----------
app.post('/api/join', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  try {
    const p = await verifyGoogleCredential(req.body?.credential);

    const code = String(req.body?.code || '').toUpperCase().trim();
    const invite = await prisma.inviteCode.findUnique({ where: { code } });
    if (!invite) return res.status(400).json({ error: 'Kode undangan tidak ditemukan.' });
    if (Number(invite.uses) >= Number(invite.maxUses)) return res.status(400).json({ error: 'Link undangan sudah habis dipakai.' });
    if (invite.expiresAt && invite.expiresAt < new Date()) return res.status(400).json({ error: 'Link undangan sudah kedaluwarsa.' });

    const profile = {
      phone: req.body?.phone ? String(req.body.phone).slice(0, 40) : undefined,
      address: req.body?.address ? String(req.body.address).slice(0, 1000) : undefined,
      origin: req.body?.origin ? String(req.body.origin).slice(0, 190) : undefined,
      talents: Array.isArray(req.body?.talents) ? req.body.talents : undefined,
      giftsTop5: Array.isArray(req.body?.giftsTop5) ? req.body.giftsTop5 : undefined,
    };

    let user = (await prisma.user.findUnique({ where: { id: p.sub } }))
      || (await prisma.user.findUnique({ where: { email: p.email } }));

    if (!user) {
      user = await prisma.user.create({
        data: {
          id: p.sub,
          email: p.email,
          name: p.name || p.email.split('@')[0],
          avatar: p.picture || null,
          accountStatus: 'PENDING',
          ...profile,
        },
        include: { roles: true },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: p.name || user.name,
          avatar: p.picture || user.avatar,
          phone: profile.phone ?? user.phone,
          address: profile.address ?? user.address,
          origin: profile.origin ?? user.origin,
          talents: profile.talents ?? user.talents,
          giftsTop5: profile.giftsTop5 ?? user.giftsTop5,
        },
        include: { roles: true },
      });
    }

    // Multi-role: tambahkan role dasar dari invite bila belum dimiliki
    const has = (user.roles || []).some((r) => r.role === invite.defaultRole);
    if (!has) {
      await prisma.userRole.create({
        data: { userId: user.id, tenantId: 'tenant-youth', role: invite.defaultRole },
      });
      user.roles.push({ role: invite.defaultRole, tenantId: 'tenant-youth' });
    }

    await prisma.inviteCode.update({ where: { code }, data: { uses: { increment: 1 } } });

    if (invite.defaultRole === 'MENTEE') {
      try { await ensureWaitingPoolForNewPemuda(user.id, { sourceEvent: `Invite ${code}` }); } catch { /* non-blocking */ }
    }

    setSessionCookie(res, { uid: user.id, email: user.email });
    res.json({
      status: user.accountStatus,
      role: invite.defaultRole,
      user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar, roles: user.roles },
    });
  } catch (err) {
    console.error('[join] gagal:', err.message);
    res.status(400).json({ error: err.message });
  }
}));

// Join via invite — akun LOKAL (email + password)
app.post('/api/join/local', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  try {
    const b = req.body || {};
    const name = String(b.name || '').trim();
    const email = String(b.email || '').toLowerCase().trim();
    const password = String(b.password || '');
    if (!name || !email.includes('@')) return res.status(400).json({ error: 'Nama dan email valid wajib diisi.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password minimal 8 karakter.' });

    const code = String(b.code || '').toUpperCase().trim();
    const invite = await prisma.inviteCode.findUnique({ where: { code } });
    if (!invite) return res.status(400).json({ error: 'Kode undangan tidak ditemukan.' });
    if (Number(invite.uses) >= Number(invite.maxUses)) return res.status(400).json({ error: 'Link undangan sudah habis dipakai.' });
    if (invite.expiresAt && invite.expiresAt < new Date()) return res.status(400).json({ error: 'Link undangan sudah kedaluwarsa.' });

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return res.status(409).json({
        error: 'Email sudah terdaftar. Masuk lewat Google atau gunakan tombol masuk email.',
        existingAccount: true,
      });
    }

    const user = await prisma.user.create({
      data: {
        id: `usr-${crypto.randomUUID()}`,
        email,
        name,
        phone: b.phone ? String(b.phone).slice(0, 40) : null,
        address: b.address ? String(b.address).slice(0, 1000) : null,
        origin: b.origin ? String(b.origin).slice(0, 190) : null,
        gender: b.gender ? String(b.gender).slice(0, 20) : null,
        emergencyContactName: b.emergencyContactName ? String(b.emergencyContactName).trim().slice(0, 150) : null,
        emergencyContactRelation: b.emergencyContactRelation ? String(b.emergencyContactRelation).slice(0, 50) : null,
        emergencyContactPhone: b.emergencyContactPhone ? String(b.emergencyContactPhone).trim().slice(0, 40) : null,
        emergencyContactAddress: b.emergencyContactAddress ? String(b.emergencyContactAddress).trim() : null,
        talents: Array.isArray(b.talents) ? b.talents : undefined,
        giftsTop5: Array.isArray(b.giftsTop5) ? b.giftsTop5 : undefined,
        authProvider: 'LOCAL',
        passwordHash: hashPassword(password),
        accountStatus: 'PENDING',
      },
      include: { roles: true },
    });

    await prisma.userRole.create({
      data: { userId: user.id, tenantId: 'tenant-youth', role: invite.defaultRole },
    });
    user.roles.push({ role: invite.defaultRole, tenantId: 'tenant-youth' });

    await prisma.inviteCode.update({ where: { code }, data: { uses: { increment: 1 } } });

    if (invite.defaultRole === 'MENTEE') {
      try { await ensureWaitingPoolForNewPemuda(user.id, { sourceEvent: `Invite ${code}` }); } catch { /* non-blocking */ }
    }

    setSessionCookie(res, { uid: user.id, email: user.email });
    res.json({ status: user.accountStatus, role: invite.defaultRole, user });
  } catch (err) {
    console.error('[join-local] gagal:', err.message);
    res.status(400).json({ error: err.message });
  }
}));

// ---------- Profil diri sendiri (lengkapi setelah join) ----------
app.patch('/api/me', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const b = req.body || {};
  const data = {};
  for (const k of ['phone', 'address', 'origin', 'gender', 'emergencyContactName', 'emergencyContactRelation', 'emergencyContactPhone', 'emergencyContactAddress']) {
    if (b[k] !== undefined) data[k] = String(b[k]).slice(0, 1000);
  }
  if (b.profileReminderDays !== undefined) data.profileReminderDays = Number(b.profileReminderDays);
  if (Array.isArray(b.talents)) data.talents = b.talents;
  if (Array.isArray(b.giftsTop5)) data.giftsTop5 = b.giftsTop5;
  if (b.giftsScores && typeof b.giftsScores === 'object') data.giftsScores = b.giftsScores;
  const u = await prisma.user.update({ where: { id: req.authUser.id }, data });
  try { await syncWaitingPoolFromUser(req.authUser.id); } catch { /* non-blocking */ }
  res.json({ ok: true, name: u.name });
}));

// ---------- Registrasi mandiri via Google (publik, PENDING → approval Komisi) ----------
const registrationOpen = () => process.env.REGISTRATION_OPEN !== 'false';

app.post('/api/register/google', wrap(async (req, res) => {
  if (!registrationOpen()) {
    return res.status(403).json({ error: 'Pendaftaran akun baru sedang ditutup. Ikuti waitlist event terdekat ya!' });
  }
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  try {
    const p = await verifyGoogleCredential(req.body?.credential);
    const email = p.email;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ id: p.sub }, { email }] },
      include: { roles: true },
    });
    if (existing && (existing.roles || []).length > 0) {
      return res.status(409).json({
        error: 'Email sudah terdaftar. Silakan Masuk dengan Google.',
        existingAccount: true,
      });
    }

    const trusted = isSuperadminEmail(email);
    const status = trusted ? 'ACTIVE' : 'PENDING';
    const initialRole = trusted ? 'SUPERADMIN' : 'MENTEE';

    const profile = {
      phone: req.body?.phone ? String(req.body.phone).slice(0, 40) : null,
      origin: req.body?.origin ? String(req.body.origin).slice(0, 190) : null,
      gender: req.body?.gender ? String(req.body.gender).slice(0, 20) : null,
      emergencyContactName: req.body?.emergencyContactName ? String(req.body.emergencyContactName).trim().slice(0, 150) : null,
      emergencyContactRelation: req.body?.emergencyContactRelation ? String(req.body.emergencyContactRelation).slice(0, 50) : null,
      emergencyContactPhone: req.body?.emergencyContactPhone ? String(req.body.emergencyContactPhone).trim().slice(0, 40) : null,
      emergencyContactAddress: req.body?.emergencyContactAddress ? String(req.body.emergencyContactAddress).trim() : null,
      talents: Array.isArray(req.body?.talents) ? req.body.talents : undefined,
      giftsTop5: Array.isArray(req.body?.giftsTop5) ? req.body.giftsTop5 : undefined,
    };

    let user;
    if (existing) {
      // akun yatim (tanpa role) — lengkapi & aktifkan alur pendaftaran
      user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: p.name || user?.name || email.split('@')[0],
          avatar: p.picture || existing.avatar,
          accountStatus: status,
          ...profile,
        },
        include: { roles: true },
      });
    } else {
      user = await prisma.user.create({
        data: {
          id: p.sub,
          email,
          name: p.name || email.split('@')[0],
          avatar: p.picture || null,
          accountStatus: status,
          ...profile,
        },
        include: { roles: true },
      });
    }

    const hasRole = (user.roles || []).some((r) => r.role === initialRole);
    if (!hasRole) {
      await prisma.userRole.create({
        data: { userId: user.id, tenantId: 'tenant-youth', role: initialRole },
      });
      user.roles.push({ userId: user.id, tenantId: 'tenant-youth', role: initialRole });
    }

    // Kaitkan waitlist berdasar email bila pernah daftar cepat
    const wl = await prisma.waitlistEntry.findFirst({ where: { email } });
    if (wl && wl.status === 'WAITLISTED') {
      await prisma.waitlistEntry.update({ where: { id: wl.id }, data: { status: 'PROFILED' } });
    }

    if (!trusted) {
      await prisma.user.update({
        where: { id: user.id },
        data: { onboardingStatus: 'WAITING_POOL' },
      });
      try {
        await claimWaitingPoolByPhone(prisma, user.id, user.phone, BAKU_TAU_SOURCE_EVENT);
        await ensureWaitingPoolForNewPemuda(user.id, { sourceEvent: BAKU_TAU_SOURCE_EVENT });
      } catch { /* non-blocking */ }
    }

    setSessionCookie(res, { uid: user.id, email: user.email });
    res.json({
      status,
      role: initialRole,
      user: {
        id: user.id, email: user.email, name: user.name,
        avatar: user.avatar, accountStatus: status, roles: user.roles,
      },
    });
  } catch (err) {
    console.error('[register-google] gagal:', err.message);
    res.status(400).json({ error: err.message });
  }
}));

app.post('/api/register/local', wrap(async (req, res) => {
  if (!registrationOpen()) {
    return res.status(403).json({ error: 'Pendaftaran akun baru sedang ditutup. Ikuti waitlist event terdekat ya!' });
  }
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  try {
    const b = req.body || {};
    const name = String(b.name || '').trim();
    const email = String(b.email || '').toLowerCase().trim();
    const password = String(b.password || '');
    if (!name || !email.includes('@')) {
      return res.status(400).json({ error: 'Nama dan email valid wajib diisi.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Kata sandi minimal 8 karakter.' });
    }

    const existing = await prisma.user.findUnique({ where: { email }, include: { roles: true } });
    if (existing && (existing.roles || []).length > 0) {
      return res.status(409).json({
        error: 'Email sudah terdaftar. Silakan masuk lewat portal dengan email & kata sandi.',
        existingAccount: true,
      });
    }

    const trusted = isSuperadminEmail(email);
    const status = trusted ? 'ACTIVE' : 'PENDING';
    const initialRole = trusted ? 'SUPERADMIN' : 'MENTEE';

    const profile = {
      phone: b.phone ? String(b.phone).slice(0, 40) : null,
      origin: b.origin ? String(b.origin).slice(0, 190) : null,
      gender: b.gender ? String(b.gender).slice(0, 20) : null,
      emergencyContactName: b.emergencyContactName ? String(b.emergencyContactName).trim().slice(0, 150) : null,
      emergencyContactRelation: b.emergencyContactRelation ? String(b.emergencyContactRelation).slice(0, 50) : null,
      emergencyContactPhone: b.emergencyContactPhone ? String(b.emergencyContactPhone).trim().slice(0, 40) : null,
      emergencyContactAddress: b.emergencyContactAddress ? String(b.emergencyContactAddress).trim() : null,
      talents: Array.isArray(b.talents) ? b.talents : undefined,
      giftsTop5: Array.isArray(b.giftsTop5) ? b.giftsTop5 : undefined,
    };

    let user;
    if (existing) {
      user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          name,
          accountStatus: status,
          authProvider: 'LOCAL',
          passwordHash: hashPassword(password),
          ...profile,
        },
        include: { roles: true },
      });
    } else {
      user = await prisma.user.create({
        data: {
          id: `usr-${crypto.randomUUID()}`,
          email,
          name,
          accountStatus: status,
          bipra: 'PEMUDA',
          authProvider: 'LOCAL',
          passwordHash: hashPassword(password),
          ...profile,
        },
        include: { roles: true },
      });
    }

    const hasRole = (user.roles || []).some((r) => r.role === initialRole);
    if (!hasRole) {
      await prisma.userRole.create({
        data: { userId: user.id, tenantId: 'tenant-youth', role: initialRole },
      });
      user.roles.push({ userId: user.id, tenantId: 'tenant-youth', role: initialRole });
    }

    const wl = await prisma.waitlistEntry.findFirst({ where: { email } });
    if (wl && wl.status === 'WAITLISTED') {
      await prisma.waitlistEntry.update({ where: { id: wl.id }, data: { status: 'PROFILED' } });
    }

    if (!trusted) {
      await prisma.user.update({
        where: { id: user.id },
        data: { onboardingStatus: 'WAITING_POOL' },
      });
      try {
        await claimWaitingPoolByPhone(prisma, user.id, user.phone, BAKU_TAU_SOURCE_EVENT);
        await ensureWaitingPoolForNewPemuda(user.id, { sourceEvent: BAKU_TAU_SOURCE_EVENT });
      } catch { /* non-blocking */ }
    }

    setSessionCookie(res, { uid: user.id, email: user.email });
    res.json({
      status,
      role: initialRole,
      user: {
        id: user.id, email: user.email, name: user.name,
        avatar: user.avatar, accountStatus: status, roles: user.roles,
      },
    });
  } catch (err) {
    console.error('[register-local] gagal:', err.message);
    res.status(400).json({ error: err.message });
  }
}));

// Agenda terdekat untuk portal terbatas / landing (publik)
app.get('/api/events/upcoming', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const items = await prisma.contentItem.findMany({
    where: { type: 'ACTIVITY', isPublished: true },
    orderBy: [{ eventDate: 'asc' }, { publishedAt: 'desc' }],
    take: 12,
  });

  const mapped = items.map((c) => {
    const eventDay = c.eventDate || c.publishedAt;
    return {
      id: c.id,
      title: c.title,
      subtitle: c.subtitle,
      date: eventDay,
      eventDateTime: c.id === 'cnt-bakutau' ? BAKU_TAU_EVENT_DATE_ISO : null,
      locationDetail: c.locationDetail ?? null,
      mapUrl: c.id === 'cnt-bakutau' ? BAKU_TAU_MAP_URL : null,
      mapEmbedQuery: c.id === 'cnt-bakutau' ? BAKU_TAU_MAP_EMBED_QUERY : null,
      venueName: c.id === 'cnt-bakutau' ? BAKU_TAU_VENUE_NAME : null,
      bannerUrl: c.bannerUrl,
      _sort: eventDay ? new Date(eventDay).getTime() : 0,
    };
  }).filter((e) => e._sort >= today.getTime() || e.id === 'cnt-bakutau');

  mapped.sort((a, b) => a._sort - b._sort);

  res.json({
    events: mapped.slice(0, 6).map(({ _sort, ...rest }) => rest),
  });
}));

// ---------- OAuth Redirect Flow ala AISIGHT (prompt=select_account) ----------
const oauthStates = new Map(); // state → intent (TTL 10 menit)
function newOAuthState(data) {
  const s = crypto.randomBytes(16).toString('hex');
  oauthStates.set(s, { ...data, exp: Date.now() + 10 * 60 * 1000 });
  return s;
}
function takeOAuthState(state) {
  const v = oauthStates.get(String(state));
  oauthStates.delete(String(state));
  if (!v || v.exp < Date.now()) return null;
  return v;
}

function googleRedirectUri(req) {
  return `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
}

app.get('/api/auth/google/start', wrap(async (req, res) => {
  const mode = ['login', 'register', 'join'].includes(String(req.query.mode)) ? String(req.query.mode) : 'login';
  const inviteCode = mode === 'join' ? String(req.query.code || '').toUpperCase().slice(0, 16) : undefined;
  const next = typeof req.query.next === 'string' && req.query.next.startsWith('#')
    ? req.query.next : '#/beyonders';

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    const fallback = mode === 'register'
      ? '#/register'
      : mode === 'join' && inviteCode
        ? `#/join?inv=${encodeURIComponent(inviteCode)}`
        : next;
    return res.redirect(302, `/${fallback}`);
  }

  const state = newOAuthState({ mode, code: inviteCode, next });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: googleRedirectUri(req),
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
    state,
  });
  res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}));

/** Buat/perbarui user dari identitas Google terverifikasi. */
async function upsertGoogleUser(prisma, p, { profile = {}, accountStatus = 'ACTIVE', initialRole }) {
  const email = p.email.toLowerCase();
  let user = await prisma.user.findFirst({
    where: { OR: [{ googleSub: p.sub }, { id: p.sub }, { email }] },
    include: { roles: true },
  });

  const baseData = {
    name: p.name || email.split('@')[0],
    avatar: p.picture ?? undefined,
    phone: profile.phone ?? undefined,
    address: profile.address ?? undefined,
    origin: profile.origin ?? undefined,
    talents: Array.isArray(profile.talents) ? profile.talents : undefined,
    giftsTop5: Array.isArray(profile.giftsTop5) ? profile.giftsTop5 : undefined,
    googleSub: p.sub,
    linkStatus: 'LINKED',
    authProvider: 'GOOGLE',
  };

  if (!user) {
    user = await prisma.user.create({
      data: { id: p.sub, email, accountStatus, bipra: 'PEMUDA', ...baseData },
      include: { roles: true },
    });
  } else {
    const clean = Object.fromEntries(Object.entries(baseData).filter(([, v]) => v !== undefined));
    user = await prisma.user.update({ where: { id: user.id }, data: clean, include: { roles: true } });
  }

  if (initialRole) {
    const has = (user.roles || []).some((r) => r.role === initialRole);
    if (!has) {
      await prisma.userRole.create({
        data: { userId: user.id, tenantId: 'tenant-youth', role: initialRole },
      });
      user.roles.push({ userId: user.id, tenantId: 'tenant-youth', role: initialRole });
    }
  }
  return user;
}

app.get('/api/auth/google/callback', wrap(async (req, res) => {
  const sendErr = (msg) =>
    res.status(400).send(
      `<html><body style="font-family:system-ui;background:#111;color:#fff;text-align:center;padding-top:80px">
       <h2>Login gagal</h2><p style="color:#f87171">${msg}</p>
       <a href="/#/beyonders" style="color:#FF416C">← Kembali ke situs</a></body></html>`
    );

  try {
    if (req.query.error) throw new Error(req.query.error === 'access_denied' ? 'Login dibatalkan.' : String(req.query.error));
    const intent = takeOAuthState(String(req.query.state || ''));
    if (!intent) throw new Error('Sesi otorisasi kedaluwarsa — coba tombol Google lagi.');

    const prisma = getPrisma();
    if (!prisma) throw new Error('DATABASE_URL belum dikonfigurasi.');

    // Tukar authorization code → token, lalu verifikasi identitas
    const { google } = await import('googleapis');
    const oauth2 = new google.auth.OAuth2({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: googleRedirectUri(req),
    });
    const { tokens } = await oauth2.getToken(String(req.query.code));
    oauth2.setCredentials(tokens);
    const idp = tokens.id_token ? await verifyGoogleCredential(tokens.id_token) : null;
    if (!idp) throw new Error('id_token tidak diterima.');

    const email = idp.email;
    let user; let status; let roleInfo;

    if (intent.mode === 'register') {
      if (!registrationOpen()) throw new Error('Pendaftaran akun baru sedang ditutup.');
      const dup = await prisma.user.findFirst({ where: { OR: [{ id: idp.sub }, { email }] }, include: { roles: true } });
      if (dup && (dup.roles || []).length > 0) throw new Error('Email sudah terdaftar — silakan Masuk dengan Google.');

      const trusted = isSuperadminEmail(email);
      status = trusted ? 'ACTIVE' : 'PENDING';
      user = await upsertGoogleUser(prisma, idp, {
        profile: { origin: req.state?.origin },
        accountStatus: status,
        initialRole: trusted ? 'SUPERADMIN' : 'MENTEE',
      });
      roleInfo = trusted ? 'SUPERADMIN' : 'MENTEE';

      if (!trusted) {
        await prisma.user.update({
          where: { id: user.id },
          data: { onboardingStatus: 'WAITING_POOL' },
        });
        try {
          await claimWaitingPoolByPhone(prisma, user.id, user.phone, BAKU_TAU_SOURCE_EVENT);
          await ensureWaitingPoolForNewPemuda(user.id, { sourceEvent: BAKU_TAU_SOURCE_EVENT });
        } catch { /* non-blocking */ }
      }

      const wl = await prisma.waitlistEntry.findFirst({ where: { email } });
      if (wl && wl.status === 'WAITLISTED') {
        await prisma.waitlistEntry.update({ where: { id: wl.id }, data: { status: 'PROFILED' } });
      }
    } else if (intent.mode === 'join') {
      const inv = await prisma.inviteCode.findUnique({ where: { code: intent.code } });
      if (!inv) throw new Error('Kode undangan tidak ditemukan.');
      if (Number(inv.uses) >= Number(inv.maxUses)) throw new Error('Link undangan sudah habis dipakai.');
      if (inv.expiresAt && inv.expiresAt < new Date()) throw new Error('Link undangan kedaluwarsa.');

      user = await upsertGoogleUser(prisma, idp, {
        profile: {},
        accountStatus: 'PENDING',
        initialRole: inv.defaultRole,
      });
      status = user.accountStatus;
      roleInfo = inv.defaultRole;

      await prisma.inviteCode.update({ where: { code: intent.code }, data: { uses: { increment: 1 } } });

      try {
        await ensureWaitingPoolForNewPemuda(user.id, { sourceEvent: `Invite ${intent.code}` });
        if (inv.defaultRole === 'MENTEE') {
          await prisma.user.update({
            where: { id: user.id },
            data: { onboardingStatus: 'WAITING_POOL' },
          });
        }
      } catch { /* non-blocking */ }
    } else {
      // login biasa
      user = await upsertGoogleUser(prisma, idp, {
        profile: {},
        accountStatus: 'ACTIVE',
        initialRole: isSuperadminEmail(email) ? 'SUPERADMIN' : null,
      });
      status = user.accountStatus;
    }

    setSessionCookie(res, { uid: user.id, email: user.email });

    let next = intent.next || '#/beyonders';
    if (intent.mode === 'register' && !isSuperadminEmail(email)) {
      next = '#/portal';
    } else {
      const bakuPool = await prisma.waitingPool.findFirst({
        where: { userId: user.id, sourceEvent: BAKU_TAU_SOURCE_EVENT },
      });
      if (bakuPool) next = '#/portal';
    }
    res.redirect(302, `/${next}`);
  } catch (err) {
    console.error('[oauth-callback]', err.message);
    sendErr(err.message);
  }
}));

// ---------- People (akun & approval) ----------
app.get('/api/db/users', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const users = await prisma.user.findMany({
    include: { roles: true, _count: { select: { groupMembers: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({
    users: users.map(({ _count, ...u }) => ({ ...u, groupCount: _count.groupMembers })),
  });
}));

app.patch('/api/people/:id', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const action = req.body?.action;

  if (action === 'approve') {
    const u = await prisma.user.update({
      where: { id: req.params.id },
      data: { accountStatus: 'ACTIVE' },
      include: { roles: true },
    });
    return res.json({ user: u });
  }

  if (action === 'addRole') {
    const role = req.body?.role;
    if (!['SUPERADMIN', 'BPMJ', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR', 'MENTEE', 'ALUMNI'].includes(role)) {
      return res.status(400).json({ error: 'Role tidak valid.' });
    }
    const dup = await prisma.userRole.findFirst({
      where: { userId: req.params.id, role, groupId: req.body?.groupId ?? null },
    });
    if (!dup) {
      await prisma.userRole.create({
        data: { userId: req.params.id, tenantId: 'tenant-youth', role, groupId: req.body?.groupId ?? null },
      });
    }
    return res.json({ ok: true });
  }

  if (action === 'removeRole') {
    await prisma.userRole.deleteMany({
      where: { userId: req.params.id, role: req.body?.role, groupId: req.body?.groupId ?? null },
    });
    return res.json({ ok: true });
  }

  res.status(400).json({ error: 'action tidak dikenal.' });
}));

// ============================================================
// WAITING POOL & ONBOARDING PIPELINE (routes/onboarding.mjs)
// ============================================================

/** Generate 64-char hex ID */
function genId64() {
  return crypto.randomBytes(32).toString('hex');
}

const BIPRA_VALUES = ['BAPAK', 'IBU', 'PEMUDA', 'REMAJA', 'ANAK'];

function formatChurchRequestSummary(req, kolomById = new Map()) {
  const parts = [];
  if (req.changeName && req.requestedName) parts.push(`Nama → ${req.requestedName}`);
  if (req.changeBipra && req.requestedBipra) parts.push(`BIPRA → ${req.requestedBipra}`);
  if (req.changeKolom) {
    parts.push(`Kolom → ${req.requestedKolomId ? (kolomById.get(req.requestedKolomId)?.name || req.requestedKolomId) : 'Belum di-assign'}`);
  }
  return parts.join(' · ') || 'Perubahan data gereja';
}

app.post('/api/profile/church-data-requests/:id/approve', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const record = await prisma.profileChurchDataRequest.findUnique({
    where: { id: req.params.id },
  });
  if (!record) return res.status(404).json({ error: 'Permintaan tidak ditemukan.' });
  if (record.status !== 'PENDING') return res.status(400).json({ error: 'Permintaan sudah diproses.' });

  const data = {};
  if (record.changeName && record.requestedName) data.name = record.requestedName;
  if (record.changeBipra && record.requestedBipra) {
    if (!BIPRA_VALUES.includes(record.requestedBipra)) {
      return res.status(400).json({ error: 'BIPRA pada permintaan tidak valid.' });
    }
    data.bipra = record.requestedBipra;
    if (record.requestedBipra !== 'PEMUDA') data.isBeyonders = false;
  }
  if (record.changeKolom) data.kolomId = record.requestedKolomId;

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Tidak ada perubahan untuk diterapkan.' });
  }

  await prisma.user.update({ where: { id: record.userId }, data });
  await prisma.profileChurchDataRequest.update({
    where: { id: record.id },
    data: {
      status: 'APPROVED',
      reviewedById: req.authUser.id,
      reviewedAt: new Date(),
      adminNote: req.body?.adminNote ? String(req.body.adminNote).trim().slice(0, 500) : null,
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: record.userId },
    include: jemaatInclude(),
  });
  res.json({ user: serializeJemaat(user) });
}));

app.post('/api/profile/church-data-requests/:id/reject', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const record = await prisma.profileChurchDataRequest.findUnique({ where: { id: req.params.id } });
  if (!record) return res.status(404).json({ error: 'Permintaan tidak ditemukan.' });
  if (record.status !== 'PENDING') return res.status(400).json({ error: 'Permintaan sudah diproses.' });

  await prisma.profileChurchDataRequest.update({
    where: { id: record.id },
    data: {
      status: 'REJECTED',
      reviewedById: req.authUser.id,
      reviewedAt: new Date(),
      adminNote: req.body?.adminNote ? String(req.body.adminNote).trim().slice(0, 500) : null,
    },
  });
  res.json({ ok: true });
}));

function jemaatInclude() {
  return {
    roles: true,
    roleAssignments: { where: { isActive: true }, include: { group: true } },
    orgAssignments: {
      where: { isActive: true },
      include: { orgNode: true },
    },
    kolom: true,
    institution: true,
    recreational: { include: { group: true } },
  };
}

function serializeJemaat(u) {
  const base = {
    ...u,
    recreationalIds: (u.recreational || []).map((m) => m.groupId),
    recreational: (u.recreational || []).map((m) => m.group),
  };
  return { ...base, demographics: enrichUserDemographics(base) };
}

function collectRecreationalLeafIds(all, rootId) {
  const ids = [];
  const walk = (id) => {
    const children = all.filter((g) => g.parentId === id);
    if (!children.length) {
      const node = all.find((g) => g.id === id);
      if (node?.selectable !== false) ids.push(id);
      return;
    }
    children.forEach((c) => walk(c.id));
  };
  walk(rootId);
  return ids;
}

async function queryJemaat(prisma, { bipra, kolomId, recreational, addressScope, birthdayWithin, membershipKind }) {
  const where = {};
  if (bipra && BIPRA_VALUES.includes(bipra)) where.bipra = bipra;
  if (kolomId === 'none') where.kolomId = null;
  else if (kolomId) where.kolomId = kolomId;
  if (addressScope === 'ID' || addressScope === 'INTL') where.addressScope = addressScope;
  if (membershipKind === 'JEMAAT' || membershipKind === 'SIMPATISAN') {
    where.membershipKind = membershipKind;
  }
  if (recreational) {
    const all = await prisma.recreationalGroup.findMany();
    const start = all.find((g) => g.slug === recreational || g.id === recreational);
    const leafIds = start ? collectRecreationalLeafIds(all, start.id) : [];
    if (leafIds.length) {
      where.recreational = { some: { groupId: { in: leafIds } } };
    } else {
      where.recreational = { some: { group: { slug: recreational } } };
    }
  }
  const youth = await prisma.user.findMany({
    where,
    include: jemaatInclude(),
    orderBy: { name: 'asc' },
  });
  let rows = youth.map(serializeJemaat);
  if (birthdayWithin) {
    const days = Number(birthdayWithin) || 30;
    rows = rows.filter((u) => u.birthDate && isBirthdayWithinDays(u.birthDate, days));
  }
  return rows;
}

app.get('/api/jemaat/meta', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const [kolom, recreationalFlat, pendingSuggestions, pendingChurchRequests, orgNodes, kolomAssignments] = await Promise.all([
    prisma.kolom.findMany({ orderBy: { number: 'asc' } }),
    prisma.recreationalGroup.findMany({ orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.recreationalSuggestion.findMany({
      where: { status: 'PENDING' },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }).catch(() => []),
    prisma.profileChurchDataRequest.findMany({
      where: { status: 'PENDING' },
      include: { user: { select: { id: true, name: true, email: true, bipra: true, kolomId: true, kolom: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }).catch(() => []),
    prisma.orgNode.findMany({
      where: { domain: 'YOUTH', isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    }).catch(() => []),
    prisma.orgAssignment.findMany({
      where: { isActive: true, orgNode: { domain: 'KOLOM', isActive: true } },
      include: {
        orgNode: true,
        user: { select: { id: true, name: true, avatar: true } },
      },
    }).catch(() => []),
  ]);
  const byId = new Map(recreationalFlat.map((r) => [r.id, { ...r, children: [] }]));
  const recreationalTree = [];
  for (const r of byId.values()) {
    if (r.parentId && byId.has(r.parentId)) byId.get(r.parentId).children.push(r);
    else if (!r.parentId) recreationalTree.push(r);
  }

  const timkerjaNode = orgNodes.find((n) => n.slug === 'TIMKERJA');
  const timKerjaBranches = timkerjaNode
    ? orgNodes
      .filter((n) => n.parentId === timkerjaNode.id && n.nodeKind === 'BRANCH')
      .map((n) => {
        const meta = n.metadata && typeof n.metadata === 'object' ? n.metadata : {};
        const divisions = meta.division ? [meta.division] : [];
        if (n.slug === 'PANCA_TUGAS') {
          divisions.push('LITURGIA', 'DIDASKALIA', 'KOINONIA', 'DIAKONIA', 'MARTURIA');
        }
        return { key: n.slug, label: n.label, divisions };
      })
    : [];

  const kolomLeaders = {};
  for (const a of kolomAssignments) {
    const meta = a.orgNode?.metadata && typeof a.orgNode.metadata === 'object' ? a.orgNode.metadata : {};
    const kid = meta.linkedKolomId;
    if (!kid) continue;
    if (!kolomLeaders[kid]) kolomLeaders[kid] = {};
    if (meta.leaderKind === 'DIAKEN') kolomLeaders[kid].diaken = a.user;
    if (meta.leaderKind === 'PENATUA') kolomLeaders[kid].penatua = a.user;
  }

  res.json({
    kolom,
    recreational: recreationalFlat,
    recreationalTree,
    bipra: BIPRA_VALUES,
    pendingSuggestions,
    pendingChurchRequests,
    timKerjaBranches,
    kolomLeaders,
  });
}));

function slugifyRec(name) {
  const base = String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32) || 'minat';
  return base;
}

app.get('/api/recreational', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const recreational = await prisma.recreationalGroup.findMany({
    orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  });
  res.json({ recreational });
}));

app.post('/api/recreational', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Nama wajib.' });

  const parentId = req.body?.parentId ? String(req.body.parentId) : null;
  let kind = String(req.body?.kind || '').toUpperCase();
  let selectable = true;
  let parent = null;

  if (parentId) {
    parent = await prisma.recreationalGroup.findUnique({ where: { id: parentId } });
    if (!parent) return res.status(404).json({ error: 'Subkategori tidak ditemukan.' });
    if (parent.parentId) {
      return res.status(400).json({ error: 'Item hanya bisa ditambah di bawah subkategori (Olahraga, Dance, …).' });
    }
    kind = parent.kind;
    selectable = true;
  } else {
    if (kind !== 'SPORTS' && kind !== 'ARTS') {
      return res.status(400).json({ error: 'kind wajib SPORTS atau ARTS untuk subkategori baru.' });
    }
    selectable = false;
  }

  const siblings = await prisma.recreationalGroup.findMany({
    where: parentId ? { parentId } : { kind, parentId: null },
    select: { sortOrder: true, slug: true },
  });
  let slug = slugifyRec(name);
  if (siblings.some((s) => s.slug === slug) || await prisma.recreationalGroup.findUnique({ where: { slug } })) {
    slug = `${slug}-${crypto.randomBytes(2).toString('hex')}`;
  }
  const sortOrder = siblings.reduce((m, s) => Math.max(m, s.sortOrder || 0), 0) + 1;

  const group = await prisma.recreationalGroup.create({
    data: {
      id: `rec-${crypto.randomBytes(6).toString('hex')}`,
      slug,
      name,
      kind,
      parentId,
      selectable,
      sortOrder,
    },
  });
  res.json({ group });
}));

app.post('/api/recreational/suggest', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Nama minat wajib.' });
  let kind = String(req.body?.kind || '').toUpperCase();
  const parentId = req.body?.parentId ? String(req.body.parentId) : null;
  if (parentId) {
    const parent = await prisma.recreationalGroup.findUnique({ where: { id: parentId } });
    if (!parent) return res.status(404).json({ error: 'Kategori tidak ditemukan.' });
    kind = parent.kind;
  }
  if (kind !== 'SPORTS' && kind !== 'ARTS') {
    return res.status(400).json({ error: 'kind wajib SPORTS atau ARTS.' });
  }
  const suggestion = await prisma.recreationalSuggestion.create({
    data: {
      id: `recsug-${crypto.randomBytes(6).toString('hex')}`,
      userId: req.authUser.id,
      name,
      kind,
      parentId,
      status: 'PENDING',
    },
  });
  res.json({ suggestion });
}));

app.get('/api/recreational/suggestions', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const status = String(req.query.status || 'PENDING').toUpperCase();
  const suggestions = await prisma.recreationalSuggestion.findMany({
    where: status ? { status } : undefined,
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ suggestions });
}));

app.post('/api/recreational/suggestions/:id/approve', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const sug = await prisma.recreationalSuggestion.findUnique({ where: { id: req.params.id } });
  if (!sug) return res.status(404).json({ error: 'Saran tidak ditemukan.' });
  if (sug.status !== 'PENDING') return res.status(400).json({ error: 'Saran sudah diproses.' });

  let parent = null;
  if (sug.parentId) {
    parent = await prisma.recreationalGroup.findUnique({ where: { id: sug.parentId } });
    if (!parent) return res.status(404).json({ error: 'Kategori induk tidak ditemukan.' });
  }

  const siblings = await prisma.recreationalGroup.findMany({
    where: sug.parentId ? { parentId: sug.parentId } : { kind: sug.kind, parentId: null },
    select: { sortOrder: true, slug: true },
  });
  let slug = slugifyRec(sug.name);
  if (siblings.some((s) => s.slug === slug) || await prisma.recreationalGroup.findUnique({ where: { slug } })) {
    slug = `${slug}-${crypto.randomBytes(2).toString('hex')}`;
  }
  const sortOrder = siblings.reduce((m, s) => Math.max(m, s.sortOrder || 0), 0) + 1;

  const group = await prisma.recreationalGroup.create({
    data: {
      id: `rec-${crypto.randomBytes(6).toString('hex')}`,
      slug,
      name: sug.name,
      kind: sug.kind,
      parentId: sug.parentId,
      selectable: Boolean(sug.parentId),
      sortOrder,
    },
  });

  await prisma.recreationalMembership.upsert({
    where: { userId_groupId: { userId: sug.userId, groupId: group.id } },
    create: { userId: sug.userId, groupId: group.id },
    update: {},
  });

  await prisma.recreationalSuggestion.update({
    where: { id: sug.id },
    data: { status: 'APPROVED', groupId: group.id },
  });

  res.json({ group, suggestionId: sug.id });
}));

app.post('/api/recreational/suggestions/:id/reject', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const sug = await prisma.recreationalSuggestion.findUnique({ where: { id: req.params.id } });
  if (!sug) return res.status(404).json({ error: 'Saran tidak ditemukan.' });
  if (sug.status !== 'PENDING') return res.status(400).json({ error: 'Saran sudah diproses.' });
  await prisma.recreationalSuggestion.update({ where: { id: sug.id }, data: { status: 'REJECTED' } });
  res.json({ ok: true });
}));

app.get('/api/jemaat', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const youth = await queryJemaat(prisma, {
    bipra: String(req.query.bipra || ''),
    kolomId: String(req.query.kolomId || ''),
    recreational: String(req.query.recreational || ''),
    addressScope: String(req.query.addressScope || ''),
    birthdayWithin: req.query.birthdayWithin ? String(req.query.birthdayWithin) : '',
    membershipKind: String(req.query.membershipKind || ''),
  });
  res.json({ youth });
}));

app.get('/api/jemaat/birthdays/upcoming', requireRole(...KOMISION, 'COMMITTEE', 'BPMJ'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const days = Number(req.query.days || 7);
  const all = await queryJemaat(prisma, { birthdayWithin: String(days) });
  const sorted = all
    .map((u) => ({ id: u.id, name: u.name, birthDate: u.birthDate, daysToBirthday: u.demographics?.daysToBirthday }))
    .sort((a, b) => (a.daysToBirthday ?? 999) - (b.daysToBirthday ?? 999))
    .slice(0, 10);
  res.json({ birthdays: sorted });
}));

app.patch('/api/jemaat/:id/bipra-suggest', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });
  const { suggested } = enrichUserDemographics(user).bipraSuggest;
  if (!suggested) return res.status(400).json({ error: 'Tidak ada usulan BIPRA.' });
  const data = { bipra: suggested };
  if (suggested !== 'PEMUDA') data.isBeyonders = false;
  await prisma.user.update({ where: { id: user.id }, data });
  const updated = await prisma.user.findUnique({ where: { id: user.id }, include: jemaatInclude() });
  res.json({ ok: true, user: serializeJemaat(updated) });
}));

/** PATCH /api/jemaat/:id — update membership kind (simpatisan) */
app.patch('/api/jemaat/:id', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });

  const { membershipKind } = req.body || {};
  if (!membershipKind || !['JEMAAT', 'SIMPATISAN'].includes(membershipKind)) {
    return res.status(400).json({ error: 'membershipKind harus JEMAAT atau SIMPATISAN.' });
  }

  await prisma.user.update({ where: { id: user.id }, data: { membershipKind } });
  const updated = await prisma.user.findUnique({ where: { id: user.id }, include: jemaatInclude() });
  res.json({ ok: true, user: serializeJemaat(updated) });
}));

app.post('/api/jemaat', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const { name, phone, gender, bipra, kolomId, isBeyonders, recreationalIds } = req.body || {};
  if (!String(name || '').trim()) return res.status(400).json({ error: 'Nama wajib.' });
  const b = BIPRA_VALUES.includes(bipra) ? bipra : 'PEMUDA';
  const data = {
    id: `usr-${crypto.randomBytes(8).toString('hex')}`,
    name: String(name).trim(),
    email: null,
    phone: phone ? String(phone) : null,
    gender: gender ? String(gender) : null,
    bipra: b,
    kolomId: kolomId || null,
    isBeyonders: b === 'PEMUDA' ? Boolean(isBeyonders) : false,
    linkStatus: 'UNLINKED',
    authProvider: 'LOCAL',
    accountStatus: 'ACTIVE',
    onboardingStatus: 'ACTIVE',
  };
  const fieldErr = applyLifeAddressFields(req.body || {}, data);
  if (fieldErr) return res.status(400).json({ error: fieldErr });
  const created = await prisma.user.create({
    data,
    include: jemaatInclude(),
  });
  const ids = Array.isArray(recreationalIds) ? recreationalIds.filter(Boolean) : [];
  if (ids.length) {
    await prisma.recreationalMembership.createMany({
      data: ids.map((groupId) => ({ userId: created.id, groupId })),
    });
  }
  const user = await prisma.user.findUnique({ where: { id: created.id }, include: jemaatInclude() });
  res.json({ user: serializeJemaat(user) });
}));

app.post('/api/admin/users/:id/claim-link', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'User tidak ditemukan.' });
  if (existing.linkStatus === 'LINKED' && existing.googleSub) {
    return res.status(400).json({ error: 'Akun ini sudah tertaut Google.' });
  }
  const token = newClaimToken();
  const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await prisma.user.update({
    where: { id: req.params.id },
    data: { claimToken: token, claimTokenExpiresAt: expires },
  });
  const origin = `${req.protocol}://${req.get('host')}`;
  res.json({ token, expiresAt: expires.toISOString(), claimUrl: `${origin}/#/claim?token=${encodeURIComponent(token)}` });
}));

app.post('/api/admin/users/:id/unlink', requireRole('SUPERADMIN'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'User tidak ditemukan.' });
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { googleSub: null, linkStatus: 'UNLINKED', claimToken: null, claimTokenExpiresAt: null },
  });
  res.json({ user });
}));

/** PATCH /api/admin/users/:id — Admin edit profil jemaat */
app.patch('/api/admin/users/:id', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'User tidak ditemukan.' });

  const { name, gender, phone, giftsTop5, isBeyonders, bipra, kolomId, recreationalIds, membershipKind } = req.body || {};
  const data = {};
  if (name !== undefined) {
    if (!String(name).trim()) return res.status(400).json({ error: 'name tidak boleh kosong.' });
    data.name = String(name).trim();
  }
  if (gender !== undefined) data.gender = gender ? String(gender) : null;
  if (phone !== undefined) data.phone = phone ? String(phone) : null;
  if (req.body?.birthDate !== undefined) {
    const parsed = parseBirthDateInput(req.body.birthDate);
    if (req.body.birthDate && !parsed) return res.status(400).json({ error: 'Tanggal lahir tidak valid.' });
    data.birthDate = parsed;
  }
  const fieldErr = applyLifeAddressFields(req.body || {}, data);
  if (fieldErr) return res.status(400).json({ error: fieldErr });
  if (giftsTop5 !== undefined) {
    if (!Array.isArray(giftsTop5)) return res.status(400).json({ error: 'giftsTop5 harus array JSON.' });
    data.giftsTop5 = giftsTop5;
  }
  if (bipra !== undefined) {
    if (!BIPRA_VALUES.includes(bipra)) return res.status(400).json({ error: 'BIPRA tidak valid.' });
    data.bipra = bipra;
  }
  if (kolomId !== undefined) data.kolomId = kolomId || null;
  if (membershipKind !== undefined) {
    if (!['JEMAAT', 'SIMPATISAN'].includes(membershipKind)) {
      return res.status(400).json({ error: 'membershipKind tidak valid.' });
    }
    data.membershipKind = membershipKind;
  }
  const nextBipra = data.bipra || existing.bipra;
  if (isBeyonders !== undefined) data.isBeyonders = nextBipra === 'PEMUDA' ? Boolean(isBeyonders) : false;
  else if (data.bipra && data.bipra !== 'PEMUDA') data.isBeyonders = false;

  if (Object.keys(data).length === 0 && recreationalIds === undefined) {
    return res.status(400).json({ error: 'Tidak ada field untuk diupdate.' });
  }

  if (Object.keys(data).length) {
    data.lastProfileUpdate = new Date();
    await prisma.user.update({ where: { id: req.params.id }, data });
  }

  if (Array.isArray(recreationalIds)) {
    await prisma.recreationalMembership.deleteMany({ where: { userId: req.params.id } });
    const ids = recreationalIds.filter(Boolean);
    if (ids.length) {
      await prisma.recreationalMembership.createMany({
        data: ids.map((groupId) => ({ userId: req.params.id, groupId })),
      });
    }
  }

  const user = await prisma.user.findUnique({ where: { id: req.params.id }, include: jemaatInclude() });
  res.json({ user: serializeJemaat(user) });
}));

/** POST /api/role-assignments — Assign role to user (creates RoleAssignment + dual-write to UserRole) */
app.post('/api/role-assignments', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { userId, role, position, division, subdivision, groupId, familyRole, note } = req.body || {};
  const assignerId = req.authUser?.id;
  if (!assignerId) return res.status(401).json({ error: 'Belum login.' });

  if (!userId || !role) {
    return res.status(400).json({ error: 'userId dan role wajib.' });
  }

  const validRoles = ['SUPERADMIN', 'BPMJ', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR', 'MENTEE', 'ALUMNI'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Role tidak valid.' });
  }

  // Check if user exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });

  const { assignment, userRole } = await assignRoleToUser(prisma, {
    userId,
    role,
    groupId: groupId || null,
    position: position || null,
    division: division || null,
    subdivision: subdivision || null,
    familyRole: familyRole || null,
    assignedBy: assignerId,
    note: note || null,
  });

  res.json({ ok: true, assignment, userRole });
}));

/** POST /api/role-assignments/bulk-individu — Bulk assign MENTEE without group (Individu) */
app.post('/api/role-assignments/bulk-individu', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { userIds } = req.body || {};
  const assignerId = req.authUser?.id;
  if (!assignerId) return res.status(401).json({ error: 'Belum login.' });

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'userIds array wajib.' });
  }

  const results = { created: 0, errors: [] };

  for (const userId of userIds) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        results.errors.push(`${userId}: User tidak ditemukan`);
        continue;
      }

      const individuNode = await prisma.orgNode.findFirst({
        where: { domain: 'YOUTH', slug: 'INDIVIDU', isActive: true },
      });

      if (individuNode) {
        await assignOrgSlot(prisma, {
          userId,
          orgNodeId: individuNode.id,
          assignedBy: assignerId,
          note: 'Individu (tanpa kelompok mentoring)',
          updateOnboarding: true,
        });
        results.created++;
        continue;
      }

      const assignment = await prisma.roleAssignment.create({
        data: {
          id: genId64(),
          userId,
          role: 'MENTEE',
          position: null,
          division: null,
          subdivision: null,
          groupId: null,
          familyRole: 'MENTEE',
          assignedBy: assignerId,
          note: 'Individu (tanpa kelompok mentoring)',
          isActive: true,
        },
      });

      // Dual-write UserRole
      const existingUserRole = await prisma.userRole.findFirst({
        where: { userId, role: 'MENTEE', groupId: null },
      });

      if (existingUserRole) {
        await prisma.userRole.update({
          where: { id: existingUserRole.id },
          data: { assignmentId: assignment.id },
        });
      } else {
        await prisma.userRole.create({
          data: {
            userId,
            tenantId: 'tenant-youth',
            role: 'MENTEE',
            groupId: null,
            assignmentId: assignment.id,
          },
        });
      }

      // Update WaitingPool status
      await prisma.waitingPool.updateMany({
        where: { userId },
        data: { status: 'ROLE_ASSIGNED' },
      });

      // Update user
      await prisma.user.update({
        where: { id: userId },
        data: { onboardingStatus: 'ACTIVE', isBeyonders: false },
      });

      results.created++;
    } catch (e) {
      results.errors.push(`${userId}: ${e.message}`);
    }
  }

  res.json(results);
}));

/** PATCH /api/role-assignments/:id — Update sub-role detail */
app.patch('/api/role-assignments/:id', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { position, division, subdivision, groupId, familyRole, note, isActive } = req.body || {};

  const assignment = await prisma.roleAssignment.findUnique({ where: { id: req.params.id } });
  if (!assignment) return res.status(404).json({ error: 'Assignment tidak ditemukan.' });

  const updated = await prisma.roleAssignment.update({
    where: { id: req.params.id },
    data: {
      position: position !== undefined ? position : assignment.position,
      division: division !== undefined ? division : assignment.division,
      subdivision: subdivision !== undefined ? subdivision : assignment.subdivision,
      groupId: groupId !== undefined ? groupId : assignment.groupId,
      familyRole: familyRole !== undefined ? familyRole : assignment.familyRole,
      note: note !== undefined ? note : assignment.note,
      isActive: isActive !== undefined ? isActive : assignment.isActive,
    },
  });

  res.json({ ok: true, assignment: updated });
}));

/** DELETE /api/role-assignments/:id — Revoke role assignment */
app.delete('/api/role-assignments/:id', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  try {
    await revokeRoleAssignment(prisma, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
}));

/** GET /api/users/:id/roles — List user's role assignments */
app.get('/api/users/:id/roles', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const assignments = await prisma.roleAssignment.findMany({
    where: { userId: req.params.id, isActive: true },
    include: { group: true },
    orderBy: { assignedAt: 'desc' },
  });

  res.json({ assignments });
}));

/** POST /api/role-assignments/cleanup-duplicates — Clean duplicate RoleAssignments */
app.post('/api/role-assignments/cleanup-duplicates', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  // Find duplicates: same userId, role, groupId, isActive
  const duplicates = await prisma.$queryRaw`
    SELECT \`user_id\`, role, \`group_id\`, COUNT(*) as cnt
    FROM \`role_assignments\`
    WHERE \`is_active\` = true
    GROUP BY \`user_id\`, role, \`group_id\`
    HAVING COUNT(*) > 1
  `;

  let deleted = 0;
  for (const dup of duplicates) {
    // Keep the oldest (first assignedAt), delete the rest
    const toDelete = await prisma.roleAssignment.findMany({
      where: {
        userId: dup.userId,
        role: dup.role,
        groupId: dup.groupId,
        isActive: true
      },
      orderBy: { assignedAt: 'asc' },
      skip: 1, // Keep first
      select: { id: true }
    });

    for (const d of toDelete) {
      await prisma.roleAssignment.update({
        where: { id: d.id },
        data: { isActive: false }
      });
      // Remove corresponding UserRole
      await prisma.userRole.deleteMany({
        where: { userId: dup.userId, role: dup.role, groupId: dup.groupId }
      });
      deleted++;
    }
  }

  res.json({ ok: true, deleted });
}));

/** POST /api/role-assignments/bulk-delete — Bulk delete RoleAssignments by userIds */
app.post('/api/role-assignments/bulk-delete', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { userIds } = req.body || {};
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'userIds array wajib.' });
  }

  const assignments = await prisma.roleAssignment.findMany({
    where: { userId: { in: userIds }, isActive: true },
    select: { id: true, userId: true, role: true, groupId: true }
  });

  let deleted = 0;
  for (const a of assignments) {
    await prisma.roleAssignment.update({
      where: { id: a.id },
      data: { isActive: false }
    });
    await prisma.userRole.deleteMany({
      where: { userId: a.userId, role: a.role, groupId: a.groupId }
    });
    // If Beyonders role, remove GroupMember
    if (a.groupId && ['MENTOR', 'CO_MENTOR', 'MENTEE'].includes(a.role)) {
      await prisma.groupMember.deleteMany({
        where: { userId: a.userId, groupId: a.groupId }
      });
    }
    deleted++;
  }

  res.json({ ok: true, deleted });
}));

// ---------- GiftTest ----------
app.post('/api/gifttest', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const { scope, token, giftsTop5, giftsScores, talents } = req.body || {};

  if (scope === 'waitlist') {
    if (!token) return res.status(400).json({ error: 'token wajib.' });
    const w = await prisma.waitlistEntry.findUnique({ where: { promoteToken: token } });
    if (!w) return res.status(404).json({ error: 'Token tidak valid.' });
    await prisma.waitlistEntry.update({
      where: { id: w.id },
      data: { giftsTop5, giftsScores, talents, status: w.status === 'WAITLISTED' ? 'PROFILED' : w.status },
    });
    return res.json({ ok: true });
  }

  if (scope === 'user') {
    if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
    await prisma.user.update({
      where: { id: req.authUser.id },
      data: { giftsTop5, giftsScores, talents },
    });
    try { await syncWaitingPoolFromUser(req.authUser.id); } catch { /* non-blocking */ }
    return res.json({ ok: true });
  }

  res.status(400).json({ error: 'scope tidak dikenal.' });
}));

// ---------- Admin routes (modular) ----------
registerOnboardingRoutes(app, { wrap });
registerEventsPublicRoutes(app, { wrap });
registerAdminRoutes(app, { wrap });
registerOrgRoutes(app, { wrap });

// ---------- Admin: Seed Gift Test Data (legacy inline — SUPERADMIN only) ----------
app.post('/api/admin/seed-gifts', requireRole('SUPERADMIN'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const GIFTS = [
    'Administration','Apostleship','Craftsmanship','Discernment','Evangelism',
    'Exhortation','Faith','Giving','Healing','Hospitality','Intercession',
    'Leadership','Mercy','Miracles','Pastor/Shepherd','Prophecy','Service',
    'Teaching','Tongues and Interpretation','Word of Knowledge','Word of Wisdom','Helps'
  ];
  const { createHash } = await import('crypto');
  function genGifts(name) {
    const h = createHash('md5').update(name).digest();
    const used = new Set(); const s = {};
    for (let i = 0; i < 5; i++) { let idx; do { idx = h[i*3] % GIFTS.length; } while (used.has(idx)); used.add(idx); s[GIFTS[idx]] = 10 + (h[i*3+1] % 40); }
    const t = Object.entries(s).sort((a,b) => b[1]-a[1]).slice(0,5);
    return { top5: t.map(([g])=>g), scores: Object.fromEntries(t) };
  }

  const EXCEL_GIFTS = {
    'jessica poyoh': ['Pastor/Shepherd',9], 'kimberly turambi': ['Leadership',9],
    'kimmy casey liogu': ['Miracles',10], 'putri massie': ['Teaching',7],
    'hoky theos': ['Helps',29], 'jilova pakasi': ['Exhortation',17],
    'natalie musak': ['Intercession',1], 'kezia joseph': ['Evangelism',7],
    'syallomitha mawitjere': ['Faith',47], 'prichel kampong': ['Craftsmanship',18],
    'nelcy lodarmase': ['Discernment',16], 'aurellia hillary': ['Hospitality',16],
    'akwila gente': ['Giving',10], 'timothy mewengkang': ['Apostleship',8],
    'agnes reimas': ['Tongues and Interpretation',1], 'avriel singal': ['Administration',19],
    'imanuel yimna esau': ['Prophecy',6], 'shanella mondong': ['Healing',5],
    'glenity siauw': ['Word of Wisdom',5], 'lingkan pinontoan': ['Giving',10],
    'jonathan tintingon': ['Giving',10], 'yuen pajow': ['Mercy',19],
    'jacqson naharia': ['Word of Knowledge',3], 'mega welan': ['Healing',5],
    'soneta imanuela': ['Teaching',7],
  };

  const USERS_NEED_GIFTS = [
    ['usr-alvandi-saerang', 'Alvandi Saerang'],
    ['usr-angelita-entjaurau', 'Angelita Entjaurau'],
    ['usr-artjuna-timbuleng', 'Artjuna Timbuleng'],
    ['usr-aurellia-hillary', 'Aurellia Hillary'],
    ['usr-avriel-singal', 'Avriel Singal'],
    ['usr-christian-lombogia', 'Christian Lombogia'],
    ['usr-cia-worung', 'Cia Worung'],
    ['usr-david-pesoth', 'David Pesoth'],
    ['usr-diferd-wuri', 'Diferd Wuri'],
    ['usr-fladyna-mondoringin', 'Fladyna Mondoringin'],
    ['usr-gievara-bogar', 'Gievara Bogar'],
    ['usr-gracia-laura', 'Gracia Laura'],
    ['usr-hoky-theos', 'Hoky Theos'],
    ['usr-holly-kalele', 'Holly Kalele'],
    ['usr-imanuel-yimna', 'Imanuel Yimna Esau'],
    ['usr-injilia-oroh', 'Injilia Oroh'],
    ['usr-jacqson-naharia', 'Jacqson Naharia'],
    ['usr-jeconia-luwuk', 'Jeconia Luwuk'],
    ['usr-jeconia-wanget', 'Jeconia Wanget'],
    ['usr-jeremiah-mewengkang', 'Jeremiah Mewengkang'],
    ['usr-jilova-pakasi', 'Jilova Pakasi'],
    ['usr-jonathan-tintingon', 'Jonathan Tintingon'],
    ['usr-julivie-irot', 'Julivie Irot'],
    ['usr-kezia-joseph', 'Kezia Joseph'],
    ['usr-krisetia-mamoto', 'Krisetia Mamoto'],
    ['usr-lingkan-pinontoan', 'Lingkan Pinontoan'],
    ['usr-lorenzo-ricsamana', 'Lorenzo Ricsamana'],
    ['usr-lovely-pantouw', 'Lovely Pantouw'],
    ['usr-marhaen-manus', 'Marhaen Manus'],
    ['usr-marshal-maramis', 'Marshal Maramis'],
    ['usr-mega-welan', 'Mega Welan'],
    ['usr-michel-lonteng', 'Michel Lonteng'],
    ['usr-mighty-rengkung', 'Mighty Rengkung'],
    ['usr-milithya-wuisan', 'Milithya Wuisan'],
    ['usr-natalie-musak', 'Natalie Musak'],
    ['usr-nelcy-lodarmase', 'Nelcy Lodarmase'],
    ['usr-patrisha-lengkey', 'Patrisha Lengkey'],
    ['usr-prichel-kampong', 'Prichel Kampong'],
    ['usr-putri-massie', 'Putri Massie'],
    ['usr-reiner-montolalu', 'Reiner Montolalu'],
    ['usr-reywin-rengkuan', 'Reywin Rengkuan'],
    ['usr-resty-budianto', 'Resty Budianto'],
    ['usr-shanella-mondong', 'Shanella Mondong'],
    ['usr-soneta-imanuela', 'Soneta Imanuela'],
    ['usr-stefanus-tambariki', 'Stefanus Tambariki'],
    ['usr-syallomitha-mawitjere', 'Syallomitha Mawitjere'],
    ['usr-thea-sanger', 'Thea Sanger'],
    ['usr-theodore-kowaas', 'Theodore Kowaas'],
    ['usr-timothy-mewengkang', 'Timothy Mewengkang'],
    ['usr-trivena-rattu', 'Trivena Rattu'],
    ['usr-yohana-doga', 'Yohana Doga'],
    ['usr-yuen-pajow', 'Yuen Pajow'],
    ['usr-zhanon-lausan', 'Zhanon Lausan'],
  ];

  function giftForUser(id, name) {
    const lo = (name || '').toLowerCase();
    const gift = EXCEL_GIFTS[lo];
    return gift ? { top5: [gift[0]], scores: { [gift[0]]: gift[1] } } : genGifts(name);
  }

  function sqlJson(val) {
    return JSON.stringify(val).replace(/\\/g, '\\\\').replace(/'/g, "''");
  }

  function sqlId(val) {
    return String(val).replace(/'/g, "''");
  }

  const top5Cases = USERS_NEED_GIFTS.map(([id, name]) => {
    const gd = giftForUser(id, name);
    return `WHEN id = '${sqlId(id)}' THEN CAST('${sqlJson(gd.top5)}' AS JSON)`;
  }).join(' ');

  const scoresCases = USERS_NEED_GIFTS.map(([id, name]) => {
    const gd = giftForUser(id, name);
    return `WHEN id = '${sqlId(id)}' THEN CAST('${sqlJson(gd.scores)}' AS JSON)`;
  }).join(' ');

  const ids = USERS_NEED_GIFTS.map(([id]) => `'${sqlId(id)}'`).join(',');
  const sql = `UPDATE users SET gifts_top5 = CASE ${top5Cases} END, gifts_scores = CASE ${scoresCases} END, is_beyonders = 1 WHERE id IN (${ids})`;

  console.log(`[seed-gifts] Updating ${USERS_NEED_GIFTS.length} users in single query...`);
  const updated = await prisma.$executeRawUnsafe(sql);
  console.log(`[seed-gifts] Done. Rows affected: ${updated}`);
  res.json({ ok: true, updated: Number(updated), expected: USERS_NEED_GIFTS.length });
}));

// ---------- Benzarpreneurship E-commerce ----------
const VALID_CATEGORIES = ['MERCHANDISE', 'FUNDRAISING', 'DONATION'];
const VALID_ORDER_STATUSES = ['PENDING', 'PAID', 'VERIFIED', 'PROCESSING', 'READY', 'COMPLETED', 'CANCELLED'];
const VALID_SHIPPING = ['PICKUP', 'DELIVERY'];

function generateOrderCode() {
  const d = new Date();
  const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `BZP-${dateStr}-${rand}`;
}

// GET /api/benzar/products — public katalog produk
app.get('/api/benzar/products', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const { category } = req.query;
  const where = { isActive: true };
  if (category && VALID_CATEGORIES.includes(category.toUpperCase())) {
    where.category = category.toUpperCase();
  }
  const products = await prisma.product.findMany({ where, orderBy: { sortOrder: 'asc' } });
  res.json({ products });
}));

// GET /api/benzar/products/:id — detail produk
app.get('/api/benzar/products/:id', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  res.json({ product });
}));

// POST /api/benzar/products — buat produk (BZP LEAD/CO_LEAD)
app.post('/api/benzar/products', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const { name, description, price, stock, images, category, sortOrder } = req.body || {};
  if (!name || price == null || !category) {
    return res.status(400).json({ error: 'name, price, category wajib.' });
  }
  if (!VALID_CATEGORIES.includes(category.toUpperCase())) {
    return res.status(400).json({ error: `category harus salah satu dari: ${VALID_CATEGORIES.join(', ')}` });
  }
  const id = `prod-${Date.now().toString(36)}-${Math.floor(Math.random() * 999)}`;
  const product = await prisma.product.create({
    data: {
      id, name, description: description || null, price: Number(price),
      stock: Number(stock) || 0, images: images || [], category: category.toUpperCase(),
      sortOrder: Number(sortOrder) || 0, createdById: req.authUser?.id || 'unknown',
    },
  });
  res.status(201).json({ product });
}));

// PATCH /api/benzar/products/:id — update produk
app.patch('/api/benzar/products/:id', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  const { name, description, price, stock, images, category, sortOrder, isActive } = req.body || {};
  const data = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (price !== undefined) data.price = Number(price);
  if (stock !== undefined) data.stock = Number(stock);
  if (images !== undefined) data.images = images;
  if (category !== undefined) {
    if (!VALID_CATEGORIES.includes(category.toUpperCase())) {
      return res.status(400).json({ error: `category harus salah satu dari: ${VALID_CATEGORIES.join(', ')}` });
    }
    data.category = category.toUpperCase();
  }
  if (sortOrder !== undefined) data.sortOrder = Number(sortOrder);
  if (isActive !== undefined) data.isActive = Boolean(isActive);
  const product = await prisma.product.update({ where: { id: req.params.id }, data });
  res.json({ product });
}));

// DELETE /api/benzar/products/:id — soft delete
app.delete('/api/benzar/products/:id', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json({ ok: true });
}));

// POST /api/benzar/orders — buat pesanan
app.post('/api/benzar/orders', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const { items: rawItems, shipping, shippingAddr, notes } = req.body || {};
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return res.status(400).json({ error: 'items[] wajib minimal 1 produk.' });
  }
  // Validate & build order items
  const orderItems = [];
  let total = 0;
  for (const item of rawItems) {
    const product = await prisma.product.findUnique({ where: { id: item.productId } });
    if (!product || !product.isActive) {
      return res.status(400).json({ error: `Produk ${item.productId} tidak tersedia.` });
    }
    const qty = Number(item.qty) || 1;
    if (product.stock > 0 && qty > product.stock) {
      return res.status(400).json({ error: `Stok ${product.name} tidak cukup (tersisa ${product.stock}).` });
    }
    orderItems.push({ productId: product.id, qty, price: product.price, name: product.name });
    total += product.price * qty;
  }
  if (shipping && !VALID_SHIPPING.includes(shipping.toUpperCase())) {
    return res.status(400).json({ error: `shipping harus PICKUP atau DELIVERY.` });
  }
  const orderId = `ord-${Date.now().toString(36)}-${Math.floor(Math.random() * 999)}`;
  const orderCode = generateOrderCode();
  const order = await prisma.order.create({
    data: {
      id: orderId, orderCode, userId: req.authUser.id, items: orderItems, total,
      status: 'PENDING', shipping: (shipping || 'PICKUP').toUpperCase(),
      shippingAddr: shippingAddr || null, notes: notes || null,
    },
  });
  // Create order items in relation table
  for (const oi of orderItems) {
    await prisma.orderItem.create({
      data: { id: `oi-${Date.now().toString(36)}-${Math.floor(Math.random() * 999)}`, orderId: order.id, ...oi },
    });
  }
  // Deduct stock
  for (const oi of orderItems) {
    await prisma.product.update({
      where: { id: oi.productId },
      data: { stock: { decrement: oi.qty } },
    });
  }
  res.status(201).json({ order, orderCode });
}));

// GET /api/benzar/orders — list orders (BZP staff)
app.get('/api/benzar/orders', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const { status } = req.query;
  const where = {};
  if (status && VALID_ORDER_STATUSES.includes(status.toUpperCase())) {
    where.status = status.toUpperCase();
  }
  const orders = await prisma.order.findMany({
    where, orderBy: { createdAt: 'desc' }, take: 100,
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  res.json({ orders });
}));

// GET /api/benzar/orders/my — list orders milik user login
app.get('/api/benzar/orders/my', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const orders = await prisma.order.findMany({
    where: { userId: req.authUser.id }, orderBy: { createdAt: 'desc' },
  });
  res.json({ orders });
}));

// GET /api/benzar/orders/:id — detail order
app.get('/api/benzar/orders/:id', wrap(async (req, res) => {
  if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
  // Only owner or staff can view
  const isOwner = order.userId === req.authUser.id;
  const roles = (req.authUser.roles || []).map((r) => r.role);
  const isStaff = roles.includes('SUPERADMIN') || roles.includes('KOMISI') || roles.includes('COMMITTEE');
  if (!isOwner && !isStaff) return res.status(403).json({ error: 'Akses ditolak.' });
  res.json({ order });
}));

// PATCH /api/benzar/orders/:id/status — update status order (BZP staff)
app.patch('/api/benzar/orders/:id/status', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const { status } = req.body || {};
  if (!status || !VALID_ORDER_STATUSES.includes(status.toUpperCase())) {
    return res.status(400).json({ error: `status harus salah satu dari: ${VALID_ORDER_STATUSES.join(', ')}` });
  }
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
  // If cancelling, restore stock
  if (status.toUpperCase() === 'CANCELLED' && order.status !== 'CANCELLED') {
    const items = order.items;
    for (const item of items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.qty } },
      });
    }
  }
  const updated = await prisma.order.update({
    where: { id: req.params.id }, data: { status: status.toUpperCase() },
  });
  res.json({ order: updated });
}));

// GET /api/benzar/qris — return QRIS info (public)
app.get('/api/benzar/qris', wrap(async (req, res) => {
  // Static QRIS config — admin ganti di Drive, ini fallback
  res.json({
    imageUrl: process.env.QRIS_IMAGE_URL || '/Gopay QRIS.png',
    merchantName: process.env.QRIS_MERCHANT_NAME || 'GEHC Benzarpreneurship',
    merchantId: process.env.QRIS_MERCHANT_ID || '',
    bankName: process.env.QRIS_BANK_NAME || 'GoPay',
    accountNumber: process.env.QRIS_ACCOUNT_NUMBER || '',
    whatsapp: '081288646114',
    instructions: 'Scan QRIS di atas untuk melakukan pembayaran. Setelah bayar, kirim bukti transfer ke WA: 081288646114.',
  });
}));

// ---------- PENATALAYAN SCHEDULING ----------

// GET /api/penatalayan/roles — list all service roles
app.get('/api/penatalayan/roles', wrap(async (req, res) => {
  const prisma = getPrisma();
  const { division } = req.query;
  const where = { isActive: true };
  if (division) where.division = division;
  const roles = await prisma.serviceRole.findMany({ where, orderBy: { sortOrder: 'asc' } });
  res.json({ roles });
}));

// POST /api/penatalayan/roles — create service role (admin only)
app.post('/api/penatalayan/roles', requireRole('SUPERADMIN', 'KOMISI'), wrap(async (req, res) => {
  const prisma = getPrisma();
  const { name, division, description, sortOrder } = req.body;
  if (!name || !division) return res.status(400).json({ error: 'name & division wajib' });
  const id = 'sr-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const role = await prisma.serviceRole.create({ data: { id, name, division, description, sortOrder: sortOrder || 0 } });
  res.status(201).json({ role });
}));

// GET /api/penatalayan/schedules — list schedules (filter by date range)
app.get('/api/penatalayan/schedules', requireRole(), wrap(async (req, res) => {
  const prisma = getPrisma();
  const { from, to, userId, eventId } = req.query;
  const where = {};
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }
  if (userId) where.userId = userId;
  if (eventId) where.eventId = eventId;
  const schedules = await prisma.serviceSchedule.findMany({
    where,
    include: { serviceRole: true, user: { select: { id: true, name: true, email: true } } },
    orderBy: [{ date: 'asc' }, { timeStart: 'asc' }],
  });
  res.json({ schedules });
}));

// POST /api/penatalayan/schedules — create schedule (assign person to role)
app.post('/api/penatalayan/schedules', requireRole(), wrap(async (req, res) => {
  const prisma = getPrisma();
  const { serviceRoleId, userId, eventId, date, timeStart, timeEnd, notes } = req.body;
  if (!serviceRoleId || !userId || !date) return res.status(400).json({ error: 'serviceRoleId, userId, date wajib' });
  const id = 'ss-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const schedule = await prisma.serviceSchedule.create({
    data: { id, serviceRoleId, userId, eventId: eventId || null, date: new Date(date), timeStart, timeEnd, notes },
    include: { serviceRole: true, user: { select: { id: true, name: true } } },
  });
  res.status(201).json({ schedule });
}));

// PATCH /api/penatalayan/schedules/:id — update status
app.patch('/api/penatalayan/schedules/:id', requireRole(), wrap(async (req, res) => {
  const prisma = getPrisma();
  const { status, notes } = req.body;
  const data = {};
  if (status) data.status = status;
  if (notes !== undefined) data.notes = notes;
  const schedule = await prisma.serviceSchedule.update({ where: { id: req.params.id }, data, include: { serviceRole: true, user: true } });
  res.json({ schedule });
}));

// DELETE /api/penatalayan/schedules/:id — remove schedule
app.delete('/api/penatalayan/schedules/:id', requireRole(), wrap(async (req, res) => {
  const prisma = getPrisma();
  await prisma.serviceSchedule.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

// POST /api/penatalayan/schedules/bulk — bulk create for a date range (recurring ibadah)
app.post('/api/penatalayan/schedules/bulk', requireRole(), wrap(async (req, res) => {
  const prisma = getPrisma();
  const { serviceRoleId, userIds, dates, timeStart, timeEnd } = req.body;
  if (!serviceRoleId || !userIds?.length || !dates?.length) {
    return res.status(400).json({ error: 'serviceRoleId, userIds[], dates[] wajib' });
  }
  const created = [];
  for (const userId of userIds) {
    for (const dateStr of dates) {
      const id = 'ss-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const s = await prisma.serviceSchedule.create({
        data: { id, serviceRoleId, userId, date: new Date(dateStr), timeStart, timeEnd },
      });
      created.push(s);
    }
  }
  res.status(201).json({ count: created.length });
}));

// ---------- DIVISION MEETINGS & AGENDAS ----------

// GET /api/division-meetings — list meetings by division
app.get('/api/division-meetings', requireRole(), wrap(async (req, res) => {
  const prisma = getPrisma();
  const { division, status } = req.query;
  const where = {};
  if (division) where.division = division;
  if (status) where.status = status;
  const meetings = await prisma.divisionMeeting.findMany({
    where,
    include: { agendaItems: true },
    orderBy: { meetingDate: 'desc' },
  });
  res.json({ meetings });
}));

// POST /api/division-meetings — create meeting
app.post('/api/division-meetings', requireRole(), wrap(async (req, res) => {
  const prisma = getPrisma();
  const { division, meetingDate, title, agenda, attendees } = req.body;
  if (!division || !meetingDate) return res.status(400).json({ error: 'division & meetingDate wajib' });
  const id = 'dm-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const meeting = await prisma.divisionMeeting.create({
    data: {
      id, division, meetingDate: new Date(meetingDate), title,
      agenda: agenda || [], attendees: attendees || [],
    },
  });
  res.status(201).json({ meeting });
}));

// GET /api/division-meetings/:id — get meeting with agenda items
app.get('/api/division-meetings/:id', requireRole(), wrap(async (req, res) => {
  const prisma = getPrisma();
  const meeting = await prisma.divisionMeeting.findUnique({
    where: { id: req.params.id },
    include: { agendaItems: { orderBy: { createdAt: 'asc' } } },
  });
  if (!meeting) return res.status(404).json({ error: 'Meeting tidak ditemukan' });
  res.json({ meeting });
}));

// PATCH /api/division-meetings/:id — update meeting
app.patch('/api/division-meetings/:id', requireRole(), wrap(async (req, res) => {
  const prisma = getPrisma();
  const { title, agenda, attendees, notes, status } = req.body;
  const data = {};
  if (title) data.title = title;
  if (agenda) data.agenda = agenda;
  if (attendees) data.attendees = attendees;
  if (notes !== undefined) data.notes = notes;
  if (status) data.status = status;
  const meeting = await prisma.divisionMeeting.update({ where: { id: req.params.id }, data });
  res.json({ meeting });
}));

// POST /api/division-meetings/:id/agenda — add agenda item
app.post('/api/division-meetings/:id/agenda', requireRole(), wrap(async (req, res) => {
  const prisma = getPrisma();
  const { title, description, division, component, personInChargeId, deadline } = req.body;
  if (!title) return res.status(400).json({ error: 'title wajib' });
  const id = 'dai-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const item = await prisma.divisionAgendaItem.create({
    data: {
      id, meetingId: req.params.id, title, description, division: division || 'LITURGIA',
      component, personInChargeId, deadline: deadline ? new Date(deadline) : null,
    },
  });
  res.status(201).json({ item });
}));

// PATCH /api/division-meetings/agenda/:id — update agenda item status
app.patch('/api/division-meetings/agenda/:id', requireRole(), wrap(async (req, res) => {
  const prisma = getPrisma();
  const { status, personInChargeId, deadline, driveFolderId } = req.body;
  const data = {};
  if (status) data.status = status;
  if (personInChargeId !== undefined) data.personInChargeId = personInChargeId;
  if (deadline) data.deadline = new Date(deadline);
  if (driveFolderId !== undefined) data.driveFolderId = driveFolderId;
  const item = await prisma.divisionAgendaItem.update({ where: { id: req.params.id }, data });
  res.json({ item });
}));

// ---------- End Penatalayan & Division Meetings ----------

// ============================================================
// WARTA PUBLIK (Weekly Bulletin Workflow)
// ============================================================

// Status flow: DRAFT → CONTENT_READY (Didaskalia) → COPY_EDIT (Koinonia PR) → DESIGN (Marturia) → REVIEW (KOMISI) → APPROVED → PUBLISHED
const WARTA_STATUS_FLOW = ['DRAFT', 'CONTENT_READY', 'COPY_EDIT', 'DESIGN', 'REVIEW', 'APPROVED', 'PUBLISHED'];

// GET /api/warta — list warta by status or date range
app.get('/api/warta', requireRole(), wrap(async (req, res) => {
  const prisma = getPrisma();
  const { status, from, to, limit: lim } = req.query;
  const where = {};
  if (status) where.status = status;
  if (from || to) {
    where.weekDate = {};
    if (from) where.weekDate.gte = new Date(from);
    if (to) where.weekDate.lte = new Date(to);
  }
  const warta = await prisma.wartaPublik.findMany({
    where,
    orderBy: { weekDate: 'desc' },
    take: parseInt(lim) || 20,
  });
  res.json({ warta });
}));

// POST /api/warta — create new warta (DRAFT)
app.post('/api/warta', requireRole(), wrap(async (req, res) => {
  const prisma = getPrisma();
  const { weekDate, title, contentJson } = req.body;
  if (!weekDate || !title) return res.status(400).json({ error: 'weekDate & title wajib' });
  const id = 'warta-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const warta = await prisma.wartaPublik.create({
    data: {
      id, weekDate: new Date(weekDate), title,
      contentJson: contentJson || {},
      createdById: req.authUser?.id,
    },
  });
  res.status(201).json({ warta });
}));

// PATCH /api/warta/:id — update content or advance status
app.patch('/api/warta/:id', requireRole(), wrap(async (req, res) => {
  const prisma = getPrisma();
  const { status, contentJson, title, pdfUrl, pngUrl, rejectReason, driveFolderId } = req.body;
  const data = {};
  if (title) data.title = title;
  if (contentJson !== undefined) data.contentJson = contentJson;
  if (pdfUrl !== undefined) data.pdfUrl = pdfUrl;
  if (pngUrl !== undefined) data.pngUrl = pngUrl;
  if (rejectReason !== undefined) data.rejectReason = rejectReason;
  if (driveFolderId !== undefined) data.driveFolderId = driveFolderId;
  let oldStatus = null;
  if (status) {
    const current = await prisma.wartaPublik.findUnique({ where: { id: req.params.id }, select: { status: true } });
    if (!current) return res.status(404).json({ error: 'Warta tidak ditemukan' });
    oldStatus = current.status;
    const curIdx = WARTA_STATUS_FLOW.indexOf(current.status);
    const nextIdx = WARTA_STATUS_FLOW.indexOf(status);
    if (nextIdx < 0) return res.status(400).json({ error: 'Status tidak valid' });
    if (nextIdx > curIdx + 1 && status !== 'APPROVED' && status !== 'PUBLISHED') {
      return res.status(400).json({ error: 'Tidak bisa skip status kecuali APPROVED/PUBLISHED dari REVIEW' });
    }
    data.status = status;
    if (status === 'REJECTED') data.rejectReason = rejectReason || 'Ditolak';
    if (status === 'PUBLISHED') data.publishedAt = new Date();
    if (status !== 'REJECTED') data.rejectReason = null;
    data.reviewedById = req.authUser?.id;
  }
  const warta = await prisma.wartaPublik.update({ where: { id: req.params.id }, data });
  
  // Send push notification when warta is published
  if (status === 'PUBLISHED' && oldStatus !== 'PUBLISHED') {
    notifyNewWarta(prisma, warta).catch(console.error);
  }
  
  res.json({ warta });
}));

// GET /api/warta/:id — get single warta
app.get('/api/warta/:id', requireRole(), wrap(async (req, res) => {
  const prisma = getPrisma();
  const warta = await prisma.wartaPublik.findUnique({ where: { id: req.params.id } });
  if (!warta) return res.status(404).json({ error: 'Warta tidak ditemukan' });
  res.json({ warta });
}));

// PATCH /api/warta/:id — update content or advance status
app.patch('/api/warta/:id', requireRole(), wrap(async (req, res) => {
  const prisma = getPrisma();
  const { status, contentJson, title, pdfUrl, pngUrl, rejectReason, driveFolderId } = req.body;
  const data = {};
  if (title) data.title = title;
  if (contentJson !== undefined) data.contentJson = contentJson;
  if (pdfUrl !== undefined) data.pdfUrl = pdfUrl;
  if (pngUrl !== undefined) data.pngUrl = pngUrl;
  if (rejectReason !== undefined) data.rejectReason = rejectReason;
  if (driveFolderId !== undefined) data.driveFolderId = driveFolderId;
  if (status) {
    // Validate status transition
    const current = await prisma.wartaPublik.findUnique({ where: { id: req.params.id }, select: { status: true } });
    if (!current) return res.status(404).json({ error: 'Warta tidak ditemukan' });
    const curIdx = WARTA_STATUS_FLOW.indexOf(current.status);
    const nextIdx = WARTA_STATUS_FLOW.indexOf(status);
    if (nextIdx < 0) return res.status(400).json({ error: 'Status tidak valid' });
    // Allow: forward 1 step, or skip to APPROVED/PUBLISHED from REVIEW
    if (nextIdx > curIdx + 1 && status !== 'APPROVED' && status !== 'PUBLISHED') {
      return res.status(400).json({ error: 'Tidak bisa skip status kecuali APPROVED/PUBLISHED dari REVIEW' });
    }
    data.status = status;
    if (status === 'REJECTED') data.rejectReason = rejectReason || 'Ditolak';
    if (status === 'PUBLISHED') data.publishedAt = new Date();
    if (status !== 'REJECTED') data.rejectReason = null;
    data.reviewedById = req.authUser?.id;
  }
  const warta = await prisma.wartaPublik.update({ where: { id: req.params.id }, data });
  res.json({ warta });
}));

// DELETE /api/warta/:id — delete draft warta
app.delete('/api/warta/:id', requireRole(), wrap(async (req, res) => {
  const prisma = getPrisma();
  const warta = await prisma.wartaPublik.findUnique({ where: { id: req.params.id }, select: { status: true } });
  if (!warta) return res.status(404).json({ error: 'Warta tidak ditemukan' });
  if (warta.status !== 'DRAFT') return res.status(400).json({ error: 'Hanya warta DRAFT yang bisa dihapus' });
  await prisma.wartaPublik.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

// ============================================================
// EVENT GALLERY (Photo/Video Upload & Approval)
// ============================================================

// GET /api/gallery — list gallery items by event
app.get('/api/gallery', requireRole(), wrap(async (req, res) => {
  const prisma = getPrisma();
  const { eventId, division, status, approvedOnly } = req.query;
  const where = {};
  if (eventId) where.eventId = eventId;
  if (division) where.division = division;
  if (approvedOnly === '1') {
    where.status = 'APPROVED';
  } else if (status) {
    where.status = status;
  }
  const items = await prisma.eventGallery.findMany({
    where,
    orderBy: { sortOrder: 'asc' },
  });
  res.json({ items });
}));

// POST /api/gallery — upload media (creates PENDING entry)
app.post('/api/gallery', requireRole(), wrap(async (req, res) => {
  const prisma = getPrisma();
  const { eventId, title, description, mediaUrl, mediaType, thumbUrl, division, driveFileId } = req.body;
  if (!eventId || !title || !mediaUrl || !mediaType) {
    return res.status(400).json({ error: 'eventId, title, mediaUrl, mediaType wajib' });
  }
  const id = 'gal-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const item = await prisma.eventGallery.create({
    data: {
      id, eventId, title, description, mediaUrl, mediaType,
      thumbUrl, division, driveFileId,
      uploadedById: req.authUser?.id,
    },
  });
  res.status(201).json({ item });
}));

// PATCH /api/gallery/:id — approve/reject
app.patch('/api/gallery/:id', requireRole(), wrap(async (req, res) => {
  const prisma = getPrisma();
  const { status, rejectReason } = req.body;
  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'status harus APPROVED atau REJECTED' });
  }
  const oldItem = await prisma.eventGallery.findUnique({ where: { id: req.params.id }, select: { status: true } });
  if (!oldItem) return res.status(404).json({ error: 'Item tidak ditemukan' });
  
  const data = { status, approvedById: req.authUser?.id, approvedAt: new Date() };
  if (status === 'REJECTED') data.rejectReason = rejectReason || 'Ditolak';
  else data.rejectReason = null;
  const item = await prisma.eventGallery.update({ where: { id: req.params.id }, data });
  
  // Send push notification when gallery item is approved
  if (status === 'APPROVED' && oldItem.status !== 'APPROVED') {
    notifyNewGallery(prisma, item).catch(console.error);
  }
  
  res.json({ item });
}));

// DELETE /api/gallery/:id — delete gallery item
app.delete('/api/gallery/:id', requireRole(), wrap(async (req, res) => {
  const prisma = getPrisma();
  await prisma.eventGallery.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

// ============================================================
// PAW NOTIFICATIONS (Web Push / In-App)
// ============================================================

// POST /api/paw/subscribe — save notification subscription
app.post('/api/paw/subscribe', requireRole(), wrap(async (req, res) => {
  const prisma = getPrisma();
  const { endpoint, keys } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'endpoint wajib' });
  const userId = req.authUser?.id;
  if (!userId) return res.status(401).json({ error: 'User tidak ditemukan' });
  const id = 'pawsub-' + Date.now().toString(36);
  try {
    await prisma.notification.create({
      data: {
        id, memberId: userId,
        type: 'IDLE_FLAG', title: 'Push Subscription', message: JSON.stringify({ endpoint, keys }),
      },
    });
  } catch { /* skip duplicate */ }
  res.json({ ok: true });
}));

// POST /api/paw/send — send notification to user(s)
app.post('/api/paw/send', requireRole(), wrap(async (req, res) => {
  const { userId, title, message, url } = req.body;
  if (!userId || !title || !message) return res.status(400).json({ error: 'userId, title, message wajib' });
  const prisma = getPrisma();
  const id = 'paw-' + Date.now().toString(36);
  await prisma.notification.create({
    data: {
      id, memberId: userId,
      type: 'IDLE_FLAG', title, message,
    },
  });
  res.json({ ok: true, notificationId: id });
}));

// ---------- End Warta Publik & Event Gallery & PAW ----------

// ---------- End Benzarpreneurship E-commerce ----------

// ---------- Fallback ----------
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan' }));

// ---------- Frontend terintegrasi (gaya AISIGHT: 1 proses, 1 port) ----------
// DEV  : Vite middleware di-tanam ke Express → hot-reload, satu port.
// PROD : sajikan dist/ hasil `vite build`.
// API-only: set PURE_API=1 untuk mematikan penyajian frontend.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');
const serveFrontend = !process.env.PURE_API;

if (serveFrontend && process.env.NODE_ENV === 'production' && fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

let viteDev = null;
if (serveFrontend && process.env.NODE_ENV !== 'production') {
  const { createServer: createViteServer } = await import('vite');
  viteDev = await createViteServer({
    appType: 'spa',
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-dom/client'],
    },
    server: { middlewareMode: true },
  });
  app.use(viteDev.middlewares);
}

// Di Vercel serverless: jangan listen — app diekspor via api/index.mjs.
// Di lokal (npm run dev / npm run server): jalankan HTTP listener seperti biasa.
if (!process.env.VERCEL) {
  // eslint-disable-next-line no-inner-declarations
  app.listen(PORT, () => {
    const mode = process.env.NODE_ENV === 'production'
      ? 'produksi (dist/)'
      : viteDev
        ? 'development (Vite middleware — hot-reload aktif)'
        : 'API-only';
    console.log(`GEHC server berjalan di http://localhost:${PORT} [${mode}]`);
    console.log(`Google Drive mode: ${getDriveMode() ?? 'BELUM DIKONFIGURASI'}`);
    console.log(`TiDB Cloud: ${isDbConfigured() ? getDbLabel() : 'belum dikonfigurasi'}`);
    if (isDbConfigured()) {
      testDb()
        .then(() => console.log('TiDB Cloud: connected'))
        .catch((e) => console.error('TiDB Cloud: gagal connect —', e.message));
    }

    // Peringatan dini untuk developer — agar login/daftar Google tidak "diam" tanpa penjelasan
    if (!process.env.GOOGLE_CLIENT_ID) {
      console.warn('⚠️  GOOGLE_CLIENT_ID belum diisi — Login/Daftar via Google NONAKTIF.');
      console.warn('    Panduan: drive-integration.md §8 (Setup Google Auth).');
    }
    if (!process.env.SUPERADMIN_EMAILS) {
      console.warn('ℹ️  SUPERADMIN_EMAILS kosong — tidak ada email yang otomatis menjadi SUPERADMIN saat login pertama.');
    }
  });
}

export default app;
