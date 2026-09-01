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
import { displayFolderName } from '../../lib/driveDisplay';

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
            <h3 className="text-sm font-black text-white">Panduan Media — Visual Website</h3>
            <p className="text-[10px] text-white/50">
              Timpa file di Website Visual dengan nama (stem) yang sama
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

      {/* Langkah */}
      <div className="rounded-[28px] bg-white border border-[#D9D7D0]/60 p-6 space-y-4">
        <h4 className="text-xs font-black uppercase tracking-widest text-[#FF416C]">
          Langkah Update Foto
        </h4>
        {[
          ['Buka folder visual', 'Klik "Buka Website Visual". Baca _PETA-VISUAL.txt. Nama di Google Drive tetap memakai tag zona; di portal ditampilkan tanpa kurung siku.'],
          ['Timpa file, jangan ganti stem', 'Nama file adalah kunci. Contoh: brand/logo-gehc untuk logo, landing/01-hero-banner untuk Hero (jpg/png boleh).'],
          ['Publish ke website', 'Setelah update di Drive, Tim Tech jalankan npm run drive:pull-visuals lalu deploy. Visual dilayani CDN (cepat), bukan proxy Drive.'],
          ['Foto warta edisi', 'Marturia menaruh foto di Warta Publik / YYYY-MM-DD-judul / foto — tampil di detail Warta. Didaskalia menulis naskah di CMS.'],
          ['Selesai', 'Refresh halaman publik. Tanpa pull+deploy, fallback Drive API (~1 menit cache).'],
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
                ['Website Visual', 'Marturia (Desain) + Komisi (logo & identitas)', 'Semua pengunjung — logo, hero, collage, BZP, cover kelompok'],
                ['Warta Publik', 'Didaskalia (naskah) · Marturia (foto edisi)', 'Semua pengunjung — banner & album edisi'],
                ['Ruang Anggota', 'Komisi', 'Hanya yang login'],
                ['Kelompok Mentoring', 'Mentor rumah (cover & galeri grup)', 'Galeri per-rumah di halaman detail grup'],
                ['Liturgia / Didaskalia / Koinonia / Diakonia / Marturia / BZP', 'PIC divisi + input silang saat event', 'Pembina ke atas (bukan tamu)'],
                ['Laporan Internal', 'Komisi', 'Komisi & Superadmin'],
                ['Arsip Generasi', 'Komisi', 'Alumni & komisi'],
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
          Tag zona seperti [PUBLIK] / [MENTOR] tetap di nama folder Google Drive (ACL). Portal
          menampilkan {displayFolderName('Liturgia [MENTOR]')} alih-alih nama lengkap.
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