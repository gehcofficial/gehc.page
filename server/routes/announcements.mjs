import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { senderCapabilities, resolveAudience, sendNotification, NOTIFY_CATEGORIES } from '../lib/notify.mjs';

const SENDERS = ['SUPERADMIN', 'KOMISI', 'BPMJ', 'COMMITTEE', 'MENTOR', 'CO_MENTOR'];
const AUDIENCE_TYPES = ['PUBLIC', 'ROLE', 'DIVISION', 'GROUP', 'USER'];
const ROLES = ['MENTOR', 'CO_MENTOR', 'MENTEE', 'COMMITTEE', 'KOMISI', 'BPMJ', 'ALUMNI'];

function genId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function capsFor(prisma, req) {
  let division = null;
  if ((req.authUser?.roles || []).some((r) => r.role === 'COMMITTEE')) {
    const sm = await prisma.strukturMember.findFirst({ where: { email: req.authUser.email || '' } }).catch(() => null);
    division = sm?.division || null;
  }
  return senderCapabilities(req.authUser, division);
}

async function senderGroupIds(prisma, userId) {
  const [ra, gm] = await Promise.all([
    prisma.roleAssignment.findMany({ where: { userId, isActive: true, groupId: { not: null } }, select: { groupId: true } }).catch(() => []),
    prisma.groupMember.findMany({ where: { userId }, select: { groupId: true } }).catch(() => []),
  ]);
  return [...new Set([...ra.map((r) => r.groupId), ...gm.map((r) => r.groupId)].filter(Boolean))];
}

function buildAudience(body) {
  const type = String(body.audienceType || '').toUpperCase();
  if (type === 'PUBLIC') return { type };
  if (type === 'ROLE') return { type, roles: body.audienceRoles };
  if (type === 'DIVISION') return { type, divisions: body.audienceDivisions };
  if (type === 'GROUP') return { type, groupIds: body.audienceGroupIds };
  if (type === 'USER') return { type, userIds: body.audienceUserIds };
  return { type };
}

function idsOf(value) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

export function registerAnnouncementRoutes(app, { wrap }) {
  // Kapabilitas pengirim untuk UI (audiens & kategori yang boleh).
  app.get('/api/announcements/capabilities', requireRole(...SENDERS), wrap(async (req, res) => {
    const prisma = getPrisma();
    const caps = await capsFor(prisma, req);
    const groups = await senderGroupIds(prisma, req.authUser.id);
    res.json({ role: caps.role, audiences: caps.audiences, categories: caps.categories, scopeDivision: caps.scopeDivision, isBod: caps.isBod, groupIds: groups });
  }));

  app.get('/api/announcements', requireRole(...SENDERS), wrap(async (req, res) => {
    const prisma = getPrisma();
    const caps = await capsFor(prisma, req);
    const where = caps.isBod || caps.role === 'KOMISI' ? {} : { senderId: req.authUser.id };
    const rows = await prisma.announcement.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({ announcements: rows });
  }));

  app.post('/api/announcements', requireRole(...SENDERS), wrap(async (req, res) => {
    const prisma = getPrisma();
    const caps = await capsFor(prisma, req);
    const body = req.body || {};
    const title = String(body.title || '').trim();
    const message = String(body.message || '').trim();
    const category = String(body.category || 'announcement').toLowerCase();
    const priority = ['INFO', 'TASK', 'URGENT'].includes(String(body.priority || '').toUpperCase()) ? String(body.priority).toUpperCase() : 'INFO';
    const audience = buildAudience(body);

    if (!title) return res.status(400).json({ error: 'Judul wajib.' });
    if (!AUDIENCE_TYPES.includes(audience.type)) return res.status(400).json({ error: 'audienceType tidak valid.' });
    if (!caps.audiences.includes(audience.type)) return res.status(403).json({ error: `Peran ${caps.role} tidak boleh mengirim ke ${audience.type}.` });
    if (!NOTIFY_CATEGORIES.includes(category)) return res.status(400).json({ error: 'Kategori tidak valid.' });
    if (!caps.categories.includes(category)) return res.status(403).json({ error: `Peran ${caps.role} tidak boleh mengirim kategori ${category}.` });

    // Scope: PIC/mentor dibatasi.
    if (audience.type === 'ROLE') {
      const roles = idsOf(audience.roles);
      if (!roles.length || roles.some((r) => !ROLES.includes(r))) return res.status(400).json({ error: 'audienceRoles tidak valid.' });
    }
    if (audience.type === 'DIVISION') {
      const divisions = idsOf(audience.divisions);
      if (!divisions.length) return res.status(400).json({ error: 'audienceDivisions wajib.' });
      if (caps.scopeDivision && divisions.some((d) => String(d).toUpperCase() !== caps.scopeDivision)) {
        return res.status(403).json({ error: `Hanya boleh mengirim ke divisi ${caps.scopeDivision}.` });
      }
    }
    if (audience.type === 'GROUP') {
      const groupIds = idsOf(audience.groupIds);
      if (!groupIds.length) return res.status(400).json({ error: 'audienceGroupIds wajib.' });
      if (!caps.isBod && caps.role !== 'KOMISI') {
        const own = new Set(await senderGroupIds(prisma, req.authUser.id));
        if (groupIds.some((g) => !own.has(g))) return res.status(403).json({ error: 'Hanya boleh mengirim ke kelompok Anda.' });
      }
    }
    if (audience.type === 'USER') {
      const userIds = idsOf(audience.userIds);
      if (!userIds.length) return res.status(400).json({ error: 'audienceUserIds wajib.' });
      if (!caps.isBod && caps.role !== 'KOMISI') {
        const ownGroups = await senderGroupIds(prisma, req.authUser.id);
        const pool = new Set([
          ...(ownGroups.length ? await resolveAudience(prisma, { type: 'GROUP', groupIds: ownGroups }) : []),
          ...(caps.scopeDivision ? await resolveAudience(prisma, { type: 'DIVISION', divisions: [caps.scopeDivision] }) : []),
        ]);
        if (userIds.some((id) => !pool.has(id))) return res.status(403).json({ error: 'Ada penerima di luar jangkauan Anda.' });
      }
    }

    if (audience.type !== 'PUBLIC') {
      const resolved = await resolveAudience(prisma, audience);
      if (!resolved.length) return res.status(400).json({ error: 'Tidak ada penerima yang cocok dengan audiens.' });
    }

    const publishAt = body.publishAt ? new Date(body.publishAt) : new Date();
    if (Number.isNaN(publishAt.getTime())) return res.status(400).json({ error: 'publishAt tidak valid.' });
    const sendNow = publishAt.getTime() <= Date.now() + 1000;

    const id = genId('ann');
    const data = {
      id,
      title,
      message: message || null,
      href: body.href ? String(body.href).slice(0, 300) : null,
      senderId: req.authUser.id,
      senderRole: caps.role,
      audienceType: audience.type,
      audienceRoles: audience.roles || null,
      audienceDivisions: audience.divisions || null,
      audienceGroupIds: audience.groupIds || null,
      audienceUserIds: audience.userIds || null,
      category,
      priority,
      publishAt,
      status: sendNow ? 'SENT' : 'SCHEDULED',
      createdById: req.authUser.id,
    };

    let result = { count: 0, pushed: 0 };
    if (sendNow) {
      result = await sendNotification({
        type: 'ANNOUNCEMENT',
        category,
        title,
        message,
        href: data.href,
        senderRole: caps.role,
        audience,
        priority,
        announcementId: id,
      });
      data.sentAt = new Date();
      data.sentCount = result.count;
    }
    const announcement = await prisma.announcement.create({ data });
    res.status(201).json({ ok: true, announcement, sent: result.count, pushed: result.pushed });
  }));

  app.post('/api/announcements/:id/send', requireRole(...SENDERS), wrap(async (req, res) => {
    const prisma = getPrisma();
    const caps = await capsFor(prisma, req);
    const ann = await prisma.announcement.findUnique({ where: { id: req.params.id } });
    if (!ann) return res.status(404).json({ error: 'Pengumuman tidak ditemukan.' });
    if (!caps.isBod && ann.senderId !== req.authUser.id) return res.status(403).json({ error: 'Bukan pengumuman Anda.' });
    if (ann.status === 'SENT') return res.status(400).json({ error: 'Sudah terkirim.' });
    const audience = {
      type: ann.audienceType,
      roles: ann.audienceRoles,
      divisions: ann.audienceDivisions,
      groupIds: ann.audienceGroupIds,
      userIds: ann.audienceUserIds,
    };
    const result = await sendNotification({
      type: 'ANNOUNCEMENT',
      category: ann.category,
      title: ann.title,
      message: ann.message || '',
      href: ann.href,
      senderRole: ann.senderRole,
      audience,
      priority: ann.priority,
      announcementId: ann.id,
    });
    const updated = await prisma.announcement.update({
      where: { id: ann.id },
      data: { status: 'SENT', sentAt: new Date(), sentCount: result.count },
    });
    res.json({ ok: true, announcement: updated, sent: result.count, pushed: result.pushed });
  }));

  app.delete('/api/announcements/:id', requireRole(...SENDERS), wrap(async (req, res) => {
    const prisma = getPrisma();
    const caps = await capsFor(prisma, req);
    const ann = await prisma.announcement.findUnique({ where: { id: req.params.id } });
    if (!ann) return res.status(404).json({ error: 'Pengumuman tidak ditemukan.' });
    if (!caps.isBod && ann.senderId !== req.authUser.id) return res.status(403).json({ error: 'Bukan pengumuman Anda.' });
    await prisma.announcement.update({ where: { id: ann.id }, data: { status: 'ARCHIVED' } });
    res.json({ ok: true });
  }));
}
