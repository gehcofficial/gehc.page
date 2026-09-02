import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useLang } from '../../context/LangContext';
import { shortName } from '../../lib/privacy-name';
import { FullFamilyTree } from './FamilyTree';
import { HeritageSection } from './HeritageSection';
import { useMediaSlots } from '../../hooks/useMediaSlots';
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
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

type DetailTab = 'roster' | 'regen' | 'agenda' | 'docs';

export const GroupDetailPage: React.FC = () => {
  const { groups, groupBatches, selectedGroupId, closeGroupDetail, openGroupDetail } = useApp();
  const { t } = useLang();
  const slots = useMediaSlots();
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>('roster');
  const [gallery, setGallery] = useState<DriveMediaItem[] | null>(null);
  const [galleryState, setGalleryState] = useState<'loading' | 'ready' | 'restricted' | 'empty'>(
    'loading'
  );
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    setTab('roster');
    setActiveBatchId(null);
    setLightboxIdx(null);
  }, [selectedGroupId]);

  useEffect(() => {
    if (!selectedGroupId) return;
    let cancelled = false;
    setGalleryState('loading');
    (async () => {
      try {
        const groupName = groups.find((g) => g.id === selectedGroupId)?.name || '';
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
    return groupBatches
      .filter((b) => b.group_id === selectedGroupId)
      .sort((a, b) => b.period.localeCompare(a.period));
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

  const tabs: { id: DetailTab; label: string; icon: React.ReactNode }[] = [
    { id: 'roster', label: t.groupDetail.tabRoster, icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'regen', label: t.groupDetail.tabRegen, icon: <History className="w-3.5 h-3.5" /> },
    { id: 'agenda', label: t.groupDetail.tabAgenda, icon: <Calendar className="w-3.5 h-3.5" /> },
    { id: 'docs', label: t.groupDetail.tabDocs, icon: <Images className="w-3.5 h-3.5" /> },
  ];

  const galleryItems = gallery || [];
  const coverUrl = slots.kelompok[group.name.toLowerCase()];
  const onPhoto = !!coverUrl;

  return (
    <div className="pt-[110px] sm:pt-[130px] pb-24">
      <div
        className={`relative overflow-hidden ${onPhoto ? 'h-80 sm:h-[26rem] md:h-[32rem]' : ''}`}
        style={!onPhoto ? { backgroundColor: `${group.color}14` } : undefined}
      >
        {onPhoto && (
          <>
            <img
              src={coverUrl}
              alt={group.name}
              className="absolute inset-0 w-full h-full object-cover"
              fetchPriority="high"
              decoding="async"
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"
              aria-hidden
            />
          </>
        )}
        {!onPhoto && (
          <div
            className="absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl opacity-25 pointer-events-none"
            style={{ backgroundColor: group.color }}
          />
        )}
        <div
          className={`relative z-10 h-full flex flex-col justify-end max-w-[1200px] mx-auto px-4 sm:px-8 ${
            onPhoto ? 'pb-8 sm:pb-10 pt-4' : 'py-10 sm:py-14'
          }`}
        >
          <button
            onClick={closeGroupDetail}
            className="inline-flex items-center gap-2 text-xs font-bold bg-white/90 hover:bg-white border border-white/60 rounded-full px-4 py-2 shadow-sm transition-colors mb-6 sm:mb-8 self-start"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t.groupDetail.back}
          </button>

          <div className="flex flex-col md:flex-row md:items-end gap-6 justify-between">
            <div className="flex items-start gap-4 sm:gap-5">
              <div
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-[22px] flex items-center justify-center text-white shadow-xl font-black text-xl shrink-0 ring-2 ring-white/25"
                style={{ backgroundColor: group.color }}
              >
                {group.name.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <span
                  className={`text-[11px] font-bold uppercase tracking-widest ${
                    onPhoto ? 'text-white/75' : ''
                  }`}
                  style={onPhoto ? undefined : { color: group.color }}
                >
                  Beyonders • Mentoring Home
                </span>
                <h1
                  className={`text-4xl sm:text-6xl font-black tracking-tight font-display leading-none mt-1 ${
                    onPhoto ? 'text-white' : 'text-[#1B1B1B]'
                  }`}
                >
                  {group.name}
                </h1>
                <p
                  className={`text-sm sm:text-base mt-2 italic ${
                    onPhoto ? 'text-white/80' : 'text-[#8C8880]'
                  }`}
                >
                  “{group.meaning}”
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 min-w-full md:min-w-[380px]">
              {group.meetingSchedule && (
                <div
                  className={`flex items-start gap-2 p-3 rounded-2xl text-[11px] ${
                    onPhoto
                      ? 'bg-white/15 border border-white/25 backdrop-blur-md'
                      : 'bg-white/85 border border-white'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: group.color }} />
                  <span className={`font-semibold ${onPhoto ? 'text-white' : 'text-[#1B1B1B]'}`}>
                    {group.meetingSchedule}
                  </span>
                </div>
              )}
              {group.meetingLocation && (
                <div
                  className={`flex items-start gap-2 p-3 rounded-2xl text-[11px] ${
                    onPhoto
                      ? 'bg-white/15 border border-white/25 backdrop-blur-md'
                      : 'bg-white/85 border border-white'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-400" />
                  <span className={`font-semibold ${onPhoto ? 'text-white' : 'text-[#1B1B1B]'}`}>
                    {group.meetingLocation}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="sticky top-[72px] z-30 bg-[#FAF9F5]/95 backdrop-blur-md border-b border-[#D9D7D0]/60">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8">
          <div className="flex gap-1 overflow-x-auto py-3 scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none]">
            {tabs.map((tb) => (
              <button
                key={tb.id}
                onClick={() => setTab(tb.id)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  tab === tb.id
                    ? 'bg-[#181818] text-white shadow-md'
                    : 'bg-white text-[#8C8880] border border-[#D9D7D0] hover:text-[#1B1B1B]'
                }`}
              >
                {tb.icon}
                {tb.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 mt-10 space-y-10">
        {group.scripture && (
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
            {group.description && (
              <p className="text-xs text-[#8C8880] mt-4 leading-relaxed">{group.description}</p>
            )}
          </div>
        )}

        {tab === 'roster' && activeBatch && (
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
              mentor={activeBatch.mentor}
              comentor={activeBatch.comentor || '—'}
              mentees={(activeBatch.mentees || []).map((m) => ({ name: m.name, note: m.note }))}
              color={group.color || '#FF416C'}
            />
            {activeBatch.theme && (
              <div className="mt-4 flex items-center gap-2 text-xs text-[#8C8880]">
                <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: group.color }} />
                <span>{activeBatch.theme}</span>
              </div>
            )}
          </section>
        )}

        {tab === 'regen' && (
          <>
            <HeritageSection
              groupId={selectedGroupId || ''}
              color={group.color || '#FF416C'}
              onOpenChild={(childId) => {
                if (groups.some((g) => g.id === childId)) {
                  openGroupDetail(childId);
                } else {
                  closeGroupDetail();
                }
              }}
            />

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
                        onClick={() => {
                          setActiveBatchId(batch.id);
                          setTab('roster');
                        }}
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
                            <span className="text-sm font-bold text-[#1B1B1B] truncate">
                              {batch.batchLabel || batch.theme || batch.period}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-[11px] text-[#8C8880] shrink-0">
                            <span className="flex items-center gap-1">
                              <Crown className="w-3 h-3" /> {shortName(batch.mentor)}
                            </span>
                            {batch.comentor && (
                              <span className="hidden sm:flex items-center gap-1">
                                <Heart className="w-3 h-3" /> {shortName(batch.comentor)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-3.5">
                          {(batch.mentees || []).map((m) => (
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
              </div>
            </section>
          </>
        )}

        {tab === 'agenda' && (
          <section className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-[24px] bg-white border border-[#D9D7D0]/60">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4" style={{ color: group.color }} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#8C8880]">
                    Meeting Schedule
                  </span>
                </div>
                <p className="text-sm font-bold text-[#1B1B1B]">
                  {group.meetingSchedule || '—'}
                </p>
              </div>
              <div className="p-5 rounded-[24px] bg-white border border-[#D9D7D0]/60">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-blue-500" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#8C8880]">
                    Location
                  </span>
                </div>
                <p className="text-sm font-bold text-[#1B1B1B]">
                  {group.meetingLocation || '—'}
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-[#1B1B1B] mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4" style={{ color: group.color }} />
                Batch themes
              </h3>
              {batches.some((b) => b.theme) ? (
                <ul className="space-y-3">
                  {batches.map((b) => (
                    <li
                      key={b.id}
                      className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-[#D9D7D0]/50"
                    >
                      <span
                        className="px-2 py-0.5 rounded-full text-white text-[10px] font-black shrink-0"
                        style={{ backgroundColor: group.color }}
                      >
                        {b.period}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#1B1B1B]">
                          {b.theme || b.batchLabel || '—'}
                        </p>
                        <p className="text-[11px] text-[#8C8880] mt-0.5">
                          {shortName(b.mentor)}
                          {b.comentor ? ` · ${shortName(b.comentor)}` : ''}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[#8C8880] p-4 rounded-2xl border border-dashed border-[#D9D7D0] bg-[#FAF9F5]">
                  {t.groupDetail.agendaEmpty}
                </p>
              )}
            </div>
          </section>
        )}

        {tab === 'docs' && (
          <section>
            {galleryState === 'restricted' ? (
              <div className="rounded-[24px] bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-xs font-semibold flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                {t.groupDetail.docsRestricted}
              </div>
            ) : galleryState === 'loading' ? (
              <p className="text-xs text-[#8C8880]">Memuat galeri…</p>
            ) : galleryState === 'empty' || !galleryItems.length ? (
              <div className="rounded-[24px] border border-dashed border-[#D9D7D0] bg-[#FAF9F5]/60 p-5 flex items-center gap-3 text-xs text-[#8C8880]">
                <ImageOff className="w-4 h-4 shrink-0 opacity-60" />
                <p>{t.groupDetail.docsEmpty}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {galleryItems.slice(0, 24).map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setLightboxIdx(idx)}
                    className="group relative aspect-square overflow-hidden rounded-[24px] bg-[#F0EFEB] border border-[#D9D7D0]/40 hover:shadow-xl transition-all duration-300 text-left"
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
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {lightboxIdx !== null && galleryItems[lightboxIdx] && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => setLightboxIdx(null)}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
          {galleryItems.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setLightboxIdx((lightboxIdx - 1 + galleryItems.length) % galleryItems.length)}
                className="absolute left-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setLightboxIdx((lightboxIdx + 1) % galleryItems.length)}
                className="absolute right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
          <img
            src={
              galleryItems[lightboxIdx].thumbnailUrl ||
              galleryItems[lightboxIdx].thumbnailLink ||
              ''
            }
            alt={galleryItems[lightboxIdx].name}
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-2xl"
          />
        </div>
      )}
    </div>
  );
};
