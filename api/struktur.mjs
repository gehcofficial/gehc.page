import 'dotenv/config';
import express from 'express';
import { getPrisma, isDbConfigured } from '../server/db.mjs';
import { requireRole } from '../server/auth.mjs';

const app = express();
app.use(express.json({ limit: '2mb' }));

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error(`[struktur] ${req.method} ${req.path} →`, err.message);
  res.status(500).json({ error: err.message });
});

// Struktur organisasi (publik — dipakai landing pohon pantatugas)
app.get('/api/db/struktur', wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const members = await prisma.strukturMember.findMany({ orderBy: { sortOrder: 'asc' } });
  res.json({ members });
}));

// Sinkronisasi struktur dari portal (replace-all: upsert semua, hapus yang tidak dikirim)
app.post('/api/db/sync-struktur', requireRole('SUPERADMIN', 'KOMISI', 'COMMITTEE'), wrap(async (req, res) => {
  const prisma = getPrisma();
  if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
  const list = Array.isArray(req.body?.members) ? req.body.members : [];
  for (const [i, m] of list.entries()) {
    if (!m?.id || !m?.name) continue;
    const data = {
      name: m.name,
      position: m.position ?? null,
      division: m.division ?? null,
      subdivision: m.subdivision ?? null,
      period: m.period ?? null,
      photoUrl: m.photoUrl ?? null,
      bio: m.bio ?? null,
      phone: m.phone ?? null,
      email: m.email ?? null,
      sortOrder: Number.isFinite(m.order) ? m.order : i,
      isOpenRole: Boolean(m.isOpenRole ?? m.is_open_role),
      role: m.role ?? null,
      roleOrder: Number.isFinite(m.roleOrder) ? m.roleOrder : 0,
      isDoubleRole: Boolean(m.isDoubleRole ?? false),
      subRoleId: m.subRoleId ?? null,
      groupId: m.groupId ?? null,
    };
    await prisma.strukturMember.upsert({ where: { id: m.id }, create: { id: m.id, ...data }, update: data });
  }
  const keepIds = list.map((m) => m.id).filter(Boolean);
  const removed = await prisma.strukturMember.deleteMany({
    where: keepIds.length ? { id: { notIn: keepIds } } : {},
  });
  res.json({ synced: list.length, removed: removed.count });
}));

export default app;