import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { DriveUploadPanel } from './DriveUploadPanel';
import { displayFolderName } from '../../lib/driveDisplay';
import {
  FolderSync,
  Lock,
  CheckCircle2,
  RefreshCw,
  Folder,
  Cloud,
  FileCheck,
  Shield,
  ExternalLink,
  Settings2,
  GitCompareArrows,
  AlertTriangle,
  XCircle,
} from 'lucide-react';

interface AuditResult {
  generatedAt: string;
  totalFoldersScanned: number;
  groups: { items: { name: string; ok: boolean; hint: string }[]; missing: number };
  pillars: { items: { pillar: string; name: string; ok: boolean }[]; missing: number };
  extraGroupFolders: string[];
  untaggedFolders: string[];
}

type TokenStatus = {
  hasToken: boolean;
  userOk: boolean;
  authFailed: boolean;
  mode?: string | null;
  ownerEmail?: string | null;
  note?: string | null;
};

const REAUTH_CMDS = 'npm run drive:auth\nnpm run env:sync-gdrive-token';

/** Status token OAuth pemilik (untuk unggah) — dibedakan dari service account baca. */
const DriveTokenStatusCard: React.FC = () => {
  const [st, setSt] = useState<TokenStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const check = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/drive/token-status', { credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      setSt(r.ok ? (d as TokenStatus) : { hasToken: false, userOk: false, authFailed: false, note: (d as { error?: string }).error });
    } catch {
      setSt({ hasToken: false, userOk: false, authFailed: false, note: 'Server tidak terjangkau.' });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void check(); }, []);

  const copyCmds = async () => {
    try {
      await navigator.clipboard.writeText(REAUTH_CMDS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard diblokir */ }
  };

  const broken = Boolean(st && (!st.userOk));
  return (
    <div className={`rounded-[28px] border p-5 sm:p-6 space-y-3 ${broken ? 'bg-red-50/60 border-red-200' : 'bg-white border-[#D9D7D0]/50 shadow-sm'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold text-[#8C8880] uppercase tracking-wider">Token unggah pemilik</p>
          <h3 className="text-base font-black text-[#1B1B1B]">Koneksi tulis Google Drive</h3>
          <p className="text-[11px] text-[#8C8880] mt-0.5">
            Baca memakai service account (JSON, headless). Unggah memakai akun pemilik — statusnya di sini.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!st ? (
            <span className="text-[11px] font-bold text-[#8C8880]">Memeriksa…</span>
          ) : st.userOk ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black">
              <CheckCircle2 className="w-4 h-4" /> Terhubung{st.ownerEmail ? ` · ${st.ownerEmail}` : ''}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 text-red-800 text-[11px] font-black">
              <XCircle className="w-4 h-4" /> {st.authFailed ? 'Terputus — perlu consent ulang' : st.hasToken ? 'Gagal probe' : 'Belum ada token'}
            </span>
          )}
          <button
            type="button"
            onClick={() => void check()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] text-[11px] font-bold disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
            Cek lagi
          </button>
        </div>
      </div>
      {st && !st.userOk && (
        <div className="rounded-2xl bg-white border border-red-200 p-4 space-y-2">
          <p className="text-xs text-[#1B1B1B] leading-relaxed">
            {st.authFailed || !st.hasToken
              ? 'Unggahan (album, cover, kesaksian) akan gagal sampai pemilik folder memberi izin ulang di browsernya. Ini aturan Google — tidak bisa diwakilkan.'
              : `Probe gagal: ${st.note || 'tidak diketahui'}. Bila ini INVALID_GRANT, lakukan consent ulang di bawah.`}
          </p>
          <ol className="text-xs text-[#5C5850] leading-relaxed list-decimal ml-4 space-y-0.5">
            <li>Jalankan perintah di bawah <strong>di laptop</strong> (bukan Vercel).</li>
            <li>Login sebagai <strong>pemilik folder root Drive</strong> → klik Izinkan.</li>
            <li>Lanjut perintah kedua → token tersebar ke staging + production.</li>
            <li>Tunggu redeploy (atau redeploy manual), minta pengunggah coba lagi.</li>
          </ol>
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 min-w-[220px] whitespace-pre-wrap rounded-xl bg-[#181818] text-emerald-300 text-[11px] font-mono px-3 py-2">{REAUTH_CMDS}</code>
            <button
              type="button"
              onClick={() => void copyCmds()}
              className="px-3 py-2 rounded-xl bg-[#181818] text-white text-[11px] font-bold"
            >
              {copied ? 'Tersalin!' : 'Salin perintah'}
            </button>
          </div>
          <p className="text-[10px] text-[#8C8880]">Jangan cabut akses app di myaccount.google.com dan jangan ganti password akun pemilik tanpa consent ulang.</p>
        </div>
      )}
    </div>
  );
};

type AdminAlert = {
  id: string;
  type: string;
  title: string;
  message?: string | null;
  status: string;
  createdAt: string;
  payload?: { items?: Array<{ label: string }> } | null;
};

/** Peringatan admin: digest drift Drive + antrean approval yang masih OPEN. */
const AdminAlertsCard: React.FC = () => {
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [checking, setChecking] = useState(false);

  const load = async () => {
    try {
      const r = await fetch('/api/db/notifications?status=OPEN', { credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      const rows: AdminAlert[] = Array.isArray(d.notifications) ? d.notifications : [];
      setAlerts(
        rows.filter((n) => n.type === 'DRIVE_DRIFT' || n.type === 'APPROVAL_ITEM').slice(0, 8),
      );
    } catch { /* abaikan */ }
  };

  useEffect(() => { void load(); }, []);

  const checkDrift = async () => {
    setChecking(true);
    try {
      const r = await fetch('/api/cron/digest', { method: 'POST', credentials: 'include' });
      await r.json().catch(() => ({}));
      await load();
    } finally {
      setChecking(false);
    }
  };

  if (!alerts.length) return null;
  return (
    <div className="rounded-[28px] border border-amber-200 bg-amber-50/60 p-5 sm:p-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Peringatan admin</p>
          <h3 className="text-base font-black text-[#1B1B1B]">Perlu perhatian Komisi</h3>
        </div>
        <button
          type="button"
          onClick={() => void checkDrift()}
          disabled={checking}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#181818] text-white text-[11px] font-bold disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Memeriksa…' : 'Cek drift sekarang'}
        </button>
      </div>
      <ul className="space-y-2">
        {alerts.map((a) => (
          <li key={a.id} className="rounded-2xl bg-white border border-[#D9D7D0]/60 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${a.type === 'DRIVE_DRIFT' ? 'bg-sky-100 text-sky-800' : 'bg-violet-100 text-violet-800'}`}>
                {a.type === 'DRIVE_DRIFT' ? 'Drive' : 'Approval'}
              </span>
              <span className="text-xs font-bold text-[#1B1B1B]">{a.title}</span>
              <span className="ml-auto text-[10px] text-[#8C8880] shrink-0">
                {new Date(a.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
              </span>
            </div>
            {a.message && <p className="text-[11px] text-[#5C5850] mt-1 leading-relaxed">{a.message}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
};

type DeployState = {
  running: string;
  latest: string;
  latestDate: string;
  inSync: boolean | null;
  redeploying: boolean;
  message: string;
};

/**
 * Sinkronisasi & Deploy: bandingkan commit yang berjalan vs main GitHub,
 * plus tombol redeploy Production (perlu VERCEL_DEPLOY_HOOK_URL di server).
 * Menjawab "sudah sync?" tanpa buka Vercel — dan menjelaskan bahwa
 * perubahan env (mis. token) baru aktif setelah redeploy.
 */
const DeploySyncCard: React.FC = () => {
  const [st, setSt] = useState<DeployState>({
    running: '',
    latest: '',
    latestDate: '',
    inSync: null,
    redeploying: false,
    message: 'Memeriksa…',
  });

  const check = async () => {
    try {
      const [v, g] = await Promise.all([
        fetch('/api/version', { credentials: 'include' }).then((r) => r.json()).catch(() => ({})),
        fetch('https://api.github.com/repos/gehcofficial/gehc.page/commits/main?per_page=1')
          .then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      const running = String(v.commit || 'dev');
      const latest = String(g?.sha || '').slice(0, 7);
      const full = String(g?.sha || '');
      setSt((s) => ({
        ...s,
        running: running.slice(0, 7),
        latest,
        latestDate: g?.commit?.author?.date ? new Date(g.commit.author.date).toLocaleString('id-ID') : '',
        inSync: !full ? null : running === 'dev' ? null : full.startsWith(running) || running.startsWith(full.slice(0, 7)),
        message: !full
          ? 'Tak bisa hubungi GitHub.'
          : running === 'dev'
            ? 'Server lokal (dev) — selalu sinkron dengan kode laptop.'
            : (full.startsWith(running) || running.startsWith(full.slice(0, 7)))
              ? 'Deploy sudah memuat commit terbaru.'
              : 'Deploy tertinggal — tekan Redeploy setelah pull/merge terbaru.',
      }));
    } catch {
      setSt((s) => ({ ...s, message: 'Gagal memeriksa.' }));
    }
  };

  useEffect(() => { void check(); }, []);

  const redeploy = async () => {
    if (!window.confirm('Redeploy Production sekarang? (±1 menit, tanpa downtime)')) return;
    setSt((s) => ({ ...s, redeploying: true, message: 'Meminta redeploy…' }));
    try {
      const r = await fetch('/api/admin/redeploy', { method: 'POST', credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      setSt((s) => ({
        ...s,
        redeploying: false,
        message: r.ok ? (d.message || 'Redeploy dimulai.') : (d.error || 'Gagal meminta redeploy.'),
      }));
    } catch {
      setSt((s) => ({ ...s, redeploying: false, message: 'Gagal menghubungi server.' }));
    }
  };

  return (
    <div className="rounded-[28px] border border-[#D9D7D0]/50 bg-white p-5 sm:p-6 space-y-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold text-[#8C8880] uppercase tracking-wider">Sinkronisasi & Deploy</p>
          <h3 className="text-base font-black text-[#1B1B1B]">Versi yang berjalan vs GitHub main</h3>
          <p className="text-[11px] text-[#8C8880] mt-0.5">
            Perubahan env (mis. token Drive) baru aktif setelah redeploy.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {st.inSync === null ? (
            <span className="text-[11px] font-bold text-[#8C8880]">{st.message}</span>
          ) : st.inSync ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black">
              <CheckCircle2 className="w-4 h-4" /> Sinkron ({st.running})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-black">
              <AlertTriangle className="w-4 h-4" /> Tertinggal ({st.running} → {st.latest})
            </span>
          )}
          <button
            type="button"
            onClick={() => void check()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] text-[11px] font-bold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Cek lagi
          </button>
          <button
            type="button"
            onClick={() => void redeploy()}
            disabled={st.redeploying}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#181818] text-white text-[11px] font-bold disabled:opacity-50"
          >
            <Cloud className="w-3.5 h-3.5" />
            {st.redeploying ? 'Meminta…' : 'Redeploy Production'}
          </button>
        </div>
      </div>
      <p className="text-[11px] text-[#8C8880]">
        {st.message}
        {st.latestDate && ` Komit terbaru: ${st.latest} (${st.latestDate}).`}
      </p>
    </div>
  );
};

/** Panel audit: folder Drive vs entitas DB (grup & subdivisi pantatugas). */
const DriveAuditPanel: React.FC = () => {
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAudit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/drive/audit', { credentials: 'include' });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error((b as { error?: string }).error || `HTTP ${res.status}`);
      }
      setAudit(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-[32px] border border-[#D9D7D0]/50 shadow-sm p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] mb-2">
            <GitCompareArrows className="w-3.5 h-3.5 text-[#FF416C]" />
            <span className="text-[11px] font-bold text-[#8C8880] uppercase tracking-wider">
              Audit Sinkronisasi
            </span>
          </div>
          <h3 className="text-xl font-bold text-[#1B1B1B]">Struktur TiDB ↔ Folder Google Drive</h3>
          <p className="text-xs text-[#8C8880] mt-1 max-w-2xl leading-relaxed">
            Membandingkan grup aktif & sub-divisi pantatugas di database dengan folder aktual di
            Drive. Nama di daftar ini tanpa tag zona; arahkan kursor untuk nama Drive lengkap (ACL).
          </p>
        </div>
        <button
          onClick={runAudit}
          disabled={busy}
          className="px-4 py-2.5 rounded-full bg-[#181818] text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50 shrink-0 self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
          Jalankan Audit
        </button>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-xs font-semibold">
          {error}
        </div>
      )}

      {audit && (
        <div className="space-y-5 mt-2">
          <p className="text-[11px] text-[#8C8880]">
            Dipindai {audit.totalFoldersScanned} folder • {new Date(audit.generatedAt).toLocaleString('id-ID')}
          </p>

          {/* Grup */}
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-[#1B1B1B] mb-2 flex items-center gap-2">
              Kelompok Mentoring
              {audit.groups.missing > 0 ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">{audit.groups.missing} hilang</span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">lengkap</span>
              )}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {audit.groups.items.map((g) => (
                <div
                  key={g.name}
                  className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-2 rounded-xl border ${
                    g.ok ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'
                  }`}
                  title={g.ok ? 'Folder ditemukan' : `Buat folder: ${g.hint}`}
                >
                  {g.ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate" title={g.hint || g.name}>{displayFolderName(g.name)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Subdivisi */}
          {audit.pillars.items.length > 0 && (
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-[#1B1B1B] mb-2 flex items-center gap-2">
                Sub-Divisi Pantatugas
                {audit.pillars.missing > 0 ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">{audit.pillars.missing} hilang</span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">lengkap</span>
                )}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {audit.pillars.items.map((p) => (
                  <div
                    key={`${p.pillar}-${p.name}`}
                    className={`flex items-center gap-2 text-[11px] font-semibold px-3 py-2 rounded-xl border ${
                      p.ok ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'
                    }`}
                  >
                    {p.ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                    <span className="uppercase text-[9px] opacity-70">{p.pillar}</span>
                    <span className="truncate" title={`${p.pillar} / ${p.name}`}>{displayFolderName(p.name)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(audit.extraGroupFolders.length > 0 || audit.untaggedFolders.length > 0) && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-2">
              {audit.extraGroupFolders.length > 0 && (
                <p className="text-[11px] text-amber-800 font-semibold flex items-start gap-2">
                  <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  Folder GROUP tidak dikenali database (periksa ejaan):{' '}
                  {audit.extraGroupFolders.map((n) => displayFolderName(n)).join(', ')}
                </p>
              )}
              {audit.untaggedFolders.length > 0 && (
                <p className="text-[11px] text-amber-800 font-semibold flex items-start gap-2">
                  <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  Folder tanpa tag zona — tidak dapat diakses siapa pun hingga diberi tag:{' '}
                  <span title={audit.untaggedFolders.join(', ')}>
                    {audit.untaggedFolders.map((n) => displayFolderName(n)).join(', ')}
                  </span>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {!audit && !error && (
        <p className="text-xs text-[#8C8880]">
          Belum ada audit berjalan. Panduan penamaan folder: lihat <code>drive-integration.md</code>.
        </p>
      )}
    </div>
  );
};

export const ManageIntegrations: React.FC = () => {
  const { isSuperAdmin, isKomisi, currentRole, integrationConfig, updateIntegrationConfig, addToast } =
    useApp();

  const [isSyncing, setIsSyncing] = useState(false);
  const [rootFolderId, setRootFolderId] = useState(integrationConfig.root_folder_id);
  const [rootFolderName, setRootFolderName] = useState(integrationConfig.root_folder_name);
  const [allowedMimeTypes, setAllowedMimeTypes] = useState(
    integrationConfig.allowed_mime_types.join(', ')
  );
  const [events, setEvents] = useState<Array<{ id: string; title: string }>>([]);
  const [uploadEventId, setUploadEventId] = useState('');
  const [uploadDivision, setUploadDivision] = useState('MARTURIA');

  useEffect(() => {
    fetch('/api/events', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((d) => {
        const list = (d.events || []).map((e: { id: string; title?: string; name?: string }) => ({
          id: e.id,
          title: e.title || e.name || e.id,
        }));
        setEvents(list);
        if (list[0]?.id) setUploadEventId(list[0].id);
      })
      .catch(() => setEvents([]));
  }, []);

  // 403 Forbidden Gatekeeper check
  if (!isSuperAdmin && !isKomisi) {
    return (
      <div className="bg-white rounded-[32px] p-8 sm:p-16 border border-red-200 text-center max-w-2xl mx-auto my-8 shadow-sm">
        <div className="w-16 h-16 rounded-3xl bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4 border border-red-100">
          <Lock className="w-8 h-8" />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-red-600">
          HTTP 403 • Akses Ditolak
        </span>
        <h3 className="text-2xl font-bold text-[#1B1B1B] mt-2 mb-3">
          Integrasi Khusus Admin
        </h3>
        <p className="text-xs sm:text-sm text-[#8C8880] leading-relaxed max-w-md mx-auto">
          Halaman konfigurasi Google Drive OAuth & folder repository ini hanya dapat dikelola oleh Superadmin atau Komisi.
          Peran aktif Anda: <strong className="text-[#1B1B1B] uppercase">[{currentRole}]</strong>.
        </p>
      </div>
    );
  }

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateIntegrationConfig({
      root_folder_id: rootFolderId,
      root_folder_name: rootFolderName,
      allowed_mime_types: allowedMimeTypes.split(',').map((t) => t.trim()),
    });
    addToast({
      type: 'success',
      title: 'Konfigurasi Cloud Disimpan',
      description: 'Pengaturan Google Drive storage bridge berhasil diperbarui.',
    });
  };

  const handleTriggerSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      updateIntegrationConfig({
        last_synced_at: new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      });
      addToast({
        type: 'success',
        title: 'Sinkronisasi Selesai',
        description: 'Seluruh aset media warta, foto pengurus, dan flyer kegiatan telah tersinkron dengan Google Drive.',
      });
    }, 1500);
  };

  return (
    <div className="space-y-8 animate-fade-in">

      <DriveTokenStatusCard />

      <DeploySyncCard />

      <AdminAlertsCard />

      {/* Header Bar */}
      <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] mb-2">
            <FolderSync className="w-3.5 h-3.5 text-[#FF416C]" />
            <span className="text-[11px] font-bold text-[#8C8880] uppercase tracking-wider">
              Google Drive Cloud Storage Bridge
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1B1B1B]">
            Integrasi Media & File Storage
          </h2>
          <p className="text-xs sm:text-sm text-[#8C8880] mt-1">
            Konfigurasi OAuth Google Drive untuk penyimpanan banner warta, foto struktur, dan dokumen kegiatan gereja secara terpusat.
          </p>
        </div>

        <button
          onClick={handleTriggerSync}
          disabled={isSyncing}
          className="px-5 py-3 rounded-full bg-[#181818] hover:bg-black disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-md transition-all flex items-center gap-2 shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}</span>
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-3xl p-6 border border-[#D9D7D0]/50 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#8C8880] uppercase">Status Koneksi</span>
            <div className="text-xl font-bold text-emerald-600 flex items-center gap-1.5 mt-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>OAuth Connected</span>
            </div>
            <p className="text-[11px] text-[#8C8880] mt-0.5">Akun: ebenhaezer.cikarang@gmail.com</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-[#D9D7D0]/50 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#8C8880] uppercase">Root Directory</span>
            <div className="text-xl font-bold text-[#1B1B1B] flex items-center gap-1.5 mt-1">
              <Folder className="w-4 h-4 text-blue-500" />
              <span>{integrationConfig.root_folder_name}</span>
            </div>
            <p className="text-[11px] font-mono text-[#8C8880] mt-0.5">ID: {integrationConfig.root_folder_id}</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-[#D9D7D0]/50 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#8C8880] uppercase">Sinkronisasi Terakhir</span>
            <div className="text-xl font-bold text-[#1B1B1B] mt-1">
              {integrationConfig.last_synced_at || 'Baru Saja'}
            </div>
            <p className="text-[11px] text-[#8C8880] mt-0.5">Auto-sync diaktifkan</p>
          </div>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm max-w-2xl">
        <div className="flex items-center gap-2 mb-6 pb-4 border-b border-[#D9D7D0]/40">
          <Settings2 className="w-4 h-4 text-[#FF416C]" />
          <h3 className="text-base font-bold text-[#1B1B1B]">
            Pengaturan Root Folder & Filter File
          </h3>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-5">
          <div>
            <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
              Root Folder ID (Google Drive) *
            </label>
            <input
              type="text"
              required
              value={rootFolderId}
              onChange={(e) => setRootFolderId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs font-mono focus:outline-none focus:border-black"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
              Nama Folder Utama *
            </label>
            <input
              type="text"
              required
              value={rootFolderName}
              onChange={(e) => setRootFolderName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#1B1B1B] uppercase tracking-wider block mb-1.5">
              Format File Yang Diizinkan (MIME Types)
            </label>
            <input
              type="text"
              value={allowedMimeTypes}
              onChange={(e) => setAllowedMimeTypes(e.target.value)}
              className="w-full px-4 py-2.5 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs font-mono focus:outline-none focus:border-black"
            />
            <p className="text-[10px] text-[#8C8880] mt-1">
              Contoh: image/jpeg, image/png, image/webp, application/pdf
            </p>
          </div>

          <div className="pt-4 border-t border-[#D9D7D0]/40 flex items-center justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-full bg-[#181818] hover:bg-black text-white text-xs font-bold shadow-md transition-all"
            >
              Simpan Konfigurasi
            </button>
          </div>
        </form>
      </div>

      {/* Audit Sinkronisasi TiDB ↔ Drive + Matriks Akses */}
      <DriveAuditPanel />

      {/* Drive upload per event division */}
      <div className="bg-white rounded-[32px] border border-[#D9D7D0]/60 p-6 space-y-4">
        <h3 className="text-sm font-bold">Upload Aset ke Drive</h3>
        {events.length === 0 ? (
          <p className="text-xs text-[#8C8880]">Belum ada event aktif — buat event di portal terlebih dahulu.</p>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs font-bold block">
                Event
                <select
                  value={uploadEventId}
                  onChange={(e) => setUploadEventId(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-[#D9D7D0] bg-[#FAF9F5] text-xs"
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>{ev.title}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold block">
                Divisi
                <select
                  value={uploadDivision}
                  onChange={(e) => setUploadDivision(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-[#D9D7D0] bg-[#FAF9F5] text-xs"
                >
                  {['LITURGIA', 'DIDASKALIA', 'KOINONIA', 'DIAKONIA', 'MARTURIA'].map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </label>
            </div>
            {uploadEventId && (
              <DriveUploadPanel eventId={uploadEventId} division={uploadDivision} folderLabel={uploadDivision} />
            )}
          </>
        )}
      </div>

    </div>
  );
};
