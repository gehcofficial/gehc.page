import { requireRole } from '../auth.mjs';
import { KOMISION_WITH_LEGACY_SUPERADMIN } from '../lib/rbac-constants.mjs';
import { WEBSITE_VISUAL_SUBFOLDERS } from '../lib/website-visuals.mjs';
import {
  publishVisualsConfigured,
  triggerPublishVisualsWorkflow,
  getPublishVisualsRun,
} from '../lib/github-actions.mjs';

export const PULLABLE_VISUAL_FOLDERS = [...WEBSITE_VISUAL_SUBFOLDERS, 'pengurus', 'testimoni'];

const FOLDER_LABELS = {
  kelompok: 'Cover 10 rumah (kelompok)',
  landing: 'Hero & collage landing',
  brand: 'Logo & brand',
  warta: 'Banner warta',
  kegiatan: 'Banner kegiatan',
  benzarpreneurship: 'Benzarpreneurship',
  pengurus: 'Foto pengurus',
  testimoni: 'Foto testimoni',
};

/** Portal → publish visual Drive ke CDN via GitHub Actions. */
export function registerVisualsPublishRoutes(app, { wrap }) {
  app.get('/api/admin/visuals/publish/config', requireRole(...KOMISION_WITH_LEGACY_SUPERADMIN), wrap(async (_req, res) => {
    res.json({
      configured: publishVisualsConfigured(),
      folders: PULLABLE_VISUAL_FOLDERS.map((id) => ({
        id,
        label: FOLDER_LABELS[id] || id,
      })),
      defaultFolder: 'kelompok',
      defaultBranch: 'staging',
      branches: ['staging', 'main'],
    });
  }));

  app.post('/api/admin/visuals/publish', requireRole(...KOMISION_WITH_LEGACY_SUPERADMIN), wrap(async (req, res) => {
    if (!publishVisualsConfigured()) {
      return res.status(503).json({
        error: 'Publish otomatis belum dikonfigurasi (GITHUB_PUBLISH_TOKEN + GITHUB_REPO). Hubungi Tim Tech.',
      });
    }

    const folder = req.body?.folder != null ? String(req.body.folder).toLowerCase().trim() : 'kelompok';
    const branch = req.body?.branch === 'main' ? 'main' : 'staging';

    if (folder && !PULLABLE_VISUAL_FOLDERS.includes(folder)) {
      return res.status(400).json({ error: `Folder tidak valid: ${folder}` });
    }

    if (branch === 'main') {
      const roles = (req.authUser?.roles || []).map((r) => r.role);
      const canProd =
        roles.includes('SUPERADMIN') ||
        roles.includes('KOMISI') ||
        (req.authUser?.email && process.env.SUPERADMIN_EMAILS?.split(',').map((e) => e.trim().toLowerCase()).includes(req.authUser.email.toLowerCase()));
      if (!canProd) {
        return res.status(403).json({ error: 'Deploy production (main) hanya untuk SUPERADMIN / KOMISI.' });
      }
    }

    try {
      const result = await triggerPublishVisualsWorkflow({
        folder: folder || '',
        branch,
      });
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(502).json({ error: e.message || 'Gagal memicu GitHub Actions.' });
    }
  }));

  app.get('/api/admin/visuals/publish/status/:runId', requireRole(...KOMISION_WITH_LEGACY_SUPERADMIN), wrap(async (req, res) => {
    if (!publishVisualsConfigured()) {
      return res.status(503).json({ error: 'Publish otomatis belum dikonfigurasi.' });
    }
    try {
      const run = await getPublishVisualsRun(req.params.runId);
      res.json(run);
    } catch (e) {
      res.status(502).json({ error: e.message || 'Gagal membaca status workflow.' });
    }
  }));
}
