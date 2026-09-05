import crypto from 'node:crypto';
import { getPrisma } from '../db.mjs';
import { requireRole } from '../auth.mjs';
import { isValidWhatsAppUrl } from '../lib/baku-tau.mjs';
import { isKomisiOrSuperadmin } from '../division-rbac.mjs';
import {
  DIVISION_CATALOG,
  isChannelWriter,
  canWriteKind,
  scopedGroupIds,
  scopedDivisionCodes,
  isBroadChannelViewer,
} from '../lib/channel-link-access.mjs';

const KINDS = ['EVENT', 'GROUP', 'DIVISION', 'KOLOM', 'RECREATIONAL'];
const clId = () => `cl-${crypto.randomUUID()}`;

const RACI = {
  EVENT: { responsible: 'Koinonia — Hubungan & Komunikasi', accountable: 'Ketua Tim Kerja', writeVia: 'Program & Event → Edit' },
  GROUP: { responsible: 'Tim Kerja BOD', accountable: 'Komisi' },
  DIVISION: { responsible: 'Tim Kerja BOD', accountable: 'Ketua Tim Kerja' },
  KOLOM: { responsible: 'Komisi Sekretaris', accountable: 'Komisi (BPMJ diinformasikan)' },
  RECREATIONAL: { responsible: 'Tim Kerja BOD', accountable: 'Komisi' },
};

function writeFlags(authUser) {
  const komisi = isKomisiOrSuperadmin(authUser);
  return {
    EVENT: false,
    KOLOM: komisi,
    RECREATIONAL: true,
    GROUP: true,
    DIVISION: true,
  };
}

export function registerChannelLinkRoutes(app, { wrap }) {
  app.get(
    '/api/channel-links/scoped',
    requireRole('KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR', 'MENTEE', 'BPMJ'),
    wrap(async (req, res) => {
      if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

      const isBroad = await isBroadChannelViewer(req.authUser);
      const [groupIds, divisionCodes] = await Promise.all([
        isBroad ? Promise.resolve([]) : scopedGroupIds(req.authUser),
        isBroad ? Promise.resolve([]) : scopedDivisionCodes(req.authUser),
      ]);

      const or = [];
      if (isBroad) {
        or.push({ kind: 'GROUP' }, { kind: 'DIVISION' });
      } else {
        if (groupIds.length) or.push({ kind: 'GROUP', refId: { in: groupIds } });
        if (divisionCodes.length) or.push({ kind: 'DIVISION', refId: { in: divisionCodes } });
      }

      const links = or.length
        ? await prisma.channelLink.findMany({
            where: { OR: or },
            orderBy: { kind: 'asc' },
          }).catch(() => [])
        : [];

      const groups = isBroad
        ? await prisma.group.findMany({
            where: { status: 'ACTIVE' },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
          }).catch(() => [])
        : groupIds.length
          ? await prisma.group.findMany({
              where: { status: 'ACTIVE', id: { in: groupIds } },
              select: { id: true, name: true },
              orderBy: { name: 'asc' },
            }).catch(() => [])
          : [];

      res.json({
        links,
        groups,
        divisions: DIVISION_CATALOG.filter((d) => isBroad || divisionCodes.includes(d.id)),
      });
    }),
  );

  app.get(
    '/api/channel-links',
    requireRole('KOMISI', 'COMMITTEE', 'BPMJ'),
    wrap(async (req, res) => {
      if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
      if (!(await isChannelWriter(req.authUser))) {
        return res.status(403).json({ error: 'Hanya Admin, BPMJ, Komisi, atau Tim Kerja BOD yang mengelola kanal.' });
      }
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

      const links = await prisma.channelLink.findMany({
        where: { kind: { in: KINDS } },
        orderBy: { kind: 'asc' },
      }).catch(() => []);

      const [events, groups, kolom, recreational] = await Promise.all([
        prisma.eventProgram.findMany({
          select: { id: true, slug: true, name: true, status: true, whatsappGroupUrl: true },
          orderBy: { createdAt: 'desc' },
          take: 40,
        }).catch(() => []),
        prisma.group.findMany({
          where: { status: 'ACTIVE' },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }).catch(() => []),
        prisma.kolom.findMany({ select: { id: true, number: true, name: true }, orderBy: { number: 'asc' } }).catch(() => []),
        prisma.recreationalGroup.findMany({
          where: { selectable: true },
          select: { id: true, name: true, kind: true, parentId: true },
          orderBy: { sortOrder: 'asc' },
        }).catch(() => []),
      ]);

      const eventLinks = events
        .filter((ev) => ev.whatsappGroupUrl && !links.some((l) => l.kind === 'EVENT' && l.refId === ev.id))
        .map((ev) => ({
          id: `legacy-${ev.id}`,
          kind: 'EVENT',
          refId: ev.id,
          label: ev.name,
          url: ev.whatsappGroupUrl,
          updatedAt: null,
        }));

      res.json({
        links: [...links, ...eventLinks],
        catalog: {
          events,
          groups,
          divisions: DIVISION_CATALOG,
          kolom,
          recreational,
        },
        canWrite: writeFlags(req.authUser),
        raci: RACI,
      });
    }),
  );

  app.put(
    '/api/channel-links',
    requireRole('KOMISI', 'COMMITTEE', 'BPMJ'),
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
      if (kind === 'EVENT' && !isKomisiOrSuperadmin(req.authUser)) {
        return res.status(400).json({ error: 'Ubah tautan grup peserta di Program & Event → Edit.' });
      }
      if (!isValidWhatsAppUrl(url)) {
        return res.status(400).json({ error: 'URL harus tautan undangan WhatsApp (chat.whatsapp.com atau wa.me).' });
      }
      if (!(await canWriteKind(req.authUser, kind))) {
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
    requireRole('KOMISI', 'COMMITTEE', 'BPMJ'),
    wrap(async (req, res) => {
      if (!req.authUser) return res.status(401).json({ error: 'Belum login.' });
      const prisma = getPrisma();
      if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });
      if (!(await isChannelWriter(req.authUser))) {
        return res.status(403).json({ error: 'Hanya Admin, BPMJ, Komisi, atau Tim Kerja BOD yang boleh menghapus tautan.' });
      }
      const existing = await prisma.channelLink.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Tautan tidak ditemukan.' });
      await prisma.channelLink.delete({ where: { id: existing.id } });
      if (existing.kind === 'EVENT') {
        await prisma.eventProgram.update({
          where: { id: existing.refId },
          data: { whatsappGroupUrl: null },
        }).catch(() => null);
      }
      res.json({ ok: true });
    }),
  );
}
