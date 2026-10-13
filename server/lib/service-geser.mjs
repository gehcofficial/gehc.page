/**
 * Geser sistemik: pindah ibadah dari slot Minggu (from) ke tanggal efektif (to).
 * Satu aksi → semua artefak yang sudah ter-create mengikuti:
 *  - servingAssignment.eventDate (cycleIndex tetap)
 *  - eventProgram.eventDate + startDate + rename suffix tanggal di name
 *  - contentItem (by eventId): title rename + eventDate
 *  - worshipSession.sessionDate (by eventId; slug/title tetap agar link stabil)
 *  - serviceSchedule.date (by eventId ATAU date=from, non-CANCELLED)
 *  - servingWeekChannel.eventDate (UNIQUE; ikut pindah + eventId)
 *  - dayTimelineItem.day (by eventId)
 *  - service_week_overrides GESER (slot asal → tanggal efektif)
 *  - Drive: rename folder `<nama> [EV:slug:DIV]` + arsip (best-effort, di luar transaksi)
 * Pekan materi (ministryMonthPlan grid Minggu) TIDAK pindah — tetap dari slot asal.
 * slug event, QR/WA/check-in ikut eventId sehingga tetap valid.
 */
import { wibDateOnly } from './event-venue.mjs';
import { formatSundayID, renameServiceDateSuffix } from './service-events.mjs';
import { upsertOverride } from './service-overrides.mjs';

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function toISODate(v) {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  return ISO_RE.test(s) ? s : null;
}

function dayRange(iso) {
  const day = new Date(`${iso}T00:00:00.000Z`);
  return { gte: new Date(day.getTime() - 24 * 3600 * 1000), lt: new Date(day.getTime() + 2 * 24 * 3600 * 1000) };
}

/** Pertahankan jam asli event (mis. 09:00 WIB) saat ganti tanggal. */
export function shiftInstantKeepTime(orig, toISO) {
  if (!orig) return new Date(`${toISO}T00:00:00.000Z`);
  const d = orig instanceof Date ? orig : new Date(orig);
  if (Number.isNaN(d.getTime())) return new Date(`${toISO}T00:00:00.000Z`);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return new Date(`${toISO}T${hh}:${mm}:${ss}.000Z`);
}

function sameWibDay(value, iso) {
  try {
    return wibDateOnly(value) === iso;
  } catch {
    return false;
  }
}

async function collectOnDay(prisma, iso) {
  const r = dayRange(iso);
  const [assignments, events, channel] = await Promise.all([
    prisma.servingAssignment.findMany({
      where: { eventDate: { gte: r.gte, lt: r.lt } },
      include: {
        responsibleGroup: { select: { id: true, name: true } },
        hostGroup: { select: { id: true, name: true } },
      },
    }).catch(() => []),
    prisma.eventProgram.findMany({
      where: { eventDate: { gte: r.gte, lt: r.lt } },
      select: { id: true, name: true, slug: true, serviceType: true, eventDate: true, startDate: true, status: true },
    }).catch(() => []),
    prisma.servingWeekChannel.findMany
      ? prisma.servingWeekChannel.findMany({ where: { eventDate: { gte: r.gte, lt: r.lt } } }).catch(() => [])
      : prisma.$queryRawUnsafe(
        'SELECT id, event_date AS eventDate, status, event_id AS eventId FROM serving_week_channels WHERE event_date >= ? AND event_date < ?',
        r.gte, r.lt,
      ).then((rows) => rows || []).catch(() => []),
  ]);
  return {
    assignments: (assignments || []).filter((a) => sameWibDay(a.eventDate, iso)),
    events: (events || []).filter((e) => sameWibDay(e.eventDate, iso)),
    channels: (channelsOrRows(channel) || []).filter((c) => sameWibDay(c.eventDate ?? c.event_date, iso)),
  };
}

function channelsOrRows(channel) {
  if (!channel) return [];
  if (Array.isArray(channel)) return channel;
  return [];
}

function isServingLike(e) {
  return ['SERVING_DAY', 'MENTORING_DAY'].includes(String(e.serviceType || '').toUpperCase());
}

/**
 * Rencana dry-run tanpa menulis. Return { preview, collisions, src, movingEvents }.
 * collisions berisi detail penghuni tanggal tujuan (nama, bukan cuma count).
 */
export async function planGeser(prisma, from, to) {
  const fromISO = toISODate(from);
  const toISO = toISODate(to);
  if (!fromISO) throw new Error('from wajib (YYYY-MM-DD).');
  if (!toISO) throw new Error('to wajib (YYYY-MM-DD, tanggal efektif).');
  if (fromISO === toISO) throw new Error('Tanggal geser harus berbeda dari tanggal asal.');

  const src = await collectOnDay(prisma, fromISO);
  const dst = await collectOnDay(prisma, toISO);
  const movingEvents = src.events.filter(isServingLike);
  const movingEventIds = movingEvents.map((e) => e.id);

  // Artefak pengikut (by eventId) — dihitung walau tanggalnya sudah meleset.
  let sessions = [];
  let schedules = [];
  let contents = [];
  let timeline = [];
  let divisions = [];
  if (movingEventIds.length) {
    const [s1, s2, s3, s4, s5] = await Promise.all([
      prisma.worshipSession.findMany({ where: { eventId: { in: movingEventIds } }, select: { id: true, title: true, slug: true, sessionDate: true, eventId: true } }).catch(() => []),
      prisma.serviceSchedule.findMany({ where: { eventId: { in: movingEventIds }, status: { not: 'CANCELLED' } }, select: { id: true, date: true, eventId: true, status: true } }).catch(() => []),
      prisma.contentItem.findMany({ where: { eventId: { in: movingEventIds } }, select: { id: true, title: true, eventDate: true, eventId: true } }).catch(() => []),
      prisma.dayTimelineItem.findMany({ where: { eventId: { in: movingEventIds } }, select: { id: true, day: true, eventId: true, title: true } }).catch(() => []),
      prisma.eventDivision.findMany({ where: { eventId: { in: movingEventIds } }, select: { id: true, division: true, driveFolderId: true, eventId: true } }).catch(() => []),
    ]);
    sessions = s1 || [];
    schedules = s2 || [];
    contents = s3 || [];
    timeline = s4 || [];
    divisions = s5 || [];
  }
  // Jadwal mingguan tanpa eventId (date=from) juga ikut — sumber Daftar undangan.
  let looseSchedules = [];
  try {
    const r = dayRange(fromISO);
    const rows = await prisma.serviceSchedule.findMany({
      where: { eventId: null, date: { gte: r.gte, lt: r.lt }, status: { not: 'CANCELLED' } },
      select: { id: true, date: true, eventId: true, status: true },
    }).catch(() => []);
    looseSchedules = (rows || []).filter((s) => sameWibDay(s.date, fromISO));
  } catch { looseSchedules = []; }
  const allSchedules = [...schedules, ...looseSchedules];

  // Channel sumber (by date from) — keyed UNIQUE by eventDate.
  let srcChannels = src.channels;
  try {
    if (!srcChannels.length && prisma.servingWeekChannel?.findUnique) {
      const one = await prisma.servingWeekChannel.findUnique({ where: { eventDate: new Date(`${fromISO}T00:00:00.000Z`) } }).catch(() => null);
      if (one) srcChannels = [one];
    }
  } catch { /* abaikan */ }

  const collisions = [
    ...dst.assignments.map((a) => ({ kind: 'assignment', id: a.id, label: `Jadwal idx ${a.cycleIndex ?? '?'} (${a.responsibleGroup?.name || '?'}→${a.hostGroup?.name || '?'})` })),
    ...dst.events.map((e) => ({ kind: 'event', id: e.id, label: e.name })),
    ...dst.channels.map((c) => ({ kind: 'channel', id: String(c.id ?? c.eventDate), label: `Grup WA ${toISO} (${c.status || 'DRAFT'})` })),
  ];

  const newDateLabel = formatSundayID(toISO);
  const preview = {
    from: fromISO,
    to: toISO,
    newDateLabel,
    assignments: src.assignments.map((a) => ({
      id: a.id,
      cycleIndex: a.cycleIndex,
      responsible: a.responsibleGroup?.name || null,
      host: a.hostGroup?.name || null,
    })),
    events: movingEvents.map((e) => ({
      id: e.id,
      name: e.name,
      newName: renameServiceDateSuffix(e.name, toISO),
      serviceType: e.serviceType,
      status: e.status,
    })),
    otherEventsOnDay: src.events.filter((e) => !movingEvents.some((m) => m.id === e.id)).map((e) => ({ id: e.id, name: e.name })),
    worshipSessions: sessions.map((s) => ({ id: s.id, title: s.title, slug: s.slug, eventId: s.eventId })),
    worshipSessionsFollow: sessions.length,
    schedules: allSchedules.map((s) => ({ id: s.id, eventId: s.eventId || null })),
    scheduleCount: allSchedules.length,
    channels: srcChannels.map((c) => ({ id: String(c.id ?? ''), status: c.status || 'DRAFT', eventId: c.eventId ?? c.event_id ?? null })),
    channelCount: srcChannels.length,
    contents: contents.map((c) => ({ id: c.id, title: c.title, newTitle: renameServiceDateSuffix(c.title, toISO), eventId: c.eventId })),
    contentCount: contents.length,
    timeline: timeline.map((t) => ({ id: t.id, title: t.title || null, eventId: t.eventId })),
    timelineCount: timeline.length,
    divisions: divisions.map((d) => ({ id: d.id, division: d.division, driveFolderId: d.driveFolderId || null, eventId: d.eventId })),
    driveFolderCount: divisions.filter((d) => d.driveFolderId).length,
    collisions,
    notes: [
      'Pekan materi tetap di slot Minggu asal; grup idx tetap.',
      'slug event + slug sesi tetap (QR/WA/check-in ikut eventId).',
      'Nama event + judul konten + folder Drive di-rename mengikuti tanggal efektif.',
    ],
  };
  return { preview, collisions, src, movingEvents, sessions, allSchedules, srcChannels, contents, timeline, divisions };
}

/**
 * Terapkan geser sistemik (menulis DB). Drive di-rename terpisah best-effort oleh caller.
 * Return { preview, moved, renamed }.
 */
export async function applyGeser(prisma, opts = {}) {
  const { from, to, note = null, createdById = null } = opts || {};
  const { preview, collisions, src, movingEvents, sessions, allSchedules, srcChannels, contents, timeline } = await planGeser(prisma, from, to);
  const fromISO = preview.from;
  const toISO = preview.to;
  if (collisions.length) {
    const err = new Error(`Tanggal ${toISO} sudah terisi (${collisions.length} baris: ${collisions.slice(0, 3).map((c) => c.label).join(' | ')}) — pilih tanggal lain atau kosongkan dulu.`);
    err.status = 409;
    err.preview = preview;
    throw err;
  }
  if (!src.assignments.length && !movingEvents.length && !srcChannels.length) {
    const err = new Error(`Tidak ada jadwal/event serving pada ${fromISO}.`);
    err.status = 404;
    err.preview = preview;
    throw err;
  }

  await upsertOverride(prisma, {
    eventDate: fromISO,
    condition: 'GESER',
    note: note || null,
    newEventDate: toISO,
    createdById: createdById || null,
  });

  const targetDateOnly = new Date(`${toISO}T00:00:00.000Z`);
  let movedAssignments = 0;
  let movedEvents = 0;
  let movedSessions = 0;
  let movedSchedules = 0;
  let movedChannels = 0;
  let movedContents = 0;
  let movedTimeline = 0;
  const renamed = [];

  for (const a of src.assignments) {
    await prisma.servingAssignment.update({ where: { id: a.id }, data: { eventDate: targetDateOnly } }).catch(() => null);
    movedAssignments += 1;
  }
  for (const e of movingEvents) {
    // Catat dulu sebelum update: mock/ORM bisa me-mutasi objek yang sama (alias referensi).
    const oldName = String(e.name || '');
    const newName = renameServiceDateSuffix(oldName, toISO);
    const needRename = newName !== oldName;
    const data = { eventDate: shiftInstantKeepTime(e.eventDate, toISO) };
    if (e.startDate && sameWibDay(e.startDate, fromISO)) data.startDate = shiftInstantKeepTime(e.startDate, toISO);
    if (needRename) data.name = newName.slice(0, 160);
    await prisma.eventProgram.update({ where: { id: e.id }, data }).catch(() => null);
    movedEvents += 1;
    if (needRename) renamed.push({ id: e.id, from: oldName, to: newName });
  }
  for (const s of sessions) {
    await prisma.worshipSession.update({ where: { id: s.id }, data: { sessionDate: targetDateOnly } }).catch(() => null);
    movedSessions += 1;
  }
  for (const s of allSchedules) {
    await prisma.serviceSchedule.update({ where: { id: s.id }, data: { date: targetDateOnly } }).catch(() => null);
    movedSchedules += 1;
  }
  for (const c of srcChannels) {
    if (!c.id) continue;
    try {
      await prisma.servingWeekChannel.update({ where: { id: String(c.id) }, data: { eventDate: targetDateOnly } });
      movedChannels += 1;
    } catch {
      // UNIQUE bentrok di detik terakhir — biarkan 409 keseluruhan? catat saja agar tidak setengah diam.
      const err = new Error(`Grup WA ${fromISO} gagal pindah — tanggal ${toISO} sudah punya grup WA. Kosongkan dulu.`);
      err.status = 409;
      err.preview = preview;
      throw err;
    }
  }
  // Sinkron eventId channel tujuan bila channel ikut event (opsional, best-effort).
  try {
    if (movingEvents[0] && movedChannels) {
      await prisma.servingWeekChannel.updateMany({
        where: { eventDate: targetDateOnly },
        data: { eventId: movingEvents[0].id },
      }).catch(() => null);
    }
  } catch { /* abaikan */ }
  for (const c of contents) {
    const oldTitle = String(c.title || '');
    const newTitle = renameServiceDateSuffix(oldTitle, toISO);
    const needRename = newTitle !== oldTitle;
    const data = {};
    if (needRename) data.title = newTitle.slice(0, 255);
    if (c.eventDate && sameWibDay(c.eventDate, fromISO)) data.eventDate = targetDateOnly;
    if (Object.keys(data).length) await prisma.contentItem.update({ where: { id: c.id }, data }).catch(() => null);
    movedContents += 1;
    if (needRename) renamed.push({ id: c.id, from: oldTitle, to: newTitle });
  }
  for (const t of timeline) {
    await prisma.dayTimelineItem.update({ where: { id: t.id }, data: { day: targetDateOnly } }).catch(() => null);
    movedTimeline += 1;
  }

  return {
    preview,
    moved: {
      assignments: movedAssignments,
      events: movedEvents,
      sessions: movedSessions,
      schedules: movedSchedules,
      channels: movedChannels,
      contents: movedContents,
      timeline: movedTimeline,
    },
    renamed,
  };
}
