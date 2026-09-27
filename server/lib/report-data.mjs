/**
 * P8 — Agregasi data laporan (dipakai endpoint JSON & PDF). Murni terhadap Prisma.
 */
import { parsePeriod } from './report-period.mjs';
import { accountBalance } from './church-p1.mjs';

const periodInfo = (p) => ({ key: p.key, label: p.label, type: p.type });
const safe = (q, fb) => q.catch(() => fb);

export const UNIT_LABEL = {
  JEMAAT: 'Jemaat', PEMUDA: 'Pemuda', REMAJA: 'Remaja', ANAK: 'Anak', BAPAK: 'Kaum Bapa', IBU: 'Kaum Ibu',
  KOLOM: 'Kolom', KOMUNITAS: 'Komunitas', PEMBANGUNAN: 'Departemen Pembangunan', THL: 'THL', TECHTEAM: 'Tim Tech', PANJI: 'Panji Yosua',
};
export const UNIT_TENANT = {
  JEMAAT: 'tenant-jemaat', PEMUDA: 'tenant-youth', REMAJA: 'tenant-teen', ANAK: 'tenant-kids',
  BAPAK: 'tenant-men', IBU: 'tenant-women', KOLOM: 'tenant-districts', KOMUNITAS: 'tenant-community',
  PEMBANGUNAN: 'tenant-jemaat', THL: 'tenant-jemaat', TECHTEAM: 'tenant-jemaat', PANJI: 'tenant-jemaat',
};
const UNIT_BIPRA = { PEMUDA: 'PEMUDA', REMAJA: 'REMAJA', ANAK: 'ANAK', BAPAK: 'BAPAK', IBU: 'IBU' };
const UNIT_DIVISION = { PEMBANGUNAN: 'PEMBANGUNAN', THL: ['THL_STEWARDSHIP', 'THL_MDS'], PANJI: ['PANJI'] };

export async function kasReport(prisma, periodStr) {
  const p = parsePeriod(periodStr);
  const [accounts, txns] = await Promise.all([
    safe(prisma.cashAccount.findMany({ orderBy: [{ kind: 'asc' }, { name: 'asc' }] }), []),
    safe(prisma.cashTransaction.findMany({ where: { occurredAt: { gte: p.from, lt: p.to } }, orderBy: { occurredAt: 'asc' } }), []),
  ]);
  const byAcc = new Map();
  for (const t of txns) {
    const a = byAcc.get(t.accountId) || { in: 0, out: 0 };
    if (t.direction === 'IN') a.in += Number(t.amount || 0);
    else a.out += Number(t.amount || 0);
    byAcc.set(t.accountId, a);
  }
  const nameById = new Map(accounts.map((a) => [a.id, a.name]));
  const rows = accounts.map((a) => {
    const agg = byAcc.get(a.id) || { in: 0, out: 0 };
    return {
      code: a.code, name: a.name, unit: a.unit, kind: a.kind,
      opening: Number(a.openingBalance || 0), in: agg.in, out: agg.out,
      balance: accountBalance(a.openingBalance, [{ direction: 'IN', sum: agg.in }, { direction: 'OUT', sum: agg.out }]),
    };
  });
  const totals = rows.reduce((s, r) => ({ in: s.in + r.in, out: s.out + r.out, balance: s.balance + r.balance }), { in: 0, out: 0, balance: 0 });
  return {
    period: periodInfo(p),
    accounts: rows,
    totals,
    transactions: txns.map((t) => ({
      occurredAt: t.occurredAt, accountName: nameById.get(t.accountId) || '',
      direction: t.direction, amount: Number(t.amount || 0), category: t.category, unit: t.unit, description: t.description,
    })),
  };
}

export async function facilityReport(prisma, periodStr) {
  const p = parsePeriod(periodStr);
  const bookings = await safe(prisma.facilityBooking.findMany({
    where: { startAt: { gte: p.from, lt: p.to } },
    orderBy: { startAt: 'desc' },
    include: { facility: { select: { name: true } } },
  }), []);
  const countsMap = new Map();
  const topMap = new Map();
  let revenue = 0;
  for (const b of bookings) {
    countsMap.set(b.status, (countsMap.get(b.status) || 0) + 1);
    if (b.paidAt) revenue += Number(b.paidAmount || b.rateAmount || 0);
    const fn = b.facility?.name || '—';
    topMap.set(fn, (topMap.get(fn) || 0) + 1);
  }
  return {
    period: periodInfo(p),
    counts: [...countsMap.entries()].map(([status, count]) => ({ status, count })),
    revenue,
    topFacilities: [...topMap.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5),
    bookings: bookings.map((b) => ({ title: b.title, facility: b.facility?.name, unit: b.unit, status: b.status, startAt: b.startAt, rateAmount: b.rateAmount == null ? null : Number(b.rateAmount) })),
  };
}

export async function bpmjReport(prisma, periodStr) {
  const p = parsePeriod(periodStr);
  const [membersByBipra, membersByKolom, paidSum, accounts, txSums, openBookings, openFunding, openIncidents, upcomingDuties, campaigns, recentWarta] = await Promise.all([
    safe(prisma.user.groupBy({ by: ['bipra'], _count: { _all: true } }), []),
    safe(prisma.user.groupBy({ by: ['kolomId'], _count: { _all: true }, where: { kolomId: { not: null } } }), []),
    safe(prisma.order.aggregate({ _sum: { total: true }, where: { status: 'PAID' } }), { _sum: { total: 0 } }),
    safe(prisma.cashAccount.findMany(), []),
    safe(prisma.cashTransaction.groupBy({ by: ['accountId', 'direction'], _sum: { amount: true } }), []),
    safe(prisma.facilityBooking.count({ where: { status: { in: ['SUBMITTED', 'APPROVED'] } } }), 0),
    safe(prisma.fundingRequest.count({ where: { status: { in: ['SUBMITTED', 'APPROVED'] } } }), 0),
    safe(prisma.incidentLog.count({ where: { status: { in: ['OPEN', 'HANDLED'] } } }), 0),
    safe(prisma.serviceSchedule.count({ where: { date: { gte: new Date() }, status: { not: 'CANCELLED' } } }), 0),
    safe(prisma.campaign.findMany({ where: { isActive: true }, take: 10, select: { title: true } }), []),
    safe(prisma.internalWarta.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { title: true, status: true } }), []),
  ]);
  const bal = new Map();
  for (const s of txSums) {
    const arr = bal.get(s.accountId) || [];
    arr.push({ direction: s.direction, sum: s._sum?.amount });
    bal.set(s.accountId, arr);
  }
  const cashTotal = accounts.reduce((sum, a) => sum + accountBalance(a.openingBalance, bal.get(a.id) || []), 0);
  const total = membersByBipra.reduce((s, r) => s + (r._count?._all || 0), 0);
  return {
    period: periodInfo(p),
    members: { total, byBipra: membersByBipra.map((r) => ({ bipra: r.bipra, count: r._count?._all || 0 })), byKolom: membersByKolom.length },
    finance: { bzpPaid: Number(paidSum?._sum?.total || 0), cashTotal, openFunding, openBookings },
    security: { openIncidents },
    duties: { upcoming: upcomingDuties },
    campaigns,
    recentWarta,
  };
}

export async function unitReport(prisma, unitCode, periodStr) {
  const code = String(unitCode || '').toUpperCase();
  if (!UNIT_LABEL[code]) return null;
  const p = parsePeriod(periodStr);
  const memberWhere = code === 'KOLOM' ? { kolomId: { not: null } } : UNIT_BIPRA[code] ? { bipra: UNIT_BIPRA[code] } : {};
  const [memberCount, accounts, txSums, events, duties] = await Promise.all([
    safe(prisma.user.count({ where: memberWhere }), 0),
    safe(prisma.cashAccount.findMany({ where: { unit: code } }), []),
    safe(prisma.cashTransaction.groupBy({ by: ['accountId', 'direction'], _sum: { amount: true } }), []),
    safe(prisma.eventProgram.findMany({
      where: { tenantId: UNIT_TENANT[code], startDate: { gte: p.from, lt: p.to } },
      orderBy: { startDate: 'desc' }, take: 20, select: { name: true, status: true, startDate: true },
    }), []),
    UNIT_DIVISION[code]
      ? safe(prisma.serviceSchedule.findMany({
          where: { date: { gte: p.from, lt: p.to }, serviceRole: { division: Array.isArray(UNIT_DIVISION[code]) ? { in: UNIT_DIVISION[code] } : UNIT_DIVISION[code] } },
          orderBy: { date: 'asc' }, take: 20,
          include: { serviceRole: { select: { name: true } }, user: { select: { name: true } } },
        }), [])
      : Promise.resolve([]),
  ]);
  const bal = new Map();
  for (const s of txSums) {
    const arr = bal.get(s.accountId) || [];
    arr.push({ direction: s.direction, sum: s._sum?.amount });
    bal.set(s.accountId, arr);
  }
  return {
    period: periodInfo(p),
    unitLabel: UNIT_LABEL[code],
    memberCount,
    cash: accounts.map((a) => ({ name: a.name, balance: accountBalance(a.openingBalance, bal.get(a.id) || []) })),
    events: events.map((e) => ({ name: e.name, status: e.status, startDate: e.startDate })),
    duties: duties.map((d) => ({ role: d.serviceRole?.name, user: d.user?.name, date: d.date, status: d.status })),
  };
}
