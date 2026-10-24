/**
 * Teks Utama & tema pekan Didaskalia untuk layar Start Sesi Creative Lab.
 */
import { listOverrides } from './service-overrides.mjs';
import { sundaysInMonth } from './church-year.mjs';

function dayOnly(v) {
  const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function yearMonthWib(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const wib = new Date(d.getTime() + 7 * 3600 * 1000);
  return `${wib.getUTCFullYear()}-${String(wib.getUTCMonth() + 1).padStart(2, '0')}`;
}

function originDateForEvent(dayIso, overrides) {
  const base = dayOnly(dayIso);
  if (!base || !Array.isArray(overrides)) return base;
  for (const ov of overrides) {
    const origin = dayOnly(ov?.eventDate);
    if (String(ov?.condition || '').toUpperCase() === 'GESER'
      && dayOnly(ov?.newEventDate) === base
      && origin && origin !== base) return origin;
  }
  return base;
}

function weekIndexForDateWib(iso) {
  const ym = yearMonthWib(iso);
  if (!ym) return 1;
  const d = new Date(iso);
  const wib = new Date(d.getTime() + 7 * 3600 * 1000);
  const day = wib.getUTCDate();
  const [y, m] = ym.split('-').map(Number);
  const sundays = sundaysInMonth(y, m).map((s) => s.getUTCDate());
  if (!sundays.length) return 1;
  if (day < sundays[0]) return 1;
  for (let i = sundays.length - 1; i >= 0; i -= 1) {
    if (day >= sundays[i]) return i + 1;
  }
  return 1;
}

function weekForEventDate(iso, overrides) {
  const day = dayOnly(iso);
  if (!day) return { ym: '', weekIndex: 1 };
  const origin = originDateForEvent(day, overrides) || day;
  const probe = /T/.test(String(iso || '')) ? `${origin}${String(iso).slice(10)}` : origin;
  return { ym: yearMonthWib(probe), weekIndex: weekIndexForDateWib(probe) };
}

function readWeeks(plan) {
  return Array.isArray(plan?.weeks) ? plan.weeks : [];
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ eventId?: string|null, sessionDate?: Date|string|null }} session
 */
export async function studioContextForCreativeLabSession(prisma, session) {
  if (!prisma || !session) return null;
  let event = null;
  if (session.eventId) {
    event = await prisma.eventProgram.findUnique({
      where: { id: String(session.eventId) },
      select: { id: true, eventDate: true, name: true },
    }).catch(() => null);
  }
  const rawDay = event?.eventDate
    ? new Date(event.eventDate).toISOString()
    : (session.sessionDate ? new Date(session.sessionDate).toISOString() : '');
  const day = dayOnly(rawDay);
  if (!day) return null;
  const overrides = await listOverrides(prisma, day, day).catch(() => new Map());
  const ovList = [...overrides.entries()].map(([eventDate, o]) => ({ eventDate, ...o }));
  const { ym, weekIndex } = weekForEventDate(rawDay, ovList);
  if (!ym || !weekIndex) return null;
  const plan = await prisma.ministryMonthPlan.findUnique({ where: { yearMonth: ym } }).catch(() => null);
  const week = readWeeks(plan).find((w) => Number(w?.index) === weekIndex);
  const studio = week?.studio && typeof week.studio === 'object' ? week.studio : {};
  const sermon = studio.sermon && typeof studio.sermon === 'object' ? studio.sermon : {};
  const tu = sermon.teksUtama && typeof sermon.teksUtama === 'object' ? sermon.teksUtama : {};
  return {
    themeTitle: String(week?.servingTheme || week?.mentoringTheme || week?.theme || event?.name || '').trim(),
    teksUtamaRef: String(tu.ref || '').trim(),
    teksUtamaText: String(tu.text || '').trim(),
    yearMonth: ym,
    weekIndex,
  };
}

export async function mergeStudioIntoLabBrief(prisma, session, brief) {
  const base = brief && typeof brief === 'object' ? brief : {};
  const ctx = await studioContextForCreativeLabSession(prisma, session);
  if (!ctx) return base;
  return {
    ...base,
    firmanTitle: base.firmanTitle || ctx.themeTitle || base.firmanTitle,
    teksUtamaRef: ctx.teksUtamaRef || base.teksUtamaRef || '',
    teksUtamaText: ctx.teksUtamaText || base.teksUtamaText || '',
  };
}
