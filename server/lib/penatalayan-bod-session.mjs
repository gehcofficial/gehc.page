/**
 * Susun papan slot penatalayan untuk tautan BOD (read model).
 */
import { rolesForPattern, catalogEntry, resolveRoleKey } from './serving-role-catalog.mjs';
import { computeSlotStatus, effectiveScheduleStatus, slotStatusLabel } from './penatalayan-slot-status.mjs';

export function inferEventEndAt(event) {
  if (!event?.eventDate) return null;
  const start = new Date(event.eventDate);
  if (Number.isNaN(start.getTime())) return null;
  const meta = event.metadata && typeof event.metadata === 'object' ? event.metadata : {};
  const durationMin = Number(meta.durationMin) > 0 ? Number(meta.durationMin) : 120;
  return new Date(start.getTime() + durationMin * 60 * 1000);
}

/**
 * @param {object} opts
 * @param {string} opts.patternCode
 * @param {Array} opts.roles - service_roles rows with roleKey
 * @param {Array} opts.schedules
 * @param {Array} opts.requests
 * @param {Date|null} opts.eventEndAt
 */
export function buildSlotBoard({ patternCode, roles, schedules, requests, eventEndAt }) {
  const patternRoles = rolesForPattern(patternCode);
  const roleByKey = new Map();
  for (const r of roles || []) {
    const key = r.roleKey || resolveRoleKey(r.name);
    if (key) roleByKey.set(key, r);
  }
  const schedByRoleId = new Map();
  for (const s of schedules || []) {
    const rid = String(s.serviceRoleId || s.serviceRole?.id || '');
    if (!rid) continue;
    const st = String(s.status || '').toUpperCase();
    if (st === 'CANCELLED') continue;
    if (!schedByRoleId.has(rid)) schedByRoleId.set(rid, s);
  }
  const reqByRoleId = new Map();
  for (const q of requests || []) {
    if (String(q.status || '').toUpperCase() !== 'PENDING') continue;
    const rid = String(q.serviceRoleId || '');
    if (!reqByRoleId.has(rid)) reqByRoleId.set(rid, q);
  }

  let lastSegment = '';
  const slots = [];
  for (const pr of patternRoles) {
    const cat = catalogEntry(pr.roleKey);
    const dbRole = roleByKey.get(pr.roleKey);
    const schedule = dbRole ? schedByRoleId.get(String(dbRole.id)) : null;
    const pendingRequest = dbRole ? reqByRoleId.get(String(dbRole.id)) : null;
    const slotStatus = computeSlotStatus({ schedule, pendingRequest, eventEndAt });
    const eff = schedule ? effectiveScheduleStatus(schedule, eventEndAt) : null;
    if (pr.segment !== lastSegment) lastSegment = pr.segment;
    slots.push({
      roleKey: pr.roleKey,
      serviceRoleId: dbRole?.id || null,
      segment: pr.segment,
      name: pr.name,
      division: pr.division,
      optional: pr.optional,
      note: pr.note || '',
      slotStatus,
      slotStatusLabel: slotStatusLabel(slotStatus),
      scheduleId: schedule?.id || null,
      scheduleStatus: eff,
      userId: schedule?.userId || null,
      userName: schedule?.user?.name || schedule?.userName || null,
      requestId: pendingRequest?.id || null,
    });
  }
  return slots;
}

export function progressFromSlots(slots) {
  const required = (slots || []).filter((s) => !s.optional);
  const filled = required.filter((s) => s.slotStatus !== 'KOSONG' && s.slotStatus !== 'MINTA_DIVISI');
  const total = required.length || 1;
  return {
    required: required.length,
    filled: filled.length,
    percent: Math.round((filled.length / total) * 100),
  };
}
