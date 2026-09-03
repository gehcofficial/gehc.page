/**
 * Sync retreat Excel → Beyonders family tree (groups, batches, members).
 * Idempotent. Source of truth: MATRIKS ABSENSI sheet.
 *
 * Usage: node server/_sync-retreat-beyonders.cjs
 * Env: DATABASE_URL, RETREAT_XLSX_PATH (optional)
 */
require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');

const PERIOD = '2026-06';
const TENANT = 'tenant-youth';
const DEFAULT_XLSX =
  process.env.RETREAT_XLSX_PATH ||
  path.join('D:', 'AISaerang Life', 'Services', 'Youth', 'Retreat Attendance_GEHC YOUTH 2026.xlsx');

const GROUP_META = {
  AVODAH: { meaning: 'Ibadah & Pelayanan yang Nyata dalam Karya', color: '#FF416C', scripture: 'Kolose 3:23' },
  AGAPE: { meaning: 'Kasih yang Tulus dan Tanpa Syarat', color: '#E94057', scripture: '1 Korintus 13:4-7' },
  SHALOM: { meaning: 'Damai Sejahtera dan Ketenangan Batin', color: '#2A81FF', scripture: 'Yohanes 14:27' },
  HESED: { meaning: 'Kasih Setia Allah yang Kekal', color: '#8A2387', scripture: 'Ratapan 3:22-23' },
  KAIROS: { meaning: 'Waktu Perkenanan Tuhan', color: '#F27121', scripture: 'Pengkhotbah 3:11' },
  LOGOS: { meaning: 'Firman Hidup yang Menjadi Landasan', color: '#00B4D8', scripture: 'Yohanes 1:1' },
  METANOIA: { meaning: 'Pembaruan Budi dan Transformasi Hidup', color: '#059669', scripture: 'Roma 12:2' },
  RUACH: { meaning: 'Nafas Roh Kudus yang Menghidupkan', color: '#7C3AED', scripture: 'Yesaya 11:2' },
  DUNAMIS: { meaning: 'Kekuatan dan Kuasa Ilahi', color: '#DC2626', scripture: 'Kisah Para Rasul 1:8' },
  ECHAD: { meaning: 'Kesatuan Sejati dalam Kasih Kristus', color: '#0D9488', scripture: 'Yohanes 17:21' },
};

function slug(n) {
  return String(n)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function titleCaseName(n) {
  return String(n)
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function genId() {
  return crypto.randomBytes(16).toString('hex');
}

function parseExcel(xlsxPath) {
  const wb = XLSX.readFile(xlsxPath);
  const sheet = wb.Sheets['MATRIKS ABSENSI'];
  if (!sheet) throw new Error('Sheet MATRIKS ABSENSI tidak ditemukan');
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const groups = {};
  let cur = '';
  for (const r of data) {
    const c0 = String(r[0] || '').trim();
    const c1 = String(r[1] || '').trim();
    if (c0.startsWith('KELOMPOK:')) {
      const m = c0.match(/KELOMPOK:\s*([A-Z]+)\s*\(MENTOR:\s*(.+?)\s*&\s*CO-MENTOR:\s*(.+?)\)/);
      if (m) {
        cur = m[1];
        groups[cur] = {
          mentor: titleCaseName(m[2]),
          comentor: titleCaseName(m[3]),
          mentees: [],
        };
      }
    } else if (c1.startsWith('Nama Mentee') && cur && c0) {
      groups[cur].mentees.push(titleCaseName(c0.replace(/\s*\(G\)\s*/gi, '')));
    }
  }
  return groups;
}

function normalizeKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\s*\(g\)\s*/gi, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function main() {
  const xlsxPath = DEFAULT_XLSX;
  console.log('Excel:', xlsxPath);
  const parsed = parseExcel(xlsxPath);
  console.log('Parsed groups:', Object.keys(parsed).length);

  const prisma = new PrismaClient();
  try {
    // Ensure tenant exists
    await prisma.tenant.upsert({
      where: { id: TENANT },
      create: { id: TENANT, name: 'GEHC Youth', slug: 'youth', domain: 'youth.gehc.page', isActive: true },
      update: { isActive: true },
    });

    const allUsers = await prisma.user.findMany({ select: { id: true, name: true, email: true } });
    const byName = new Map(allUsers.map((u) => [normalizeKey(u.name), u]));

    let sa = await prisma.user.findFirst({
      where: { OR: [{ email: 'tech@gehc.demo' }, { roles: { some: { role: 'SUPERADMIN' } } }] },
      select: { id: true },
    });
    if (!sa) {
      sa = allUsers[0] || { id: 'usr-system' };
    }

    const ensureUser = async (displayName) => {
      const key = normalizeKey(displayName);
      let u = byName.get(key);
      if (u) return u;
      const id = `usr-${slug(displayName)}`.slice(0, 64);
      const email = `${slug(displayName)}@gehc.demo`.slice(0, 190);
      try {
        u = await prisma.user.create({
          data: {
            id,
            name: displayName,
            email,
            bipra: 'PEMUDA',
            isBeyonders: true,
            accountStatus: 'ACTIVE',
            onboardingStatus: 'ACTIVE',
            authProvider: 'LOCAL',
            linkStatus: 'UNLINKED',
            membershipKind: 'JEMAAT',
          },
        });
      } catch {
        u = await prisma.user.findFirst({
          where: { OR: [{ id }, { email }, { name: displayName }] },
        });
      }
      if (u) byName.set(key, u);
      return u;
    };

    for (const [gn, gd] of Object.entries(parsed)) {
      const meta = GROUP_META[gn] || { meaning: gn, color: '#FF416C', scripture: '' };
      const gidPreferred = `grp-${gn.toLowerCase()}`;

      let group = await prisma.group.findFirst({
        where: { OR: [{ id: gidPreferred }, { name: { equals: gn } }] },
      });

      if (!group) {
        // try case-insensitive via all groups
        const allG = await prisma.group.findMany();
        group = allG.find((g) => g.name.toUpperCase() === gn) || null;
      }

      if (!group) {
        group = await prisma.group.create({
          data: {
            id: gidPreferred,
            tenantId: TENANT,
            name: gn.charAt(0) + gn.slice(1).toLowerCase(),
            meaning: meta.meaning,
            scripture: meta.scripture,
            color: meta.color,
            memberCount: 2 + gd.mentees.length,
            status: 'ACTIVE',
            foundedPeriod: PERIOD,
          },
        });
      } else {
        group = await prisma.group.update({
          where: { id: group.id },
          data: {
            tenantId: TENANT,
            meaning: group.meaning || meta.meaning,
            color: group.color || meta.color,
            scripture: group.scripture || meta.scripture,
            memberCount: 2 + gd.mentees.length,
            status: 'ACTIVE',
          },
        });
      }

      const groupId = group.id;

      // Clear other isCurrent batches for this group, then upsert retreat batch
      await prisma.groupBatch.updateMany({
        where: { groupId, isCurrent: true, NOT: { period: PERIOD } },
        data: { isCurrent: false },
      });

      const batchId = `batch-${groupId}-${PERIOD}`.slice(0, 64);
      const existingBatch = await prisma.groupBatch.findFirst({
        where: { groupId, period: PERIOD },
      });
      if (existingBatch) {
        await prisma.groupBatch.update({
          where: { id: existingBatch.id },
          data: {
            mentorName: gd.mentor,
            comentorName: gd.comentor,
            batchLabel: `Retreat Gen-0 ${PERIOD}`,
            theme: 'Retreat GEHC Youth 2026',
            isCurrent: true,
          },
        });
      } else {
        await prisma.groupBatch.create({
          data: {
            id: batchId,
            groupId,
            period: PERIOD,
            mentorName: gd.mentor,
            comentorName: gd.comentor,
            batchLabel: `Retreat Gen-0 ${PERIOD}`,
            theme: 'Retreat GEHC Youth 2026',
            isCurrent: true,
          },
        });
      }

      const people = [
        { name: gd.mentor, role: 'MENTOR', fr: 'MENTOR' },
        { name: gd.comentor, role: 'CO_MENTOR', fr: 'COMENTOR' },
        ...gd.mentees.map((m) => ({ name: m, role: 'MENTEE', fr: 'MENTEE' })),
      ];

      for (const p of people) {
        const user = await ensureUser(p.name);
        if (!user) {
          console.warn('  skip user', p.name);
          continue;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { isBeyonders: true, bipra: 'PEMUDA', onboardingStatus: 'ACTIVE' },
        });

        // Role assignment (active)
        const existingRa = await prisma.roleAssignment.findFirst({
          where: {
            userId: user.id,
            groupId,
            isActive: true,
            role: { in: ['MENTOR', 'CO_MENTOR', 'MENTEE'] },
          },
        });
        if (!existingRa) {
          const raId = genId();
          try {
            await prisma.roleAssignment.create({
              data: {
                id: raId,
                userId: user.id,
                role: p.role,
                groupId,
                familyRole: p.role === 'CO_MENTOR' ? 'CO_MENTOR' : p.role,
                assignedBy: sa.id,
                isActive: true,
                note: 'Synced from retreat Excel',
              },
            });
          } catch (e) {
            console.warn('  RA skip', p.name, e.message?.slice?.(0, 80) || e);
          }
        } else if (existingRa.role !== p.role) {
          await prisma.roleAssignment.update({
            where: { id: existingRa.id },
            data: { role: p.role, familyRole: p.role === 'CO_MENTOR' ? 'CO_MENTOR' : p.role },
          });
        }

        const existingUr = await prisma.userRole.findFirst({
          where: { userId: user.id, role: p.role, groupId },
        });
        if (!existingUr) {
          try {
            await prisma.userRole.create({
              data: {
                userId: user.id,
                tenantId: TENANT,
                role: p.role,
                groupId,
              },
            });
          } catch (_) {
            /* skip */
          }
        }

        const existingGm = await prisma.groupMember.findFirst({
          where: { userId: user.id, groupId },
        });
        if (existingGm) {
          await prisma.groupMember.update({
            where: { id: existingGm.id },
            data: {
              name: p.name,
              familyRole: p.fr,
              batchPeriod: PERIOD,
              status: 'ACTIVE',
            },
          });
        } else {
          await prisma.groupMember.create({
            data: {
              id: `gm-${slug(p.name)}-${slug(gn)}`.slice(0, 64),
              groupId,
              userId: user.id,
              name: p.name,
              email: user.email,
              familyRole: p.fr,
              batchPeriod: PERIOD,
              status: 'ACTIVE',
            },
          });
        }
      }

      console.log(`✓ ${gn} (${groupId}): ${people.length} members`);
    }

    // Demote any other current batches so landing only shows retreat Gen-0
    const syncedIds = [];
    for (const gn of Object.keys(parsed)) {
      const g = await prisma.group.findFirst({
        where: { OR: [{ id: `grp-${gn.toLowerCase()}` }, { name: { equals: gn.charAt(0) + gn.slice(1).toLowerCase() } }] },
      });
      if (g) syncedIds.push(g.id);
    }
    if (syncedIds.length) {
      await prisma.groupBatch.updateMany({
        where: {
          isCurrent: true,
          OR: [{ groupId: { notIn: syncedIds } }, { period: { not: PERIOD } }],
        },
        data: { isCurrent: false },
      });
      // Re-assert current on retreat period for synced groups
      await prisma.groupBatch.updateMany({
        where: { groupId: { in: syncedIds }, period: PERIOD },
        data: { isCurrent: true },
      });
    }

    console.log('\nDone. Family tree batch period=', PERIOD);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
