import { getPrisma } from '../db.mjs';
import { findEventProgramPublic } from '../lib/event-program-public.mjs';

/**
 * GET /api/events/:id/attendance-by-group?groupId=xxx
 * Sinkron pendaftar event (waiting_pool sourceEvent + event_attendees + event_check_ins) ke absensi kelompok.
 * Return per groupMember: suggested HADIR jika terdata di event, else null (manual).
 * Opsional menimpa (overwrite) di FE — BE hanya suggest.
 */
export function registerEventAttendanceSyncRoutes(app, { wrap }) {
  app.get('/api/events/:id/attendance-by-group', wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });

    const rawId = String(req.params.id || '').trim();
    const groupId = String(req.query?.groupId || '').trim();
    if (!rawId) return res.status(400).json({ error: 'event id wajib.' });
    if (!groupId) return res.status(400).json({ error: 'groupId wajib.' });

    let event = null;
    try {
      event = await findEventProgramPublic(prisma, { id: rawId });
      if (!event) event = await findEventProgramPublic(prisma, { slug: rawId });
    } catch {}
    if (!event) return res.status(404).json({ error: 'Event tidak ditemukan.' });

    // Gate INTERNAL hanya staf
    const kindNorm = String(event.kind || '').toUpperCase() === 'RECURRING' ? 'REKREASIONAL' : String(event.kind || '').toUpperCase();
    if (kindNorm === 'INTERNAL') {
      const roles = (req.authUser?.roles || []).map((r) => r.role);
      const isPriv = roles.includes('SUPERADMIN') || roles.includes('KOMISI') || roles.includes('COMMITTEE') || roles.includes('BPMJ');
      if (!isPriv) return res.status(403).json({ error: 'Event Internal hanya untuk staf.' });
    }

    let members = [];
    try {
      const gMembers = await prisma.groupMember.findMany({ where: { groupId }, select: { id: true, userId: true, name: true, familyRole: true } });
      members = gMembers;
    } catch {
      try {
        const alt = await prisma.recreationalMembership.findMany({ where: { groupId }, include: { user: { select: { id: true, name: true } } } });
        members = alt.map((m) => ({ id: m.id, userId: m.userId, name: m.user?.name || '', familyRole: null }));
      } catch {}
    }
    if (!members.length) {
      // still allow empty group
      return res.json({ eventId: event.id, groupId, members: [], suggestions: [], sourceEvent: event.name });
    }

    const sourceEvent = String(event.name || '').trim();
    const userIds = members.map((m) => m.userId).filter(Boolean);

    // Collect pendaftar event: waiting_pool sourceEvent, event_attendees, event_check_ins
    let poolUserIds = new Set();
    let attendeeUserIds = new Set();
    let checkInUserIds = new Set();
    try {
      if (sourceEvent && userIds.length) {
        const pools = await prisma.waitingPool.findMany({ where: { sourceEvent, userId: { in: userIds } }, select: { userId: true } });
        poolUserIds = new Set(pools.map((p) => p.userId).filter(Boolean));
      }
    } catch {}
    try {
      if (userIds.length) {
        const atts = await prisma.eventAttendee.findMany({ where: { eventId: event.id, userId: { in: userIds } }, select: { userId: true } });
        attendeeUserIds = new Set(atts.map((a) => a.userId).filter(Boolean));
      }
    } catch {}
    try {
      if (userIds.length) {
        const checks = await prisma.eventCheckIn.findMany({ where: { eventId: event.id, userId: { in: userIds } }, select: { userId: true, result: true } });
        checkInUserIds = new Set(checks.filter((c) => ['OK', 'WALK_IN', 'DUPLICATE'].includes(String(c.result).toUpperCase())).map((c) => c.userId).filter(Boolean));
      }
    } catch {}

    const suggestions = members.map((m) => {
      const uid = m.userId;
      if (!uid) return { groupMemberId: m.id, name: m.name, suggested: null, reason: 'no_user' };
      const hasPool = poolUserIds.has(uid);
      const hasAtt = attendeeUserIds.has(uid);
      const hasCheck = checkInUserIds.has(uid);
      if (hasCheck || hasAtt || hasPool) return { groupMemberId: m.id, userId: uid, name: m.name, suggested: 'HADIR', source: hasCheck ? 'check_in' : hasAtt ? 'attendee' : 'waiting_pool' };
      return { groupMemberId: m.id, userId: uid, name: m.name, suggested: null, source: null };
    });

    res.json({
      eventId: event.id,
      eventName: event.name,
      sourceEvent,
      groupId,
      members: members.map((m) => ({ id: m.id, userId: m.userId, name: m.name, familyRole: m.familyRole })),
      suggestions,
      counts: {
        total: members.length,
        hadirSuggested: suggestions.filter((s) => s.suggested === 'HADIR').length,
        needManual: suggestions.filter((s) => !s.suggested).length,
      },
    });
  }));
}
