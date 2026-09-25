/**
 * Voting logo kelompok (Beyonders) — pemilihan 1 dari 2 opsi logo per grup.
 * Setiap anggota grup (aktif/alumni) hanya memilih untuk grupnya sendiri.
 */
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { isKomisiOrSuperadmin, globalRoles } from '../division-rbac.mjs';
import { getDriveMode, getFileStream, getFileStreamAsServiceAccount } from '../gdrive.mjs';

/** Grup milik user: GroupMember (ACTIVE/ALUMNI) + RoleAssignment.groupId. */
export async function myGroupIds(authUser) {
  if (!authUser?.id) return [];
  const fromRoles = (authUser.roles || []).map((r) => r.groupId).filter(Boolean);
  const prisma = getPrisma();
  if (!prisma) return [...new Set(fromRoles)];
  try {
    const [gm, ra] = await Promise.all([
      prisma.groupMember.findMany({
        where: { userId: authUser.id, status: { in: ['ACTIVE', 'ALUMNI'] } },
        select: { groupId: true },
      }).catch(() => []),
      prisma.roleAssignment.findMany({
        where: { userId: authUser.id, isActive: true, groupId: { not: null } },
        select: { groupId: true },
      }).catch(() => []),
    ]);
    return [...new Set([
      ...fromRoles,
      ...gm.map((r) => r.groupId),
      ...ra.map((r) => r.groupId),
    ].filter(Boolean))];
  } catch {
    return [...new Set(fromRoles)];
  }
}

/** Boleh memilih di grup ini? (anggota ACTIVE/ALUMNI, atau staf). */
export async function canVoteForGroup(authUser, groupId) {
  if (!authUser?.id || !groupId) return false;
  if (isKomisiOrSuperadmin(authUser)) return true;
  const ids = await myGroupIds(authUser);
  return ids.includes(groupId);
}

export function isVoteAdmin(authUser) {
  const roles = globalRoles(authUser);
  return roles.includes('SUPERADMIN') || roles.includes('KOMISI') || roles.includes('COMMITTEE');
}

const SESSION_STATUSES = ['DRAFT', 'OPEN', 'CLOSED'];

export function registerLogoVoteRoutes(app, { wrap }) {
  async function loadSession(prisma) {
    const open = await prisma.groupLogoVote.findFirst({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
    }).catch(() => null);
    if (open) return open;
    return prisma.groupLogoVote.findFirst({ orderBy: { createdAt: 'desc' } }).catch(() => null);
  }

  function isOpen(session) {
    if (!session || session.status !== 'OPEN') return false;
    if (session.closesAt && new Date(session.closesAt).getTime() < Date.now()) return false;
    return true;
  }

  // GET /api/voting — sesi + grup & opsi + hak pilih + pilihan user + tally
  app.get('/api/voting', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const session = await loadSession(prisma);
    const canAdmin = isVoteAdmin(req.authUser) || isKomisiOrSuperadmin(req.authUser);
    if (!session) return res.json({ session: null, canAdmin, groups: [], myGroupIds: [] });

    const owned = await myGroupIds(req.authUser);
    const [options, ballots, groups] = await Promise.all([
      prisma.groupLogoOption.findMany({ where: { sessionId: session.id }, orderBy: [{ groupId: 'asc' }, { optionNo: 'asc' }] }).catch(() => []),
      prisma.groupLogoBallot.findMany({ where: { sessionId: session.id, userId: req.authUser.id }, select: { groupId: true, optionId: true } }).catch(() => []),
      prisma.group.findMany({ select: { id: true, name: true } }).catch(() => []),
    ]);
    const groupName = new Map((groups || []).map((g) => [g.id, g.name]));
    const myVote = new Map((ballots || []).map((b) => [b.groupId, b.optionId]));

    const byGroup = new Map();
    for (const o of options || []) {
      if (!byGroup.has(o.groupId)) byGroup.set(o.groupId, []);
      byGroup.get(o.groupId).push(o);
    }

    const visibleGroupIds = canAdmin ? [...byGroup.keys()] : owned.filter((g) => byGroup.has(g));
    const out = visibleGroupIds.map((gid) => {
      const opts = byGroup.get(gid) || [];
      return {
        groupId: gid,
        name: groupName.get(gid) || gid,
        philosophy: opts.find((o) => o.philosophy)?.philosophy || '',
        canVote: isOpen(session) && (owned.includes(gid) || isKomisiOrSuperadmin(req.authUser)),
        myOptionId: myVote.get(gid) || null,
        total: opts.reduce((n, o) => n + (o.voteCount || 0), 0),
        options: opts.map((o) => ({ id: o.id, optionNo: o.optionNo, label: o.label, imageFileId: o.imageFileId, voteCount: o.voteCount || 0 })),
      };
    });

    res.json({
      session: { id: session.id, title: session.title, description: session.description, status: session.status, closesAt: session.closesAt },
      open: isOpen(session),
      canAdmin,
      myGroupIds: owned,
      groups: out,
    });
  }));

  // POST /api/voting/ballot { optionId } — pilih/ganti (1 suara per grup)
  app.post('/api/voting/ballot', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    const optionId = String(req.body?.optionId || '');
    if (!optionId) return res.status(400).json({ error: 'optionId wajib.' });
    const option = await prisma.groupLogoOption.findUnique({ where: { id: optionId } }).catch(() => null);
    if (!option) return res.status(404).json({ error: 'Opsi tidak ditemukan.' });
    const session = await prisma.groupLogoVote.findUnique({ where: { id: option.sessionId } }).catch(() => null);
    if (!isOpen(session)) return res.status(409).json({ error: 'Sesi voting belum dibuka atau sudah ditutup.' });
    const allowed = await canVoteForGroup(req.authUser, option.groupId);
    if (!allowed) return res.status(403).json({ error: 'Anda hanya dapat memilih untuk kelompok Anda.' });

    const userId = req.authUser.id;
    await prisma.groupLogoBallot.upsert({
      where: { sessionId_groupId_userId: { sessionId: option.sessionId, groupId: option.groupId, userId } },
      update: { optionId },
      create: {
        id: `glb-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        sessionId: option.sessionId,
        groupId: option.groupId,
        optionId,
        userId,
      },
    }).catch(async () => {
      // Fallback bila unique composite tak terdeteksi: cari lalu update/crete manual.
      const existing = await prisma.groupLogoBallot.findFirst({ where: { sessionId: option.sessionId, groupId: option.groupId, userId } });
      if (existing) await prisma.groupLogoBallot.update({ where: { id: existing.id }, data: { optionId } });
      else await prisma.groupLogoBallot.create({ data: { id: `glb-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, sessionId: option.sessionId, groupId: option.groupId, optionId, userId } });
    });

    // Recompute tally untuk grup ini (otoritatif dari ballots).
    const opts = await prisma.groupLogoOption.findMany({ where: { sessionId: option.sessionId, groupId: option.groupId }, select: { id: true } });
    const counts = await prisma.groupLogoBallot.groupBy({ by: ['optionId'], where: { sessionId: option.sessionId, groupId: option.groupId }, _count: { _all: true } });
    const countById = new Map(counts.map((c) => [c.optionId, c._count._all]));
    await Promise.all(opts.map((o) => prisma.groupLogoOption.update({ where: { id: o.id }, data: { voteCount: countById.get(o.id) || 0 } })));

    const fresh = await prisma.groupLogoOption.findMany({ where: { sessionId: option.sessionId, groupId: option.groupId }, orderBy: { optionNo: 'asc' } });
    res.json({ ok: true, myOptionId: optionId, options: fresh.map((o) => ({ id: o.id, optionNo: o.optionNo, label: o.label, voteCount: o.voteCount || 0 })) });
  }));

  // GET /api/voting/asset/:fileId — proxy gambar (login-gated)
  app.get('/api/voting/asset/:fileId', requireRole(), wrap(async (req, res) => {
    if (!getDriveMode()) return res.status(503).json({ error: 'Google Drive belum dikonfigurasi.' });
    const fileId = String(req.params.fileId || '');
    if (!fileId) return res.status(400).json({ error: 'fileId wajib.' });
    let got = null;
    try { got = await getFileStream(fileId); } catch { /* coba service account */ }
    if (!got) {
      try { got = await getFileStreamAsServiceAccount(fileId); } catch { /* gagal */ }
    }
    if (!got) return res.status(404).json({ error: 'Gambar tidak ditemukan.' });
    const { meta, stream } = got;
    res.setHeader('Content-Type', meta.mimeType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    stream.on('error', () => { try { res.end(); } catch { /* abaikan */ } });
    stream.pipe(res);
  }));

  // GET /api/voting/results — rekap semua grup (admin)
  app.get('/api/voting/results', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    if (!isVoteAdmin(req.authUser) && !isKomisiOrSuperadmin(req.authUser)) {
      return res.status(403).json({ error: 'Hanya admin yang dapat melihat rekap.' });
    }
    const session = await loadSession(prisma);
    if (!session) return res.json({ session: null, groups: [] });
    const [options, groups] = await Promise.all([
      prisma.groupLogoOption.findMany({ where: { sessionId: session.id }, orderBy: [{ groupId: 'asc' }, { optionNo: 'asc' }] }).catch(() => []),
      prisma.group.findMany({ select: { id: true, name: true } }).catch(() => []),
    ]);
    const name = new Map(groups.map((g) => [g.id, g.name]));
    const byGroup = new Map();
    for (const o of options) {
      if (!byGroup.has(o.groupId)) byGroup.set(o.groupId, []);
      byGroup.get(o.groupId).push(o);
    }
    const out = [...byGroup.entries()].map(([gid, opts]) => {
      const total = opts.reduce((n, o) => n + (o.voteCount || 0), 0);
      const sorted = [...opts].sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
      const tie = sorted.length > 1 && (sorted[0].voteCount || 0) === (sorted[1].voteCount || 0);
      return {
        groupId: gid,
        name: name.get(gid) || gid,
        total,
        winner: total ? sorted[0].optionNo : null,
        tie,
        options: opts.map((o) => ({ optionNo: o.optionNo, label: o.label, voteCount: o.voteCount || 0 })),
      };
    });
    res.json({ session: { id: session.id, title: session.title, status: session.status, closesAt: session.closesAt }, groups: out });
  }));

  // PUT /api/voting/session { action: 'open'|'close', closesAt? } (admin)
  app.put('/api/voting/session', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    if (!isVoteAdmin(req.authUser) && !isKomisiOrSuperadmin(req.authUser)) {
      return res.status(403).json({ error: 'Hanya admin yang dapat mengubah sesi.' });
    }
    const action = String(req.body?.action || '').toLowerCase();
    const closesAt = req.body?.closesAt ? new Date(req.body.closesAt) : null;
    let session = await loadSession(prisma);
    if (!session) {
      session = await prisma.groupLogoVote.create({
        data: {
          id: `glv-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
          title: 'Pemilihan Logo Kelompok',
          status: 'DRAFT',
          createdById: req.authUser?.id || null,
        },
      });
    }
    const status = action === 'open' ? 'OPEN' : action === 'close' ? 'CLOSED' : SESSION_STATUSES.includes(String(req.body?.status || '').toUpperCase()) ? String(req.body.status).toUpperCase() : session.status;
    const updated = await prisma.groupLogoVote.update({ where: { id: session.id }, data: { status, closesAt: req.body?.closesAt !== undefined ? closesAt : session.closesAt } });
    res.json({ session: { id: updated.id, title: updated.title, status: updated.status, closesAt: updated.closesAt } });
  }));
}
