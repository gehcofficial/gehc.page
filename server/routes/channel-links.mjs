import crypto from 'node:crypto';
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { isValidWhatsAppUrl } from '../lib/baku-tau.mjs';
import { isKomisiOrSuperadmin, isBodTimkerja, globalRoles } from '../division-rbac.mjs';
import {
  isKoinoniaOperator,
  isDivisionStaff,
  mentoredGroupIds,
  isPortalStaff,
} from '../lib/checkin-access.mjs';

const KINDS = ['EVENT', 'GROUP', 'DIVISION', 'KOLOM', 'RECREATIONAL'];
const DIVISION_CATALOG = [
  { id: 'LITURGIA', name: 'Liturgia' },
  { id: 'DIDASKALIA', name: 'Didaskalia' },
  { id: 'KOINONIA', name: 'Koinonia' },
  { id: 'DIAKONIA', name: 'Diakonia' },
  { id: 'MARTURIA', name: 'Marturia' },
  { id: 'BENZARPR', name: 'Benzarpreneurship' },
];
const clId = () => `cl-${crypto.randomUUID()}`;

function roles(user) {
  return globalRoles(user);
}

async function canWriteKind(authUser, kind, refId) {
  if (!authUser) return false;
  if (isKomisiOrSuperadmin(authUser)) return true;
  if (kind === 'EVENT') return isKoinoniaOperator(authUser);
  if (kind === 'KOLOM') return false;
  if (kind === 'RECREATIONAL') return roles(authUser).includes('COMMITTEE') || isKomisiOrSuperadmin(authUser);
  if (kind === 'DIVISION') return isDivisionStaff(authUser, refId);
  if (kind === 'GROUP') {
    const ids = await mentoredGroupIds(authUser);
    return ids.includes(refId);
  }
  return false;
}

async function visibleKinds(authUser) {
  const r = roles(authUser);
  if (isKomisiOrSuperadmin(authUser) || r.includes('BPMJ') || await isBodTimkerja(authUser)) {
    return KINDS;
  }
  const out = new Set();
  if (await isKoinoniaOperator(authUser)) out.add('EVENT');
  if (r.includes('COMMITTEE')) {
    out.add('DIVISION');
    out.add('RECREATIONAL');
  }
  if (r.includes('MENTOR') || r.includes('CO_MENTOR')) out.add('GROUP');
  return [...out];
}

export function registerChannelLinkRoutes(app, { wrap }) {
  app.get(
    '/api/channel-links',
    requireRole('KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR', 'BPMJ'),
    wrap(async (req, res) => {
      if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
      if (!isPortalStaff(req.authUser)) return res.status(403).json({ error: 'Akses ditolak.' });
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

      const kinds = await visibleKinds(req.authUser);
      const mentorGroups = await mentoredGroupIds(req.authUser);
      const isBroad = isKomisiOrSuperadmin(req.authUser)
        || roles(req.authUser).includes('BPMJ')
        || await isBodTimkerja(req.authUser);

      const links = await prisma.channelLink.findMany({
        where: { kind: { in: kinds } },
        orderBy: { kind: 'asc' },
      }).catch(() => []);

      const filtered = isBroad
        ? links
        : links.filter((l) => {
            if (l.kind === 'GROUP') return mentorGroups.includes(l.refId);
            if (l.kind === 'DIVISION') return true;
            return kinds.includes(l.kind);
          });

      const [events, groups, kolom, recreational] = await Promise.all([
        prisma.eventProgram.findMany({
          select: { id: true, slug: true, name: true, status: true, whatsappGroupUrl: true },
          orderBy: { createdAt: 'desc' },
          take: 40,
        }).catch(() => []),
        kinds.includes('GROUP') || isBroad
          ? prisma.group.findMany({
              where: isBroad ? { status: 'ACTIVE' } : { status: 'ACTIVE', id: { in: mentorGroups.length ? mentorGroups : ['__none__'] } },
              select: { id: true, name: true },
              orderBy: { name: 'asc' },
            }).catch(() => [])
          : [],
        kinds.includes('KOLOM') || isBroad
          ? prisma.kolom.findMany({ select: { id: true, number: true, name: true }, orderBy: { number: 'asc' } }).catch(() => [])
          : [],
        kinds.includes('RECREATIONAL') || isBroad
          ? prisma.recreationalGroup.findMany({
              where: { selectable: true },
              select: { id: true, name: true, kind: true, parentId: true },
              orderBy: { sortOrder: 'asc' },
            }).catch(() => [])
          : [],
      ]);

      const eventLinks = events
        .filter((ev) => ev.whatsappGroupUrl && !filtered.some((l) => l.kind === 'EVENT' && l.refId === ev.id))
        .map((ev) => ({
          id: `legacy-${ev.id}`,
          kind: 'EVENT',
          refId: ev.id,
          label: ev.name,
          url: ev.whatsappGroupUrl,
          updatedAt: null,
        }));

      const write = {
        EVENT: await isKoinoniaOperator(req.authUser) || isKomisiOrSuperadmin(req.authUser),
        KOLOM: isKomisiOrSuperadmin(req.authUser),
        RECREATIONAL: isKomisiOrSuperadmin(req.authUser) || roles(req.authUser).includes('COMMITTEE'),
        GROUP: isKomisiOrSuperadmin(req.authUser) || mentorGroups.length > 0,
        DIVISION: isKomisiOrSuperadmin(req.authUser) || roles(req.authUser).includes('COMMITTEE'),
      };

      res.json({
        links: [...filtered, ...eventLinks],
        catalog: {
          events: kinds.includes('EVENT') || isBroad ? events : [],
          groups,
          divisions: DIVISION_CATALOG,
          kolom,
          recreational,
        },
        canWrite: write,
        mentorGroupIds: mentorGroups,
        raci: {
          EVENT: { responsible: 'Koinonia — Hubungan & Komunikasi', accountable: 'Ketua Tim Kerja' },
          GROUP: { responsible: 'Mentor kelompok', accountable: 'Komisi' },
          DIVISION: { responsible: 'Kepala Divisi', accountable: 'Ketua Tim Kerja' },
          KOLOM: { responsible: 'Komisi Sekretaris', accountable: 'Komisi (BPMJ diinformasikan)' },
          RECREATIONAL: { responsible: 'PIC / Komisi', accountable: 'Komisi' },
        },
      });
    }),
  );

  app.put(
    '/api/channel-links',
    requireRole('KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR'),
    wrap(async (req, res) => {
      if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

      const kind = String(req.body?.kind || '').toUpperCase();
      const refId = String(req.body?.refId || '').trim();
      const url = String(req.body?.url || '').trim();
      const label = req.body?.label ? String(req.body.label).trim().slice(0, 160) : null;
      if (!KINDS.includes(kind) || !refId) {
        return res.status(400).json({ error: 'kind dan refId wajib.' });
      }
      if (!isValidWhatsAppUrl(url)) {
        return res.status(400).json({ error: 'URL harus tautan undangan WhatsApp (chat.whatsapp.com atau wa.me).' });
      }
      if (!(await canWriteKind(req.authUser, kind, refId))) {
        return res.status(403).json({ error: 'Anda tidak berwenang mengubah kanal ini.' });
      }

      const existing = await prisma.channelLink.findUnique({
        where: { kind_refId: { kind, refId } },
      });
      const saved = existing
        ? await prisma.channelLink.update({
            where: { id: existing.id },
            data: { url, label, updatedById: req.authUser.id },
          })
        : await prisma.channelLink.create({
            data: { id: clId(), kind, refId, url, label, updatedById: req.authUser.id },
          });

      if (kind === 'EVENT') {
        await prisma.eventProgram.update({
          where: { id: refId },
          data: { whatsappGroupUrl: url },
        }).catch(() => null);
      }

      res.json({ link: saved });
    }),
  );

  app.delete(
    '/api/channel-links/:id',
    requireRole('KOMISI', 'COMMITTEE'),
    wrap(async (req, res) => {
      if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      if (!isKomisiOrSuperadmin(req.authUser) && !(await isBodTimkerja(req.authUser))) {
        return res.status(403).json({ error: 'Hanya Komisi / Ketua Tim Kerja yang boleh menghapus tautan.' });
      }
      const existing = await prisma.channelLink.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Tautan tidak ditemukan.' });
      await prisma.channelLink.delete({ where: { id: existing.id } });
      res.json({ ok: true });
    }),
  );
}
