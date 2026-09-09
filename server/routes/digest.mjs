import crypto from 'node:crypto';
import { getPrisma } from '../db.mjs';
import { isKomisiOrSuperadmin } from '../division-rbac.mjs';
import { approverUserIds } from '../lib/approval-notify.mjs';
import { diffDrift, listPublicFiles, runDriveAudit } from '../lib/drive-audit.mjs';
import { hasUserDriveToken, getUserDrive, isDriveAuthError } from '../lib/gdrive-user-oauth.mjs';

const nid = () => `ntf-${crypto.randomUUID()}`;

/**
 * Cron digest drift Drive (harian, digabung dengan lifecycle):
 * folder hilang/asing/tanpa-tag + file publik baru + token mati.
 * Hanya item BARU vs snapshot digest sebelumnya yang dibunyikan.
 *
 * Auth: Bearer CRON_SECRET (Vercel Cron otomatis) atau sesi Komisi/Superadmin
 * (tombol "Cek drift sekarang" di panel Integrasi).
 */
export function registerDigestRoutes(app, { wrap }) {
  const handler = wrap(async (req, res) => {
    const prisma = getPrisma();
    if (!prisma) return res.status(503).json({ error: 'DATABASE_URL belum dikonfigurasi.' });

    const cronSecret = process.env.CRON_SECRET || '';
    const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const viaCron = cronSecret && bearer === cronSecret;
    if (!viaCron) {
      if (!req.authUser || !isKomisiOrSuperadmin(req.authUser)) {
        return res.status(403).json({ error: 'Butuh CRON_SECRET atau peran Komisi.' });
      }
    }

    // 1. Token tulis pemilik.
    let tokenOk = false;
    if (hasUserDriveToken()) {
      try {
        const drive = await getUserDrive();
        await drive.about.get({ fields: 'user(emailAddress)' });
        tokenOk = true;
      } catch (e) {
        if (!isDriveAuthError(e)) {
          return res.status(502).json({ error: `Probe Drive gagal: ${e?.message || 'tidak diketahui'}` });
        }
        tokenOk = false;
      }
    }

    // 2. Audit struktur (butuh SA baca; gagal → lewati dengan catatan).
    let audit = null;
    let auditError = null;
    try {
      audit = await runDriveAudit();
    } catch (e) {
      auditError = e?.message || 'Audit gagal.';
    }

    // 3. File di folder [PUBLIK].
    let publicFiles = [];
    try {
      publicFiles = await listPublicFiles();
    } catch (e) {
      auditError = auditError || `List publik gagal: ${e?.message || 'tidak diketahui'}`;
    }

    const curr = {
      missing: audit
        ? [
            ...audit.groups.items.filter((g) => !g.ok).map((g) => `grup:${g.name}`),
            ...audit.pillars.items.filter((p) => !p.ok).map((p) => `${p.pillar}/${p.name}`),
          ]
        : [],
      extra: audit ? audit.extraGroupFolders : [],
      untagged: audit ? audit.untaggedFolders : [],
      publicNew: publicFiles.flatMap((f) =>
        (f.files || []).map((x) => ({ id: x.id, name: x.name, folderName: f.folderName }))
      ),
      publicFiles: publicFiles.map((f) => ({
        folderId: f.folderId,
        files: (f.files || []).map((x) => ({ id: x.id, name: x.name })),
      })),
      tokenOk,
    };

    const last = await prisma.notification.findFirst({
      where: { type: 'DRIVE_DRIFT' },
      orderBy: { createdAt: 'desc' },
    }).catch(() => null);
    const prev = last && last.payload && typeof last.payload === 'object' ? last.payload.snapshot || null : null;

    const items = diffDrift(prev, curr);
    if (!items.length) {
      return res.json({ ok: true, newItems: [], note: auditError || 'Tidak ada perubahan baru.' });
    }

    const recipients = await approverUserIds(prisma);
    if (recipients.length) {
      await prisma.notification.createMany({
        data: recipients.map((userId) => ({
          id: nid(),
          type: 'DRIVE_DRIFT',
          memberId: userId,
          title: `Drive berubah: ${items.length} temuan baru`,
          message: items.slice(0, 5).map((i) => i.label).join(' · '),
          payload: { snapshot: curr, items, url: '#/portal/komisi/integrations' },
          status: 'OPEN',
        })),
      }).catch(() => null);
    }
    res.json({ ok: true, newItems: items, notified: recipients.length });
  });

  app.get('/api/cron/digest', handler);
  app.post('/api/cron/digest', handler);
}
