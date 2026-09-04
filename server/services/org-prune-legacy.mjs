import { parseOrgMeta, isLegacyPantaSlot, legacyCanonicalName, pillarSlotSlug, subdivisionKeyOf } from '../lib/org-legacy-slots.mjs';

function slotDivision(node) {
  const m = parseOrgMeta(node?.metadata);
  return String(m.division || '').toUpperCase();
}

/**
 * Move assignments off renamed panca/BZP slots, then deactivate the leftover nodes.
 * Idempotent. Does not hard-delete.
 */
export async function pruneLegacyOrgSlots(prisma) {
  const nodes = await prisma.orgNode.findMany({
    where: { domain: 'YOUTH', nodeKind: 'POSITION_SLOT' },
  });

  const bySlug = new Map(nodes.filter((n) => n.isActive).map((n) => [String(n.slug).toUpperCase(), n]));
  const byDivSub = new Map();
  for (const n of nodes) {
    if (!n.isActive) continue;
    const div = slotDivision(n);
    const sub = String(parseOrgMeta(n.metadata).subdivision || '').trim();
    if (div && sub) byDivSub.set(`${div}::${sub}`, n);
  }

  const legacy = nodes.filter((n) => n.isActive && isLegacyPantaSlot(n));
  const stats = { scanned: nodes.length, legacy: legacy.length, moved: 0, deactivated: 0, skipped: 0 };

  for (const old of legacy) {
    const div = slotDivision(old);
    const oldName = subdivisionKeyOf(old);
    const canonicalName = legacyCanonicalName(div, oldName)
      || legacyCanonicalName(div, parseOrgMeta(old.metadata).subdivision);
    const target =
      (canonicalName && byDivSub.get(`${div}::${canonicalName}`))
      || (canonicalName && bySlug.get(pillarSlotSlug(div, canonicalName)))
      || null;

    const assignments = await prisma.orgAssignment.findMany({
      where: { orgNodeId: old.id, isActive: true },
    });

    if (target && target.id !== old.id) {
      for (const row of assignments) {
        const dup = await prisma.orgAssignment.findFirst({
          where: { orgNodeId: target.id, userId: row.userId, isActive: true },
        });
        if (dup) {
          await prisma.orgAssignment.update({ where: { id: row.id }, data: { isActive: false } });
        } else {
          await prisma.orgAssignment.update({
            where: { id: row.id },
            data: { orgNodeId: target.id },
          });
        }
        stats.moved += 1;
      }
    } else {
      for (const row of assignments) {
        await prisma.orgAssignment.update({ where: { id: row.id }, data: { isActive: false } });
      }
      if (!target) stats.skipped += 1;
    }

    await prisma.orgNode.update({ where: { id: old.id }, data: { isActive: false } });
    stats.deactivated += 1;
    console.log(`  – ${old.slug} → ${target ? target.slug : '(no canonical target)'}`);
  }

  return stats;
}
