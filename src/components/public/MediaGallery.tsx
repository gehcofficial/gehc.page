import React, { useEffect, useState } from 'react';
import { useLang } from '../../context/LangContext';
import { SectionHeader } from './ui/SectionHeader';
import { fetchApiStatus, fetchDriveFiles, fetchDriveFolders, DEMO_MEDIA, ApiStatus } from '../../services/driveApi';
import { DriveMediaItem } from '../../types';
import { Images, Loader2, ExternalLink, Lock } from 'lucide-react';

interface FolderDto {
  id: string;
  name: string;
  accessAllowed?: boolean;
  zoneTag?: string | null;
}

/**
 * Galeri publik — menarik media dari Google Drive via API.
 * Tamu otomatis diarahkan ke folder zona [PUBLIK]; zona lain
 * mengembalikan 403 → ditampilkan sebagai catatan halus.
 */
export const MediaGallery: React.FC = () => {
  const { t } = useLang();
  const [status, setStatus] = useState<ApiStatus | null>(null);
  const [files, setFiles] = useState<DriveMediaItem[]>([]);
  const [folders, setFolders] = useState<FolderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [restricted, setRestricted] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRestricted(null);
    (async () => {
      try {
        const st = await fetchApiStatus();
        if (cancelled) return;
        setStatus(st);
        if (!st.driveConfigured) throw new Error('drive-not-configured');

        const fs = await fetchDriveFolders();
        if (cancelled) return;
        setFolders(fs);

        const target =
          (activeFolderId && fs.find((f) => f.id === activeFolderId)?.id) ||
          fs.find((f) => f.zoneTag === 'PUBLIK')?.id ||
          fs[0]?.id;

        if (!target) {
          setFiles(DEMO_MEDIA);
          return;
        }
        const items = await fetchDriveFiles({ folderId: target, pageSize: 12 });
        if (cancelled) return;
        setFiles(items.length > 0 ? items : DEMO_MEDIA);
      } catch (err) {
        const e = err as Error & { status?: number };
        if (!cancelled) {
          if (e.status === 403) {
            setFiles([]);
            setRestricted(e.message || t.gallery.restrictedNote);
          } else {
            setFiles(DEMO_MEDIA);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFolderId]);

  return (
    <section className="py-14 sm:py-20 px-4 sm:px-8 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 border-b border-[#D9D7D0]/60 pb-8">
        <SectionHeader eyebrow={t.gallery.eyebrow} title={t.gallery.title} subtitle={t.gallery.sub} />
      </div>

      {/* Folder Filter — hanya yang boleh diakses user ini */}
      {folders.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => f.accessAllowed !== false && setActiveFolderId(f.id)}
              disabled={f.accessAllowed === false}
              title={f.accessAllowed === false ? t.gallery.restrictedNote : f.name}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                activeFolderId === f.id
                  ? 'bg-[#181818] text-white border-black shadow-md'
                  : f.accessAllowed === false
                  ? 'bg-[#F3F1EC] text-[#8C8880]/50 border-[#D9D7D0]/40 cursor-not-allowed'
                  : 'bg-white text-[#1B1B1B] border-[#D9D7D0] hover:border-black'
              }`}
            >
              {f.name}
              {f.accessAllowed === false && <Lock className="inline w-3 h-3 ml-1.5 -mt-0.5" />}
            </button>
          ))}
        </div>
      )}

      {/* Restricted notice */}
      {restricted && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-xs font-semibold mb-6 flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          {restricted}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-[#8C8880] gap-2 text-xs">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat galeri…
        </div>
      ) : files.length === 0 ? (
        <p className="text-xs text-[#8C8880] py-6">{t.gallery.highlights} — segera hadir.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {files.map((item) => (
            <a
              key={item.id}
              href={item.webViewLink || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-square overflow-hidden rounded-[24px] bg-[#F0EFEB] border border-[#D9D7D0]/40 hover:shadow-xl transition-all duration-300"
            >
              {item.thumbnailLink ? (
                <img
                  src={item.thumbnailLink}
                  alt={item.name}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Images className="w-8 h-8 text-[#8C8880]/40" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-[10px] font-bold text-white truncate flex items-center gap-1">
                  {item.name}
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </p>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
};
