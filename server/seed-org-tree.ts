/**
 * Default org tree seed — CHURCH (BPMJ) + BIPRA + YOUTH (Komisi/Tim Kerja) + KOLOM.
 * Idempotent: upsert by domain+slug. Memindah BPMJ lama dari YOUTH.
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { SUB_DIVISIONS, DIVISION_HEAD_POSITION, PANTA_DIVISIONS } from '../src/lib/pantatugas.ts';
import { pruneLegacyOrgSlots } from './services/org-prune-legacy.mjs';

function resolveSeedDatabaseUrl() {
  const env = String(process.env.GEHC_ENV || process.env.DB_TARGET || '').toLowerCase();
  if (env === 'production' || env === 'prod' || env === 'main') {
    return process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL || '';
  }
  return process.env.DATABASE_URL || process.env.DATABASE_URL_STAGING || '';
}

function maskDbUrl(url: string) {
  try {
    const u = new URL(url);
    const db = u.pathname.replace(/^\//, '').split('?')[0];
    return `${u.hostname}:${u.port || 4000}/${db}`;
  } catch {
    return '(invalid DATABASE_URL)';
  }
}

const seedUrl = resolveSeedDatabaseUrl();
if (!seedUrl) {
  console.error('❌ DATABASE_URL tidak ada — gunakan db:seed:org-tree:staging atau db:seed:org-tree:prod');
  process.exit(1);
}
process.env.DATABASE_URL = seedUrl;
console.log(`🌱 seed-org-tree → ${process.env.GEHC_ENV || 'default'} · ${maskDbUrl(seedUrl)}`);

const prisma = new PrismaClient();

function id() {
  return crypto.randomBytes(32).toString('hex');
}

const BPMJ_POSITIONS = ['Ketua BPMJ', 'Wakil Ketua BPMJ', 'Sekretaris', 'Wakil Sekretaris', 'Bendahara', 'Anggota'];
const KOMISI_POSITIONS = ['Ketua Komisi', 'Wakil Ketua Komisi', 'Sekretaris', 'Bendahara', 'Anggota'];
const BOD_POSITIONS = ['Ketua Tim Kerja', 'Sekretaris Tim Kerja', 'Bendahara Tim Kerja'];
const PANTA = [...PANTA_DIVISIONS];
const PANTA_LABELS = {
  LITURGIA: 'Liturgia',
  DIDASKALIA: 'Didaskalia',
  KOINONIA: 'Koinonia',
  DIAKONIA: 'Diakonia',
  MARTURIA: 'Marturia',
};

async function upsertNode({
  domain,
  parentId,
  slug,
  label,
  nodeKind,
  metadata,
  sortOrder,
}: {
  domain: string;
  parentId?: string | null;
  slug: string;
  label: string;
  nodeKind: string;
  sortOrder: number;
  metadata?: Prisma.InputJsonObject;
}) {
  const existing = await prisma.orgNode.findFirst({ where: { domain, slug } });
  if (existing) {
    return prisma.orgNode.update({
      where: { id: existing.id },
      data: { label, nodeKind, metadata, sortOrder, isActive: true, parentId: parentId || null },
    });
  }
  return prisma.orgNode.create({
    data: {
      id: id(),
      domain,
      parentId: parentId || null,
      slug,
      label,
      nodeKind,
      metadata: metadata || {},
      sortOrder,
      isActive: true,
    },
  });
}

async function relocateYouthBpmjToChurch() {
  const nodes = await prisma.orgNode.findMany({
    where: {
      domain: 'YOUTH',
      OR: [{ slug: 'BPMJ' }, { slug: { startsWith: 'BPMJ_' } }],
    },
  });
  for (const node of nodes) {
    const clash = await prisma.orgNode.findFirst({
      where: { domain: 'CHURCH', slug: node.slug, NOT: { id: node.id } },
    });
    if (clash) {
      await prisma.orgAssignment.updateMany({
        where: { orgNodeId: node.id },
        data: { orgNodeId: clash.id },
      });
      await prisma.orgNode.update({ where: { id: node.id }, data: { isActive: false } });
      continue;
    }
    await prisma.orgNode.update({
      where: { id: node.id },
      data: { domain: 'CHURCH' },
    });
  }
  if (nodes.length) console.log(`✓ BPMJ dipindah YOUTH → CHURCH (${nodes.length} node)`);
}

async function seedChurchBpmj() {
  const bpmj = await upsertNode({
    domain: 'CHURCH',
    slug: 'BPMJ',
    label: 'BPMJ',
    nodeKind: 'BRANCH',
    sortOrder: 1,
    metadata: { portalRole: 'BPMJ', churchOffice: 'BPMJ' },
  });
  for (let i = 0; i < BPMJ_POSITIONS.length; i++) {
    const pos = BPMJ_POSITIONS[i];
    await upsertNode({
      domain: 'CHURCH',
      parentId: bpmj.id,
      slug: `BPMJ_${pos.replace(/\s+/g, '_').toUpperCase()}`,
      label: pos,
      nodeKind: 'POSITION_SLOT',
      sortOrder: i,
      metadata: { portalRole: 'BPMJ', position: pos, maxAssignees: 1, churchOffice: 'BPMJ' },
    });
  }
  console.log('✓ CHURCH (Jemaat) BPMJ seeded');
}

async function seedBipraTree() {
  const cats: Array<{ slug: string; label: string; sortOrder: number; nestedDomain?: string }> = [
    { slug: 'BAPAK', label: 'Bapak', sortOrder: 1 },
    { slug: 'IBU', label: 'Ibu', sortOrder: 2 },
    { slug: 'PEMUDA', label: 'Pemuda', sortOrder: 3, nestedDomain: 'YOUTH' },
    { slug: 'REMAJA', label: 'Remaja', sortOrder: 4 },
    { slug: 'ANAK', label: 'Anak', sortOrder: 5 },
  ];
  for (const cat of cats) {
    const branch = await upsertNode({
      domain: 'BIPRA',
      slug: cat.slug,
      label: cat.label,
      nodeKind: 'BRANCH',
      sortOrder: cat.sortOrder,
      metadata: {
        bipra: cat.slug,
        ...(cat.nestedDomain ? { nestedDomain: cat.nestedDomain } : {}),
      },
    });
    await upsertNode({
      domain: 'BIPRA',
      parentId: branch.id,
      slug: `${cat.slug}_PENATUA`,
      label: `Penatua ${cat.label}`,
      nodeKind: 'POSITION_SLOT',
      sortOrder: 0,
      metadata: {
        bipra: cat.slug,
        leaderKind: 'PENATUA',
        position: `Penatua ${cat.label}`,
        maxAssignees: 1,
      },
    });
  }
  console.log('✓ BIPRA tree seeded (Penatua per kategorial; Pemuda menyarang pohon YOUTH)');
}

async function seedYouthTree() {
  const komisi = await upsertNode({
    domain: 'YOUTH',
    slug: 'KOMISI',
    label: 'Komisi Pemuda',
    nodeKind: 'BRANCH',
    sortOrder: 1,
    metadata: { portalRole: 'KOMISI' },
  });
  for (let i = 0; i < KOMISI_POSITIONS.length; i++) {
    const pos = KOMISI_POSITIONS[i];
    await upsertNode({
      domain: 'YOUTH',
      parentId: komisi.id,
      slug: `KOMISI_${pos.replace(/\s+/g, '_').toUpperCase()}`,
      label: pos,
      nodeKind: 'POSITION_SLOT',
      sortOrder: i,
      metadata: { portalRole: 'KOMISI', position: pos, maxAssignees: 1 },
    });
  }

  const timkerja = await upsertNode({
    domain: 'YOUTH',
    slug: 'TIMKERJA',
    label: 'Tim Kerja',
    nodeKind: 'BRANCH',
    sortOrder: 2,
    metadata: { portalRole: 'COMMITTEE' },
  });

  const bod = await upsertNode({
    domain: 'YOUTH',
    parentId: timkerja.id,
    slug: 'TIMKERJA_BOD',
    label: 'BOD Tim Kerja',
    nodeKind: 'BRANCH',
    sortOrder: 1,
    metadata: { division: 'TIMKERJA', portalRole: 'COMMITTEE' },
  });
  for (let i = 0; i < BOD_POSITIONS.length; i++) {
    const pos = BOD_POSITIONS[i];
    await upsertNode({
      domain: 'YOUTH',
      parentId: bod.id,
      slug: `BOD_${pos.replace(/\s+/g, '_').toUpperCase()}`,
      label: pos,
      nodeKind: 'POSITION_SLOT',
      sortOrder: i,
      metadata: {
        portalRole: 'COMMITTEE',
        division: 'TIMKERJA',
        position: pos,
        maxAssignees: 1,
      },
    });
  }

  const panca = await upsertNode({
    domain: 'YOUTH',
    parentId: timkerja.id,
    slug: 'PANCA_TUGAS',
    label: 'Panca Tugas',
    nodeKind: 'BRANCH',
    sortOrder: 2,
    metadata: { portalRole: 'COMMITTEE' },
  });

  for (let pi = 0; pi < PANTA.length; pi++) {
    const div = PANTA[pi];
    const divNode = await upsertNode({
      domain: 'YOUTH',
      parentId: panca.id,
      slug: div,
      label: PANTA_LABELS[div],
      nodeKind: 'BRANCH',
      sortOrder: pi,
      metadata: { portalRole: 'COMMITTEE', division: div },
    });
    await upsertNode({
      domain: 'YOUTH',
      parentId: divNode.id,
      slug: `${div}_HEAD`,
      label: DIVISION_HEAD_POSITION,
      nodeKind: 'POSITION_SLOT',
      sortOrder: -1,
      metadata: {
        portalRole: 'COMMITTEE',
        division: div,
        position: DIVISION_HEAD_POSITION,
        maxAssignees: 1,
      },
    });
    const subs = SUB_DIVISIONS[div] || [];
    for (let si = 0; si < subs.length; si++) {
      const sub = subs[si];
      await upsertNode({
        domain: 'YOUTH',
        parentId: divNode.id,
        slug: `${div}_${sub.name.replace(/\s+/g, '_').toUpperCase().slice(0, 40)}`,
        label: sub.label,
        nodeKind: 'POSITION_SLOT',
        sortOrder: si,
        metadata: {
          portalRole: 'COMMITTEE',
          division: div,
          subdivision: sub.name,
          maxAssignees: 99,
        },
      });
    }
  }

  const bzp = await upsertNode({
    domain: 'YOUTH',
    parentId: timkerja.id,
    slug: 'BENZARPR',
    label: 'Benzarpreneurship',
    nodeKind: 'BRANCH',
    sortOrder: 3,
    metadata: { portalRole: 'COMMITTEE', division: 'BENZARPR' },
  });
  for (const sub of SUB_DIVISIONS.BENZARPR || []) {
    await upsertNode({
      domain: 'YOUTH',
      parentId: bzp.id,
      slug: `BENZARPR_${sub.name.replace(/\s+/g, '_').toUpperCase().slice(0, 40)}`,
      label: sub.label,
      nodeKind: 'POSITION_SLOT',
      sortOrder: 0,
      metadata: { portalRole: 'COMMITTEE', division: 'BENZARPR', subdivision: sub.name, maxAssignees: 99 },
    });
  }

  await upsertNode({
    domain: 'YOUTH',
    parentId: timkerja.id,
    slug: 'INDIVIDU',
    label: 'Community · Individu',
    nodeKind: 'POSITION_SLOT',
    sortOrder: 5,
    metadata: { portalRole: 'MENTEE', maxAssignees: 999, requiresGroup: false, position: 'Individu' },
  });

  await upsertNode({
    domain: 'YOUTH',
    parentId: timkerja.id,
    slug: 'BEYONDERS',
    label: 'Beyonders (Kelompok Mentoring)',
    nodeKind: 'GROUP_REF',
    sortOrder: 4,
    metadata: { portalRoles: ['MENTOR', 'CO_MENTOR', 'MENTEE'], requiresGroup: true },
  });

  console.log('✓ YOUTH org tree seeded');
}

async function seedKolomSlots() {
  const kolomList = await prisma.kolom.findMany({ orderBy: { number: 'asc' } });
  if (!kolomList.length) {
    console.log('  (no kolom rows — skip KOLOM slots)');
    return;
  }

  const root = await upsertNode({
    domain: 'KOLOM',
    slug: 'KOLOM_ROOT',
    label: 'Kolom Teritorial',
    nodeKind: 'BRANCH',
    sortOrder: 0,
    metadata: {},
  });

  for (const k of kolomList) {
    const kolomBranch = await upsertNode({
      domain: 'KOLOM',
      parentId: root.id,
      slug: `KOLOM_${k.number}`,
      label: `Kolom ${k.number} — ${k.name}`,
      nodeKind: 'BRANCH',
      sortOrder: k.number,
      metadata: { linkedKolomId: k.id },
    });
    await upsertNode({
      domain: 'KOLOM',
      parentId: kolomBranch.id,
      slug: `KOLOM_${k.number}_DIAKEN`,
      label: 'Diaken Kolom',
      nodeKind: 'POSITION_SLOT',
      sortOrder: 1,
      metadata: { linkedKolomId: k.id, position: 'Diaken', maxAssignees: 1, leaderKind: 'DIAKEN' },
    });
    await upsertNode({
      domain: 'KOLOM',
      parentId: kolomBranch.id,
      slug: `KOLOM_${k.number}_PENATUA`,
      label: 'Penatua Kolom',
      nodeKind: 'POSITION_SLOT',
      sortOrder: 2,
      metadata: { linkedKolomId: k.id, position: 'Penatua', maxAssignees: 1, leaderKind: 'PENATUA' },
    });
    await upsertNode({
      domain: 'KOLOM',
      parentId: kolomBranch.id,
      slug: `KOLOM_${k.number}_ANGGOTA`,
      label: 'Anggota Jemaat',
      nodeKind: 'POSITION_SLOT',
      sortOrder: 3,
      metadata: { linkedKolomId: k.id, position: 'Anggota', maxAssignees: 999 },
    });
  }
  console.log(`✓ KOLOM org slots seeded (${kolomList.length} kolom)`);
}

async function main() {
  await relocateYouthBpmjToChurch();
  await seedChurchBpmj();
  await seedBipraTree();
  await seedYouthTree();
  const prune = await pruneLegacyOrgSlots(prisma);
  if (prune.legacy) {
    console.log(
      `✓ legacy panca/BZP slots pruned: moved=${prune.moved} deactivated=${prune.deactivated} no-target=${prune.skipped}`,
    );
  }
  await seedKolomSlots();
  try {
    await prisma.user.updateMany({
      where: { OR: [{ id: 'usr-platform-ops' }, { loginUsername: 'platform.ops' }] },
      data: { accountKind: 'SYSTEM_LEGACY', isBeyonders: false },
    });
  } catch {
    /* users.accountKind belum ada */
  }
  const [church, bipra, youth, kolom] = await Promise.all([
    prisma.orgNode.count({ where: { domain: 'CHURCH', isActive: true } }),
    prisma.orgNode.count({ where: { domain: 'BIPRA', isActive: true } }),
    prisma.orgNode.count({ where: { domain: 'YOUTH', isActive: true } }),
    prisma.orgNode.count({ where: { domain: 'KOLOM', isActive: true } }),
  ]);
  console.log(`✓ org_nodes aktif: CHURCH=${church} · BIPRA=${bipra} · YOUTH=${youth} · KOLOM=${kolom}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
