/**
 * Pelsus 11 Okt 2026 — Pemilihan Pelayan Khusus GMIM.
 *
 * Standar Juklak BPMS: perorangan, langsung, rahasia, tertulis (digital =
 * surat suara panitia), tak dapat diwakilkan; kuorum 2/3 configurable;
 * 1 pemilih = 1 submisi per election (immutable); layar live hanya
 * partisipasi saat OPEN, perolehan dibuka setelah CLOSED.
 *
 * Anti-kambuh Likert: tanpa full-scan agregat, tanpa $transaction
 * multi-upsert; ballot = 1 transaksi pendek (createMany + flag voter +
 * increment atomik); live di-cache 2,5 dtk; unique DB sebagai final
 * anti-duplikasi lintas channel (LOGIN/KIOSK/MANUAL).
 */
import crypto from 'node:crypto';
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { globalRoles } from '../division-rbac.mjs';

const uid = (p) => `${p}-${crypto.randomUUID().slice(0, 12)}`;
const TOKEN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newToken = () =>
  Array.from(crypto.randomBytes(6))
    .map((b) => TOKEN_ALPHABET[b % TOKEN_ALPHABET.length])
    .join('');
const newAccessCode = () => crypto.randomBytes(3).toString('hex').toUpperCase();

export const PELSUS_SCOPES = ['BIPRA', 'KOLOM', 'BPMJ'];
export const PELSUS_ADMIN_ROLES = ['SUPERADMIN', 'BPMJ', 'KOMISI', 'COMMITTEE'];

export function isPelsusAdmin(authUser) {
  const roles = globalRoles(authUser);
  return roles.some((r) => PELSUS_ADMIN_ROLES.includes(r));
}

/** Kuorum terpenuhi? ceil(total * num/den) <= voted. */
export function quorumMet(voted, total, num = 2, den = 3) {
  const t = Number(total) || 0;
  if (t <= 0) return false;
  const need = Math.ceil((t * (Number(num) || 2)) / (Number(den) || 3));
  return (Number(voted) || 0) >= need;
}

export function quorumNeed(total, num = 2, den = 3) {
  const t = Number(total) || 0;
  if (t <= 0) return 0;
  return Math.ceil((t * (Number(num) || 2)) / (Number(den) || 3));
}

export function isOpenElection(e) {
  if (!e || e.status !== 'OPEN') return false;
  if (e.closesAt && new Date(e.closesAt).getTime() < Date.now()) return false;
  return true;
}

const str = (v, max = 200) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};
const intOr = (v, fb) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fb;
};

/** Cache live 2,5 dtk: hemat TiDB saat layar + ratusan HP polling. */
const liveCache = new Map();
const LIVE_TTL_MS = 2500;

async function audit(prisma, electionId, actorId, action, detail) {
  try {
    await prisma.pelsusAuditLog.create({
      data: { id: uid('pal'), electionId: electionId || null, actorId: actorId || null, action, detail: detail || {} },
    });
  } catch { /* audit tak boleh gagalkan vote */ }
}

/** Tulis ballot atomik: guard ganda (flag + unique) agar klik-ganda / bilik-manual tak ganda. */
async function submitBallots(prisma, { election, voter, candidateIds, channel, abstain }) {
  const ids = [...new Set((candidateIds || []).map(String).filter(Boolean))];
  if (!abstain) {
    if (!ids.length) throw Object.assign(new Error('Pilih minimal 1 kandidat.'), { status: 400 });
    if (ids.length > (election.maxChoices || 1)) {
      throw Object.assign(new Error(`Maksimal ${election.maxChoices} pilihan per surat suara.`), { status: 400 });
    }
  }
  let valid = [];
  if (!abstain) {
    valid = await prisma.pelsusCandidate.findMany({ where: { electionId: election.id, id: { in: ids } }, select: { id: true } });
    if (valid.length !== ids.length) throw Object.assign(new Error('Ada kandidat yang tidak dikenal.'), { status: 400 });
  }
  const now = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.pelsusVoter.findUnique({ where: { id: voter.id } });
      if (!fresh || fresh.hasVoted) throw Object.assign(new Error('Suara Anda sudah tercatat. 1 orang 1 suara.'), { status: 409 });
      if (!abstain && valid.length) {
        await tx.pelsusBallot.createMany({
          data: valid.map((c) => ({ id: uid('pbl'), electionId: election.id, voterId: voter.id, candidateId: c.id, channel })),
        });
        for (const c of valid) {
          await tx.pelsusCandidate.update({ where: { id: c.id }, data: { voteCount: { increment: 1 } } });
        }
      }
      await tx.pelsusVoter.update({ where: { id: voter.id }, data: { hasVoted: true, votedAt: now, votedVia: channel } });
    });
  } catch (e) {
    if (e?.code === 'P2002' || e?.status === 409) {
      throw Object.assign(new Error('Suara Anda sudah tercatat. 1 orang 1 suara.'), { status: 409 });
    }
    throw e;
  }
  return { votedAt: now };
}

export function registerPelsusRoutes(app, { wrap }) {
  const prismaOf = (res) => {
    const prisma = getPrisma();
    if (!prisma) res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
    return prisma;
  };

  // GET /api/pelsus — daftar election + kelayakan saya (tanpa perolehan saat OPEN)
  app.get('/api/pelsus', requireRole(), wrap(async (req, res) => {
    const prisma = prismaOf(res);
    if (!prisma) return;
    const elections = await prisma.pelsusElection.findMany({ orderBy: [{ scope: 'asc' }, { title: 'asc' }] }).catch(() => []);
    const myVoters = await prisma.pelsusVoter.findMany({
      where: { userId: req.authUser.id },
      select: { electionId: true, hasVoted: true },
    }).catch(() => []);
    const mine = new Map(myVoters.map((v) => [v.electionId, v]));
    const counts = await prisma.pelsusVoter.groupBy({
      by: ['electionId', 'hasVoted'], _count: { _all: true },
      where: { electionId: { in: elections.map((e) => e.id) } },
    }).catch(() => []);
    const tally = new Map();
    for (const c of counts) {
      if (!tally.has(c.electionId)) tally.set(c.electionId, { voted: 0, total: 0 });
      const t = tally.get(c.electionId);
      t.total += c._count._all;
      if (c.hasVoted) t.voted += c._count._all;
    }
    res.json({
      canAdmin: isPelsusAdmin(req.authUser),
      elections: elections.map((e) => {
        const t = tally.get(e.id) || { voted: 0, total: 0 };
        return {
          id: e.id, scope: e.scope, bipra: e.bipra, kolomId: e.kolomId, roleTarget: e.roleTarget,
          title: e.title, description: e.description, status: e.status, maxChoices: e.maxChoices,
          open: isOpenElection(e), closesAt: e.closesAt,
          turnout: t, quorum: { need: quorumNeed(t.total, e.quorumNum, e.quorumDen), met: quorumMet(t.voted, t.total, e.quorumNum, e.quorumDen) },
          myVoter: mine.has(e.id) ? { hasVoted: mine.get(e.id).hasVoted } : null,
        };
      }),
    });
  }));

  // GET /api/pelsus/:id — detail + kandidat (voteCount disembunyikan saat OPEN kecuali admin)
  app.get('/api/pelsus/:id', requireRole(), wrap(async (req, res) => {
    const prisma = prismaOf(res);
    if (!prisma) return;
    const e = await prisma.pelsusElection.findUnique({ where: { id: String(req.params.id) } });
    if (!e) return res.status(404).json({ error: 'Pemilihan tidak ditemukan.' });
    const admin = isPelsusAdmin(req.authUser);
    const [candidates, myVoter, agg] = await Promise.all([
      prisma.pelsusCandidate.findMany({ where: { electionId: e.id }, orderBy: { nomor: 'asc' } }).catch(() => []),
      prisma.pelsusVoter.findFirst({ where: { electionId: e.id, userId: req.authUser.id } }).catch(() => null),
      prisma.pelsusVoter.groupBy({ by: ['hasVoted'], _count: { _all: true }, where: { electionId: e.id } }).catch(() => []),
    ]);
    let voted = 0; let total = 0;
    for (const a of agg) { total += a._count._all; if (a.hasVoted) voted += a._count._all; }
    const showCounts = e.status === 'CLOSED' || admin;
    res.json({
      election: {
        id: e.id, scope: e.scope, bipra: e.bipra, kolomId: e.kolomId, roleTarget: e.roleTarget,
        title: e.title, description: e.description, status: e.status, maxChoices: e.maxChoices,
        open: isOpenElection(e), closesAt: e.closesAt, accessCode: admin ? e.accessCode : undefined,
      },
      candidates: candidates.map((c) => ({
        id: c.id, nomor: c.nomor, name: c.name, roleTarget: c.roleTarget,
        photoUrl: c.photoUrl, visi: c.visi, voteCount: showCounts ? c.voteCount : null,
      })),
      myVoter: myVoter ? { id: myVoter.id, name: myVoter.name, hasVoted: myVoter.hasVoted, votedVia: myVoter.votedVia } : null,
      canVote: isOpenElection(e) && Boolean(myVoter) && !myVoter.hasVoted,
      turnout: { voted, total },
      quorum: { need: quorumNeed(total, e.quorumNum, e.quorumDen), met: quorumMet(voted, total, e.quorumNum, e.quorumDen) },
      canAdmin: admin,
    });
  }));

  // POST /api/pelsus/:id/ballot { candidateIds[] } — 1 submisi, immutable
  app.post('/api/pelsus/:id/ballot', requireRole(), wrap(async (req, res) => {
    const prisma = prismaOf(res);
    if (!prisma) return;
    const e = await prisma.pelsusElection.findUnique({ where: { id: String(req.params.id) } });
    if (!e) return res.status(404).json({ error: 'Pemilihan tidak ditemukan.' });
    if (!isOpenElection(e)) return res.status(409).json({ error: 'Pemilihan belum dibuka atau sudah ditutup.' });
    const voter = await prisma.pelsusVoter.findFirst({ where: { electionId: e.id, userId: req.authUser.id } });
    if (!voter) return res.status(403).json({ error: 'Anda tidak terdaftar di DPT pemilihan ini.' });
    if (voter.hasVoted) return res.status(409).json({ error: 'Suara Anda sudah tercatat. 1 orang 1 suara.' });
    try {
      const r = await submitBallots(prisma, { election: e, voter, candidateIds: req.body?.candidateIds, channel: 'LOGIN' });
      await audit(prisma, e.id, req.authUser.id, 'VOTE_LOGIN', { voterId: voter.id, n: (req.body?.candidateIds || []).length });
      liveCache.delete(e.id);
      res.json({ ok: true, votedAt: r.votedAt });
    } catch (err) {
      const s = typeof err?.status === 'number' ? err.status : 500;
      return res.status(s).json({ error: err.message || 'Gagal menyimpan suara.' });
    }
  }));

  // GET /api/pelsus/:id/live?code= — layar: partisipasi saja saat OPEN; perolehan setelah CLOSED
  app.get('/api/pelsus/:id/live', wrap(async (req, res) => {
    const prisma = prismaOf(res);
    if (!prisma) return;
    const id = String(req.params.id);
    const hit = liveCache.get(id);
    if (hit && Date.now() - hit.at < LIVE_TTL_MS) {
      res.setHeader('Cache-Control', 'no-store');
      return res.json(hit.data);
    }
    const e = await prisma.pelsusElection.findUnique({ where: { id } });
    if (!e) return res.status(404).json({ error: 'Pemilihan tidak ditemukan.' });
    const code = String(req.query?.code || '').toUpperCase();
    const codeOk = Boolean(code) && String(e.accessCode || '').toUpperCase() === code;
    if (!req.authUser && !codeOk) return res.status(401).json({ error: 'Butuh login atau kode layar.' });
    const agg = await prisma.pelsusVoter.groupBy({ by: ['hasVoted'], _count: { _all: true }, where: { electionId: id } }).catch(() => []);
    let voted = 0; let total = 0;
    for (const a of agg) { total += a._count._all; if (a.hasVoted) voted += a._count._all; }
    const payload = {
      election: { id: e.id, title: e.title, scope: e.scope, bipra: e.bipra, kolomId: e.kolomId, roleTarget: e.roleTarget, status: e.status, open: isOpenElection(e) },
      turnout: { voted, total },
      quorum: { need: quorumNeed(total, e.quorumNum, e.quorumDen), met: quorumMet(voted, total, e.quorumNum, e.quorumDen), num: e.quorumNum, den: e.quorumDen },
      results: null,
    };
    if (e.status === 'CLOSED' || isPelsusAdmin(req.authUser)) {
      const cands = await prisma.pelsusCandidate.findMany({ where: { electionId: id }, orderBy: { nomor: 'asc' } }).catch(() => []);
      const sorted = [...cands].sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
      payload.results = {
        candidates: cands.map((c) => ({ id: c.id, nomor: c.nomor, name: c.name, voteCount: c.voteCount || 0 })),
        winnerId: sorted.length && (sorted[0].voteCount || 0) > 0 ? sorted[0].id : null,
        tie: sorted.length > 1 && (sorted[0].voteCount || 0) === (sorted[1].voteCount || 0) && (sorted[0].voteCount || 0) > 0,
      };
    }
    liveCache.set(id, { at: Date.now(), data: payload });
    res.setHeader('Cache-Control', 'no-store');
    res.json(payload);
  }));

  // GET /api/pelsus/:id/results — rekap (admin saat OPEN; publik login setelah CLOSED)
  app.get('/api/pelsus/:id/results', requireRole(), wrap(async (req, res) => {
    const prisma = prismaOf(res);
    if (!prisma) return;
    const e = await prisma.pelsusElection.findUnique({ where: { id: String(req.params.id) } });
    if (!e) return res.status(404).json({ error: 'Pemilihan tidak ditemukan.' });
    const admin = isPelsusAdmin(req.authUser);
    if (e.status !== 'CLOSED' && !admin) return res.status(403).json({ error: 'Hasil dibuka setelah pemilihan ditutup.' });
    const [cands, agg] = await Promise.all([
      prisma.pelsusCandidate.findMany({ where: { electionId: e.id }, orderBy: { nomor: 'asc' } }).catch(() => []),
      prisma.pelsusVoter.groupBy({ by: ['hasVoted'], _count: { _all: true }, where: { electionId: e.id } }).catch(() => []),
    ]);
    let voted = 0; let total = 0;
    for (const a of agg) { total += a._count._all; if (a.hasVoted) voted += a._count._all; }
    const ballotCount = await prisma.pelsusBallot.count({ where: { electionId: e.id } }).catch(() => 0);
    const sorted = [...cands].sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
    res.json({
      election: { id: e.id, title: e.title, status: e.status },
      turnout: { voted, total, abstain: Math.max(0, voted - (await prisma.pelsusVoter.count({ where: { electionId: e.id, hasVoted: true, ballots: { none: {} } } }).catch(() => 0))) },
      ballotCount,
      quorum: { need: quorumNeed(total, e.quorumNum, e.quorumDen), met: quorumMet(voted, total, e.quorumNum, e.quorumDen) },
      candidates: cands.map((c) => ({ id: c.id, nomor: c.nomor, name: c.name, roleTarget: c.roleTarget, voteCount: c.voteCount || 0 })),
      winnerId: sorted.length && (sorted[0].voteCount || 0) > 0 ? sorted[0].id : null,
      tie: sorted.length > 1 && (sorted[0].voteCount || 0) === (sorted[1].voteCount || 0) && (sorted[0].voteCount || 0) > 0,
    });
  }));

  // GET /api/pelsus/:id/export.csv — Berita Acara (admin): kandidat + DPT sudah/belum (tanpa bongkar pilihan)
  app.get('/api/pelsus/:id/export.csv', requireRole(), wrap(async (req, res) => {
    const prisma = prismaOf(res);
    if (!prisma) return;
    if (!isPelsusAdmin(req.authUser)) return res.status(403).json({ error: 'Hanya panitia.' });
    const e = await prisma.pelsusElection.findUnique({ where: { id: String(req.params.id) } });
    if (!e) return res.status(404).json({ error: 'Pemilihan tidak ditemukan.' });
    const [cands, voters] = await Promise.all([
      prisma.pelsusCandidate.findMany({ where: { electionId: e.id }, orderBy: { nomor: 'asc' } }).catch(() => []),
      prisma.pelsusVoter.findMany({ where: { electionId: e.id }, orderBy: { name: 'asc' }, take: 5000 }).catch(() => []),
    ]);
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [`"BERITA ACARA","${e.title.replace(/"/g, '')}","status: ${e.status}"`, ''];
    lines.push('"PEROLEHAN"');
    lines.push(['Nomor', 'Nama', 'Suara'].map(esc).join(','));
    for (const c of cands) lines.push([c.nomor, c.name, c.voteCount || 0].map(esc).join(','));
    lines.push('');
    lines.push('"DPT (sudah/belum — pilihan dirahasiakan)"');
    lines.push(['Nama', 'Status', 'Via'].map(esc).join(','));
    for (const v of voters) lines.push([v.name, v.hasVoted ? 'SUDAH' : 'BELUM', v.votedVia || ''].map(esc).join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="pelsus-${e.id}.csv"`);
    res.send(`\uFEFF${lines.join('\r\n')}`);
  }));

  // GET /api/pelsus/:id/voters?q=&unvoted=1 — DPT untuk petugas (nama + sudah/belum; tanpa pilihan)
  app.get('/api/pelsus/:id/voters', requireRole(...PELSUS_ADMIN_ROLES), wrap(async (req, res) => {
    const prisma = prismaOf(res);
    if (!prisma) return;
    const q = String(req.query?.q || '').trim();
    const onlyUnvoted = String(req.query?.unvoted || '') === '1';
    const where = { electionId: String(req.params.id) };
    if (onlyUnvoted) where.hasVoted = false;
    if (q) where.name = { contains: q };
    const voters = await prisma.pelsusVoter.findMany({
      where, orderBy: { name: 'asc' }, take: 500,
      select: { id: true, name: true, hasVoted: true, votedVia: true, userId: true },
    }).catch(() => []);
    res.json({ voters });
  }));

  // POST /api/pelsus/bilik/preview { token } — info surat suara tanpa login (nama + kandidat, tanpa perolehan)
  app.post('/api/pelsus/bilik/preview', wrap(async (req, res) => {
    const prisma = prismaOf(res);
    if (!prisma) return;
    const token = String(req.body?.token || '').toUpperCase().trim();
    if (!token) return res.status(400).json({ error: 'Token wajib.' });
    const t = await prisma.pelsusKioskToken.findUnique({ where: { token } }).catch(() => null);
    if (!t || t.usedAt || new Date(t.expiresAt).getTime() < Date.now()) {
      return res.status(401).json({ error: 'Token tidak valid / kedaluwarsa.' });
    }
    const e = await prisma.pelsusElection.findUnique({ where: { id: t.electionId } });
    if (!e || !isOpenElection(e)) return res.status(409).json({ error: 'Pemilihan belum dibuka atau sudah ditutup.' });
    const voter = await prisma.pelsusVoter.findUnique({ where: { id: t.voterId } });
    if (!voter || voter.hasVoted) return res.status(409).json({ error: 'Suara sudah tercatat.' });
    const candidates = await prisma.pelsusCandidate.findMany({ where: { electionId: e.id }, orderBy: { nomor: 'asc' } }).catch(() => []);
    res.json({
      election: { id: e.id, title: e.title, scope: e.scope, bipra: e.bipra, kolomId: e.kolomId, roleTarget: e.roleTarget, maxChoices: e.maxChoices },
      voter: { name: voter.name },
      candidates: candidates.map((c) => ({ id: c.id, nomor: c.nomor, name: c.name, roleTarget: c.roleTarget, photoUrl: c.photoUrl, visi: c.visi })),
    });
  }));

  // ---- Panitia (admin): elections CRUD + state + DPT + kandidat + token + checkin + promote ----

  // POST /api/pelsus/elections — buat election
  app.post('/api/pelsus/elections', requireRole(...PELSUS_ADMIN_ROLES), wrap(async (req, res) => {
    const prisma = prismaOf(res);
    if (!prisma) return;
    const scope = String(req.body?.scope || 'BIPRA').toUpperCase();
    if (!PELSUS_SCOPES.includes(scope)) return res.status(400).json({ error: 'scope harus BIPRA|KOLOM|BPMJ.' });
    const title = str(req.body?.title, 200);
    if (!title) return res.status(400).json({ error: 'title wajib.' });
    // id kustom hanya untuk namespace simulasi/uji (sim-*) agar mudah dibersihkan.
    const customId = /^sim-[a-z0-9]{1,32}$/.test(String(req.body?.id || '')) ? String(req.body.id) : null;
    if (customId && await prisma.pelsusElection.findUnique({ where: { id: customId } }).catch(() => null)) {
      return res.status(409).json({ error: 'id simulasi sudah dipakai.' });
    }
    const e = await prisma.pelsusElection.create({
      data: {
        id: customId || `pel-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        scope, title,
        bipra: req.body?.bipra ? String(req.body.bipra).toUpperCase() : null,
        kolomId: str(req.body?.kolomId, 64),
        roleTarget: req.body?.roleTarget ? String(req.body.roleTarget).toUpperCase() : null,
        description: str(req.body?.description, 2000),
        maxChoices: Math.max(1, Math.min(20, intOr(req.body?.maxChoices, 1))),
        quorumNum: Math.max(1, intOr(req.body?.quorumNum, 2)),
        quorumDen: Math.max(1, intOr(req.body?.quorumDen, 3)),
        accessCode: newAccessCode(),
        createdById: req.authUser?.id || null,
      },
    });
    await audit(prisma, e.id, req.authUser.id, 'ELECTION_CREATE', { scope, title });
    res.status(201).json({ election: e });
  }));

  // PUT /api/pelsus/:id/state { action: open|close|reset|draft, closesAt? }
  app.put('/api/pelsus/:id/state', requireRole(...PELSUS_ADMIN_ROLES), wrap(async (req, res) => {
    const prisma = prismaOf(res);
    if (!prisma) return;
    const e = await prisma.pelsusElection.findUnique({ where: { id: String(req.params.id) } });
    if (!e) return res.status(404).json({ error: 'Pemilihan tidak ditemukan.' });
    const action = String(req.body?.action || '').toLowerCase();
    if (action === 'reset') {
      await prisma.$transaction([
        prisma.pelsusBallot.deleteMany({ where: { electionId: e.id } }),
        prisma.pelsusKioskToken.deleteMany({ where: { electionId: e.id } }),
        prisma.pelsusVoter.updateMany({ where: { electionId: e.id }, data: { hasVoted: false, votedAt: null, votedVia: null } }),
        prisma.pelsusCandidate.updateMany({ where: { electionId: e.id }, data: { voteCount: 0 } }),
      ]);
      await audit(prisma, e.id, req.authUser.id, 'ELECTION_RESET', {});
      liveCache.delete(e.id);
      return res.json({ ok: true, reset: true });
    }
    const status = action === 'open' ? 'OPEN' : action === 'close' ? 'CLOSED' : action === 'draft' ? 'DRAFT' : null;
    if (!status) return res.status(400).json({ error: 'action harus open|close|reset|draft.' });
    const data = { status };
    if (req.body?.closesAt !== undefined) data.closesAt = req.body.closesAt ? new Date(req.body.closesAt) : null;
    if (req.body?.rotateCode) data.accessCode = newAccessCode();
    const updated = await prisma.pelsusElection.update({ where: { id: e.id }, data });
    await audit(prisma, e.id, req.authUser.id, `ELECTION_${status}`, {});
    liveCache.delete(e.id);
    res.json({ election: updated });
  }));

  // DELETE /api/pelsus/:id — hapus election + seluruh data (khusus DRAFT/CLOSED; cascade)
  app.delete('/api/pelsus/:id', requireRole(...PELSUS_ADMIN_ROLES), wrap(async (req, res) => {
    const prisma = prismaOf(res);
    if (!prisma) return;
    const e = await prisma.pelsusElection.findUnique({ where: { id: String(req.params.id) } });
    if (!e) return res.status(404).json({ error: 'Pemilihan tidak ditemukan.' });
    if (e.status === 'OPEN') return res.status(409).json({ error: 'Tutup dulu sebelum menghapus.' });
    // Cascade eksplisit di aplikasi (tidak mengandalkan FK DB): ballot → token → voter → kandidat → audit → election.
    await prisma.$transaction([
      prisma.pelsusBallot.deleteMany({ where: { electionId: e.id } }),
      prisma.pelsusKioskToken.deleteMany({ where: { electionId: e.id } }),
      prisma.pelsusVoter.deleteMany({ where: { electionId: e.id } }),
      prisma.pelsusCandidate.deleteMany({ where: { electionId: e.id } }),
      prisma.pelsusAuditLog.deleteMany({ where: { electionId: e.id } }),
      prisma.pelsusElection.delete({ where: { id: e.id } }),
    ]);
    liveCache.delete(e.id);
    res.json({ ok: true, deleted: e.id });
  }));

  // POST /api/pelsus/:id/voters/sync — bangun DPT dari User (BIPRA/KOLOM)
  app.post('/api/pelsus/:id/voters/sync', requireRole(...PELSUS_ADMIN_ROLES), wrap(async (req, res) => {
    const prisma = prismaOf(res);
    if (!prisma) return;
    const e = await prisma.pelsusElection.findUnique({ where: { id: String(req.params.id) } });
    if (!e) return res.status(404).json({ error: 'Pemilihan tidak ditemukan.' });
    if (e.scope === 'BPMJ') return res.status(400).json({ error: 'DPT BPMJ via promote/import (fase-2), bukan sync.' });
    const where = { accountStatus: 'ACTIVE' };
    if (e.scope === 'BIPRA' && e.bipra) where.bipra = e.bipra;
    if (e.scope === 'KOLOM' && e.kolomId) where.kolomId = e.kolomId;
    const users = await prisma.user.findMany({ where, select: { id: true, name: true, bipra: true, kolomId: true }, take: 5000 }).catch(() => []);
    let created = 0;
    for (const u of users) {
      try {
        await prisma.pelsusVoter.create({
          data: { id: uid('pvt'), electionId: e.id, userId: u.id, name: String(u.name || u.id).slice(0, 150), bipra: u.bipra || null, kolomId: u.kolomId || null },
        });
        created += 1;
      } catch { /* sudah ada — lewati (idempoten) */ }
    }
    await audit(prisma, e.id, req.authUser.id, 'DPT_SYNC', { created, from: users.length });
    res.json({ ok: true, created, scanned: users.length });
  }));

  // POST /api/pelsus/:id/voters/import { rows: [{name, bipra?, kolomId?, userId?}] } — susulan CSV
  app.post('/api/pelsus/:id/voters/import', requireRole(...PELSUS_ADMIN_ROLES), wrap(async (req, res) => {
    const prisma = prismaOf(res);
    if (!prisma) return;
    const e = await prisma.pelsusElection.findUnique({ where: { id: String(req.params.id) } });
    if (!e) return res.status(404).json({ error: 'Pemilihan tidak ditemukan.' });
    const rows = Array.isArray(req.body?.rows) ? req.body.rows.slice(0, 2000) : [];
    if (!rows.length) return res.status(400).json({ error: 'rows kosong (maks 2000).' });
    let created = 0; let skipped = 0;
    for (const r of rows) {
      const name = str(r?.name, 150);
      if (!name) { skipped += 1; continue; }
      try {
        await prisma.pelsusVoter.create({
          data: {
            id: uid('pvt'), electionId: e.id,
            userId: r?.userId ? String(r.userId) : null,
            name, bipra: r?.bipra ? String(r.bipra).toUpperCase() : null,
            kolomId: str(r?.kolomId, 64),
          },
        });
        created += 1;
      } catch { skipped += 1; }
    }
    await audit(prisma, e.id, req.authUser.id, 'DPT_IMPORT', { created, skipped });
    res.json({ ok: true, created, skipped });
  }));

  // POST /api/pelsus/:id/candidates { name, nomor?, roleTarget?, userId?, visi? }
  app.post('/api/pelsus/:id/candidates', requireRole(...PELSUS_ADMIN_ROLES), wrap(async (req, res) => {
    const prisma = prismaOf(res);
    if (!prisma) return;
    const e = await prisma.pelsusElection.findUnique({ where: { id: String(req.params.id) } });
    if (!e) return res.status(404).json({ error: 'Pemilihan tidak ditemukan.' });
    if (e.status !== 'DRAFT') return res.status(409).json({ error: 'Kandidat hanya bisa diubah saat DRAFT.' });
    const name = str(req.body?.name, 150);
    if (!name) return res.status(400).json({ error: 'name wajib.' });
    const count = await prisma.pelsusCandidate.count({ where: { electionId: e.id } }).catch(() => 0);
    try {
      const c = await prisma.pelsusCandidate.create({
        data: {
          id: uid('pcd'), electionId: e.id, name,
          userId: str(req.body?.userId, 64),
          nomor: intOr(req.body?.nomor, count + 1),
          roleTarget: req.body?.roleTarget ? String(req.body.roleTarget).toUpperCase() : e.roleTarget,
          photoUrl: str(req.body?.photoUrl, 500),
          visi: str(req.body?.visi, 2000),
        },
      });
      await audit(prisma, e.id, req.authUser.id, 'CANDIDATE_ADD', { name });
      res.status(201).json({ candidate: c });
    } catch {
      return res.status(409).json({ error: 'Nomor urut sudah dipakai di pemilihan ini.' });
    }
  }));

  // DELETE /api/pelsus/:id/candidates/:cid (DRAFT saja)
  app.delete('/api/pelsus/:id/candidates/:cid', requireRole(...PELSUS_ADMIN_ROLES), wrap(async (req, res) => {
    const prisma = prismaOf(res);
    if (!prisma) return;
    const e = await prisma.pelsusElection.findUnique({ where: { id: String(req.params.id) } });
    if (!e) return res.status(404).json({ error: 'Pemilihan tidak ditemukan.' });
    if (e.status !== 'DRAFT') return res.status(409).json({ error: 'Kandidat hanya bisa diubah saat DRAFT.' });
    await prisma.pelsusCandidate.deleteMany({ where: { id: String(req.params.cid), electionId: e.id } });
    await audit(prisma, e.id, req.authUser.id, 'CANDIDATE_REMOVE', { cid: String(req.params.cid) });
    res.json({ ok: true });
  }));

  // POST /api/pelsus/:id/tokens { voterId } — panitia terbitkan token bilik (10 mnt, single-use)
  app.post('/api/pelsus/:id/tokens', requireRole(...PELSUS_ADMIN_ROLES), wrap(async (req, res) => {
    const prisma = prismaOf(res);
    if (!prisma) return;
    const e = await prisma.pelsusElection.findUnique({ where: { id: String(req.params.id) } });
    if (!e) return res.status(404).json({ error: 'Pemilihan tidak ditemukan.' });
    if (!isOpenElection(e)) return res.status(409).json({ error: 'Token hanya diterbitkan saat pemilihan OPEN.' });
    const voter = await prisma.pelsusVoter.findFirst({ where: { id: String(req.body?.voterId || ''), electionId: e.id } });
    if (!voter) return res.status(404).json({ error: 'Pemilih tidak ada di DPT.' });
    if (voter.hasVoted) return res.status(409).json({ error: `${voter.name} sudah memilih — 1 orang 1 suara.` });
    await prisma.pelsusKioskToken.updateMany({ where: { electionId: e.id, voterId: voter.id, usedAt: null }, data: { usedAt: new Date() } });
    const token = newToken();
    await prisma.pelsusKioskToken.create({
      data: { token, electionId: e.id, voterId: voter.id, expiresAt: new Date(Date.now() + 10 * 60 * 1000), createdById: req.authUser.id },
    });
    await audit(prisma, e.id, req.authUser.id, 'TOKEN_ISSUE', { voterId: voter.id });
    res.status(201).json({ token, expiresInSec: 600, voter: { id: voter.id, name: voter.name } });
  }));

  // POST /api/pelsus/bilik { token, candidateIds[] } — tanpa login, token sekali pakai
  app.post('/api/pelsus/bilik', wrap(async (req, res) => {
    const prisma = prismaOf(res);
    if (!prisma) return;
    const token = String(req.body?.token || '').toUpperCase().trim();
    if (!token) return res.status(400).json({ error: 'Token wajib.' });
    const t = await prisma.pelsusKioskToken.findUnique({ where: { token } }).catch(() => null);
    if (!t || t.usedAt || new Date(t.expiresAt).getTime() < Date.now()) {
      return res.status(401).json({ error: 'Token tidak valid / kedaluwarsa. Minta token baru ke petugas.' });
    }
    const e = await prisma.pelsusElection.findUnique({ where: { id: t.electionId } });
    if (!e || !isOpenElection(e)) return res.status(409).json({ error: 'Pemilihan belum dibuka atau sudah ditutup.' });
    const voter = await prisma.pelsusVoter.findUnique({ where: { id: t.voterId } });
    if (!voter) return res.status(404).json({ error: 'Pemilih tidak ditemukan.' });
    if (voter.hasVoted) {
      await prisma.pelsusKioskToken.update({ where: { token }, data: { usedAt: new Date() } }).catch(() => null);
      return res.status(409).json({ error: 'Suara sudah tercatat. 1 orang 1 suara.' });
    }
    try {
      const r = await submitBallots(prisma, { election: e, voter, candidateIds: req.body?.candidateIds, channel: 'KIOSK' });
      await prisma.pelsusKioskToken.update({ where: { token }, data: { usedAt: new Date() } }).catch(() => null);
      await audit(prisma, e.id, null, 'VOTE_KIOSK', { voterId: voter.id });
      liveCache.delete(e.id);
      res.json({ ok: true, votedAt: r.votedAt });
    } catch (err) {
      const s = typeof err?.status === 'number' ? err.status : 500;
      return res.status(s).json({ error: err.message || 'Gagal menyimpan suara.' });
    }
  }));

  // POST /api/pelsus/:id/checkin { voterId, candidateIds[]?, abstain? } — petugas catat manual/surat kertas
  app.post('/api/pelsus/:id/checkin', requireRole(...PELSUS_ADMIN_ROLES), wrap(async (req, res) => {
    const prisma = prismaOf(res);
    if (!prisma) return;
    const e = await prisma.pelsusElection.findUnique({ where: { id: String(req.params.id) } });
    if (!e) return res.status(404).json({ error: 'Pemilihan tidak ditemukan.' });
    if (!isOpenElection(e)) return res.status(409).json({ error: 'Check-in hanya saat pemilihan OPEN.' });
    const voter = await prisma.pelsusVoter.findFirst({ where: { id: String(req.body?.voterId || ''), electionId: e.id } });
    if (!voter) return res.status(404).json({ error: 'Pemilih tidak ada di DPT.' });
    if (voter.hasVoted) return res.status(409).json({ error: `${voter.name} sudah memilih — 1 orang 1 suara.` });
    try {
      // markOnly = hadir untuk kuorum tanpa pilihan (surat kertas dihitung terpisah / abstain).
      const markOnly = req.body?.markOnly === true;
      const abstained = Boolean(req.body?.abstain) || markOnly;
      const r = await submitBallots(prisma, {
        election: e, voter,
        candidateIds: markOnly ? [] : req.body?.candidateIds, channel: 'MANUAL',
        abstain: abstained,
      });
      await audit(prisma, e.id, req.authUser.id, 'VOTE_MANUAL', { voterId: voter.id });
      liveCache.delete(e.id);
      res.json({ ok: true, votedAt: r.votedAt, abstain: abstained });
    } catch (err) {
      const s = typeof err?.status === 'number' ? err.status : 500;
      return res.status(s).json({ error: err.message || 'Gagal mencatat.' });
    }
  }));

  // POST /api/pelsus/:id/promote { topN } — fase-2 BPMJ: pemenang sumber → DPT target (by userId)
  app.post('/api/pelsus/:id/promote', requireRole(...PELSUS_ADMIN_ROLES), wrap(async (req, res) => {
    const prisma = prismaOf(res);
    if (!prisma) return;
    const target = await prisma.pelsusElection.findUnique({ where: { id: String(req.params.id) } });
    if (!target) return res.status(404).json({ error: 'Pemilihan target tidak ditemukan.' });
    const fromId = String(req.body?.fromElectionId || '');
    const topN = Math.max(1, Math.min(50, intOr(req.body?.topN, 3)));
    const src = await prisma.pelsusElection.findUnique({ where: { id: fromId } });
    if (!src) return res.status(404).json({ error: 'Pemilihan sumber tidak ditemukan.' });
    if (src.status !== 'CLOSED') return res.status(409).json({ error: 'Sumber harus sudah CLOSED.' });
    const winners = await prisma.pelsusCandidate.findMany({
      where: { electionId: fromId }, orderBy: { voteCount: 'desc' }, take: topN,
    });
    let added = 0;
    for (const w of winners) {
      if (!w.userId) continue;
      const u = await prisma.user.findUnique({ where: { id: w.userId }, select: { id: true, name: true } }).catch(() => null);
      try {
        await prisma.pelsusVoter.create({
          data: { id: uid('pvt'), electionId: target.id, userId: w.userId, name: String(u?.name || w.name).slice(0, 150) },
        });
        added += 1;
      } catch { /* sudah ada */ }
    }
    await audit(prisma, target.id, req.authUser.id, 'DPT_PROMOTE', { from: fromId, added });
    res.json({ ok: true, added, winners: winners.map((w) => ({ id: w.id, name: w.name, voteCount: w.voteCount })) });
  }));
}
