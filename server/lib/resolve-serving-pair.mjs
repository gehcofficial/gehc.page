/**
 * Resolver read-only: pasangan penanggung/tuan rumah untuk satu pekan serving.
 */
import { listOverrides, effectiveDate, originDateFor } from './service-overrides.mjs';
import { parsePenatalayanGroups } from './event-groups.mjs';
import { resolvePairIdsDb } from './serving-cycle.mjs';
import { expectedCycleIndexForServingSunday } from './serving-week-expectations.mjs';

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function assignmentLookupDates(gridDateISO, overridesMap) {
  if (!ISO_RE.test(String(gridDateISO || '').slice(0, 10))) return [];
  const dates = new Set([String(gridDateISO).slice(0, 10)]);
  const eff = effectiveDate(gridDateISO, overridesMap);
  if (eff) dates.add(eff);
  const origin = originDateFor(gridDateISO, overridesMap);
  if (origin) dates.add(origin);
  if (overridesMap instanceof Map) {
    for (const [originKey, ov] of overridesMap) {
      if (String(ov?.condition || '').toUpperCase() === 'GESER' && ov.newEventDate === gridDateISO) {
        dates.add(originKey);
      }
    }
  }
  return [...dates].filter((d) => ISO_RE.test(d));
}

async function loadGroupsByIds(prisma, ids) {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return new Map();
  const rows = await prisma.group.findMany({ where: { id: { in: uniq } }, select: { id: true, name: true } }).catch(() => []);
  return new Map(rows.map((g) => [g.id, g]));
}

function emptyPair(gridDate, lookupDates = [], warnings = []) {
  return {
    gridDate,
    lookupDates,
    responsibleGroupId: null,
    hostGroupId: null,
    responsibleGroup: null,
    hostGroup: null,
    cycleIndex: null,
    event: null,
    source: 'none',
    warnings,
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ gridDate: string, eventId?: string|null, linkHostGroupId?: string|null, linkResponsibleGroupId?: string|null }} input
 */
export async function resolveServingPairForWeek(prisma, input) {
  const gridDate = String(input?.gridDate || '').slice(0, 10);
  const warnings = [];
  if (!prisma || !ISO_RE.test(gridDate)) {
    warnings.push('gridDate tidak valid');
    return emptyPair(gridDate, [], warnings);
  }

  const anchor = new Date(`${gridDate}T00:00:00.000Z`);
  const ovFrom = new Date(anchor);
  ovFrom.setUTCDate(ovFrom.getUTCDate() - 21);
  const ovTo = new Date(anchor);
  ovTo.setUTCDate(ovTo.getUTCDate() + 21);
  const overrides = await listOverrides(
    prisma,
    ovFrom.toISOString().slice(0, 10),
    ovTo.toISOString().slice(0, 10),
  ).catch(() => new Map());
  const lookupDates = assignmentLookupDates(gridDate, overrides);

  for (const iso of lookupDates) {
    const dayStart = new Date(`${iso}T00:00:00.000Z`);
    const dayEnd = new Date(`${iso}T23:59:59.999Z`);
    const row = await prisma.servingAssignment.findFirst({
      where: { eventDate: { gte: dayStart, lte: dayEnd } },
      include: {
        responsibleGroup: { select: { id: true, name: true } },
        hostGroup: { select: { id: true, name: true } },
        event: { select: { id: true, name: true } },
      },
    }).catch(() => null);
    if (row?.hostGroupId && row?.responsibleGroupId) {
      return {
        gridDate,
        lookupDates,
        responsibleGroupId: row.responsibleGroupId,
        hostGroupId: row.hostGroupId,
        responsibleGroup: row.responsibleGroup || { id: row.responsibleGroupId, name: row.responsibleGroupId },
        hostGroup: row.hostGroup || { id: row.hostGroupId, name: row.hostGroupId },
        cycleIndex: row.cycleIndex ?? null,
        event: row.event ? { id: row.event.id, name: row.event.name } : null,
        source: 'assignment',
        warnings,
      };
    }
  }

  const expectedIdx = await expectedCycleIndexForServingSunday(prisma, gridDate).catch(() => null);
  if (expectedIdx != null) {
    const groups = await prisma.group.findMany({ select: { id: true, name: true } }).catch(() => []);
    const pair = await resolvePairIdsDb(prisma, expectedIdx, groups);
    if (pair.responsibleGroupId && pair.hostGroupId) {
      const byId = await loadGroupsByIds(prisma, [pair.responsibleGroupId, pair.hostGroupId]);
      let event = null;
      if (input.eventId) {
        event = await prisma.eventProgram.findUnique({
          where: { id: String(input.eventId) },
          select: { id: true, name: true },
        }).catch(() => null);
      }
      if (!event) {
        const dayStart = new Date(`${gridDate}T00:00:00.000Z`);
        const dayEnd = new Date(`${gridDate}T23:59:59.999Z`);
        event = await prisma.eventProgram.findFirst({
          where: { eventDate: { gte: dayStart, lte: dayEnd }, serviceType: 'SERVING_DAY' },
          select: { id: true, name: true },
        }).catch(() => null);
      }
      return {
        gridDate,
        lookupDates,
        responsibleGroupId: pair.responsibleGroupId,
        hostGroupId: pair.hostGroupId,
        responsibleGroup: byId.get(pair.responsibleGroupId) || { id: pair.responsibleGroupId, name: pair.responsibleName },
        hostGroup: byId.get(pair.hostGroupId) || { id: pair.hostGroupId, name: pair.hostName },
        cycleIndex: expectedIdx,
        event: event ? { id: event.id, name: event.name } : null,
        source: 'expected',
        warnings,
      };
    }
    warnings.push('expected cycle index tanpa pasangan grup di DB');
  }

  const eventId = input.eventId ? String(input.eventId) : null;
  if (eventId) {
    const ev = await prisma.eventProgram.findUnique({
      where: { id: eventId },
      select: { id: true, name: true, metadata: true },
    }).catch(() => null);
    const pg = parsePenatalayanGroups(ev?.metadata);
    if (pg?.hostGroupId && pg?.responsibleGroupId) {
      const byId = await loadGroupsByIds(prisma, [pg.responsibleGroupId, pg.hostGroupId]);
      return {
        gridDate,
        lookupDates,
        responsibleGroupId: pg.responsibleGroupId,
        hostGroupId: pg.hostGroupId,
        responsibleGroup: byId.get(pg.responsibleGroupId) || null,
        hostGroup: byId.get(pg.hostGroupId) || null,
        cycleIndex: null,
        event: ev ? { id: ev.id, name: ev.name } : null,
        source: 'metadata',
        warnings,
      };
    }
  }

  if (input.linkHostGroupId && input.linkResponsibleGroupId) {
    const byId = await loadGroupsByIds(prisma, [input.linkResponsibleGroupId, input.linkHostGroupId]);
    return {
      gridDate,
      lookupDates,
      responsibleGroupId: input.linkResponsibleGroupId,
      hostGroupId: input.linkHostGroupId,
      responsibleGroup: byId.get(input.linkResponsibleGroupId) || null,
      hostGroup: byId.get(input.linkHostGroupId) || null,
      cycleIndex: null,
      event: null,
      source: 'link',
      warnings,
    };
  }

  warnings.push('Tidak ada assignment, expected, metadata, atau link');
  return emptyPair(gridDate, lookupDates, warnings);
}

/** Grup penanggung/tuan rumah untuk event — metadata override atau rotasi expected. */
export async function resolvePenatalayanGroupsForEvent(prisma, event) {
  if (!prisma || !event) return null;
  const day = event.eventDate ? new Date(event.eventDate).toISOString().slice(0, 10) : null;
  if (!day) return parsePenatalayanGroups(event.metadata);
  const pair = await resolveServingPairForWeek(prisma, { gridDate: day, eventId: event.id });
  if (!pair?.responsibleGroupId || !pair?.hostGroupId) return parsePenatalayanGroups(event.metadata);
  return {
    responsibleGroupId: pair.responsibleGroupId,
    hostGroupId: pair.hostGroupId,
    responsibleGroupName: pair.responsibleGroup?.name || null,
    hostGroupName: pair.hostGroup?.name || null,
    source: pair.source,
  };
}

export function pairNamesForCaption(resolved) {
  return {
    responsibleGroup: resolved?.responsibleGroup?.name || null,
    hostGroup: resolved?.hostGroup?.name || null,
    source: resolved?.source || 'none',
    warnings: resolved?.warnings || [],
  };
}
