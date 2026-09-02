import crypto from 'node:crypto';
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { isKomisiOrSuperadmin, globalRoles } from '../division-rbac.mjs';

const SCOPES = ['BPMJ', 'KOMISI', 'KOLOM'];
const SEASONS = ['NATAL', 'PASKAH', 'HUT', 'REGULAR'];
const idOf = () => `cprog-${crypto.randomUUID()}`;

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
      const programs = await prisma.churchProgram.findMany({
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
}
