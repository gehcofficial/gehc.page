require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function meta(node) {
  const m = node?.metadata;
  return m && typeof m === 'object' && !Array.isArray(m) ? m : {};
}

function slugFromAssignment(ra) {
  const div = ra.division || '';
  const pos = (ra.position || '').replace(/\s+/g, '_').toUpperCase();
  if (div === 'TIMKERJA' && pos) return `TIMKERJA_${pos}`;
  if (div && pos) return `${div}_${pos}`;
  if (ra.role === 'MENTEE' && !ra.groupId) return 'INDIVIDU';
  return null;
}

(async () => {
  const nodes = await prisma.orgNode.findMany({ where: { isActive: true } });
  const bySlug = new Map(nodes.map((n) => [`${n.domain}:${n.slug}`, n]));

  const assignments = await prisma.roleAssignment.findMany({
    where: { isActive: true },
    orderBy: { assignedAt: 'asc' },
  });

  let linked = 0;
  let skipped = 0;

  for (const ra of assignments) {
    const existing = await prisma.orgAssignment.findFirst({
      where: { roleAssignmentId: ra.id, isActive: true },
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    const slug = slugFromAssignment(ra);
    if (!slug) {
      skipped += 1;
      continue;
    }

    const node = bySlug.get(`YOUTH:${slug}`) || bySlug.get(`KOLOM:${slug}`);
    if (!node) {
      skipped += 1;
      continue;
    }

    await prisma.orgAssignment.create({
      data: {
        id: require('crypto').randomBytes(32).toString('hex'),
        userId: ra.userId,
        orgNodeId: node.id,
        position: ra.position,
        roleAssignmentId: ra.id,
        assignedBy: ra.assignedBy || 'backfill',
        isActive: true,
      },
    });
    linked += 1;
  }

  console.log(`Backfill selesai: ${linked} linked, ${skipped} skipped`);
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
