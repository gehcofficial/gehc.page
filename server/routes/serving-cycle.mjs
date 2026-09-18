/**
 * Urutan siklus serving (10 pasangan penanggung/tuan rumah).
 * Admin (Superadmin, Komisi, BOD Tim Kerja) dapat mengubah urutan tanpa deploy,
 * menukar dua kelompok secara massal, dan menerapkan ulang ke jadwal nyata.
 */
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { isTimKerjaBod } from '../lib/channel-link-access.mjs';
import {
  diffAssignments,
  invalidateCyclePairsCache,
  loadCyclePairs,
  swapGroupsInPairs,
  validateCyclePairs,
} from '../lib/serving-cycle.mjs';

/** Riwayat dijaga: hanya tanggal >= awal mentoring yang boleh ditulis ulang. */
export const CYCLE_WRITE_FROM = '2026-09-06';

const WRITE_ROLES = ['SUPERADMIN', 'KOMISI', 'COMMITTEE'];

function toDayISO(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  const s = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

async function authorizeWrite(req, res) {
  const user = req.authUser;
  const roles = (user?.roles || []).map((r) => r.role);
  if (roles.includes('SUPERADMIN') || roles.includes('KOMISI')) return true;
  if (roles.includes('COMMITTEE') && (await isTimKerjaBod(user))) return true;
  res.status(403).json({ error: 'Hanya Superadmin, Komisi, atau BOD Tim Kerja yang mengubah urutan siklus.' });
  return false;
}

/** Tanggal minggu dengan kondisi khusus (LIBUR/ALIH/GABUNGAN) — jangan ditulis ulang. */
async function overrideDates(prisma) {
  const rows = await prisma.serviceWeekOverride
    .findMany({ select: { eventDate: true } })
    .catch(() => []);
  return new Set(rows.map((r) => toDayISO(r.eventDate)).filter(Boolean));
}

export function registerServingCycleRoutes(app, { wrap }) {
  // GET /api/serving-cycle — daftar urutan + katalog grup
  app.get(
    '/api/serving-cycle',
    requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE', 'BPMJ'),
    wrap(async (_req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const [pairs, groups, last] = await Promise.all([
        loadCyclePairs(prisma, { fresh: true }),
        prisma.group.findMany({ select: { id: true, name: true, color: true }, orderBy: { name: 'asc' } }).catch(() => []),
        prisma.servingCyclePair
          .findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true, updatedById: true } })
          .catch(() => null),
      ]);
      res.json({
        pairs,
        groups,
        updatedAt: last?.updatedAt || null,
        updatedById: last?.updatedById || null,
        writeFrom: CYCLE_WRITE_FROM,
      });
    }),
  );

  // PUT /api/serving-cycle — simpan urutan baru
  app.put(
    '/api/serving-cycle',
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      if (!(await authorizeWrite(req, res))) return;
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const input = Array.isArray(req.body?.pairs) ? req.body.pairs : [];
      const groups = await prisma.group.findMany({ select: { id: true, name: true } }).catch(() => []);
      const check = validateCyclePairs(input, groups);
      if (!check.ok) return res.status(400).json({ error: check.errors[0], errors: check.errors });
      const byIndex = new Map(input.map((p) => [Number(p.cycleIndex), p]));
      const ops = [];
      for (let i = 0; i < 10; i++) {
        const p = byIndex.get(i);
        ops.push(prisma.servingCyclePair.upsert({
          where: { cycleIndex: i },
          create: {
            cycleIndex: i,
            responsibleGroupId: p.responsibleGroupId,
            hostGroupId: p.hostGroupId,
            updatedById: req.authUser.id,
          },
          update: {
            responsibleGroupId: p.responsibleGroupId,
            hostGroupId: p.hostGroupId,
            updatedById: req.authUser.id,
          },
        }));
      }
      await prisma.$transaction(ops);
      invalidateCyclePairsCache();
      const pairs = await loadCyclePairs(prisma, { fresh: true });
      res.json({ ok: true, pairs });
    }),
  );

  // POST /api/serving-cycle/swap-groups — tukar dua kelompok (kedua peran) massal
  app.post(
    '/api/serving-cycle/swap-groups',
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      if (!(await authorizeWrite(req, res))) return;
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const aGroupId = String(req.body?.aGroupId || '').trim();
      const bGroupId = String(req.body?.bGroupId || '').trim();
      const dryRun = Boolean(req.body?.dryRun);
      const from = toDayISO(req.body?.from) || CYCLE_WRITE_FROM;
      if (!aGroupId || !bGroupId) return res.status(400).json({ error: 'aGroupId dan bGroupId wajib.' });
      if (aGroupId === bGroupId) return res.status(400).json({ error: 'Pilih dua kelompok yang berbeda.' });

      const [pairs, groups, rows, overrides] = await Promise.all([
        loadCyclePairs(prisma, { fresh: true }),
        prisma.group.findMany({ select: { id: true, name: true, color: true } }).catch(() => []),
        prisma.servingAssignment
          .findMany({ where: { eventDate: { gte: new Date(`${from}T00:00:00.000Z`) } }, orderBy: { eventDate: 'asc' } })
          .catch(() => []),
        overrideDates(prisma),
      ]);
      const valid = new Set(groups.map((g) => g.id));
      if (!valid.has(aGroupId) || !valid.has(bGroupId)) {
        return res.status(404).json({ error: 'Kelompok tidak ditemukan.' });
      }
      const target = rows.filter((r) => !overrides.has(toDayISO(r.eventDate)));
      const newPairs = swapGroupsInPairs(pairs, aGroupId, bGroupId, groups);
      const changes = diffAssignments(target, newPairs, groups, from);

      if (dryRun) {
        return res.json({ ok: true, dryRun: true, from, changes, pairsBefore: pairs, pairsAfter: newPairs });
      }

      const groupName = (id) => groups.find((g) => g.id === id)?.name || id;
      const ops = [];
      for (let i = 0; i < 10; i++) {
        const p = newPairs[i];
        ops.push(prisma.servingCyclePair.upsert({
          where: { cycleIndex: i },
          create: { cycleIndex: i, responsibleGroupId: p.responsibleGroupId, hostGroupId: p.hostGroupId, updatedById: req.authUser.id },
          update: { responsibleGroupId: p.responsibleGroupId, hostGroupId: p.hostGroupId, updatedById: req.authUser.id },
        }));
      }
      for (const c of changes) {
        ops.push(prisma.servingAssignment.update({
          where: { id: c.id },
          data: {
            responsibleGroupId: c.after.responsibleGroupId,
            hostGroupId: c.after.hostGroupId,
            swapReason: `[urutan] tukar ${groupName(aGroupId)} ⇄ ${groupName(bGroupId)}`,
          },
        }));
      }
      await prisma.$transaction(ops);
      invalidateCyclePairsCache();
      res.json({ ok: true, dryRun: false, from, changed: changes.length, changes });
    }),
  );

  // POST /api/serving-cycle/apply — selaraskan baris nyata ke urutan siklus saat ini
  app.post(
    '/api/serving-cycle/apply',
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      if (!(await authorizeWrite(req, res))) return;
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const dryRun = Boolean(req.body?.dryRun);
      const from = toDayISO(req.body?.from) || CYCLE_WRITE_FROM;

      const [pairs, groups, rows, overrides] = await Promise.all([
        loadCyclePairs(prisma, { fresh: true }),
        prisma.group.findMany({ select: { id: true, name: true, color: true } }).catch(() => []),
        prisma.servingAssignment
          .findMany({ where: { eventDate: { gte: new Date(`${from}T00:00:00.000Z`) } }, orderBy: { eventDate: 'asc' } })
          .catch(() => []),
        overrideDates(prisma),
      ]);
      const target = rows.filter((r) => !overrides.has(toDayISO(r.eventDate)));
      const changes = diffAssignments(target, pairs, groups, from);

      if (dryRun) return res.json({ ok: true, dryRun: true, from, changes });

      const ops = changes.map((c) => prisma.servingAssignment.update({
        where: { id: c.id },
        data: {
          responsibleGroupId: c.after.responsibleGroupId,
          hostGroupId: c.after.hostGroupId,
          swapReason: '[urutan] diselaraskan ke urutan siklus',
        },
      }));
      if (ops.length) await prisma.$transaction(ops);
      res.json({ ok: true, dryRun: false, from, updated: ops.length, changes });
    }),
  );
}
