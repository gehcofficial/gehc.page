import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Images,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Lock,
  Rocket,
  Loader2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { fetchApiStatus, fetchDriveFolders } from '../../services/driveApi';
import { displayFolderName } from '../../lib/driveDisplay';
import {
  fetchVisualsPublishConfig,
  fetchVisualsPublishStatus,
  triggerVisualsPublish,
  type VisualsPublishConfig,
} from '../../services/visualsPublishApi';

const GDRIVE_ROOT_FALLBACK_URL =
  'https://drive.google.com/drive/folders/1w_ajoAUKJM81ttGLSH-EKeNyca0Y96-u';

const STATUS_LABEL: Record<string, string> = {
  queued: 'Antrian CI…',
  in_progress: 'Menarik visual & deploy…',
  completed: 'Selesai',
  waiting: 'Menunggu…',
};

export const MediaGuidePanel: React.FC = () => {
  const { canAccess, isSuperAdmin, isKomisi, addToast } = useApp();
  const allowed = canAccess('content_manage');
  const canProdBranch = isSuperAdmin || isKomisi;

  const [driveOk, setDriveOk] = useState<boolean | null>(null);
  const [galleryUrl, setGalleryUrl] = useState<string>(GDRIVE_ROOT_FALLBACK_URL);
  const [checking, setChecking] = useState(true);

  const [publishConfig, setPublishConfig] = useState<VisualsPublishConfig | null>(null);
  const [folder, setFolder] = useState('kelompok');
  const [branch, setBranch] = useState('staging');
  const [publishing, setPublishing] = useState(false);
  const [runId, setRunId] = useState<number | null>(null);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [runConclusion, setRunConclusion] = useState<string | null>(null);
  const [runUrl, setRunUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshStatus = () => {
    setChecking(true);
    fetchApiStatus()
      .then((st) => {
        setDriveOk(st.driveConfigured);
        if (!st.driveConfigured) return;
        return fetchDriveFolders().then((fs) => {
          const visual = fs.find(
            (f) => f.zoneTag === 'PUBLIK' && /website visual/i.test(f.name)
          );
          const publik = visual || fs.find((f) => f.zoneTag === 'PUBLIK');
          if (publik) {
            setGalleryUrl(`https://drive.google.com/drive/folders/${publik.id}`);
          }
        });
      })
      .catch(() => setDriveOk(false))
      .finally(() => setChecking(false));
  };

  const loadPublishConfig = useCallback(() => {
    fetchVisualsPublishConfig()
      .then((cfg) => {
        setPublishConfig(cfg);
        setFolder(cfg.defaultFolder);
        setBranch(cfg.defaultBranch);
      })
      .catch(() => setPublishConfig(null));
  }, []);

  useEffect(() => {
    refreshStatus();
    loadPublishConfig();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadPublishConfig]);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPolling = (id: number) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const run = await fetchVisualsPublishStatus(id);
        setRunStatus(run.status);
        setRunConclusion(run.conclusion);
        if (run.htmlUrl) setRunUrl(run.htmlUrl);
        if (run.status === 'completed') {
          stopPolling();
          setPublishing(false);
          if (run.conclusion === 'success') {
            addToast({
              type: 'success',
              title: 'Publish visual berhasil',
              description: 'Vercel sedang deploy — refresh halaman publik dalam 1–3 menit.',
            });
          } else {
            addToast({
              type: 'error',
              title: 'Workflow gagal',
              description: 'Buka log GitHub Actions untuk detail.',
            });
          }
        }
      } catch {
        stopPolling();
        setPublishing(false);
      }
    }, 5000);
  };

  const handlePublish = async () => {
    if (!publishConfig?.configured) {
      addToast({
        type: 'warning',
        title: 'Belum dikonfigurasi',
        description: 'Hubungi Tim Tech untuk GITHUB_PUBLISH_TOKEN di server staging.',
      });
      return;
    }
    setPublishing(true);
    setRunId(null);
    setRunStatus('queued');
    setRunConclusion(null);
    setRunUrl(null);
    try {
      const result = await triggerVisualsPublish({ folder, branch });
      if (result.runId) {
        setRunId(result.runId);
        setRunStatus(result.status);
        setRunConclusion(result.conclusion);
        setRunUrl(result.htmlUrl);
        startPolling(result.runId);
      } else {
        setPublishing(false);
        addToast({
          type: 'info',
          title: 'Workflow dipicu',
          description: 'Cek tab Actions di GitHub jika status tidak muncul.',
        });
      }
    } catch (e) {
      setPublishing(false);
      addToast({
        type: 'error',
        title: 'Gagal publish',
        description: (e as Error).message,
      });
    }
  };

  if (!allowed) {
    return (
      <div className="rounded-[28px] border border-[#D9D7D0]/60 bg-white p-8 text-center">
        <Lock className="w-6 h-6 mx-auto mb-3 text-[#8C8880]" />
        <h3 className="text-sm font-black">Akses Terbatas</h3>
        <p className="text-xs text-[#8C8880] mt-1">
          Panduan media hanya untuk SUPERADMIN, KOMISI, dan COMMITTEE.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] bg-gradient-to-r from-[#181818] to-[#262626] p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Images className="w-6 h-6 text-[#FF416C]" />
          <div>
            <h3 className="text-sm font-black text-white">Panduan Media — Visual Website</h3>
            <p className="text-[10px] text-white/50">
              Timpa file di Website Visual, lalu publish ke CDN
            </p>
          </div>
        </div>
        <button
          onClick={refreshStatus}
          title="Periksa ulang status"
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white"
        >
          <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="rounded-[28px] bg-white border border-[#D9D7D0]/60 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-[#FF416C]">
              Publish otomatis
            </h4>
            <p className="text-[11px] text-[#8C8880] mt-1 max-w-md leading-relaxed">
              Tarik file terbaru dari Drive → commit → deploy Vercel. Contoh: timpa{' '}
              <code className="text-[10px] bg-[#FAF9F5] px-1 rounded">cover-echad.jpg</code>{' '}
              di folder <strong>kelompok</strong>, lalu klik publish.
            </p>
          </div>
          {!publishConfig?.configured && (
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
              Token CI belum diset
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase text-[#8C8880]">Folder Drive</span>
            <select
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              disabled={publishing}
              className="text-xs font-semibold rounded-xl border border-[#D9D7D0] px-3 py-2.5 bg-[#FAF9F5] min-w-[200px]"
            >
              {(publishConfig?.folders || [{ id: 'kelompok', label: 'Cover kelompok' }]).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase text-[#8C8880]">Deploy ke</span>
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              disabled={publishing || (!canProdBranch && branch === 'main')}
              className="text-xs font-semibold rounded-xl border border-[#D9D7D0] px-3 py-2.5 bg-[#FAF9F5] min-w-[140px]"
            >
              <option value="staging">Staging</option>
              {canProdBranch && <option value="main">Production</option>}
            </select>
          </label>

          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing || !publishConfig?.configured}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#181818] hover:bg-black disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider shadow-md transition-all"
          >
            {publishing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Rocket className="w-4 h-4" />
            )}
            {publishing ? 'Publishing…' : 'Publish ke website'}
          </button>
        </div>

        {(publishing || runStatus) && (
          <div className="rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0]/60 px-4 py-3 text-[11px]">
            <p className="font-bold text-[#1B1B1B]">
              {runStatus === 'completed' && runConclusion === 'success' ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Deploy dipicu — tunggu 1–3 menit
                </span>
              ) : runStatus === 'completed' && runConclusion === 'failure' ? (
                <span className="inline-flex items-center gap-1.5 text-red-600">
                  <AlertTriangle className="w-3.5 h-3.5" /> Workflow gagal
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {STATUS_LABEL[runStatus || ''] || runStatus || 'Memproses…'}
                </span>
              )}
            </p>
            {runId && <p className="text-[#8C8880] mt-0.5">Run #{runId}</p>}
            {runUrl && (
              <a
                href={runUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-[#FF416C] font-bold hover:underline"
              >
                <ExternalLink className="w-3 h-3" /> Lihat log GitHub Actions
              </a>
            )}
          </div>
        )}
      </div>

      <div
        className={`rounded-[24px] p-4 border ${
          checking
            ? 'border-[#D9D7D0]/60 bg-white'
            : driveOk
            ? 'border-emerald-200 bg-emerald-50'
            : 'border-amber-200 bg-amber-50'
        }`}
      >
        {checking ? (
          <p className="text-xs font-semibold text-[#8C8880]">Memeriksa koneksi Google Drive…</p>
        ) : driveOk ? (
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs font-black text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Google Drive terhubung (service account)
              </p>
              <p className="text-[11px] text-emerald-800/80 mt-0.5">
                Timpa file di Drive dengan stem yang sama sebelum publish.
              </p>
            </div>
            <a
              href={galleryUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#181818] text-white text-[11px] font-bold hover:bg-black transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Buka Website Visual
            </a>
          </div>
        ) : (
          <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> Drive belum terkonfigurasi di environment ini —
            hubungi Tim Tech.
          </p>
        )}
      </div>

      <div className="rounded-[28px] bg-white border border-[#D9D7D0]/60 p-6 space-y-4">
        <h4 className="text-xs font-black uppercase tracking-widest text-[#FF416C]">
          Langkah Update Foto
        </h4>
        {[
          ['Buka folder visual', 'Klik "Buka Website Visual". Stem nama file jangan diubah (cth. kelompok/cover-echad).'],
          ['Timpa file di Drive', 'Upload foto baru dengan nama yang sama — jpg/png/webp.'],
          ['Publish ke website', 'Pilih folder (mis. kelompok) → klik "Publish ke website". CI akan pull, commit, dan deploy.'],
          ['Selesai', 'Refresh halaman publik setelah deploy Vercel selesai (~1–3 menit).'],
        ].map(([title, desc], i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="w-6 h-6 shrink-0 rounded-full bg-[#181818] text-white text-[10px] font-black flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <div>
              <p className="text-xs font-bold">{title}</p>
              <p className="text-[11px] text-[#8C8880] leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-[28px] bg-[#FAF9F5] border border-[#D9D7D0]/60 p-6 space-y-3">
        <h4 className="text-xs font-black uppercase tracking-widest text-[#181818]">
          Zona folder & siapa yang mengelola
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-[#8C8880] uppercase tracking-wider">
                <th className="pb-2 pr-4">Folder</th>
                <th className="pb-2 pr-4">Dikelola oleh</th>
                <th className="pb-2 pr-4">Tampil untuk</th>
              </tr>
            </thead>
            <tbody className="font-semibold">
              {[
                ['Website Visual / kelompok', 'Mentor rumah + Marturia', 'Cover carousel Beyonders'],
                ['Website Visual / landing', 'Marturia (Desain)', 'Hero & collage'],
                ['Warta Publik', 'Marturia (foto edisi)', 'Halaman warta'],
              ].map(([f, owner, w]) => (
                <tr key={f} className="border-t border-[#D9D7D0]/40">
                  <td className="py-2 pr-4">{f}</td>
                  <td className="py-2 pr-4 font-medium text-[#1B1B1B]">{owner}</td>
                  <td className="py-2 pr-4">{w}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-[#8C8880] leading-relaxed">
          Tag zona seperti [PUBLIK] tetap di nama folder Google Drive. Portal menampilkan{' '}
          {displayFolderName('Liturgia [MENTOR]')} alih-alih nama lengkap.
        </p>
      </div>

      <details className="rounded-[24px] bg-white border border-[#D9D7D0]/60 p-5">
        <summary className="text-xs font-bold cursor-pointer select-none">
          Foto tidak muncul? Cek ini
        </summary>
        <ul className="mt-3 space-y-2 text-[11px] text-[#8C8880] list-disc pl-5 leading-relaxed">
          <li>Pastikan stem file benar (cover-echad, bukan echad-cover).</li>
          <li>Publish ulang setelah timpa file di Drive — CDN tidak update otomatis tanpa deploy.</li>
          <li>Jika badge &quot;Token CI belum diset&quot;, Tim Tech perlu menambah GITHUB_PUBLISH_TOKEN di Vercel.</li>
          <li>GitHub repo secrets: GDRIVE_ROOT_FOLDER_ID + GOOGLE_SERVICE_ACCOUNT_JSON untuk workflow.</li>
        </ul>
      </details>
    </div>
  );
};
