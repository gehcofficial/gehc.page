import 'dotenv/config';
import express from 'express';
import { getPrisma, isDbConfigured } from '../server/db.mjs';
import { requireRole } from '../server/auth.mjs';
import crypto from 'node:crypto';

const app = express();
app.use(express.json({ limit: '2mb' }));

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error(`[regeneration] ${req.method} ${req.path} →`, err.message);
  res.status(500).json({ error: err.message });
});

const ALL_GIFTS = [
  'Teaching', 'Administration', 'Hospitality', 'Music', 'Mercy',
  'Evangelism', 'Prophecy', 'Discernment', 'Faith', 'Healing',
  'Wisdom', 'Knowledge', 'Speaking in Tongues', 'Intercession', 'Giving',
  'Craftsmanship', 'Shepherding', 'Apostleship', 'Exhortation', 'Service',
];

function calculateGiftDiversity(groupGifts) {
  const represented = Object.keys(groupGifts).filter((g) => groupGifts[g] > 0).length;
  return represented / ALL_GIFTS.length;
}

function calculateGiftContribution(userGifts, groupGifts) {
  let score = 0;
  for (const gift of userGifts) {
    const current = groupGifts[gift] || 0;
    score += 1 / (current + 1);
  }
  return score;
}

// POST: Generate regeneration plan preview
app.post('/api/regeneration/preview', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { menteeUserIds, groupIds, options } = req.body || {};
  if (!Array.isArray(menteeUserIds) || !Array.isArray(groupIds)) {
    return res.status(400).json({ error: 'menteeUserIds dan groupIds harus array.' });
  }

  const mentees = await prisma.user.findMany({
    where: { id: { in: menteeUserIds } },
    select: { id: true, name: true, giftsTop5: true, giftsScores: true },
  });

  const menteeGifts = mentees.map((m) => ({
    userId: m.id,
    name: m.name,
    giftsTop5: Array.isArray(m.giftsTop5) ? m.giftsTop5 : [],
    giftsScores: (m.giftsScores as Record<string, number>) || {},
  }));

  const groups = await prisma.group.findMany({
    where: { id: { in: groupIds } },
    include: {
      members: {
        include: { user: { select: { id: true, giftsTop5: true, giftsScores: true } } },
      },
    },
  });

  const groupAssignments = groups.map((g) => {
    const memberGifts = {};
    for (const m of g.members) {
      if (m.user?.giftsTop5) {
        for (const gift of m.user.giftsTop5) {
          memberGifts[gift] = (memberGifts[gift] || 0) + 1;
        }
      }
    }
    return {
      groupId: g.id,
      groupName: g.name,
      currentMembers: g.members.length,
      suggestedMembers: [],
      giftCoverage: memberGifts,
      diversityScore: calculateGiftDiversity(memberGifts),
    };
  });

  const giftFrequency = {};
  for (const mg of menteeGifts) {
    for (const gift of mg.giftsTop5) {
      giftFrequency[gift] = (giftFrequency[gift] || 0) + 1;
    }
  }

  const sortedMentees = [...menteeGifts].sort((a, b) => {
    const aRarity = a.giftsTop5.reduce((sum, g) => sum + (1 / (giftFrequency[g] || 1)), 0);
    const bRarity = b.giftsTop5.reduce((sum, g) => sum + (1 / (giftFrequency[g] || 1)), 0);
    return bRarity - aRarity;
  });

  const maxPerGroup = options?.maxPerGroup ?? 15;
  const prioritizeDiversity = options?.prioritizeDiversity !== false;

  for (const mentee of sortedMentees) {
    let bestGroup = null;
    let bestScore = -Infinity;

    for (const group of groupAssignments) {
      const groupSize = group.currentMembers + group.suggestedMembers.length;
      if (groupSize >= maxPerGroup) continue;

      let score = 0;
      const avgTarget = Math.ceil(menteeUserIds.length / groupIds.length);
      score -= Math.abs(groupSize - avgTarget) * 0.5;

      if (prioritizeDiversity) {
        score += calculateGiftContribution(mentee.giftsTop5, group.giftCoverage) * 10;
      }

      for (const gift of mentee.giftsTop5.slice(0, 3)) {
        if (!group.giftCoverage[gift] || group.giftCoverage[gift] === 0) {
          score += 5;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestGroup = group;
      }
    }

    if (bestGroup) {
      bestGroup.suggestedMembers.push(mentee.userId);
      for (const gift of mentee.giftsTop5) {
        bestGroup.giftCoverage[gift] = (bestGroup.giftCoverage[gift] || 0) + 1;
      }
      bestGroup.diversityScore = calculateGiftDiversity(bestGroup.giftCoverage);
    }
  }

  const assignedIds = new Set(groupAssignments.flatMap((g) => g.suggestedMembers));
  const unassigned = menteeUserIds.filter((id) => !assignedIds.has(id));

  const sizes = groupAssignments.map((g) => g.currentMembers + g.suggestedMembers.length);
  const totalMentees = menteeUserIds.length;
  const totalGroups = groupIds.length;

  res.json({
    assignments: groupAssignments,
    unassigned,
    stats: {
      totalMentees,
      totalGroups,
      avgPerGroup: totalGroups > 0 ? totalMentees / totalGroups : 0,
      minGroupSize: sizes.length > 0 ? Math.min(...sizes) : 0,
      maxGroupSize: sizes.length > 0 ? Math.max(...sizes) : 0,
      giftDiversityIndex: groupAssignments.length > 0
        ? groupAssignments.reduce((sum, g) => sum + g.diversityScore, 0) / groupAssignments.length
        : 0,
    },
  });
}));

// POST: Apply regeneration plan
app.post('/api/regeneration/apply', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

  const { assignments, period } = req.body || {};
  if (!Array.isArray(assignments) || !period) {
    return res.status(400).json({ error: 'assignments array dan period wajib diisi.' });
  }

  for (const assignment of assignments) {
    const { groupId, suggestedMembers } = assignment;
    if (!Array.isArray(suggestedMembers)) continue;

    for (const userId of suggestedMembers) {
      await prisma.groupMember.create({
        data: {
          id: `gm-${crypto.randomUUID()}`,
          groupId,
          userId,
          batchPeriod: period,
          role: 'MENTEE',
        },
      });
    }

    const currentCount = await prisma.groupMember.count({ where: { groupId, batchPeriod: period } });
    await prisma.group.update({
      where: { id: groupId },
      data: { memberCount: currentCount },
    });
  }

  res.json({ ok: true, message: 'Regenerasi berhasil diterapkan.' });
}));

export default app;