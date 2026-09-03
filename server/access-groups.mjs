/**
 * Access Groups — RLS-like email bundles that auto-apply roles on login.
 */
import crypto from 'node:crypto';
import { getPrisma, isDbConfigured } from './db.mjs';

const ROLE_ORDER = ['SUPERADMIN', 'BPMJ', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR', 'MENTEE', 'ALUMNI'];
const TENANT_ID = 'tenant-youth';

function slugify(name) {
  return String(name || 'group')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72) || 'group';
}

function parseRoles(raw) {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.map(String) : [];
    } catch {
      return raw.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

export function pickDefaultActiveRole(user) {
  const roles = (user?.roles || []).map((r) => r.role);
  if (!roles.length) return null;
  if (roles.length === 1) return roles[0];
  for (const r of ROLE_ORDER) {
    if (roles.includes(r)) return r;
  }
  return roles[0];
}

/** Apply group entitlements for email — idempotent role grants. */
export async function applyGroupEntitlements(emailRaw, userId) {
  if (!isDbConfigured()) return;
  const email = String(emailRaw || '').toLowerCase().trim();
  if (!email || !userId) return;
  const prisma = getPrisma();
  if (!prisma) return;

  const memberships = await prisma.accessGroupMember.findMany({
    where: {
      email,
      status: { in: ['PENDING', 'ACTIVE'] },
      group: { isActive: true, autoApplyOnLogin: true },
    },
    include: { group: true },
  });
  if (!memberships.length) return;

  const existing = await prisma.userRole.findMany({ where: { userId } });
  const have = new Set(existing.map((r) => `${r.role}::${r.groupId || ''}`));
  const toCreate = [];

  for (const m of memberships) {
    const roles = parseRoles(m.group.roles);
    const groupId = m.group.groupId || null;
    for (const role of roles) {
      const key = `${role}::${groupId || ''}`;
      if (!have.has(key)) {
        toCreate.push({ userId, tenantId: TENANT_ID, role, groupId });
        have.add(key);
      }
    }
    if (m.status === 'PENDING' || !m.userId) {
      await prisma.accessGroupMember.update({
        where: { id: m.id },
        data: { status: 'ACTIVE', userId },
      });
    }
  }

  if (toCreate.length) {
    await prisma.userRole.createMany({ data: toCreate, skipDuplicates: true });
  }
}

export async function listAccessGroups() {
  const prisma = getPrisma();
  if (!prisma) return [];
  const groups = await prisma.accessGroup.findMany({
    orderBy: { createdAt: 'desc' },
    include: { members: { orderBy: { createdAt: 'desc' }, take: 200 } },
  });
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    slug: g.slug,
    description: g.description,
    roles: parseRoles(g.roles),
    orgNodeId: g.orgNodeId,
    groupId: g.groupId,
    autoApplyOnLogin: g.autoApplyOnLogin,
    isActive: g.isActive,
    memberCount: g.members.length,
    members: g.members.map((m) => ({
      id: m.id,
      email: m.email,
      userId: m.userId,
      status: m.status,
      createdAt: m.createdAt,
    })),
    createdAt: g.createdAt,
  }));
}

export async function createAccessGroup(data, createdBy) {
  const prisma = getPrisma();
  if (!prisma) throw new Error('DATABASE_URL belum dikonfigurasi.');
  const name = String(data.name || '').trim();
  if (!name) throw new Error('Nama grup wajib.');
  const roles = parseRoles(data.roles);
  if (!roles.length) throw new Error('Minimal satu role.');
  let slug = slugify(data.slug || name);
  const taken = await prisma.accessGroup.findUnique({ where: { slug } });
  if (taken) slug = `${slug}-${crypto.randomBytes(3).toString('hex')}`;
  const id = `ag-${crypto.randomBytes(8).toString('hex')}`;
  const group = await prisma.accessGroup.create({
    data: {
      id,
      name,
      slug,
      description: data.description || null,
      roles,
      orgNodeId: data.orgNodeId || null,
      groupId: data.groupId || null,
      autoApplyOnLogin: data.autoApplyOnLogin !== false,
      isActive: true,
      createdBy: createdBy || null,
    },
  });
  return { id: group.id, slug: group.slug };
}

export async function addAccessGroupMembers(groupId, emailsRaw, addedBy) {
  const prisma = getPrisma();
  if (!prisma) throw new Error('DATABASE_URL belum dikonfigurasi.');
  const group = await prisma.accessGroup.findUnique({ where: { id: groupId } });
  if (!group) throw new Error('Grup tidak ditemukan.');
  const emails = (Array.isArray(emailsRaw) ? emailsRaw : String(emailsRaw || '').split(/[\n,;]+/))
    .map((e) => String(e).toLowerCase().trim())
    .filter((e) => e.includes('@'));
  if (!emails.length) throw new Error('Daftar email kosong.');
  let added = 0;
  for (const email of emails) {
    const existing = await prisma.user.findUnique({ where: { email } });
    try {
      await prisma.accessGroupMember.upsert({
        where: { groupId_email: { groupId, email } },
        create: {
          id: `agm-${crypto.randomBytes(8).toString('hex')}`,
          groupId,
          email,
          userId: existing?.id || null,
          status: existing ? 'ACTIVE' : 'PENDING',
          addedBy: addedBy || null,
        },
        update: {},
      });
      added++;
      if (existing) await applyGroupEntitlements(email, existing.id);
    } catch {
      /* skip duplicate race */
    }
  }
  return { added, total: emails.length };
}

export async function deleteAccessGroup(groupId) {
  const prisma = getPrisma();
  if (!prisma) throw new Error('DATABASE_URL belum dikonfigurasi.');
  await prisma.accessGroup.delete({ where: { id: groupId } });
  return { ok: true };
}

export async function removeAccessGroupMember(memberId) {
  const prisma = getPrisma();
  if (!prisma) throw new Error('DATABASE_URL belum dikonfigurasi.');
  await prisma.accessGroupMember.delete({ where: { id: memberId } });
  return { ok: true };
}
