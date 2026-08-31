/**
 * "Jethro" Engine — Decision Support untuk regenerasi kelompok GEHC Youth.
 * Referensi: revision-v2-beyonders.md (Parameter 1-3 + Bagian 3).
 *
 * Semua fungsi bersifat idempotent dan aman dipanggil berulang:
 * notifikasi di-dedup per (type, target) selama masih OPEN/ACKNOWLEDGED.
 */
import crypto from 'node:crypto';
import { getPrisma, isDbConfigured } from './db.mjs';
import { normalizeGiftsTop5 } from './gift-normalize.mjs';

export const THRESHOLD = Number(process.env.GROUP_THRESHOLD || 10);
const IDLE_WEEKS = 4;
const HIGH_ATTENDANCE_RATE = 0.8;
const MERGER_MAX_COMBINED = Math.floor(THRESHOLD * 0.6);

const uid = (prefix) => `${prefix}-${crypto.randomUUID()}`;
const dayStr = (d) => d.toISOString().slice(0, 10);
const weeksAgo = (n) => new Date(Date.now() - n * 7 * 86400 * 1000);

function assertDb() {
  if (!isDbConfigured()) throw new Error('DATABASE_URL belum dikonfigurasi.');
}

/** Roster aktif = status ACTIVE (mentor + co-mentor + mentee semuanya menghitung kuota). */
function activeMembers(group) {
  return (group.members || []).filter((m) => m.status === 'ACTIVE');
}

export function capacityOf(group) {
  const activeCount = activeMembers(group).length;
  return {
    activeCount,
    threshold: THRESHOLD,
    freeSlots: Math.max(0, THRESHOLD - activeCount),
    isFull: activeCount >= THRESHOLD,
  };
}

async function createNotificationIfAbsent(prisma, data) {
  const open = await prisma.notification.findFirst({
    where: {
      type: data.type,
      groupId: data.groupId ?? null,
      memberId: data.memberId ?? null,
      status: { in: ['OPEN', 'ACKNOWLEDGED'] },
    },
  });
  if (open) return null;
  return prisma.notification.create({ data: { id: uid('ntf'), ...data } });
}

// ------------------------------------------------------------------
// Parameter 3a — Deteksi idle: tanpa HADIR selama IDLE_WEEKS minggu
// ------------------------------------------------------------------
export async function scanIdle() {
  assertDb();
  const prisma = getPrisma();
  const since = weeksAgo(IDLE_WEEKS);
  const groups = await prisma.group.findMany({
    where: { status: 'ACTIVE' },
    include: { members: { where: { status: 'ACTIVE' } } },
  });

  const created = [];
  for (const g of groups) {
    if (activeMembers(g).length === 0) continue;
    const att = await prisma.attendanceRecord.findMany({
      where: { groupId: g.id, date: { gte: since } },
    });
    const meetings = new Set(att.map((a) => dayStr(a.date)));
    if (meetings.size === 0) continue; // belum ada laporan pertemuan → tidak bisa dinilai

    const hadirByMember = new Map();
    for (const a of att) {
      if (a.status === 'HADIR') {
        hadirByMember.set(a.groupMemberId, (hadirByMember.get(a.groupMemberId) || 0) + 1);
      }
    }

    for (const m of activeMembers(g)) {
      if (m.familyRole !== 'MENTEE') continue; // aturan idle hanya untuk Mentee (revision-v2 §Parameter 3)
      if ((hadirByMember.get(m.id) || 0) > 0) continue;
      const n = await createNotificationIfAbsent(prisma, {
        type: 'IDLE_FLAG',
        groupId: g.id,
        memberId: m.id,
        title: `Idle ${IDLE_WEEKS} minggu: ${m.name}`,
        message: `${m.name} (${m.familyRole}) tidak tercatat hadir dalam ${IDLE_WEEKS} minggu terakhir di grup ${g.name} (${meetings.size} pertemuan tercatat).`,
        payload: { meetings: meetings.size, windowDays: IDLE_WEEKS * 7 },
      });
      if (n) created.push(n);
    }
  }
  return created;
}

// ------------------------------------------------------------------
// Parameter 1 — Mitosis trigger: grup penuh + mentee matang
// ------------------------------------------------------------------
export async function suggestMitosis() {
  assertDb();
  const prisma = getPrisma();
  const since = weeksAgo(8);
  const groups = await prisma.group.findMany({
    where: { status: 'ACTIVE' },
    include: { members: { where: { status: 'ACTIVE' } } },
  });

  const created = [];
  for (const g of groups) {
    const cap = capacityOf(g);
    if (!cap.isFull) continue;

    const att = await prisma.attendanceRecord.findMany({
      where: { groupId: g.id, date: { gte: since } },
    });
    const totalMeetings = new Set(att.map((a) => dayStr(a.date))).size;
    if (totalMeetings === 0) continue;

    const hadirByMember = new Map();
    for (const a of att) {
      if (a.status === 'HADIR') {
        hadirByMember.set(a.groupMemberId, (hadirByMember.get(a.groupMemberId) || 0) + 1);
      }
    }

    const candidates = g.members
      .filter((m) => m.familyRole === 'MENTEE')
      .map((m) => ({ ...m, rate: (hadirByMember.get(m.id) || 0) / totalMeetings }))
      .filter((m) => m.rate >= HIGH_ATTENDANCE_RATE)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 2);

    if (candidates.length < 2) continue;

    const names = candidates.map((c) => c.name).join(' & ');
    const n = await createNotificationIfAbsent(prisma, {
      type: 'MITOSIS_ALERT',
      groupId: g.id,
      title: `${g.name} penuh ${cap.activeCount}/${THRESHOLD}`,
      message: `Grup ${g.name} mencapai kapasitas maksimal. ${candidates.length} Mentee memiliki kehadiran ≥${Math.round(HIGH_ATTENDANCE_RATE * 100)}%: ${names}. Rekomendasi: promote mereka menjadi Mentor & Co-Mentor untuk membuka generasi baru.`,
      payload: {
        activeCount: cap.activeCount,
        candidates: candidates.map((c) => ({ id: c.id, name: c.name, rate: Math.round(c.rate * 100) })),
      },
    });
    if (n) created.push(n);
  }
  return created;
}

// ------------------------------------------------------------------
// Parameter 1 — Merger suggestion: grup sekarat (saudara satu parent)
// ------------------------------------------------------------------
export async function suggestMerger() {
  assertDb();
  const prisma = getPrisma();
  const groups = await prisma.group.findMany({
    where: { status: 'ACTIVE', parentGroupId: { not: null } },
    include: { members: { where: { status: 'ACTIVE' } } },
  });

  const byParent = new Map();
  for (const g of groups) {
    if (!byParent.has(g.parentGroupId)) byParent.set(g.parentGroupId, []);
    byParent.get(g.parentGroupId).push(g);
  }

  const created = [];
  for (const [, siblings] of byParent) {
    if (siblings.length < 2) continue;
    const sorted = [...siblings].sort((a, b) => a.id.localeCompare(b.id));
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      const combined = activeMembers(a).length + activeMembers(b).length;
      if (combined > MERGER_MAX_COMBINED) continue;
      const n = await createNotificationIfAbsent(prisma, {
        type: 'MERGER_SUGGESTION',
        groupId: a.id,
        title: `Merger ${a.name} + ${b.name}?`,
        message: `Kapasitas gabungan hanya ${combined} orang. Rekomendasi: merger kembali untuk memaksimalkan koinonia.`,
        payload: {
          sourceGroupId: a.id,
          sourceName: a.name,
          targetGroupId: b.id,
          targetName: b.name,
          combined,
        },
      });
      if (n) created.push(n);
    }
  }
  return created;
}

/** Jalankan ketiga scan sekaligus. */
export async function runScan() {
  const idle = await scanIdle();
  const mitosis = await suggestMitosis();
  const merger = await suggestMerger();
  return { idle: idle.length, mitosis: mitosis.length, merger: merger.length };
}

// ------------------------------------------------------------------
// Placement Recommender — distribusi newcomer ke slot kosong
// ------------------------------------------------------------------
export async function recommendPlacement(newcomerCount) {
  assertDb();
  const prisma = getPrisma();
  const groups = await prisma.group.findMany({
    where: { status: 'ACTIVE' },
    include: { members: { where: { status: 'ACTIVE' } } },
    orderBy: { name: 'asc' },
  });
  const slots = groups
    .map((g) => ({ id: g.id, name: g.name, free: capacityOf(g).freeSlots }))
    .filter((s) => s.free > 0)
    .sort((x, y) => y.free - x.free);

  let remaining = newcomerCount;
  const plan = [];
  for (const s of slots) {
    if (remaining <= 0) break;
    const assign = Math.min(s.free, remaining);
    plan.push({ groupId: s.id, groupName: s.name, assign });
    remaining -= assign;
  }
  return { requested: newcomerCount, assigned: newcomerCount - remaining, unplaced: remaining, plan };
}

// ------------------------------------------------------------------
// Advanced Placement Recommender — 4-factor scoring
// Even Distribution (30%) + Gender Balance (25%) + Gift Diversity (30%) + Maturity Fit (15%)
// ------------------------------------------------------------------
export async function recommendPlacementAdvanced(newcomerInputs) {
  assertDb();
  const prisma = getPrisma();

  // Fetch all active groups with members
  const groups = await prisma.group.findMany({
    where: { status: 'ACTIVE' },
    include: {
      members: {
        where: { status: 'ACTIVE' },
        include: { user: { select: { id: true, gender: true, giftsTop5: true, giftsScores: true } } },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Build group states
  const groupStates = groups.map((g) => {
    const activeMembers = g.members.filter((m) => m.status === 'ACTIVE');
    const capacity = capacityOf(g);

    // Gender ratio
    let laki = 0, perempuan = 0;
    for (const m of activeMembers) {
      const gdr = m.user?.gender || m.gender;
      if (gdr === 'LAKI-LAKI') laki++;
      else if (gdr === 'PEREMPUAN') perempuan++;
    }

    // Gift coverage
    const giftCoverage = {};
    for (const m of activeMembers) {
      const gifts = m.user?.giftsTop5 || [];
      for (const gift of gifts) {
        giftCoverage[gift] = (giftCoverage[gift] || 0) + 1;
      }
    }

    // Mentor/Co-Mentor count
    let mentorCount = 0, comentorCount = 0;
    for (const m of activeMembers) {
      if (m.familyRole === 'MENTOR') mentorCount++;
      else if (m.familyRole === 'COMENTOR') comentorCount++;
    }

    return {
      id: g.id,
      name: g.name,
      freeSlots: capacity.freeSlots,
      totalSlots: capacity.threshold,
      activeCount: capacity.activeCount,
      genderRatio: { laki, perempuan },
      giftCoverage,
      diversityScore: calculateGiftDiversity(giftCoverage),
      mentorCount,
      comentorCount,
      members: activeMembers,
    };
  }).filter((gs) => gs.freeSlots > 0);

  // Calculate global gift frequency across all groups (for rarity scoring)
  const globalGiftFreq = {};
  for (const gs of groupStates) {
    for (const [gift, count] of Object.entries(gs.giftCoverage)) {
      globalGiftFreq[gift] = (globalGiftFreq[gift] || 0) + count;
    }
  }

  const recommendations = [];

  for (const newcomer of newcomerInputs) {
    const { id, name, gender, giftsScores, maturityScore = 0 } = newcomer;
    const giftsTop5 = normalizeGiftsTop5(newcomer.giftsTop5 || []);

    // Score each group for this newcomer
    const scoredGroups = groupStates.map((gs) => {
      // 1. Even Distribution (30%) - more free slots = higher score
      const evenDistScore = Math.min(gs.freeSlots / gs.totalSlots, 1);

      // 2. Gender Balance (25%) - minority gender gets boost
      const totalGender = gs.genderRatio.laki + gs.genderRatio.perempuan;
      let genderScore = 0.5; // neutral
      if (totalGender > 0) {
        if (gender === 'LAKI-LAKI') {
          // Boost if group has more women (minority gender = men)
          genderScore = gs.genderRatio.perempuan / totalGender;
        } else if (gender === 'PEREMPUAN') {
          // Boost if group has more men
          genderScore = gs.genderRatio.laki / totalGender;
        }
      }

      // 3. Gift Diversity (30%) - newcomer's rare gifts that group lacks
      let giftScore = 0;
      if (giftsTop5?.length) {
        for (const gift of giftsTop5) {
          const groupHas = gs.giftCoverage[gift] || 0;
          const globalFreq = globalGiftFreq[gift] || 1;
          const rarity = 1 / globalFreq; // rarer gift = higher weight
          if (groupHas === 0) {
            giftScore += rarity * 2; // group completely missing this gift
          } else if (groupHas === 1) {
            giftScore += rarity * 1; // only one person has it
          } else {
            giftScore += rarity * 0.2; // already represented
          }
        }
        giftScore = Math.min(giftScore / giftsTop5.length, 1);
      }

      // 4. Maturity Fit (15%) - high maturity → Mentor/Co-Mentor if slot available
      let maturityScoreNorm = 0;
      let recommendedRole = 'MENTEE';
      if (maturityScore >= 0.8) {
        if (gs.mentorCount === 0) {
          recommendedRole = 'MENTOR';
          maturityScoreNorm = 1;
        } else if (gs.comentorCount === 0) {
          recommendedRole = 'COMENTOR';
          maturityScoreNorm = 0.8;
        } else {
          recommendedRole = 'MENTEE';
          maturityScoreNorm = 0.3;
        }
      } else if (maturityScore >= 0.6) {
        if (gs.comentorCount === 0) {
          recommendedRole = 'COMENTOR';
          maturityScoreNorm = 0.7;
        } else {
          recommendedRole = 'MENTEE';
          maturityScoreNorm = 0.4;
        }
      } else {
        recommendedRole = 'MENTEE';
        maturityScoreNorm = 0.2;
      }

      // Weighted total score
      const totalScore =
        evenDistScore * 0.30 +
        genderScore * 0.25 +
        giftScore * 0.30 +
        maturityScoreNorm * 0.15;

      // Reasons for transparency
      const reasons = [];
      if (evenDistScore > 0.7) reasons.push('Even distribution (many free slots)');
      else if (evenDistScore > 0.3) reasons.push('Even distribution');
      if (genderScore > 0.6) reasons.push(`Gender balance (${gender === 'LAKI-LAKI' ? 'men needed' : 'women needed'} in group)`);
      if (giftScore > 0.5) reasons.push('Gift diversity (unique gifts for group)');
      if (maturityScoreNorm > 0.7) reasons.push(`Maturity fit (recommended as ${recommendedRole})`);

      return {
        groupId: gs.id,
        groupName: gs.name,
        score: totalScore,
        recommendedRole,
        reasons,
        scoreBreakdown: {
          evenDistribution: evenDistScore,
          genderBalance: genderScore,
          giftDiversity: giftScore,
          maturityFit: maturityScoreNorm,
        },
      };
    });

    // Sort by score descending
    scoredGroups.sort((a, b) => b.score - a.score);

    const best = scoredGroups[0];
    if (!best) {
      recommendations.push({
        newcomerId: id,
        newcomerName: name,
        newcomerGender: gender || '',
        newcomerGiftsTop5: giftsTop5,
        newcomerMaturityScore: maturityScore,
        recommendedGroupId: null,
        recommendedGroupName: null,
        recommendedRole: 'MENTEE',
        confidence: 0,
        reasons: ['No groups with available slots'],
        alternatives: [],
      });
      continue;
    }

    recommendations.push({
      newcomerId: id,
      newcomerName: name,
      newcomerGender: gender || '',
      newcomerGiftsTop5: giftsTop5,
      newcomerMaturityScore: maturityScore,
      recommendedGroupId: best.groupId,
      recommendedGroupName: best.groupName,
      recommendedRole: best.recommendedRole,
      confidence: Math.round(best.score * 100) / 100,
      reasons: best.reasons,
      scoreBreakdown: best.scoreBreakdown,
      alternatives: scoredGroups.slice(1, 4).map((g) => ({
        groupId: g.groupId,
        groupName: g.groupName,
        score: Math.round(g.score * 100) / 100,
        recommendedRole: g.recommendedRole,
      })),
    });
  }

  return { recommendations };
}

export function calculateGiftDiversity(groupGifts) {
  const representedGifts = Object.keys(groupGifts).filter((g) => groupGifts[g] > 0).length;
  const ALL_GIFTS = [
    'Wisdom', 'Knowledge', 'Faith', 'Healing', 'Miracles',
    'Prophecy', 'Discernment', 'Tongues', 'Interpretation',
    'Administration', 'Leadership', 'Mercy', 'Helps',
    'Giving', 'Evangelism', 'Pastoring', 'Teaching',
    'Exhortation', 'Hospitality', 'Missionary',
  ];
  return representedGifts / ALL_GIFTS.length;
}

// ------------------------------------------------------------------
// Aksi: SPLIT (mitosis) — Parameter 1 step 2-3
// ------------------------------------------------------------------
export async function executeSplit({ groupId, newName, mentorMemberId, comentorMemberId }) {
  assertDb();
  const prisma = getPrisma();
  const parent = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: { where: { status: 'ACTIVE' } } },
  });
  if (!parent) throw new Error('Grup parent tidak ditemukan.');
  if (!newName?.trim()) throw new Error('Nama grup baru wajib diisi.');

  const mentor = parent.members.find((m) => m.id === mentorMemberId);
  const comentor = parent.members.find((m) => m.id === comentorMemberId);
  if (!mentor || !comentor) throw new Error('Mentor/Co-Mentor harus anggota ACTIVE grup ini.');
  if (mentor.id === comentor.id) throw new Error('Mentor dan Co-Mentor harus orang berbeda.');

  const period = String(new Date().getFullYear());
  const child = await prisma.group.create({
    data: {
      id: uid('grp'),
      tenantId: parent.tenantId,
      name: newName.trim(),
      color: parent.color,
      icon: parent.icon,
      description: `Keturunan ${parent.name} (generasi baru).`,
      parentGroupId: parent.id,
      foundedPeriod: period,
      status: 'ACTIVE',
    },
  });

  // Promote & pindahkan dua pemimpin baru
  await prisma.groupMember.update({
    where: { id: mentor.id },
    data: { groupId: child.id, familyRole: 'MENTOR', batchPeriod: period },
  });
  await prisma.groupMember.update({
    where: { id: comentor.id },
    data: { groupId: child.id, familyRole: 'COMENTOR', batchPeriod: period },
  });

  // Redistribute proporsional: sisanya dibagi dua, parent sedikit lebih besar
  const rest = parent.members
    .filter((m) => m.id !== mentor.id && m.id !== comentor.id && m.familyRole === 'MENTEE')
    .map((m) => m.id);
  const toChild = Math.floor(rest.length / 2);
  for (const id of rest.slice(0, toChild)) {
    await prisma.groupMember.update({ where: { id }, data: { groupId: child.id, batchPeriod: period } });
  }

  await refreshMemberCount(prisma, parent.id);
  await refreshMemberCount(prisma, child.id);

  // Tutup alert mitosis yang menyasar parent
  await prisma.notification.updateMany({
    where: { type: 'MITOSIS_ALERT', groupId: parent.id, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
    data: { status: 'RESOLVED', resolvedAt: new Date() },
  });

  const [freshParent, freshChild] = await Promise.all([
    prisma.group.findUnique({ where: { id: parent.id }, include: { members: true } }),
    prisma.group.findUnique({ where: { id: child.id }, include: { members: true } }),
  ]);
  return {
    parent: { id: freshParent.id, name: freshParent.name, ...capacityOf(freshParent) },
    child: { id: freshChild.id, name: freshChild.name, ...capacityOf(freshChild) },
  };
}

// ------------------------------------------------------------------
// Aksi: MERGER — Parameter 1 (koinonia)
// ------------------------------------------------------------------
export async function executeMerge({ sourceGroupId, targetGroupId }) {
  assertDb();
  const prisma = getPrisma();
  if (sourceGroupId === targetGroupId) throw new Error('Grup sumber dan tujuan tidak boleh sama.');
  const [source, target] = await Promise.all([
    prisma.group.findUnique({ where: { id: sourceGroupId }, include: { members: { where: { status: 'ACTIVE' } } } }),
    prisma.group.findUnique({ where: { id: targetGroupId }, include: { members: { where: { status: 'ACTIVE' } } } }),
  ]);
  if (!source || !target) throw new Error('Grup sumber/tujuan tidak ditemukan.');
  if (target.status !== 'ACTIVE') throw new Error('Grup tujuan harus berstatus ACTIVE.');

  const hasMentor = target.members.some((m) => m.familyRole === 'MENTOR');
  const hasComentor = target.members.some((m) => m.familyRole === 'COMENTOR');
  let demoted = 0;

  for (const m of source.members) {
    let role = m.familyRole;
    if (role === 'MENTOR' && hasMentor) { role = 'MENTEE'; demoted++; }
    if (role === 'COMENTOR' && hasComentor) { role = 'MENTEE'; demoted++; }
    await prisma.groupMember.update({ where: { id: m.id }, data: { groupId: target.id, familyRole: role } });
  }

  // Rekam lineage: grup sumber menutup sebagai cabang dari tujuan
  await prisma.group.update({
    where: { id: source.id },
    data: { status: 'MERGED', parentGroupId: target.id },
  });
  await refreshMemberCount(prisma, target.id);

  await prisma.notification.updateMany({
    where: {
      type: 'MERGER_SUGGESTION',
      status: { in: ['OPEN', 'ACKNOWLEDGED'] },
      OR: [{ groupId: source.id }, { groupId: target.id }],
    },
    data: { status: 'RESOLVED', resolvedAt: new Date() },
  });

  return { moved: source.members.length, demoted, sourceId: source.id, targetId: target.id };
}

// ------------------------------------------------------------------
// Parameter 2 — Role shuffling (tanpa buat akun baru)
// ------------------------------------------------------------------
export async function shuffleRole(memberId, familyRole) {
  assertDb();
  const prisma = getPrisma();
  if (!['MENTOR', 'COMENTOR', 'MENTEE'].includes(familyRole)) {
    throw new Error("familyRole harus MENTOR | COMENTOR | MENTEE.");
  }
  const member = await prisma.groupMember.findUnique({ where: { id: memberId } });
  if (!member) throw new Error('Anggota tidak ditemukan.');
  if (member.status !== 'ACTIVE') throw new Error('Hanya anggota ACTIVE yang bisa di-shuffle.');

  if (familyRole !== 'MENTEE') {
    const clash = await prisma.groupMember.findFirst({
      where: { groupId: member.groupId, status: 'ACTIVE', familyRole, id: { not: memberId } },
    });
    if (clash) throw new Error(`Grup sudah punya ${familyRole}: ${clash.name}. Turunkan dulu bila ingin mengganti.`);
  }

  const updated = await prisma.groupMember.update({ where: { id: memberId }, data: { familyRole } });
  await refreshMemberCount(prisma, member.groupId);
  return updated;
}

// ------------------------------------------------------------------
// Parameter 3b — Protokol ALUMNI
// ------------------------------------------------------------------
export async function markAlumni(memberId, note) {
  assertDb();
  const prisma = getPrisma();
  const member = await prisma.groupMember.findUnique({ where: { id: memberId } });
  if (!member) throw new Error('Anggota tidak ditemukan.');
  const updated = await prisma.groupMember.update({
    where: { id: memberId },
    data: { status: 'ALUMNI', alumniDate: new Date(), alumniNote: note || null },
  });
  await refreshMemberCount(prisma, member.groupId);
  return updated;
}

// ------------------------------------------------------------------
// Dashboard snapshot
// ------------------------------------------------------------------
export async function getDashboard() {
  assertDb();
  const prisma = getPrisma();

  const groups = await prisma.group.findMany({
    where: { status: { in: ['ACTIVE', 'DORMANT'] } },
    include: { members: { where: { status: 'ACTIVE' } }, parent: true },
    orderBy: { name: 'asc' },
  });
  const notifications = await prisma.notification.findMany({
    where: { status: 'OPEN' },
    orderBy: { createdAt: 'desc' },
  });

  const groupNames = new Map(groups.map((g) => [g.id, g.name]));
  const memberIds = notifications.map((n) => n.memberId).filter(Boolean);
  const members = memberIds.length
    ? await prisma.groupMember.findMany({ where: { id: { in: memberIds } } })
    : [];
  const memberNames = new Map(members.map((m) => [m.id, m.name]));

  return {
    threshold: THRESHOLD,
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      status: g.status,
      parentId: g.parentGroupId,
      parentName: g.parent?.name || null,
      foundedPeriod: g.foundedPeriod,
      ...capacityOf(g),
    })),
    notifications: notifications.map((n) => ({
      ...n,
      groupName: n.groupId ? groupNames.get(n.groupId) || null : null,
      memberName: n.memberId ? memberNames.get(n.memberId) || null : null,
    })),
  };
}

async function refreshMemberCount(prisma, groupId) {
  const count = await prisma.groupMember.count({ where: { groupId, status: 'ACTIVE' } });
  await prisma.group.update({ where: { id: groupId }, data: { memberCount: count } });
}
