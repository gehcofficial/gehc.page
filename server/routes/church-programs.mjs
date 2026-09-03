import crypto from 'node:crypto';
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { isKomisiOrSuperadmin, globalRoles } from '../division-rbac.mjs';

const SCOPES = ['BPMJ', 'KOMISI', 'KOLOM'];
const SEASONS = ['NATAL', 'PASKAH', 'HUT', 'REGULAR'];
const TENANT_DEFAULT = 'tenant-youth';
const idOf = () => `cprog-${crypto.randomUUID()}`;

const tenantOf = (req) => req.authUser?.tenantId || process.env.TENANT_ID || TENANT_DEFAULT;

function canCreateScope(authUser, scope) {
  if (isKomisiOrSuperadmin(authUser)) return scope !== 'BPMJ' || globalRoles(authUser).includes('SUPERADMIN');
  const roles = globalRoles(authUser);
  if (scope === 'BPMJ') return roles.includes('BPMJ') || roles.includes('SUPERADMIN');
  if (scope === 'KOMISI' || scope === 'KOLOM') return roles.includes('KOMISI') || roles.includes('SUPERADMIN');
  return false;
}

export function registerChurchProgramRoutes(app, { wrap }) {
  app.get(
    '/api/church-programs',
    requireRole('KOMISI', 'COMMITTEE', 'BPMJ'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const where = { tenantId: tenantOf(req) };
      if (req.query.scope) where.scope = String(req.query.scope).toUpperCase();
      if (req.query.season) where.season = String(req.query.season).toUpperCase();
      if (req.query.year) where.year = Number(req.query.year);

      const programs = await prisma.churchProgram.findMany({
        where,
        include: {
          events: { select: { id: true, name: true, slug: true, status: true, kind: true } },
        },
        orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
      });
      res.json({ programs });
    }),
  );

  app.post(
    '/api/church-programs',
    requireRole('KOMISI', 'BPMJ'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      const scope = String(req.body?.scope || '').toUpperCase();
      const name = String(req.body?.name || '').trim();
      if (!SCOPES.includes(scope) || !name) {
        return res.status(400).json({ error: 'scope (BPMJ|KOMISI|KOLOM) dan name wajib.' });
      }
      if (!canCreateScope(req.authUser, scope)) {
        return res.status(403).json({ error: `Anda tidak boleh membuat payung ${scope}.` });
      }
      const season = req.body?.season ? String(req.body.season).toUpperCase() : null;
      if (season && !SEASONS.includes(season)) {
        return res.status(400).json({ error: 'season tidak valid.' });
      }
      const created = await prisma.churchProgram.create({
        data: {
          id: idOf(),
          tenantId: tenantOf(req),
          scope,
          parentId: req.body?.parentId || null,
          kolomId: req.body?.kolomId || null,
          season,
          name,
          description: req.body?.description || null,
          year: req.body?.year ? Number(req.body.year) : new Date().getFullYear(),
          createdById: req.authUser.id,
        },
      });
      res.status(201).json({ program: created });
    }),
  );

  app.patch(
    '/api/church-programs/:id',
    requireRole('KOMISI', 'BPMJ'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

      const existing = await prisma.churchProgram.findUnique({ where: { id: req.params.id } });
      if (!existing || existing.tenantId !== tenantOf(req)) {
        return res.status(404).json({ error: 'Payung tidak ditemukan.' });
      }
      if (!canCreateScope(req.authUser, existing.scope)) {
        return res.status(403).json({ error: `Anda tidak boleh mengubah payung ${existing.scope}.` });
      }

      const data = {};
      if (req.body?.name !== undefined) {
        const name = String(req.body.name).trim();
        if (!name) return res.status(400).json({ error: 'name tidak boleh kosong.' });
        data.name = name;
      }
      if (req.body?.season !== undefined) {
        const season = req.body.season ? String(req.body.season).toUpperCase() : null;
        if (season && !SEASONS.includes(season)) return res.status(400).json({ error: 'season tidak valid.' });
        data.season = season;
      }
      if (req.body?.description !== undefined) data.description = req.body.description || null;
      if (req.body?.year !== undefined) data.year = req.body.year ? Number(req.body.year) : null;
      if (req.body?.parentId !== undefined) data.parentId = req.body.parentId || null;
      if (req.body?.kolomId !== undefined) data.kolomId = req.body.kolomId || null;
      if (!Object.keys(data).length) return res.status(400).json({ error: 'Tidak ada perubahan.' });

      if (data.parentId && data.parentId === existing.id) {
        return res.status(400).json({ error: 'Payung tidak boleh menjadi induk dirinya sendiri.' });
      }

      const program = await prisma.churchProgram.update({ where: { id: existing.id }, data });
      res.json({ program });
    }),
  );

  app.delete(
    '/api/church-programs/:id',
    requireRole('KOMISI', 'BPMJ'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

      const existing = await prisma.churchProgram.findUnique({
        where: { id: req.params.id },
        include: {
          events: { select: { id: true } },
          children: { select: { id: true } },
          calendarEntries: { select: { id: true } },
        },
      });
      if (!existing || existing.tenantId !== tenantOf(req)) {
        return res.status(404).json({ error: 'Payung tidak ditemukan.' });
      }
      if (!canCreateScope(req.authUser, existing.scope)) {
        return res.status(403).json({ error: `Anda tidak boleh menghapus payung ${existing.scope}.` });
      }
      const refs = existing.events.length + existing.children.length + existing.calendarEntries.length;
      if (refs) {
        return res.status(409).json({
          error: `Masih terpakai: ${existing.events.length} event, ${existing.children.length} sub-payung, ${existing.calendarEntries.length} entri kalender. Lepaskan dulu.`,
        });
      }

      await prisma.churchProgram.delete({ where: { id: existing.id } });
      res.json({ ok: true });
    }),
  );
}
