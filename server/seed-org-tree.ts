/**
 * Default org tree seed — YOUTH (BPMJ→Komisi→Tim Kerja→BOD/Panca/BZP/Beyonders) + KOLOM slots.
 * Idempotent: upsert by domain+slug.
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { SUB_DIVISIONS, DIVISION_HEAD_POSITION, PANTA_DIVISIONS } from '../src/lib/pantatugas.ts';

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

async function seedYouthTree() {
  const bpmj = await upsertNode({
    domain: 'YOUTH',
    slug: 'BPMJ',
    label: 'BPMJ',
    nodeKind: 'BRANCH',
    sortOrder: 1,
    metadata: { portalRole: 'BPMJ' },
  });
  for (let i = 0; i < BPMJ_POSITIONS.length; i++) {
    const pos = BPMJ_POSITIONS[i];
    await upsertNode({
      domain: 'YOUTH',
      parentId: bpmj.id,
      slug: `BPMJ_${pos.replace(/\s+/g, '_').toUpperCase()}`,
      label: pos,
      nodeKind: 'POSITION_SLOT',
      sortOrder: i,
      metadata: { portalRole: 'BPMJ', position: pos, maxAssignees: 1 },
    });
  }

  const komisi = await upsertNode({
    domain: 'YOUTH',
    slug: 'KOMISI',
    label: 'Komisi Pemuda',
    nodeKind: 'BRANCH',
    sortOrder: 2,
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
    sortOrder: 3,
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
  await seedYouthTree();
  await seedKolomSlots();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
