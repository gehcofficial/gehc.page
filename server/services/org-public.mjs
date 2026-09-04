import { isSystemAccount } from '../lib/system-users.mjs';
import { isCanonicalPillarSubdivision, isLegacyPantaSlot, parseOrgMeta } from '../lib/org-legacy-slots.mjs';

export const LANDING_ORG_DOMAINS = ['CHURCH', 'YOUTH'];
export const LANDING_PILLARS = [
  'LITURGIA',
  'DIDASKALIA',
  'KOINONIA',
  'DIAKONIA',
  'MARTURIA',
  'BENZARPR',
];

const HIDDEN_SLUGS = new Set(['INDIVIDU', 'BEYONDERS']);

const parseMeta = parseOrgMeta;

export function isDemoEmail(email) {
  return String(email || '').toLowerCase().endsWith('@gehc.demo');
}

/** Map org node → landing division (BPMJ / KOMISI / TIMKERJA / pillar). */
export function publicDivisionOf(node) {
  const m = parseMeta(node?.metadata);
  if (m.division) return String(m.division).toUpperCase();
  if (String(m.churchOffice || '').toUpperCase() === 'BPMJ') return 'BPMJ';
  const slug = String(node?.slug || '').toUpperCase();
  if (slug === 'BPMJ' || slug.startsWith('BPMJ_')) return 'BPMJ';
  if (slug === 'KOMISI' || slug.startsWith('KOMISI_')) return 'KOMISI';
  if (slug === 'TIMKERJA' || slug === 'TIMKERJA_BOD' || slug.startsWith('BOD_') || slug.startsWith('TIMKERJA_')) {
    return 'TIMKERJA';
  }
  for (const p of LANDING_PILLARS) {
    if (slug === p || slug.startsWith(`${p}_`)) return p;
  }
  return null;
}

export function isLandingPublicSlot(node) {
  if (!node || String(node.nodeKind) !== 'POSITION_SLOT') return false;
  if (!LANDING_ORG_DOMAINS.includes(String(node.domain || '').toUpperCase())) return false;
  const slug = String(node.slug || '').toUpperCase();
  if (HIDDEN_SLUGS.has(slug) || slug.startsWith('INDIVIDU_')) return false;
  const m = parseMeta(node.metadata);
  if (m.requiresGroup) return false;
  const division = publicDivisionOf(node);
  if (!division) return false;
  if (isLegacyPantaSlot(node)) return false;
  if (!isCanonicalPillarSubdivision(division, m.subdivision)) return false;
  return true;
}

export function isPublishableAssignee(user) {
  if (!user || !String(user.name || '').trim()) return false;
  if (isSystemAccount(user)) return false;
  if (isDemoEmail(user.email)) return false;
  return true;
}

/**
 * Flatten org slots + assignments into the public landing member list.
 * Empty slots stay as isOpenRole so the tree still shows structure.
 */
export function toPublicOrgMembers(nodes, assignments) {
  const byNode = new Map();
  for (const a of assignments || []) {
    if (a && a.isActive === false) continue;
    const nodeId = a?.orgNodeId;
    if (!nodeId) continue;
    if (!byNode.has(nodeId)) byNode.set(nodeId, []);
    byNode.get(nodeId).push(a);
  }

  const slots = (nodes || [])
    .filter(isLandingPublicSlot)
    .sort((a, b) => {
      const da = publicDivisionOf(a) || '';
      const db = publicDivisionOf(b) || '';
      if (da !== db) return da.localeCompare(db);
      return (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)
        || String(a.label || '').localeCompare(String(b.label || ''));
    });

  const members = [];
  let order = 0;
  for (const node of slots) {
    const m = parseMeta(node.metadata);
    const division = publicDivisionOf(node);
    const position = m.position || node.label || '';
    const subdivision = m.subdivision || null;
    const people = (byNode.get(node.id) || [])
      .map((row) => row.user)
      .filter(isPublishableAssignee);

    if (people.length) {
      for (const user of people) {
        members.push({
          id: `${node.id}:${user.id}`,
          slotId: node.id,
          name: String(user.name).trim(),
          position,
          division,
          subdivision,
          photoUrl: user.avatar || null,
          order: order++,
          isOpenRole: false,
        });
      }
    } else {
      members.push({
        id: node.id,
        slotId: node.id,
        name: node.label || position,
        position,
        division,
        subdivision,
        photoUrl: null,
        order: order++,
        isOpenRole: true,
      });
    }
  }

  return {
    members,
    hasRealPeople: members.some((item) => !item.isOpenRole),
  };
}
