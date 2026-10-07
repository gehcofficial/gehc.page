/**
 * Marturia — liputan (shotlist), galeri-assign support, antrean desain,
 * jiwa baru misi + referral. Sprint A.
 *
 * Tulis: SUPERADMIN/KOMISI/COMMITTEE + anggota divisi MARTURIA.
 * Baca: semua peran login (kurasi terlihat agar cover Warta bisa dipakai lintas divisi).
 */
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { requireDivision } from '../lib/division-access.mjs';
import { newEntityId } from '../lib/drive-ownership.mjs';

const WRITE_ROLES = ['SUPERADMIN', 'KOMISI', 'COMMITTEE'];

const SHOTLIST_DEFAULTS = [
  'Suasana venue pra-acara',
  'Pujian & musik',
  'Firman / khotbah',
  'FGD / pleno / sesi inti',
  'Komunitas kelompok',
  'Distribusi konsumsi & kebersamaan',
];

const ASSET_STATUS = new Set(['DIMINTA', 'DIGARAP', 'REVIEW', 'FINAL', 'HANDOFF']);
const ASSET_NEXT = { DIMINTA: 'DIGARAP', DIGARAP: 'REVIEW', REVIEW: 'FINAL', FINAL: 'HANDOFF', HANDOFF: null };
const SOUL_STATUS = new Set(['BARU', 'DIHUBUNGI', 'HADIR', 'DISERAHKAN']);

function noDb(res) {
  res.json({ items: [], disabled: true });
}

export function registerMarturiaRoutes(app, { wrap }) {
  const needTable = (prisma, table) => {
    if (!prisma || !prisma[table]) return false;
    return true;
  };

  // ---- Shotlist ----
  app.get('/api/events/:id/marturia/shotlist', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!needTable(prisma, 'marturiaShotlist')) return noDb(res);
    const items = await prisma.marturiaShotlist.findMany({
      where: { eventId: req.params.id },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ items });
  }));

  // Seed 6 item default bila masih kosong (idempoten).
  app.post(
    '/api/events/:id/marturia/shotlist/seed',
    requireRole(...WRITE_ROLES), requireDivision('MARTURIA'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!needTable(prisma, 'marturiaShotlist')) return res.status(503).json({ error: 'Database belum siap.' });
      const existing = await prisma.marturiaShotlist.count({ where: { eventId: req.params.id } });
      if (existing > 0) return res.json({ seeded: 0, kept: existing });
      await prisma.marturiaShotlist.createMany({
        data: SHOTLIST_DEFAULTS.map((item, i) => ({
          id: newEntityId('mshot'),
          eventId: req.params.id,
          item,
          sortOrder: i,
        })),
      });
      const items = await prisma.marturiaShotlist.findMany({
        where: { eventId: req.params.id },
        orderBy: [{ sortOrder: 'asc' }],
      });
      res.json({ seeded: items.length, items });
    }),
  );

  app.post(
    '/api/events/:id/marturia/shotlist',
    requireRole(...WRITE_ROLES), requireDivision('MARTURIA'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!needTable(prisma, 'marturiaShotlist')) return res.status(503).json({ error: 'Database belum siap.' });
      const item = String(req.body?.item || '').trim().slice(0, 300);
      if (!item) return res.status(400).json({ error: 'Isi shotlist dulu.' });
      const count = await prisma.marturiaShotlist.count({ where: { eventId: req.params.id } });
      const created = await prisma.marturiaShotlist.create({
        data: { id: newEntityId('mshot'), eventId: req.params.id, item, sortOrder: count },
      });
      res.json({ item: created });
    }),
  );

  app.patch(
    '/api/marturia/shotlist/:id',
    requireRole(...WRITE_ROLES), requireDivision('MARTURIA'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!needTable(prisma, 'marturiaShotlist')) return res.status(503).json({ error: 'Database belum siap.' });
      const data = {};
      if (typeof req.body?.done === 'boolean') {
        data.done = req.body.done;
        data.doneById = req.body.done ? req.authUser?.id || null : null;
      }
      if (req.body?.assigneeId !== undefined) {
        data.assigneeId = req.body.assigneeId ? String(req.body.assigneeId) : null;
      }
      if (!Object.keys(data).length) return res.status(400).json({ error: 'Tidak ada perubahan.' });
      const updated = await prisma.marturiaShotlist.update({ where: { id: req.params.id }, data });
      res.json({ item: updated });
    }),
  );

  app.delete(
    '/api/marturia/shotlist/:id',
    requireRole(...WRITE_ROLES), requireDivision('MARTURIA'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!needTable(prisma, 'marturiaShotlist')) return res.status(503).json({ error: 'Database belum siap.' });
      await prisma.marturiaShotlist.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    }),
  );

  // ---- Aset desain ----
  app.get('/api/events/:id/marturia/assets', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!needTable(prisma, 'marturiaAsset')) return noDb(res);
    const items = await prisma.marturiaAsset.findMany({
      where: { eventId: req.params.id },
      include: { versions: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ items });
  }));

  app.post(
    '/api/events/:id/marturia/assets',
    requireRole(...WRITE_ROLES),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!needTable(prisma, 'marturiaAsset')) return res.status(503).json({ error: 'Database belum siap.' });
      const title = String(req.body?.title || '').trim().slice(0, 200);
      if (!title) return res.status(400).json({ error: 'Judul asset wajib diisi.' });
      const created = await prisma.marturiaAsset.create({
        data: {
          id: newEntityId('masset'),
          eventId: req.params.id,
          title,
          brief: String(req.body?.brief || '').slice(0, 5000) || null,
          requesterDiv: String(req.body?.requesterDivision || 'KOINONIA').toUpperCase().slice(0, 24),
          createdById: req.authUser?.id || null,
        },
      });
      res.json({ item: created });
    }),
  );

  app.patch(
    '/api/marturia/assets/:id',
    requireRole(...WRITE_ROLES), requireDivision('MARTURIA'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!needTable(prisma, 'marturiaAsset')) return res.status(503).json({ error: 'Database belum siap.' });
      const found = await prisma.marturiaAsset.findUnique({ where: { id: req.params.id } });
      if (!found) return res.status(404).json({ error: 'Asset tidak ditemukan.' });
      const data = {};
      const status = String(req.body?.status || '').toUpperCase();
      if (status) {
        if (!ASSET_STATUS.has(status)) return res.status(400).json({ error: 'Status tidak dikenal.' });
        // Maju satu langkah (HANDOFF terminal). Koreksi manual mundur ditolak.
        const expected = ASSET_NEXT[found.status];
        if (status !== found.status && status !== expected) {
          return res.status(409).json({ error: `Alur asset: ${found.status} → ${expected || '(selesai)'}.` });
        }
        data.status = status;
        if (status === 'HANDOFF') data.handoffTo = String(req.body?.handoffTo || 'KOINONIA').toUpperCase().slice(0, 24);
      }
      if (!Object.keys(data).length) return res.status(400).json({ error: 'Tidak ada perubahan.' });
      const updated = await prisma.marturiaAsset.update({ where: { id: found.id }, data });
      res.json({ item: updated });
    }),
  );

  app.delete(
    '/api/marturia/assets/:id',
    requireRole(...WRITE_ROLES), requireDivision('MARTURIA'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!needTable(prisma, 'marturiaAsset')) return res.status(503).json({ error: 'Database belum siap.' });
      await prisma.marturiaAsset.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    }),
  );

  app.post(
    '/api/marturia/assets/:id/versions',
    requireRole(...WRITE_ROLES), requireDivision('MARTURIA'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!needTable(prisma, 'marturiaAssetVersion')) return res.status(503).json({ error: 'Database belum siap.' });
      const url = String(req.body?.url || '').trim();
      if (!url) return res.status(400).json({ error: 'URL versi wajib diisi (link Drive).' });
      const created = await prisma.marturiaAssetVersion.create({
        data: {
          id: newEntityId('mver'),
          assetId: req.params.id,
          url: url.slice(0, 2000),
          note: String(req.body?.note || '').slice(0, 500) || null,
          createdById: req.authUser?.id || null,
        },
      });
      res.json({ version: created });
    }),
  );

  // ---- Jiwa baru ----
  app.get('/api/events/:id/marturia/souls', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!needTable(prisma, 'marturiaSoul')) return noDb(res);
    const items = await prisma.marturiaSoul.findMany({
      where: { eventId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ items });
  }));

  app.post(
    '/api/events/:id/marturia/souls',
    requireRole(...WRITE_ROLES), requireDivision('MARTURIA'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!needTable(prisma, 'marturiaSoul')) return res.status(503).json({ error: 'Database belum siap.' });
      const nickname = String(req.body?.nickname || '').trim().slice(0, 120);
      if (!nickname) return res.status(400).json({ error: 'Nama panggilan wajib diisi.' });
      const created = await prisma.marturiaSoul.create({
        data: {
          id: newEntityId('msoul'),
          eventId: req.params.id,
          nickname,
          inviterId: req.body?.inviterId ? String(req.body.inviterId) : (req.authUser?.id || null),
          referralCode: req.body?.referralCode ? String(req.body.referralCode).toUpperCase().slice(0, 32) : null,
          createdById: req.authUser?.id || null,
        },
      });
      res.json({ item: created });
    }),
  );

  app.patch(
    '/api/marturia/souls/:id',
    requireRole(...WRITE_ROLES), requireDivision('MARTURIA'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!needTable(prisma, 'marturiaSoul')) return res.status(503).json({ error: 'Database belum siap.' });
      const data = {};
      const status = String(req.body?.status || '').toUpperCase();
      if (status) {
        if (!SOUL_STATUS.has(status)) return res.status(400).json({ error: 'Status tidak dikenal.' });
        data.status = status;
      }
      if (req.body?.handoverNote !== undefined) data.handoverNote = String(req.body.handoverNote || '').slice(0, 5000) || null;
      if (!Object.keys(data).length) return res.status(400).json({ error: 'Tidak ada perubahan.' });
      const updated = await prisma.marturiaSoul.update({ where: { id: req.params.id }, data });
      res.json({ item: updated });
    }),
  );

  app.delete(
    '/api/marturia/souls/:id',
    requireRole(...WRITE_ROLES), requireDivision('MARTURIA'),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!needTable(prisma, 'marturiaSoul')) return res.status(503).json({ error: 'Database belum siap.' });
      await prisma.marturiaSoul.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    }),
  );

  // ---- Referral ----
  app.get('/api/marturia/referrals/mine', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!needTable(prisma, 'marturiaReferral')) return noDb(res);
    const items = await prisma.marturiaReferral.findMany({
      where: { inviterId: req.authUser?.id || '' },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ items });
  }));

  app.post('/api/marturia/referrals', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!needTable(prisma, 'marturiaReferral')) return res.status(503).json({ error: 'Database belum siap.' });
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      let c = 'GB-';
      for (let i = 0; i < 6; i += 1) c += alphabet[Math.floor(Math.random() * alphabet.length)];
      // eslint-disable-next-line no-await-in-loop
      const clash = await prisma.marturiaReferral.findUnique({ where: { code: c } }).catch(() => null);
      if (!clash) { code = c; break; }
    }
    if (!code) return res.status(500).json({ error: 'Gagal membuat kode, coba lagi.' });
    const created = await prisma.marturiaReferral.create({
      data: { id: newEntityId('mref'), code, inviterId: req.authUser?.id || '' },
    });
    res.json({ item: created });
  }));

  // Publik tanpa login: hitung klik + info tujuan daftar.
  app.get('/api/r/:code', wrap(async (req, res) => {
    const prisma = getPrisma();
    const code = String(req.params.code || '').toUpperCase();
    if (!prisma || !prisma.marturiaReferral) return res.json({ code, registerUrl: '/#/register' });
    const found = await prisma.marturiaReferral.findUnique({ where: { code } }).catch(() => null);
    if (!found) return res.status(404).json({ error: 'Kode ajakan tidak dikenal.' });
    await prisma.marturiaReferral.update({ where: { id: found.id }, data: { clicks: { increment: 1 } } }).catch(() => null);
    res.json({ code, registerUrl: `/#/register?ref=${encodeURIComponent(code)}`, inviterId: found.inviterId });
  }));
}
