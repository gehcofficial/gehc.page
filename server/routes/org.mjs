import crypto from 'node:crypto';
import { requireRole } from '../auth.mjs';
import { getPrisma } from '../db.mjs';
import { KOMISION, KOMISION_CORE } from '../lib/rbac-constants.mjs';
import { isPlatformAdminActor } from '../lib/platform-rbac.mjs';
import { resolveAssignedByUserId } from '../role-assign.mjs';
import {
  assignOrgSlot,
  buildOrgTree,
  deactivateOrgAssignment,
  genOrgId,
} from '../services/org-assign.mjs';

const VALID_DOMAINS = ['CHURCH', 'BIPRA', 'YOUTH', 'KOLOM'];
const NODE_KINDS = ['BRANCH', 'POSITION_SLOT', 'GROUP_REF'];

function parseMeta(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  return {};
}

/** Komisi/Tim Kerja, atau sesi platform operator/admin (#/admin). */
function requireKomisiOrPlatformAdmin(...roles) {
  const roleMw = requireRole(...roles);
  return (req, res, next) => {
    if (isPlatformAdminActor(req)) return next();
    return roleMw(req, res, next);
  };
}

/** Org hierarchy routes — tree CRUD + slot assignment */
export function registerOrgRoutes(app, { wrap }) {
  app.get('/api/org/nodes', requireKomisiOrPlatformAdmin(...KOMISION), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const domain = String(req.query.domain || 'CHURCH').toUpperCase();
    if (!VALID_DOMAINS.includes(domain)) {
      return res.status(400).json({ error: 'domain tidak valid.' });
    }

    const includeInactive = req.query.includeInactive === '1';
    const nodes = await prisma.orgNode.findMany({
      where: { domain, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });

    res.json({ domain, tree: buildOrgTree(nodes), nodes });
  }));

  app.post('/api/org/nodes', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const domain = String(req.body?.domain || '').toUpperCase();
    const slug = String(req.body?.slug || '').trim().toUpperCase().replace(/\s+/g, '_');
    const label = String(req.body?.label || '').trim();
    const nodeKind = String(req.body?.nodeKind || 'BRANCH').toUpperCase();
    const parentId = req.body?.parentId ? String(req.body.parentId) : null;
    const metadata = parseMeta(req.body?.metadata);
    const sortOrder = Number(req.body?.sortOrder ?? 0);

    if (!VALID_DOMAINS.includes(domain)) return res.status(400).json({ error: 'domain tidak valid.' });
    if (!slug || !label) return res.status(400).json({ error: 'slug dan label wajib.' });
    if (!NODE_KINDS.includes(nodeKind)) return res.status(400).json({ error: 'nodeKind tidak valid.' });

    const dup = await prisma.orgNode.findFirst({ where: { domain, slug } });
    if (dup) return res.status(409).json({ error: 'slug sudah dipakai di domain ini.' });

    if (parentId) {
      const parent = await prisma.orgNode.findUnique({ where: { id: parentId } });
      if (!parent || parent.domain !== domain) {
        return res.status(400).json({ error: 'parentId tidak valid.' });
      }
    }

    const node = await prisma.orgNode.create({
      data: {
        id: genOrgId(),
        domain,
        parentId,
        slug,
        label,
        nodeKind,
        metadata,
        sortOrder,
        isActive: true,
      },
    });
    res.json({ node });
  }));

  app.patch('/api/org/nodes/reorder', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const items = req.body?.items;
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'items array wajib.' });
    }

    for (const item of items) {
      if (!item?.id || item.sortOrder === undefined) continue;
      await prisma.orgNode.update({
        where: { id: String(item.id) },
        data: { sortOrder: Number(item.sortOrder) },
      });
    }
    res.json({ ok: true, updated: items.length });
  }));

  app.patch('/api/org/nodes/:id', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const existing = await prisma.orgNode.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Node tidak ditemukan.' });

    const data = {};
    if (req.body?.label !== undefined) data.label = String(req.body.label).trim();
    if (req.body?.sortOrder !== undefined) data.sortOrder = Number(req.body.sortOrder);
    if (req.body?.isActive !== undefined) data.isActive = Boolean(req.body.isActive);
    if (req.body?.metadata !== undefined) data.metadata = parseMeta(req.body.metadata);
    if (req.body?.parentId !== undefined) {
      const parentId = req.body.parentId ? String(req.body.parentId) : null;
      if (parentId) {
        const parent = await prisma.orgNode.findUnique({ where: { id: parentId } });
        if (!parent || parent.domain !== existing.domain) {
          return res.status(400).json({ error: 'parentId tidak valid.' });
        }
      }
      data.parentId = parentId;
    }

    if (!Object.keys(data).length) return res.status(400).json({ error: 'Tidak ada field untuk diupdate.' });

    const node = await prisma.orgNode.update({ where: { id: existing.id }, data });
    res.json({ node });
  }));

  app.delete('/api/org/nodes/:id', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const existing = await prisma.orgNode.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Node tidak ditemukan.' });

    const activeAssign = await prisma.orgAssignment.count({
      where: { orgNodeId: existing.id, isActive: true },
    });
    if (activeAssign > 0) {
      return res.status(400).json({ error: 'Node masih punya penugasan aktif.' });
    }

    await prisma.orgNode.update({ where: { id: existing.id }, data: { isActive: false } });
    res.json({ ok: true });
  }));

  app.post('/api/org/assignments', requireKomisiOrPlatformAdmin(...KOMISION_CORE), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const assignerId = await resolveAssignedByUserId(
      prisma,
      req.authUser?.id || req.platformOperator?.id,
    );

    const { userId, orgNodeId, position, groupId, familyRole, note } = req.body || {};
    if (!userId || !orgNodeId) {
      return res.status(400).json({ error: 'userId dan orgNodeId wajib.' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });

    try {
      const result = await assignOrgSlot(prisma, {
        userId,
        orgNodeId,
        positionOverride: position || null,
        groupId: groupId || null,
        familyRole: familyRole || null,
        assignedBy: assignerId,
        note: note || null,
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }));

  app.delete('/api/org/assignments/:id', requireRole(...KOMISION_CORE), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    try {
      await deactivateOrgAssignment(prisma, req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  }));

  app.get('/api/org/assignments', requireKomisiOrPlatformAdmin(...KOMISION), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const domain = req.query.domain ? String(req.query.domain).toUpperCase() : null;
    const userId = req.query.userId ? String(req.query.userId) : null;
    const kolomId = req.query.kolomId ? String(req.query.kolomId) : null;

    const where = { isActive: true };
    if (userId) where.userId = userId;

    const rows = await prisma.orgAssignment.findMany({
      where,
      include: {
        orgNode: true,
        user: { select: { id: true, name: true, email: true, avatar: true, kolomId: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });

    let filtered = rows;
    if (domain) filtered = filtered.filter((r) => r.orgNode?.domain === domain);
    if (kolomId) {
      filtered = filtered.filter((r) => {
        const m = parseMeta(r.orgNode?.metadata);
        return m.linkedKolomId === kolomId;
      });
    }

    res.json({ assignments: filtered });
  }));
}
