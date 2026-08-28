/**
 * AI Regenerasi Distribusi - Fair & Even Distribution
 * 
 * Prinsip 1 Korintus 12: "Tubuh itu satu, tetapi anggotanya banyak"
 * - Distribusi merata: jumlah anggota seimbang antar kelompok
 * - Distribusi adil karunia: setiap kelompok dapat keragaman karunia (teaching, hospitality, music, dll)
 * - Algoritma greedy dengan scoring berdasarkan gift diversity
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface GiftDistribution {
  userId: string;
  name: string;
  giftsTop5: string[];
  giftsScores: Record<string, number>;
}

export interface GroupAssignment {
  groupId: string;
  groupName: string;
  currentMembers: number;
  suggestedMembers: string[]; // userIds
  giftCoverage: Record<string, number>; // gift -> count in group
  diversityScore: number;
}

export interface RegenerationPlan {
  assignments: GroupAssignment[];
  unassigned: string[];
  stats: {
    totalMentees: number;
    totalGroups: number;
    avgPerGroup: number;
    minGroupSize: number;
    maxGroupSize: number;
    giftDiversityIndex: number; // 0-1, higher = more diverse
  };
}

const ALL_GIFTS = [
  'Teaching', 'Administration', 'Hospitality', 'Music', 'Mercy',
  'Evangelism', 'Prophecy', 'Discernment', 'Faith', 'Healing',
  'Wisdom', 'Knowledge', 'Speaking in Tongues', 'Intercession', 'Giving',
  'Craftsmanship', 'Shepherding', 'Apostleship', 'Exhortation', 'Service',
];

/**
 * Calculate gift diversity score for a group
 * Higher score = more diverse gifts (closer to having all 20 gifts represented)
 */
function calculateGiftDiversity(groupGifts: Record<string, number>): number {
  const representedGifts = Object.keys(groupGifts).filter((g) => groupGifts[g] > 0).length;
  return representedGifts / ALL_GIFTS.length;
}

/**
 * Calculate gift coverage score for adding a user to a group
 * Prioritizes gifts that are underrepresented in the group
 */
function calculateGiftContribution(userGifts: string[], groupGifts: Record<string, number>): number {
  let score = 0;
  for (const gift of userGifts) {
    const currentCount = groupGifts[gift] || 0;
    // Higher score for gifts with fewer representatives
    score += 1 / (currentCount + 1);
  }
  return score;
}

/**
 * Even distribution algorithm with gift diversity optimization
 */
export async function generateRegenerationPlan(
  menteeUserIds: string[],
  groupIds: string[],
  options: {
    maxPerGroup?: number;
    minPerGroup?: number;
    prioritizeDiversity?: boolean;
  } = {}
): Promise<RegenerationPlan> {
  const { maxPerGroup = 15, minPerGroup = 8, prioritizeDiversity = true } = options;

  // Fetch mentee gift data
  const mentees = await prisma.user.findMany({
    where: { id: { in: menteeUserIds } },
    select: {
      id: true,
      name: true,
      giftsTop5: true,
      giftsScores: true,
    },
  });

  const menteeGifts: GiftDistribution[] = mentees.map((m) => ({
    userId: m.id,
    name: m.name,
    giftsTop5: Array.isArray(m.giftsTop5) ? m.giftsTop5 : [],
    giftsScores: m.giftsScores as Record<string, number> || {},
  }));

  // Fetch current group members and their gifts
  const groups = await prisma.group.findMany({
    where: { id: { in: groupIds } },
    include: {
      members: {
        include: {
          user: { select: { id: true, giftsTop5: true, giftsScores: true } },
        },
      },
    },
  });

  const groupAssignments: GroupAssignment[] = groups.map((g) => {
    const memberGifts: Record<string, number> = {};
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

  // Sort mentees by gift rarity (users with rarer gifts get assigned first)
  const giftFrequency: Record<string, number> = {};
  for (const mg of menteeGifts) {
    for (const gift of mg.giftsTop5) {
      giftFrequency[gift] = (giftFrequency[gift] || 0) + 1;
    }
  }

  const sortedMentees = [...menteeGifts].sort((a, b) => {
    const aRarity = a.giftsTop5.reduce((sum, g) => sum + (1 / (giftFrequency[g] || 1)), 0);
    const bRarity = b.giftsTop5.reduce((sum, g) => sum + (giftFrequency[g] || 1), 0);
    return bRarity - aRarity; // Rarest gifts first
  });

  // Assign mentees to groups
  for (const mentee of sortedMentees) {
    let bestGroup: GroupAssignment | null = null;
    let bestScore = -Infinity;

    for (const group of groupAssignments) {
      // Skip if group is at max capacity
      if (group.currentMembers + group.suggestedMembers.length >= maxPerGroup) continue;

      let score = 0;

      // Base score: prefer groups with fewer members (even distribution)
      const groupSize = group.currentMembers + group.suggestedMembers.length;
      const avgTarget = Math.ceil(menteeUserIds.length / groupIds.length);
      const sizePenalty = Math.abs(groupSize - avgTarget) * 0.5;
      score -= sizePenalty;

      // Gift diversity contribution
      if (prioritizeDiversity) {
        score += calculateGiftContribution(mentee.giftsTop5, group.giftCoverage) * 10;
      }

      // Prefer groups where mentee's top gift is missing
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
      // Update gift coverage
      for (const gift of mentee.giftsTop5) {
        bestGroup.giftCoverage[gift] = (bestGroup.giftCoverage[gift] || 0) + 1;
      }
      bestGroup.diversityScore = calculateGiftDiversity(bestGroup.giftCoverage);
    }
  }

  // Check for unassigned (shouldn't happen with proper maxPerGroup)
  const assignedIds = new Set(groupAssignments.flatMap((g) => g.suggestedMembers));
  const unassigned = menteeUserIds.filter((id) => !assignedIds.has(id));

  // Calculate stats
  const sizes = groupAssignments.map((g) => g.currentMembers + g.suggestedMembers.length);
  const totalMentees = menteeUserIds.length;
  const totalGroups = groupIds.length;

  return {
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
  };
}

/**
 * Apply regeneration plan to database
 */
export async function applyRegenerationPlan(plan: RegenerationPlan, period: string): Promise<void> {
  for (const assignment of plan.assignments) {
    for (const userId of assignment.suggestedMembers) {
      await prisma.groupMember.create({
        data: {
          id: `gm-${crypto.randomUUID()}`,
          groupId: assignment.groupId,
          userId,
          batchPeriod: period,
          role: 'MENTEE',
        },
      });
    }
    // Update group member count
    await prisma.group.update({
      where: { id: assignment.groupId },
      data: {
        memberCount: assignment.currentMembers + assignment.suggestedMembers.length,
      },
    });
  }
}

export async function getRegenerationPreview(
  menteeUserIds: string[],
  groupIds: string[]
): Promise<RegenerationPlan> {
  return generateRegenerationPlan(menteeUserIds, groupIds);
}