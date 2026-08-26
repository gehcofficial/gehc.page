import React, { useEffect, useState } from 'react';
import {
  Images,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { fetchApiStatus, fetchDriveFolders } from '../../services/driveApi';

/** Root staging — ganti saat go-live production (lihat .env.production). */
const GDRIVE_ROOT_FALLBACK_URL =
  'https://drive.google.com/drive/folders/1w_ajoAUKJM81ttGLSH-EKeNyca0Y96-u';

/**
 * Panduan internal: cara memperbarui foto galeri publik ("Stories in Pictures")
 * lewat Google Drive. Hanya untuk pengelola konten (SUPERADMIN/KOMISI/COMMITTEE).
 * Halaman portal sudah butuh sesi login; staging juga noindex.
 */
export const MediaGuidePanel: React.FC = () => {
  const { canAccess } = useApp();
  const allowed = canAccess('content_manage');

  const [driveOk, setDriveOk] = useState<boolean | null>(null);
  const [galleryUrl, setGalleryUrl] = useState<string>(GDRIVE_ROOT_FALLBACK_URL);
  const [checking, setChecking] = useState(true);

  const refreshStatus = () => {
    setChecking(true);
    fetchApiStatus()
      .then((st) => {
        setDriveOk(st.driveConfigured);
        if (!st.driveConfigured) return;
        return fetchDriveFolders().then((fs) => {
          const publik = fs.find((f) => f.zoneTag === 'PUBLIK');
          if (publik) {
            setGalleryUrl(`https://drive.google.com/drive/folders/${publik.id}`);
          }
        });
      })
      .catch(() => setDriveOk(false))
      .finally(() => setChecking(false));
  };

  useEffect(refreshStatus, []);

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
      {/* Header */}
      <div className="rounded-[28px] bg-gradient-to-r from-[#181818] to-[#262626] p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Images className="w-6 h-6 text-[#FF416C]" />
          <div>
            <h3 className="text-sm font-black text-white">Panduan Media — Galeri Publik</h3>
            <p className="text-[10px] text-white/50">
              Cara memperbarui foto "Stories in Pictures" lewat Google Drive
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

      {/* Status live */}
      <div
        className={`rounded-[24px] p-4 border ${
          driveOk === null || checking
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
                Foto yang kamu tambahkan di folder di bawah otomatis tampil di web.
              </p>
            </div>
            <a
              href={galleryUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#181818] text-white text-[11px] font-bold hover:bg-black transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Buka Folder Galeri
            </a>
          </div>
        ) : (
          <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> Drive belum terkonfigurasi di environment ini —
            hubungi Tim Tech.
          </p>
        )}
      </div>

      {/* Langkah */}
      <div className="rounded-[28px] bg-white border border-[#D9D7D0]/60 p-6 space-y-4">
        <h4 className="text-xs font-black uppercase tracking-widest text-[#FF416C]">
          Langkah Update Foto
        </h4>
        {[
          ['Buka folder galery', 'Klik tombol "Buka Folder Galeri" di atas → masuk ke folder Event Gallery [PUBLIK].'],
          ['Rename dulu, baru upload', 'Nama file menjadi caption di web. Contoh: "Retreat UNSHAKABLE - Highland Camp.jpg". Rename sebelum upload.'],
          ['Drag & drop foto', 'Format JPG/PNG. 12 foto terbaru yang tampil di website (terurut terbaru).'],
          ['Selesai', 'Buka halaman Events di web publik → section "Stories in Pictures". Tunggu ±1 menit lalu refresh bila perlu.'],
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

      {/* Zona & akses */}
      <div className="rounded-[28px] bg-[#FAF9F5] border border-[#D9D7D0]/60 p-6 space-y-3">
        <h4 className="text-xs font-black uppercase tracking-widest text-[#181818]">
          Zona Folder & Siapa yang Melihat
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-[#8C8880] uppercase tracking-wider">
                <th className="pb-2 pr-4">Folder</th>
                <th className="pb-2 pr-4">Tampil untuk</th>
              </tr>
            </thead>
            <tbody className="font-semibold">
              {[
                ['Event Gallery [PUBLIK]', 'Semua pengunjung web (tanpa login)'],
                ['Warta Publik [PUBLIK]', 'Semua pengunjung web'],
                ['Ruang Anggota [MENTEE]', 'Hanya yang login'],
                ['Kelompok Mentoring [MENTOR]', 'Semua pengunjung web — galeri grup publik'],
                ['Laporan Internal [KOMISI]', 'Komisi & Superadmin saja'],
              ].map(([f, w]) => (
                <tr key={f} className="border-t border-[#D9D7D0]/40">
                  <td className="py-2 pr-4 font-mono">{f}</td>
                  <td className="py-2 pr-4">{w}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-[#8C8880] leading-relaxed">
          Aturan nama: tag zona dalam kurung siku wajib ada. Folder tanpa tag tidak dapat dibaca
          sistem (audit akan menandai).
        </p>
      </div>

      {/* Troubleshooting */}
      <details className="rounded-[24px] bg-white border border-[#D9D7D0]/60 p-5">
        <summary className="text-xs font-bold cursor-pointer select-none">
          Foto tidak muncul? Cek ini
        </summary>
        <ul className="mt-3 space-y-2 text-[11px] text-[#8C8880] list-disc pl-5 leading-relaxed">
          <li>Pastikan foto berada di folder dengan tag zona yang benar (bukan di root).</li>
          <li>Format didukung: JPG/PNG/webP. File Google Docs tidak ditampilkan sebagai galeri.</li>
          <li>Tunggu ±1 menit — ada cache singkat agar web tetap cepat.</li>
          <li>Jika status di atas merah "belum terkonfigurasi", hubungi Tim Tech (kredensial service account).</li>
        </ul>
      </details>
    </div>
  );
};