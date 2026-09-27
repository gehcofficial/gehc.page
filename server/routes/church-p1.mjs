/**
 * P1 — Fasilitas & Keuangan (portal jemaat).
 *
 * RBAC:
 *   - Fasilitas/Pemeliharaan: pengelola = SUPERADMIN | BPMJ | anggota unit PEMBANGUNAN.
 *   - Keuangan (kas, invoice, funding, distribusi): Bendahara | BPMJ | SUPERADMIN.
 *   - Pengajuan (booking/funding) boleh semua pengguna login (unit = tenant host).
 *
 * Route: /api/church/facilities, /bookings, /maintenance, /cash/*, /funding, /distributions
 */
import crypto from 'node:crypto';
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { activeTenantId } from '../lib/tenant-scope.mjs';
import { ACCOUNT_KINDS, BOOKING_STATUS, FACILITY_KINDS, accountBalance, unitOfTenant } from '../lib/church-p1.mjs';

const id = (p) => `${p}-${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
const unitOf = (req) => unitOfTenant(activeTenantId(req));
const num = (v) => Number(v);
const iso = (v) => (v ? new Date(String(v)) : null);

export function registerChurchP1Routes(app, { wrap }) {
  const facilityManager = async (req) => {
    const u = req.authUser;
    if (!u) return false;
    const { isBpmjUser, isSuperadminUser, canAccessChurchUnit } = await import('../lib/church-access.mjs');
    if (isSuperadminUser(u) || isBpmjUser(u)) return true;
    return canAccessChurchUnit(u, 'PEMBANGUNAN').catch(() => false);
  };
  const treasurer = async (req) => {
    const u = req.authUser;
    if (!u) return false;
    const { isBpmjUser, isSuperadminUser, isBendahara } = await import('../lib/church-access.mjs');
    if (isSuperadminUser(u) || isBpmjUser(u)) return true;
    return isBendahara(u).catch(() => false);
  };
  const deny = (res, msg = 'Akses ditolak.') => res.status(403).json({ error: msg });

  // ---------------- Fasilitas ----------------
  app.get('/api/church/facilities', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DB belum dikonfigurasi.' });
    const where = {};
    if (String(req.query.active || '') === '1') where.isActive = true;
    const facilities = await prisma.facility.findMany({ where, orderBy: [{ kind: 'asc' }, { name: 'asc' }] });
    res.json({ facilities });
  }));

  app.post('/api/church/facilities', requireRole(), wrap(async (req, res) => {
    if (!(await facilityManager(req))) return deny(res);
    const prisma = getPrisma();
    const b = req.body || {};
    const code = String(b.code || '').trim().toUpperCase();
    const name = String(b.name || '').trim();
    const kind = String(b.kind || '').toUpperCase();
    if (!code || !name || !FACILITY_KINDS.includes(kind)) {
      return res.status(400).json({ error: 'code, name, kind (GEDUNG|RUANG|ALAT) wajib.' });
    }
    const created = await prisma.facility.create({
      data: {
        id: id('fac'),
        code,
        name,
        kind,
        capacity: Number.isFinite(num(b.capacity)) && b.capacity ? num(b.capacity) : null,
        location: b.location || null,
        hourlyRate: b.hourlyRate != null ? num(b.hourlyRate) : null,
        dailyRate: b.dailyRate != null ? num(b.dailyRate) : null,
        isActive: b.isActive !== false,
        notes: b.notes || null,
      },
    });
    res.status(201).json({ facility: created });
  }));

  app.patch('/api/church/facilities/:id', requireRole(), wrap(async (req, res) => {
    if (!(await facilityManager(req))) return deny(res);
    const prisma = getPrisma();
    const data = {};
    for (const k of ['name', 'location', 'notes', 'code']) if (req.body?.[k] !== undefined) data[k] = String(req.body[k]).trim() || null;
    if (req.body?.kind !== undefined && FACILITY_KINDS.includes(String(req.body.kind).toUpperCase())) data.kind = String(req.body.kind).toUpperCase();
    for (const k of ['capacity', 'hourlyRate', 'dailyRate']) if (req.body?.[k] !== undefined) data[k] = req.body[k] === null ? null : num(req.body[k]);
    if (req.body?.isActive !== undefined) data.isActive = Boolean(req.body.isActive);
    const facility = await prisma.facility.update({ where: { id: req.params.id }, data });
    res.json({ facility });
  }));

  // ---------------- Booking ----------------
  app.get('/api/church/bookings', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    const where = {};
    if (req.query.status) where.status = String(req.query.status).toUpperCase();
    if (!(await facilityManager(req)) && !(await treasurer(req))) where.requesterUserId = req.authUser.id;
    const bookings = await prisma.facilityBooking.findMany({
      where,
      orderBy: { startAt: 'desc' },
      take: 300,
      include: { facility: { select: { id: true, code: true, name: true } } },
    });
    res.json({ bookings });
  }));

  app.post('/api/church/bookings', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    const b = req.body || {};
    const facilityId = String(b.facilityId || '');
    const title = String(b.title || '').trim();
    const startAt = iso(b.startAt);
    const endAt = iso(b.endAt);
    if (!facilityId || !title || !startAt || !endAt || endAt <= startAt) {
      return res.status(400).json({ error: 'facilityId, title, startAt, endAt (end > start) wajib.' });
    }
    const facility = await prisma.facility.findUnique({ where: { id: facilityId } });
    if (!facility) return res.status(404).json({ error: 'Fasilitas tidak ditemukan.' });
    const clash = await prisma.facilityBooking.findFirst({
      where: { facilityId, status: { in: ['SUBMITTED', 'APPROVED'] }, startAt: { lt: endAt }, endAt: { gt: startAt } },
    });
    if (clash) return res.status(409).json({ error: 'Jadwal bentrok dengan booking lain.' });
    const created = await prisma.facilityBooking.create({
      data: {
        id: id('bkg'),
        facilityId,
        title,
        purpose: b.purpose || null,
        unit: String(b.unit || unitOf(req)).toUpperCase().slice(0, 40),
        requesterUserId: req.authUser.id,
        contactPhone: b.contactPhone || null,
        startAt,
        endAt,
        status: b.status === 'DRAFT' ? 'DRAFT' : 'SUBMITTED',
        notes: b.notes || null,
      },
    });
    res.status(201).json({ booking: created });
  }));

  app.patch('/api/church/bookings/:id', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    const existing = await prisma.facilityBooking.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Booking tidak ditemukan.' });
    const manager = await facilityManager(req);
    const isTreasurer = await treasurer(req);
    const isOwner = existing.requesterUserId === req.authUser.id;
    const b = req.body || {};
    const data = {};

    if (b.status !== undefined) {
      const status = String(b.status).toUpperCase();
      if (!BOOKING_STATUS.includes(status)) return res.status(400).json({ error: 'status tidak valid.' });
      if (status === 'CANCELLED') {
        if (!manager && !isOwner) return deny(res);
      } else if (!manager) return deny(res);
      data.status = status;
      if (status === 'APPROVED') { data.approverId = req.authUser.id; data.approvedAt = new Date(); }
      if (status === 'REJECTED') { data.rejectReason = b.rejectReason || null; data.approverId = req.authUser.id; }
    }
    if (b.rateAmount !== undefined) {
      if (!manager) return deny(res);
      data.rateAmount = num(b.rateAmount);
    }
    if (b.issueInvoice) {
      if (!manager && !isTreasurer) return deny(res);
      data.invoiceNo = String(b.invoiceNo || `INV-${Date.now().toString(36).toUpperCase()}`);
      data.invoiceIssuedAt = new Date();
      if (b.rateAmount !== undefined) data.rateAmount = num(b.rateAmount);
    }
    if (b.markPaid) {
      if (!isTreasurer) return deny(res);
      data.paidAt = new Date();
      data.paidAmount = num(b.paidAmount ?? existing.rateAmount ?? 0);
    }
    if (b.notes !== undefined) data.notes = b.notes;

    const booking = await prisma.facilityBooking.update({ where: { id: existing.id }, data });

    // Bila lunas, catat kas masuk (bila akun ditentukan).
    if (b.markPaid && isTreasurer && b.accountId) {
      await prisma.cashTransaction.create({
        data: {
          id: id('ctx'),
          accountId: String(b.accountId),
          direction: 'IN',
          amount: data.paidAmount ?? 0,
          category: 'SEWA_FASILITAS',
          unit: booking.unit,
          refType: 'BOOKING',
          refId: booking.id,
          description: `Sewa ${booking.title}`,
          occurredAt: new Date(),
          createdById: req.authUser.id,
        },
      }).catch(() => null);
    }
    res.json({ booking });
  }));

  // ---------------- Pemeliharaan ----------------
  app.get('/api/church/maintenance', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    const logs = await prisma.maintenanceLog.findMany({ orderBy: { spentAt: 'desc' }, take: 300 });
    res.json({ logs });
  }));

  app.post('/api/church/maintenance', requireRole(), wrap(async (req, res) => {
    if (!(await facilityManager(req))) return deny(res);
    const prisma = getPrisma();
    const b = req.body || {};
    const title = String(b.title || '').trim();
    if (!title) return res.status(400).json({ error: 'title wajib.' });
    const created = await prisma.maintenanceLog.create({
      data: {
        id: id('mnt'),
        facilityId: b.facilityId || null,
        title,
        description: b.description || null,
        vendor: b.vendor || null,
        costAmount: b.costAmount != null ? num(b.costAmount) : 0,
        spentAt: iso(b.spentAt) || new Date(),
        unit: String(b.unit || unitOf(req)).toUpperCase().slice(0, 40),
        driveFolderId: b.driveFolderId || null,
        createdById: req.authUser.id,
      },
    });
    res.status(201).json({ log: created });
  }));

  // ---------------- Kas ----------------
  app.get('/api/church/cash/accounts', requireRole(), wrap(async (req, res) => {
    if (!(await treasurer(req))) return deny(res);
    const prisma = getPrisma();
    const accounts = await prisma.cashAccount.findMany({ orderBy: [{ kind: 'asc' }, { name: 'asc' }] });
    const sums = await prisma.cashTransaction.groupBy({
      by: ['accountId', 'direction'],
      _sum: { amount: true },
    });
    const bal = new Map();
    for (const s of sums) {
      const arr = bal.get(s.accountId) || [];
      arr.push({ direction: s.direction, sum: s._sum?.amount });
      bal.set(s.accountId, arr);
    }
    res.json({
      accounts: accounts.map((a) => ({ ...a, balance: accountBalance(a.openingBalance, bal.get(a.id) || []) })),
    });
  }));

  app.post('/api/church/cash/accounts', requireRole(), wrap(async (req, res) => {
    if (!(await treasurer(req))) return deny(res);
    const prisma = getPrisma();
    const b = req.body || {};
    const code = String(b.code || '').trim().toUpperCase();
    const name = String(b.name || '').trim();
    const kind = String(b.kind || '').toUpperCase();
    if (!code || !name || !ACCOUNT_KINDS.includes(kind)) {
      return res.status(400).json({ error: 'code, name, kind (KAS_GEREJA|KAS_UNIT|PETTY_CASH) wajib.' });
    }
    const created = await prisma.cashAccount.create({
      data: {
        id: id('acc'),
        code,
        name,
        unit: String(b.unit || unitOf(req)).toUpperCase().slice(0, 40),
        kind,
        openingBalance: b.openingBalance != null ? num(b.openingBalance) : 0,
        isActive: b.isActive !== false,
      },
    });
    res.status(201).json({ account: created });
  }));

  app.get('/api/church/cash/transactions', requireRole(), wrap(async (req, res) => {
    if (!(await treasurer(req))) return deny(res);
    const prisma = getPrisma();
    const where = {};
    if (req.query.accountId) where.accountId = String(req.query.accountId);
    if (req.query.direction) where.direction = String(req.query.direction).toUpperCase();
    const transactions = await prisma.cashTransaction.findMany({ where, orderBy: { occurredAt: 'desc' }, take: 500 });
    res.json({ transactions });
  }));

  app.post('/api/church/cash/transactions', requireRole(), wrap(async (req, res) => {
    if (!(await treasurer(req))) return deny(res);
    const prisma = getPrisma();
    const b = req.body || {};
    const accountId = String(b.accountId || '');
    const direction = String(b.direction || '').toUpperCase();
    const amount = num(b.amount);
    if (!accountId || !['IN', 'OUT'].includes(direction) || !(amount > 0)) {
      return res.status(400).json({ error: 'accountId, direction (IN|OUT), amount (>0) wajib.' });
    }
    const created = await prisma.cashTransaction.create({
      data: {
        id: id('ctx'),
        accountId,
        direction,
        amount,
        category: String(b.category || 'MANUAL').toUpperCase().slice(0, 60),
        unit: b.unit ? String(b.unit).toUpperCase().slice(0, 40) : unitOf(req),
        refType: b.refType ? String(b.refType).toUpperCase() : 'MANUAL',
        refId: b.refId || null,
        description: b.description || null,
        occurredAt: iso(b.occurredAt) || new Date(),
        createdById: req.authUser.id,
      },
    });
    res.status(201).json({ transaction: created });
  }));

  app.patch('/api/church/cash/transactions/:id', requireRole(), wrap(async (req, res) => {
    if (!(await treasurer(req))) return deny(res);
    const prisma = getPrisma();
    const data = {};
    if (req.body?.approve) { data.approvedById = req.authUser.id; data.approvedAt = new Date(); }
    if (req.body?.proofFileId !== undefined) data.proofFileId = req.body.proofFileId || null;
    const transaction = await prisma.cashTransaction.update({ where: { id: req.params.id }, data });
    res.json({ transaction });
  }));

  // ---------------- Pengajuan dana ----------------
  app.get('/api/church/funding', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    const where = {};
    if (req.query.status) where.status = String(req.query.status).toUpperCase();
    if (!(await treasurer(req))) where.requesterUserId = req.authUser.id;
    const requests = await prisma.fundingRequest.findMany({ where, orderBy: { createdAt: 'desc' }, take: 300 });
    res.json({ requests });
  }));

  app.post('/api/church/funding', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    const b = req.body || {};
    const title = String(b.title || '').trim();
    const amount = num(b.amount);
    if (!title || !(amount > 0)) return res.status(400).json({ error: 'title & amount (>0) wajib.' });
    const created = await prisma.fundingRequest.create({
      data: {
        id: id('fnd'),
        unit: String(b.unit || unitOf(req)).toUpperCase().slice(0, 40),
        title,
        description: b.description || null,
        amount,
        neededBy: iso(b.neededBy),
        status: 'SUBMITTED',
        requesterUserId: req.authUser.id,
      },
    });
    res.status(201).json({ request: created });
  }));

  app.patch('/api/church/funding/:id', requireRole(), wrap(async (req, res) => {
    const prisma = getPrisma();
    const existing = await prisma.fundingRequest.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
    const isTreasurer = await treasurer(req);
    const b = req.body || {};
    const data = {};
    if (b.action === 'approve' || b.action === 'reject' || b.action === 'disburse' || b.action === 'settle') {
      if (!isTreasurer) return deny(res);
      if (b.action === 'approve') { data.status = 'APPROVED'; data.approverUserId = req.authUser.id; data.approvedAt = new Date(); }
      if (b.action === 'reject') { data.status = 'REJECTED'; data.approverUserId = req.authUser.id; data.rejectReason = b.rejectReason || null; }
      if (b.action === 'disburse') {
        data.status = 'DISBURSED'; data.disbursedAt = new Date(); data.accountId = b.accountId || existing.accountId || null;
        await prisma.cashTransaction.create({
          data: {
            id: id('ctx'),
            accountId: String(b.accountId || ''),
            direction: 'OUT',
            amount: Number(existing.amount),
            category: 'FUNDING',
            unit: existing.unit,
            refType: 'FUNDING',
            refId: existing.id,
            description: `Pencairan dana: ${existing.title}`,
            occurredAt: new Date(),
            createdById: req.authUser.id,
          },
        }).catch(() => null);
      }
      if (b.action === 'settle') { data.status = 'SETTLED'; data.settleNote = b.settleNote || null; }
    }
    const request = await prisma.fundingRequest.update({ where: { id: existing.id }, data });
    res.json({ request });
  }));

  // ---------------- Distribusi ----------------
  app.get('/api/church/distributions', requireRole(), wrap(async (req, res) => {
    if (!(await treasurer(req))) return deny(res);
    const prisma = getPrisma();
    const distributions = await prisma.distribution.findMany({ orderBy: { createdAt: 'desc' }, take: 300 });
    res.json({ distributions });
  }));

  app.post('/api/church/distributions', requireRole(), wrap(async (req, res) => {
    if (!(await treasurer(req))) return deny(res);
    const prisma = getPrisma();
    const b = req.body || {};
    const sourceType = String(b.sourceType || '').toUpperCase();
    const targetUnit = String(b.targetUnit || '').toUpperCase();
    const amount = num(b.amount);
    if (!['BZP_CAMPAIGN', 'BZP_SALES', 'DONATION', 'OTHER'].includes(sourceType) || !targetUnit || !(amount > 0)) {
      return res.status(400).json({ error: 'sourceType, targetUnit, amount (>0) wajib.' });
    }
    const created = await prisma.distribution.create({
      data: {
        id: id('dst'),
        sourceType,
        sourceRef: b.sourceRef || null,
        targetUnit,
        amount,
        status: 'PROPOSED',
        decidedByUserId: req.authUser.id,
        note: b.note || null,
      },
    });
    res.status(201).json({ distribution: created });
  }));

  app.patch('/api/church/distributions/:id', requireRole(), wrap(async (req, res) => {
    if (!(await treasurer(req))) return deny(res);
    const prisma = getPrisma();
    const status = String(req.body?.status || '').toUpperCase();
    if (!['PROPOSED', 'APPROVED', 'PAID'].includes(status)) return res.status(400).json({ error: 'status tidak valid.' });
    const distribution = await prisma.distribution.update({
      where: { id: req.params.id },
      data: { status, decidedByUserId: req.authUser.id, decidedAt: new Date(), note: req.body?.note ?? undefined },
    });
    res.json({ distribution });
  }));
}
