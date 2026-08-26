import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useLang } from '../../context/LangContext';
import { shortName } from '../../lib/privacy-name';
import { FullFamilyTree } from './FamilyTree';
import { HeritageSection } from './HeritageSection';
import { fetchDriveFiles, fetchDriveFolders } from '../../services/driveApi';
import type { DriveMediaItem } from '../../types';
import {
  ArrowLeft,
  Crown,
  Heart,
  Calendar,
  MapPin,
  BookOpen,
  History,
  Users,
  Sparkles,
  ImageOff,
  Images,
  Lock,
} from 'lucide-react';

export const GroupDetailPage: React.FC = () => {
  const { groups, groupBatches, selectedGroupId, closeGroupDetail, openGroupDetail, authUser } = useApp();
  const { t } = useLang();
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);

  // Galeri grup — foto dari folder [GROUP:<NAMA>] di Google Drive.
  // Publik read-only: semua pengunjung dapat melihat (keputusan pemilik);
  // server tetap menegakkan 403 bila suatu saat kebijakan berubah.
  const [gallery, setGallery] = useState<DriveMediaItem[] | null>(null);
  const [galleryState, setGalleryState] = useState<'loading' | 'ready' | 'restricted' | 'empty'>(
    'loading'
  );

  useEffect(() => {
    if (!selectedGroupId) return;
    let cancelled = false;
    setGalleryState('loading');
    (async () => {
      try {
        const groupName = groups.find((g) => g.id === selectedGroupId)?.name || '';
        // Endpoint kurasi: server menemukan folder [GROUP:x] secara internal
        // (tamu tak perlu traversal parent [MENTOR]) + policy tetap server-side.
        const r = await fetch(
          `/api/drive/group-files/${encodeURIComponent(groupName)}`,
          { credentials: 'include' }
        );
        if (cancelled) return;
        if (!r.ok) {
          setGalleryState(r.status === 403 ? 'restricted' : 'empty');
          return;
        }
        const d = await r.json();
        setGallery(d.files || []);
        setGalleryState((d.files || []).length > 0 ? 'ready' : 'empty');
      } catch {
        if (!cancelled) setGalleryState('empty');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedGroupId, groups]);

  const group = groups.find((g) => g.id === selectedGroupId);

  const batches = useMemo(() => {
    const list = groupBatches
      .filter((b) => b.group_id === selectedGroupId)
      .sort((a, b) => b.period.localeCompare(a.period));
    return list;
  }, [groupBatches, selectedGroupId]);

  if (!group) {
    return (
      <div className="pt-[140px] pb-24 px-4 max-w-2xl mx-auto text-center">
        <h2 className="text-2xl font-bold text-[#1B1B1B] mb-3">Kelompok tidak ditemukan</h2>
        <button
          onClick={closeGroupDetail}
          className="px-5 py-2.5 rounded-full bg-[#181818] text-white text-xs font-bold"
        >
          Kembali ke Daftar Kelompok
        </button>
      </div>
    );
  }

  const activeBatch =
    batches.find((b) => b.id === activeBatchId) ?? batches.find((b) => b.isCurrent) ?? batches[0];

  return (
    <div className="pt-[110px] sm:pt-[130px] pb-24">
      {/* Hero Band */}
      <div className="relative overflow-hidden" style={{ backgroundColor: `${group.color}14` }}>
        <div
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl opacity-25 pointer-events-none"
          style={{ backgroundColor: group.color }}
        />
        <div className="relative max-w-[1200px] mx-auto px-4 sm:px-8 py-10 sm:py-14">
          <button
            onClick={closeGroupDetail}
            className="inline-flex items-center gap-2 text-xs font-bold text-[#1B1B1B] bg-white/80 hover:bg-white border border-[#D9D7D0] rounded-full px-4 py-2 shadow-sm transition-colors mb-8"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t.groupDetail.back}
          </button>

          <div className="flex flex-col md:flex-row md:items-end gap-6 justify-between">
            <div className="flex items-start gap-4 sm:gap-5">
              <div
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-[22px] flex items-center justify-center text-white shadow-xl font-black text-xl shrink-0"
                style={{ backgroundColor: group.color }}
              >
                {group.name.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: group.color }}>
                  Kelompok Beyonders • Mentoring Pemuda
                </span>
                <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-[#1B1B1B] font-display leading-none mt-1">
                  {group.name}
                </h1>
                <p className="text-sm sm:text-base text-[#8C8880] mt-2 italic">“{group.meaning}”</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 min-w-full md:min-w-[380px]">
              <div className="flex items-start gap-2 p-3 rounded-2xl bg-white/85 border border-white text-[11px]">
                <Calendar className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: group.color }} />
                <span className="text-[#1B1B1B] font-semibold">{group.meetingSchedule}</span>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-2xl bg-white/85 border border-white text-[11px]">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-500" />
                <span className="text-[#1B1B1B] font-semibold">{group.meetingLocation}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 mt-12 space-y-14">
        {/* Landasan Firman */}
        <div className="p-6 sm:p-7 rounded-[28px] bg-white border border-[#D9D7D0]/60 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-[#FF416C]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#FF416C]">
              {t.groupDetail.scriptureLabel}
            </span>
          </div>
          <p className="text-sm sm:text-base italic text-[#1B1B1B] leading-relaxed">
            “{group.scripture}”
          </p>
          <p className="text-xs text-[#8C8880] mt-4 leading-relaxed">{group.description}</p>
        </div>

        {/* Family Tree Aktif */}
        {activeBatch && (
          <section>
            <div className="flex items-center gap-2 mb-5">
              <Users className="w-4 h-4" style={{ color: group.color }} />
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1B1B1B]">
                Family Tree — {activeBatch.period}
              </h2>
              {activeBatch.isCurrent && (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-wider">
                  {t.groupDetail.currentBatch}
                </span>
              )}
            </div>
            <FullFamilyTree
              mentor={shortName(activeBatch.mentor)}
              comentor={shortName(activeBatch.comentor)}
              mentees={activeBatch.mentees.map((m) => ({ name: shortName(m.name), note: m.note }))}
              color={group.color}
            />
            {activeBatch.theme && (
              <div className="mt-4 flex items-center gap-2 text-xs text-[#8C8880]">
                <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: group.color }} />
                <span>{activeBatch.theme}</span>
              </div>
            )}
          </section>
        )}

        {/* Galeri Grup — foto dari Drive folder [GROUP:<NAMA>] (sesuai matriks akses) */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <Images className="w-4 h-4" style={{ color: group.color }} />
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1B1B1B]">
              Galeri {group.name}
            </h2>
          </div>

          {galleryState === 'restricted' ? (
            <div className="rounded-[24px] bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-xs font-semibold flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              Galeri grup bersifat internal — login sebagai anggota grup, mentor, atau pengurus
              untuk melihat.
            </div>
          ) : galleryState === 'loading' ? (
            <p className="text-xs text-[#8C8880]">Memuat galeri…</p>
          ) : galleryState === 'empty' || !gallery ? (
            <div className="rounded-[24px] border border-dashed border-[#D9D7D0] bg-[#FAF9F5]/60 p-5 flex items-center gap-3 text-xs text-[#8C8880]">
              <ImageOff className="w-4 h-4 shrink-0 opacity-60" />
              <p>
                Belum ada foto. Pengurus dapat mengunggah ke folder
                <span className="font-mono"> [GROUP:{group.name}] </span>
                di Google Drive — foto tampil otomatis di sini.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {gallery.slice(0, 12).map((item) => (
                <a
                  key={item.id}
                  href={item.webViewLink || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative aspect-square overflow-hidden rounded-[24px] bg-[#F0EFEB] border border-[#D9D7D0]/40 hover:shadow-xl transition-all duration-300"
                >
                  {item.thumbnailLink ? (
                    <img
                      src={item.thumbnailUrl || item.thumbnailLink}
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
                </a>
              ))}
            </div>
          )}
        </section>

        {/* Heritage: alumni + lineage (live dari TiDB) */}
        <HeritageSection
          groupId={selectedGroupId || ''}
          color={group.color}
          onOpenChild={(childId) => {
            if (groups.some((g) => g.id === childId)) {
              openGroupDetail(childId);
            } else {
              closeGroupDetail();
            }
          }}
        />

        {/* History / Regenerasi Batch */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <History className="w-4 h-4 text-[#1B1B1B]" />
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1B1B1B]">
              {t.groupDetail.history}
            </h2>
          </div>

          <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-[7px] before:sm:left-[9px] before:top-2 before:bottom-2 before:w-0.5 before:bg-[#D9D7D0]">
            {batches.map((batch) => {
              const isActive = activeBatch?.id === batch.id;
              return (
                <div key={batch.id} className="relative">
                  <span
                    className={`absolute -left-6 sm:-left-8 top-4 w-3.5 h-3.5 rounded-full border-[3px] ${
                      isActive ? 'border-current' : 'border-[#D9D7D0] bg-white'
                    }`}
                    style={isActive ? { color: group.color, backgroundColor: group.color } : undefined}
                  />
                  <button
                    onClick={() => setActiveBatchId(batch.id)}
                    className={`w-full text-left p-5 rounded-[24px] transition-all duration-200 border ${
                      isActive
                        ? 'bg-white shadow-lg border-[#D9D7D0]'
                        : 'bg-[#F3F1EC]/60 hover:bg-white border-transparent hover:border-[#D9D7D0]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="px-2.5 py-1 rounded-full text-white text-[10px] font-black shrink-0"
                          style={{ backgroundColor: group.color }}
                        >
                          {batch.period}
                        </span>
                        <span className="text-sm font-bold text-[#1B1B1B] truncate">{batch.batchLabel}</span>
                      </div>
                      <div className="flex items-center gap-4 text-[11px] text-[#8C8880] shrink-0">
                        <span className="flex items-center gap-1">
                          <Crown className="w-3 h-3" /> {shortName(batch.mentor)}
                        </span>
                        <span className="flex items-center gap-1 hidden sm:flex">
                          <Heart className="w-3 h-3" /> {shortName(batch.comentor)}
                        </span>
                      </div>
                    </div>
                    {/* Mentee chips ringkas */}
                    <div className="flex flex-wrap gap-1.5 mt-3.5">
                      {batch.mentees.map((m) => (
                        <span
                          key={m.name}
                          className="px-2 py-1 rounded-full bg-white border border-[#D9D7D0] text-[10px] font-semibold text-[#1B1B1B]"
                        >
                          {shortName(m.name)}
                          {m.note ? ` ${m.note}` : ''}
                        </span>
                      ))}
                    </div>
                  </button>
                </div>
              );
            })}

            {/* Placeholder arsip batch lampau */}
            <div className="relative">
              <span className="absolute -left-6 sm:-left-8 top-4 w-3.5 h-3.5 rounded-full border-[3px] border-dashed border-[#D9D7D0] bg-[#FAF9F5]" />
              <div className="p-5 rounded-[24px] border border-dashed border-[#D9D7D0] bg-[#FAF9F5]/50 flex items-center gap-3 text-xs text-[#8C8880]">
                <ImageOff className="w-4 h-4 shrink-0 opacity-60" />
                <p>
                  Arsip family tree batch regenerasi sebelumnya akan dilengkapi pengurus melalui portal
                  administrasi (terhubung arsip Google Drive & TiDB Cloud).
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
