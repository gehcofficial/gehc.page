import crypto from 'node:crypto';
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { isMentorOfGroup, groupIdsOf } from '../lib/drive-ownership.mjs';
import { isServiceApprover } from '../lib/service-approvers.mjs';
import { executeServingSwap } from './serving-assignments.mjs';

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];
// 10 rumah dalam siklus = id kanonis grp-<n>
const TEN_HOUSE_RE = /^grp-\d+$/;

function toISODate(v) {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function isSunday(iso) {
  return new Date(`${iso}T00:00:00Z`).getUTCDay() === 0;
}

function toJson(r) {
  if (!r) return null;
  const iso = (v) => {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v).slice(0, 10);
  };
  return {
    id: r.id,
    aEventDate: iso(r.aEventDate ?? r.a_event_date),
    bEventDate: iso(r.bEventDate ?? r.b_event_date),
    scope: r.scope,
    requesterGroupId: r.requesterGroupId ?? r.requester_group_id,
    requesterGroupName: r.requesterGroupName ?? null,
    requesterId: r.requesterId ?? r.requester_id,
    peerMentor: r.peerMentor ?? r.peer_mentor ?? null,
    mutualAgreed: Boolean(r.mutualAgreed ?? r.mutual_agreed),
    reason: r.reason,
    status: r.status,
    decidedById: r.decidedById ?? r.decided_by_id ?? null,
    decidedAt: r.decidedAt ?? r.decided_at ?? null,
    decideNote: r.decideNote ?? r.decide_note ?? null,
    createdAt: r.createdAt ?? r.created_at ?? null,
  };
}

async function tableMissing(prisma) {
  try {
    await prisma.$queryRawUnsafe('SELECT id FROM service_swap_requests LIMIT 1');
    return false;
  } catch {
    return true;
  }
}

export function registerServiceSwapRequestRoutes(app, { wrap }) {
  // GET /api/service-swap-requests?status=PENDING|ALL — approver: semua;
  // mentor: hanya grupnya. Termasuk nama grup peminta.
  app.get(
    '/api/service-swap-requests',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      if (await tableMissing(prisma)) return res.json({ requests: [] });
      const approver = await isServiceApprover(req.authUser);
      const want = String(req.query?.status || 'PENDING').toUpperCase();
      const where = [];
      const params = [];
      if (!approver) {
        const ids = groupIdsOf(req.authUser);
        if (!ids.length) return res.json({ requests: [] });
        where.push(`r.requester_group_id IN (${ids.map(() => '?').join(',')})`);
        params.push(...ids);
      }
      if (want !== 'ALL') {
        if (!STATUSES.includes(want)) return res.status(400).json({ error: 'status harus PENDING, APPROVED, REJECTED, atau ALL.' });
        where.push('r.status = ?');
        params.push(want);
      }
      const rows = await prisma.$queryRawUnsafe(
        `SELECT r.*, g.name AS requesterGroupName FROM service_swap_requests r
         LEFT JOIN \`groups\` g ON g.id = r.requester_group_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY r.created_at DESC LIMIT 100`,
        ...params,
      );
      res.json({ requests: (rows || []).map(toJson), approver });
    }),
  );

  // POST /api/service-swap-requests — usul mentor/co (mutualisme: kedua mentor sepakat)
  app.post(
    '/api/service-swap-requests',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      if (await tableMissing(prisma)) {
        return res.status(503).json({ error: 'DB belum migrasi antrean swap. Jalankan: npm run db:migrate:local' });
      }
      const aISO = toISODate(req.body?.aEventDate);
      const bISO = toISODate(req.body?.bEventDate);
      // Request grup selalu sepasang utuh (PAIR): penanggung + tuan rumah pindah bersama.
      const scope = 'PAIR';
      const requesterGroupId = String(req.body?.requesterGroupId || '').trim();
      const targetGroupId = String(req.body?.targetGroupId || '').trim();
      const reason = String(req.body?.reason || '').trim().slice(0, 500);
      const peerMentor = String(req.body?.peerMentor || '').trim().slice(0, 190) || null;
      const mutualAgreed = req.body?.mutualAgreed === true || req.body?.mutualAgreed === 'true' || req.body?.mutualAgreed === 1;
      const todayISO = new Date().toISOString().slice(0, 10);
      if (!aISO || !bISO) return res.status(400).json({ error: 'aEventDate dan bEventDate wajib (YYYY-MM-DD).' });
      if (aISO === bISO) return res.status(400).json({ error: 'Tidak bisa tukar dengan tanggal yang sama.' });
      if (!isSunday(aISO) || !isSunday(bISO)) return res.status(400).json({ error: 'Pertukaran hanya untuk hari Minggu layanan.' });
      if (aISO < todayISO || bISO < todayISO) return res.status(400).json({ error: 'Hanya jadwal hari ini ke depan yang bisa ditukar.' });
      if (!requesterGroupId || !targetGroupId) return res.status(400).json({ error: 'requesterGroupId dan targetGroupId wajib.' });
      if (requesterGroupId === targetGroupId) return res.status(400).json({ error: 'Grup lawan harus berbeda.' });
      if (!TEN_HOUSE_RE.test(requesterGroupId) || !TEN_HOUSE_RE.test(targetGroupId)) {
        return res.status(400).json({ error: 'Pertukaran hanya dalam cakupan 10 rumah siklus.' });
      }
      if (!isMentorOfGroup(req.authUser, requesterGroupId)) {
        return res.status(403).json({ error: 'Hanya mentor/co grup peminta (atau Komisi).' });
      }
      if (!mutualAgreed) return res.status(400).json({ error: 'Wajib centang: kedua mentor sudah sepakat.' });
      if (!reason) return res.status(400).json({ error: 'Alasan tukar wajib diisi.' });

      // Kedua baris harus sudah real (dibuat Tim Kerja) dan melibatkan grup yang benar
      const [aRow, bRow] = await Promise.all([
        prisma.servingAssignment.findFirst({ where: { eventDate: new Date(`${aISO}T00:00:00Z`) } }).catch(() => null),
        prisma.servingAssignment.findFirst({ where: { eventDate: new Date(`${bISO}T00:00:00Z`) } }).catch(() => null),
      ]);
      if (!aRow || !bRow) {
        return res.status(400).json({ error: 'Kedua tanggal harus sudah punya jadwal real (minta Tim Kerja generate-kan dulu).' });
      }
      if (aRow.responsibleGroupId !== requesterGroupId && aRow.hostGroupId !== requesterGroupId) {
        return res.status(400).json({ error: 'Grup peminta tidak bertugas pada tanggal asal.' });
      }
      if (bRow.responsibleGroupId !== targetGroupId && bRow.hostGroupId !== targetGroupId) {
        return res.status(400).json({ error: 'Grup lawan tidak bertugas pada tanggal itu.' });
      }
      // Duplikat PENDING yang sama
      const dup = await prisma.$queryRawUnsafe(
        'SELECT id FROM service_swap_requests WHERE status = ? AND a_event_date = ? AND b_event_date = ? AND scope = ? LIMIT 1',
        'PENDING', aISO, bISO, scope,
      ).catch(() => []);
      if ((dup || []).length) return res.status(409).json({ error: 'Sudah ada usulan PENDING yang sama.' });

      const id = `swr-${crypto.randomUUID()}`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO service_swap_requests
          (id, a_event_date, b_event_date, scope, requester_group_id, requester_id, peer_mentor, mutual_agreed, reason, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
        id, aISO, bISO, scope, requesterGroupId, req.authUser.id, peerMentor, mutualAgreed ? 1 : 0, reason,
      );
      // Notifikasi ke approver: Komisi/Superadmin + BOD + kepala divisi + Didaskalia
      try {
        const { approverUserIdsForService } = await import('../lib/service-approvers.mjs');
        const recipients = [...new Set(await approverUserIdsForService(prisma))].filter((u) => u && u !== req.authUser.id);
        if (recipients.length) {
          await prisma.notification.createMany({
            data: recipients.map((userId) => ({
              id: `ntf-${crypto.randomUUID()}`,
              type: 'SWAP_REQUEST',
              memberId: userId,
              title: `Usulan tukar sepasang: ${aISO} ↔ ${bISO}`,
              message: `${reason}${peerMentor ? ` (sepakat dgn ${peerMentor})` : ''}`,
              payload: { queue: 'service-swap', itemId: id },
              status: 'OPEN',
            })),
          });
        }
      } catch (e) {
        console.warn('[swap-request] notif gagal:', e?.message || e);
      }
      const created = await prisma.$queryRawUnsafe('SELECT * FROM service_swap_requests WHERE id = ? LIMIT 1', id).catch(() => []);
      res.status(201).json({ ok: true, request: toJson((created || [])[0]) });
    }),
  );

  // POST /api/service-swap-requests/:id/approve — eksekusi swap yang sama
  app.post(
    '/api/service-swap-requests/:id/approve',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      if (!(await isServiceApprover(req.authUser))) {
        return res.status(403).json({ error: 'Hanya Komisi, BOD Tim Kerja, kepala divisi, atau Didaskalia.' });
      }
      const rows = await prisma.$queryRawUnsafe('SELECT * FROM service_swap_requests WHERE id = ? LIMIT 1', String(req.params.id)).catch(() => []);
      const row = toJson((rows || [])[0]);
      if (!row) return res.status(404).json({ error: 'Usulan tidak ditemukan.' });
      if (row.status !== 'PENDING') return res.status(409).json({ error: `Usulan sudah ${row.status}.` });
      try {
        const swapped = await executeServingSwap(prisma, {
          aDate: new Date(`${row.aEventDate}T00:00:00Z`),
          bDate: new Date(`${row.bEventDate}T00:00:00Z`),
          scope: row.scope,
          reason: `req ${row.id.slice(0, 8)}: ${row.reason}`,
        });
        await prisma.$executeRawUnsafe(
          'UPDATE service_swap_requests SET status = ?, decided_by_id = ?, decided_at = NOW(3) WHERE id = ?',
          'APPROVED', req.authUser.id, row.id,
        );
        res.json({ ok: true, scope: row.scope, swapped });
      } catch (e) {
        res.status(e.status || 500).json({ error: e.message });
      }
    }),
  );

  // POST /api/service-swap-requests/:id/reject — wajib catatan
  app.post(
    '/api/service-swap-requests/:id/reject',
    requireRole(),
    wrap(async (req, res) => {
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      if (!(await isServiceApprover(req.authUser))) {
        return res.status(403).json({ error: 'Hanya Komisi, BOD Tim Kerja, kepala divisi, atau Didaskalia.' });
      }
      const note = String(req.body?.note || '').trim().slice(0, 500);
      if (!note) return res.status(400).json({ error: 'Catatan penolakan wajib diisi.' });
      const rows = await prisma.$queryRawUnsafe('SELECT * FROM service_swap_requests WHERE id = ? LIMIT 1', String(req.params.id)).catch(() => []);
      const row = toJson((rows || [])[0]);
      if (!row) return res.status(404).json({ error: 'Usulan tidak ditemukan.' });
      if (row.status !== 'PENDING') return res.status(409).json({ error: `Usulan sudah ${row.status}.` });
      await prisma.$executeRawUnsafe(
        'UPDATE service_swap_requests SET status = ?, decided_by_id = ?, decided_at = NOW(3), decide_note = ? WHERE id = ?',
        'REJECTED', req.authUser.id, note, row.id,
      );
      res.json({ ok: true, id: row.id, status: 'REJECTED' });
    }),
  );
}
