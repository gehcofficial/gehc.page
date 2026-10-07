/**
 * Serving Week — grup WA temporer per Minggu serving (BOD Tim Kerja).
 * Siklus: DRAFT (siapkan) → OPEN (H-3, undangan disebar) → CLOSED (H+1, arsip).
 * Keluar-grup WA tetap manual di HP; sistem memberi daftar + caption + arsip.
 */

export const WEEK_STATUSES = ['DRAFT', 'OPEN', 'CLOSED'];
const NEXT = { DRAFT: ['OPEN'], OPEN: ['CLOSED', 'DRAFT'], CLOSED: [] };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WA_RE = /^https:\/\/(chat\.whatsapp\.com\/[A-Za-z0-9]+|wa\.me\/\d+|api\.whatsapp\.com\/send)/i;

export function parseWeekDate(v) {
  const s = String(v || '').slice(0, 10);
  if (!DATE_RE.test(s)) {
    const e = new Error('Tanggal tidak valid (pakai YYYY-MM-DD).');
    e.status = 400;
    throw e;
  }
  return s;
}

export function validateWaUrl(url) {
  if (url === null || url === undefined || url === '') return null;
  const s = String(url).trim().slice(0, 500);
  if (!WA_RE.test(s)) {
    const e = new Error('Link WA tidak valid (pakai https://chat.whatsapp.com/...).');
    e.status = 400;
    throw e;
  }
  return s;
}

export function canTransition(from, to) {
  return (NEXT[String(from || 'DRAFT').toUpperCase()] || []).includes(String(to || '').toUpperCase());
}

export function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    const e = new Error(`Status ${from} tidak bisa ke ${to}.`);
    e.status = 409;
    throw e;
  }
}

const asDate = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d || '').slice(0, 10));

export function serializeWeekChannel(row) {
  if (!row) return null;
  let reps = [];
  try {
    const raw = row.representativeIds ?? row.representative_ids;
    reps = Array.isArray(raw) ? raw.map(String) : typeof raw === 'string' ? JSON.parse(raw) : [];
  } catch { reps = []; }
  return {
    id: row.id,
    eventDate: asDate(row.eventDate ?? row.event_date),
    cycleIndex: row.cycleIndex ?? row.cycle_index ?? null,
    responsibleGroupId: row.responsibleGroupId ?? row.responsible_group_id ?? null,
    hostGroupId: row.hostGroupId ?? row.host_group_id ?? null,
    eventId: row.eventId ?? row.event_id ?? null,
    waUrl: row.waUrl ?? row.wa_url ?? null,
    status: row.status || 'DRAFT',
    representativeIds: reps,
    closedAt: row.closedAt ?? row.closed_at ?? null,
  };
}

const MENTOR_ROLES = ['MENTOR', 'COMENTOR'];

/**
 * userId penerima SERVING_REPS: perwakilan kanal + petugas pekan itu +
 * mentor 2 grup serving. Dipakai resolveAudience + cron.
 */
export async function resolveServingRepUserIds(prisma, eventDateISO) {
  const out = new Set();
  if (!prisma || !/^\d{4}-\d{2}-\d{2}$/.test(String(eventDateISO || ''))) return [];
  try {
    const day = new Date(`${eventDateISO}T00:00:00.000Z`);
    const channel = await prisma.servingWeekChannel.findUnique({ where: { eventDate: day } }).catch(() => null);
    let reps = [];
    try {
      const raw = channel?.representativeIds ?? channel?.representative_ids;
      reps = Array.isArray(raw) ? raw : typeof raw === 'string' ? JSON.parse(raw) : [];
    } catch { reps = []; }
    for (const id of reps) if (id) out.add(String(id));

    const invite = await buildWeekInviteList(prisma, eventDateISO);
    for (const o of invite.officers) if (o.userId) out.add(String(o.userId));
    for (const m of invite.mentors) if (m.userId) out.add(String(m.userId));
    for (const h of invite.hods) if (h.userId) out.add(String(h.userId));
  } catch { /* kosong */ }
  return [...out];
}

/**
 * Daftar undangan grup temporer: petugas pekan itu + mentor 2 grup serving
 * + HOD/perwakilan divisi pada event itu. Murni data (nama, tanpa nomor HP).
 */
export async function buildWeekInviteList(prisma, eventDateISO) {
  const dayStart = new Date(`${eventDateISO}T00:00:00.000Z`);
  const dayEnd = new Date(`${eventDateISO}T23:59:59.999Z`);
  const empty = { serving: null, officers: [], mentors: [], hods: [] };
  if (!prisma) return empty;
  try {
    const serving = await prisma.servingAssignment.findFirst({
      where: { eventDate: { gte: dayStart, lte: dayEnd } },
      include: { responsibleGroup: { select: { id: true, name: true } }, hostGroup: { select: { id: true, name: true } } },
    }).catch(() => null);
    const event = serving?.eventId
      ? await prisma.eventProgram.findUnique({ where: { id: serving.eventId }, select: { id: true, name: true } }).catch(() => null)
      : await prisma.eventProgram.findFirst({
        where: { eventDate: { gte: dayStart, lte: dayEnd }, serviceType: 'SERVING_DAY' },
        select: { id: true, name: true },
      }).catch(() => null);

    const schedWhere = event?.id
      ? { OR: [{ eventId: event.id }, { eventId: null, date: { gte: dayStart, lte: dayEnd } }] }
      : { eventId: null, date: { gte: dayStart, lte: dayEnd } };
    const duties = await prisma.serviceSchedule.findMany({
      where: { ...schedWhere, status: { not: 'CANCELLED' } },
      select: {
        userId: true,
        serviceRole: { select: { name: true, division: true } },
        user: { select: { name: true } },
      },
    }).catch(() => []);
    const officers = [];
    const seen = new Set();
    for (const d of duties) {
      const key = `${d.userId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      officers.push({
        userId: d.userId,
        name: d.user?.name || d.userId,
        component: d.serviceRole?.name || 'Petugas',
        division: d.serviceRole?.division || null,
      });
    }

    const groupIds = [serving?.responsibleGroupId, serving?.hostGroupId].filter(Boolean);
    let mentors = [];
    if (groupIds.length) {
      const mrows = await prisma.groupMember.findMany({
        where: { groupId: { in: groupIds }, status: 'ACTIVE', familyRole: { in: MENTOR_ROLES } },
        select: { userId: true, groupId: true, user: { select: { name: true } }, group: { select: { name: true } } },
      }).catch(() => []);
      mentors = mrows.map((m) => ({
        userId: m.userId,
        name: m.user?.name || m.userId,
        groupName: m.group?.name || m.groupId,
      }));
    }

    let hods = [];
    if (event?.id) {
      const leads = await prisma.eventDivisionMember.findMany({
        where: { eventDivision: { eventId: event.id }, role: { in: ['LEAD', 'CO_LEAD'] } },
        select: { userId: true, role: true, user: { select: { name: true } }, eventDivision: { select: { division: true } } },
      }).catch(() => []);
      hods = leads.map((l) => ({
        userId: l.userId,
        name: l.user?.name || l.userId,
        division: l.eventDivision?.division || null,
        role: l.role,
      }));
    }

    return {
      serving: serving
        ? {
          responsibleGroup: serving.responsibleGroup || { id: serving.responsibleGroupId },
          hostGroup: serving.hostGroup || { id: serving.hostGroupId },
          cycleIndex: serving.cycleIndex ?? null,
          event: event ? { id: event.id, name: event.name } : null,
        }
        : event ? { responsibleGroup: null, hostGroup: null, cycleIndex: null, event: { id: event.id, name: event.name } } : null,
      officers,
      mentors,
      hods,
    };
  } catch {
    return empty;
  }
}
