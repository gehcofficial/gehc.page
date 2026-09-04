/**
 * Pemimpin 10 rumah Beyonders: sumber nama landing (group_batches) vs akses portal (user_roles).
 * Generasi 0 = Retreat 2026-06. Regenerasi Jethro (mitosis) bukan flip generasi.
 */
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { isKomisiOrSuperadmin } from '../division-rbac.mjs';
import {
  GEN0_LABEL,
  GEN0_PERIOD,
  isPeriod,
  leaderMismatch,
  pickTenHomes,
} from '../lib/beyonders-generation.mjs';

const READ_ROLES = ['KOMISI', 'COMMITTEE', 'BPMJ'];
const READY_ROLES = ['KOMISI', 'COMMITTEE'];

function currentBatch(group) {
  const batches = group.batches || [];
  return batches.find((b) => b.isCurrent) || batches.sort((a, b) => String(b.period).localeCompare(String(a.period)))[0] || null;
}

function liveOf(roles, groupId, role) {
  const row = roles.find((r) => r.groupId === groupId && r.role === role);
  return row?.user ? { id: row.user.id, name: row.user.name, avatar: row.user.avatar } : null;
}

function serializeHouse(group, roles) {
  const batch = currentBatch(group);
  const liveMentor = liveOf(roles, group.id, 'MENTOR');
  const liveComentor = liveOf(roles, group.id, 'CO_MENTOR');
  return {
    groupId: group.id,
    name: group.name,
    foundedPeriod: group.foundedPeriod || GEN0_PERIOD,
    batch: batch
      ? {
          id: batch.id,
          period: batch.period,
          batchLabel: batch.batchLabel,
          generation: batch.generation ?? 0,
          mentorName: batch.mentorName,
          comentorName: batch.comentorName,
          mentorUserId: batch.mentorUserId,
          comentorUserId: batch.comentorUserId,
          regenReady: Boolean(batch.regenReady),
          isCurrent: Boolean(batch.isCurrent),
        }
      : null,
    liveMentor,
    liveComentor,
    mismatch: {
      mentor: leaderMismatch(batch?.mentorName, batch?.mentorUserId, liveMentor),
      comentor: leaderMismatch(batch?.comentorName, batch?.comentorUserId, liveComentor),
    },
  };
}

async function loadHouses(prisma) {
  const groups = await prisma.group.findMany({
    where: { status: 'ACTIVE', parentGroupId: null },
    include: { batches: true },
  });
  return pickTenHomes(groups);
}

async function loadRoles(prisma, groupIds) {
  if (!groupIds.length) return [];
  return prisma.userRole.findMany({
    where: { groupId: { in: groupIds }, role: { in: ['MENTOR', 'CO_MENTOR'] } },
    include: { user: { select: { id: true, name: true, avatar: true } } },
  });
}

export function registerBeyondersLeadersRoutes(app, { wrap }) {
  app.get(
    '/api/beyonders/leaders',
    requireRole(...READ_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.json({ houses: [], gen0Period: GEN0_PERIOD });
      const houses = await loadHouses(prisma);
      const roles = await loadRoles(prisma, houses.map((h) => h.id));
      const serialized = houses.map((h) => serializeHouse(h, roles));
      const readyCount = serialized.filter((h) => h.batch?.regenReady).length;
      res.json({
        gen0Period: GEN0_PERIOD,
        gen0Label: GEN0_LABEL,
        readyCount,
        houseCount: serialized.length,
        allReady: serialized.length > 0 && readyCount === serialized.length,
        houses: serialized,
      });
    }),
  );

  app.get(
    '/api/beyonders/leaders/people',
    requireRole(...READ_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      const q = String(req.query.q || '').trim();
      if (q.length < 2) return res.json({ people: [] });
      const people = await prisma.user.findMany({
        where: {
          accountStatus: 'ACTIVE',
          name: { contains: q },
        },
        select: { id: true, name: true, avatar: true },
        take: 12,
      });
      res.json({ people });
    }),
  );

  app.patch(
    '/api/beyonders/leaders/:groupId',
    requireRole('KOMISI'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const groupId = String(req.params.groupId || '').trim();
      const houses = await loadHouses(prisma);
      const group = houses.find((h) => h.id === groupId);
      if (!group) return res.status(404).json({ error: 'Bukan salah satu dari 10 rumah induk.' });

      let batch = currentBatch(group);
      const periodRaw = req.body?.period != null ? String(req.body.period).trim() : null;
      if (periodRaw && !isPeriod(periodRaw)) {
        return res.status(400).json({ error: 'Periode harus YYYY-MM (contoh 2026-06).' });
      }

      const data = {};
      if (periodRaw) data.period = periodRaw;
      if (req.body?.batchLabel != null) data.batchLabel = String(req.body.batchLabel).trim() || null;
      if (req.body?.mentorName != null) data.mentorName = String(req.body.mentorName).trim() || 'TBD';
      if (req.body?.comentorName !== undefined) {
        const n = req.body.comentorName == null ? null : String(req.body.comentorName).trim();
        data.comentorName = n || null;
      }
      if (req.body?.mentorUserId !== undefined) {
        data.mentorUserId = req.body.mentorUserId ? String(req.body.mentorUserId) : null;
      }
      if (req.body?.comentorUserId !== undefined) {
        data.comentorUserId = req.body.comentorUserId ? String(req.body.comentorUserId) : null;
      }

      if (!batch) {
        const period = data.period || group.foundedPeriod || GEN0_PERIOD;
        batch = await prisma.groupBatch.create({
          data: {
            id: `batch-${groupId}-${period}`.slice(0, 64),
            groupId,
            period,
            generation: 0,
            mentorName: data.mentorName || 'TBD',
            comentorName: data.comentorName ?? null,
            mentorUserId: data.mentorUserId ?? null,
            comentorUserId: data.comentorUserId ?? null,
            batchLabel: data.batchLabel || (period === GEN0_PERIOD ? GEN0_LABEL : `Generasi 0 — ${period}`),
            isCurrent: true,
          },
        });
      } else if (Object.keys(data).length) {
        try {
          batch = await prisma.groupBatch.update({ where: { id: batch.id }, data });
        } catch (err) {
          if (String(err?.code) === 'P2002') {
            return res.status(409).json({ error: 'Periode itu sudah dipakai batch lain di rumah ini.' });
          }
          throw err;
        }
      }

      const roles = await loadRoles(prisma, [groupId]);
      const refreshed = await prisma.group.findUnique({
        where: { id: groupId },
        include: { batches: true },
      });
      res.json({ house: serializeHouse(refreshed, roles) });
    }),
  );

  app.post(
    '/api/beyonders/leaders/:groupId/ready',
    requireRole(...READY_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const groupId = String(req.params.groupId || '').trim();
      const houses = await loadHouses(prisma);
      const group = houses.find((h) => h.id === groupId);
      if (!group) return res.status(404).json({ error: 'Bukan salah satu dari 10 rumah induk.' });
      const batch = currentBatch(group);
      if (!batch) return res.status(400).json({ error: 'Rumah ini belum punya batch berjalan.' });
      const ready = req.body?.ready === undefined ? !batch.regenReady : Boolean(req.body.ready);
      const updated = await prisma.groupBatch.update({
        where: { id: batch.id },
        data: { regenReady: ready },
      });
      res.json({ groupId, regenReady: updated.regenReady });
    }),
  );

  app.post(
    '/api/beyonders/leaders/regenerate',
    requireRole('KOMISI'),
    wrap(async (req, res) => {
      if (!isKomisiOrSuperadmin(req.authUser)) {
        return res.status(403).json({ error: 'Hanya Komisi yang membuka generasi berikutnya.' });
      }
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const nextPeriod = String(req.body?.nextPeriod || '').trim();
      if (!isPeriod(nextPeriod)) {
        return res.status(400).json({ error: 'nextPeriod wajib YYYY-MM.' });
      }
      const override = Boolean(req.body?.override);
      const houses = await loadHouses(prisma);
      if (houses.length < 10) {
        return res.status(400).json({ error: `Butuh 10 rumah induk; ketemu ${houses.length}.` });
      }
      const currents = houses.map((h) => ({ house: h, batch: currentBatch(h) }));
      const missing = currents.filter((c) => !c.batch);
      if (missing.length) {
        return res.status(400).json({ error: `Rumah tanpa batch berjalan: ${missing.map((m) => m.house.name).join(', ')}.` });
      }
      const notReady = currents.filter((c) => !c.batch.regenReady);
      if (notReady.length && !override) {
        return res.status(400).json({
          error: `Belum semua rumah siap (${notReady.map((n) => n.house.name).join(', ')}). Centang override Komisi jika tetap lanjut.`,
        });
      }
      const clash = currents.filter((c) => (c.house.batches || []).some((b) => b.period === nextPeriod));
      if (clash.length) {
        return res.status(409).json({ error: `Periode ${nextPeriod} sudah ada di: ${clash.map((c) => c.house.name).join(', ')}.` });
      }

      const ids = houses.map((h) => h.id);
      const rows = currents.map(({ house, batch }) => {
        const generation = (batch.generation ?? 0) + 1;
        return {
          id: `batch-${house.id}-${nextPeriod}`.slice(0, 64),
          groupId: house.id,
          period: nextPeriod,
          generation,
          batchLabel: String(req.body?.batchLabel || '').trim() || `Generasi ${generation} — ${nextPeriod}`,
          mentorName: batch.mentorName || 'TBD',
          comentorName: batch.comentorName || null,
          mentorUserId: batch.mentorUserId || null,
          comentorUserId: batch.comentorUserId || null,
          regenReady: false,
          isCurrent: true,
        };
      });

      await prisma.$transaction([
        prisma.groupBatch.updateMany({
          where: { groupId: { in: ids }, isCurrent: true },
          data: { isCurrent: false, regenReady: false },
        }),
        prisma.groupBatch.createMany({ data: rows }),
      ]);

      const refreshed = await loadHouses(prisma);
      const roles = await loadRoles(prisma, ids);
      res.json({
        ok: true,
        nextPeriod,
        generation: rows[0]?.generation ?? 1,
        houses: refreshed.map((h) => serializeHouse(h, roles)),
      });
    }),
  );
}
