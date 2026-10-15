import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Calendar, Check, Copy, Images, Send, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useLang } from '../../context/LangContext';
import { copyText, whatsappShareUrl } from '../../lib/rhb-caption';
import { fmtArsipDate, type ArsipEvent } from './ArsipIbadah';

type Ringkasan = {
  theme: string;
  published: boolean;
  bigIdea: string;
  teksUtama: { ref: string; text: string };
  outline: { pengantar: string; bedahTeologis: string; jembatan: string; kesimpulan: string };
  coverUrl: string | null;
};

type Serving = {
  responsible?: string;
  host?: string;
  hostMembers?: { name: string }[];
  projected?: boolean;
};

type Duty = { role: string; division: string; name: string };

function idFromHash(): string {
  const raw = (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#\/?/, '').split('?')[0];
  const seg = raw.split('/').filter(Boolean);
  return seg[0] === 'arsip' ? seg[1] || '' : '';
}

const SECTION_KEYS = ['pengantar', 'bedahTeologis', 'jembatan', 'kesimpulan'] as const;

/** Halaman detail arsip per event (#/arsip/:id) — publik, shareable untuk grup. */
export const ArsipDetail: React.FC = () => {
  const { t } = useLang();
  const { authUser, setPublicTab } = useApp();
  const [eventId] = useState(idFromHash);
  const [event, setEvent] = useState<ArsipEvent | null>(null);
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null);
  const [serving, setServing] = useState<Serving | null>(null);
  const [duties, setDuties] = useState<Duty[]>([]);
  const [missing, setMissing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imgOk, setImgOk] = useState(true);

  useEffect(() => {
    if (!eventId) {
      setMissing(true);
      return;
    }
    fetch('/api/events/public-archive')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        const found = (d.events || []).find((e: ArsipEvent) => e.id === eventId);
        if (!found) setMissing(true);
        else setEvent(found);
      })
      .catch(() => setMissing(true));
  }, [eventId]);

  useEffect(() => {
    if (!event?.ringkasan) return;
    fetch(`/api/ibadah/ringkasan/${event.ringkasan.ym}/${event.ringkasan.week}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setRingkasan(d))
      .catch(() => {});
  }, [event]);

  useEffect(() => {
    if (!event?.date) return;
    const day = event.date.slice(0, 10);
    fetch(`/api/db/service-schedule?from=${day}&to=${day}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setServing(d.serving?.[day] || null);
        setDuties(Array.isArray(d.byDay?.[day]) ? d.byDay[day] : []);
      })
      .catch(() => {});
  }, [event]);

  const caption = useMemo(() => {
    if (!event) return '';
    const host = serving?.host ? `tuan rumah ${serving.host}` : '';
    const resp = serving?.responsible ? `penanggung jawab ${serving.responsible}` : '';
    const who = [host, resp].filter(Boolean).join(' & ');
    return [
      `Terima kasih Tuhan untuk ibadah "${event.name}" (${fmtArsipDate(event.date)}).`,
      who ? `Terima kasih ${who} dan semua petugas yang melayani.` : 'Terima kasih semua petugas yang melayani.',
      ringkasan?.teksUtama?.ref ? `Firman: ${ringkasan.teksUtama.ref}.` : '',
      ringkasan?.bigIdea ? ringkasan.bigIdea : '',
      `${typeof window !== 'undefined' ? window.location.origin + window.location.pathname : ''}#/arsip/${event.id}`,
    ]
      .filter(Boolean)
      .join('\n');
  }, [event, serving, ringkasan]);

  const doCopy = async () => {
    if (await copyText(caption)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const openDrive = async () => {
    if (!event) return;
    if (!authUser) {
      setPublicTab('login');
      return;
    }
    const r = await fetch(`/api/events/${event.id}/archive-link`, { credentials: 'include' });
    const d = await r.json().catch(() => ({}));
    if (d.driveUrl) window.open(d.driveUrl, '_blank');
  };

  if (missing) {
    return (
      <section className="py-20 px-4 max-w-2xl mx-auto text-center">
        <h1 className="text-lg font-bold text-[#1B1B1B]">{t.ringkasan.missingTitle}</h1>
        <a href="#/bulletin" className="inline-block mt-4 text-xs font-bold text-brand hover:underline">{t.arsip.backToArchive}</a>
      </section>
    );
  }
  if (!event) return <p className="text-xs text-[#8C8880] py-20 text-center">{t.arsip.loading}</p>;

  const sectionLabel = (k: (typeof SECTION_KEYS)[number]) =>
    k === 'pengantar' ? t.ringkasan.sPengantar : k === 'bedahTeologis' ? t.ringkasan.sBedah : k === 'jembatan' ? t.ringkasan.sJembatan : t.ringkasan.sKesimpulan;

  return (
    <article className="py-14 sm:py-20 px-4 sm:px-8 max-w-[800px] mx-auto">
      <a href="#/bulletin" className="text-xs font-bold text-[#8C8880] hover:text-[#1B1B1B]">{t.arsip.backToArchive}</a>
      <p className="mt-4 text-[11px] font-black uppercase tracking-[0.2em] text-brand flex items-center gap-2">
        {t.arsip.eyebrow}
        {event.ringkasan && !event.ringkasan.published ? (
          <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 normal-case tracking-normal">{t.arsip.draftLive}</span>
        ) : null}
      </p>
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1B1B1B] font-display mt-1">{event.name}</h1>
      <p className="text-xs text-[#8C8880] mt-1 inline-flex items-center gap-1.5">
        <Calendar className="w-3.5 h-3.5" /> {fmtArsipDate(event.date)}
      </p>

      {ringkasan?.coverUrl && imgOk ? (
        <div className="mt-6 rounded-[28px] overflow-hidden border border-[#D9D7D0]/40">
          <img src={ringkasan.coverUrl} alt={event.name} onError={() => setImgOk(false)} className="w-full object-cover" />
        </div>
      ) : null}

      {ringkasan?.bigIdea ? (
        <p className="mt-6 text-sm font-bold text-[#1B1B1B] leading-relaxed">{ringkasan.bigIdea}</p>
      ) : null}
      {ringkasan?.teksUtama?.ref ? (
        <blockquote className="mt-4 p-4 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0]/50 text-xs text-[#1B1B1B] italic">
          <span className="not-italic font-black">{ringkasan.teksUtama.ref}</span>
          {ringkasan.teksUtama.text ? ` — "${ringkasan.teksUtama.text}"` : ''}
        </blockquote>
      ) : null}
      {SECTION_KEYS.map((k) =>
        ringkasan?.outline?.[k] ? (
          <section key={k} className="mt-8">
            <h2 className="text-sm font-black text-[#1B1B1B] uppercase tracking-wider">{sectionLabel(k)}</h2>
            <p className="mt-2 text-sm text-[#1B1B1B]/90 leading-relaxed whitespace-pre-line">{ringkasan.outline[k]}</p>
          </section>
        ) : null,
      )}

      {(event.previews || []).length > 0 ? (
        <section className="mt-10">
          <h2 className="text-sm font-black text-[#1B1B1B] uppercase tracking-wider inline-flex items-center gap-1.5">
            <Images className="w-4 h-4" /> {t.arsip.galleryDay}
          </h2>
          <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-1.5">
            {event.previews.map((p) => (
              <img key={p.id} src={p.thumbnailUrl} alt="" loading="lazy" className="aspect-square object-cover rounded-xl" />
            ))}
          </div>
          {event.hasArchive ? (
            <button
              type="button"
              onClick={openDrive}
              className="mt-4 px-4 py-2 rounded-full bg-[#181818] text-white text-xs font-bold"
            >
              {authUser ? t.arsip.driveAll : t.arsip.driveLogin}
            </button>
          ) : null}
        </section>
      ) : null}

      {serving || duties.length ? (
        <section className="mt-10 p-5 rounded-[24px] bg-[#FAF9F5] border border-[#D9D7D0]/50">
          <h2 className="text-sm font-black text-[#1B1B1B] uppercase tracking-wider inline-flex items-center gap-1.5">
            <Users className="w-4 h-4" /> {t.arsip.hostTitle}
          </h2>
          <div className="mt-3 space-y-1.5 text-xs">
            {serving?.host ? <p><b>{t.arsip.host}:</b> {serving.host}</p> : null}
            {serving?.responsible ? <p><b>{t.arsip.responsible}:</b> {serving.responsible}</p> : null}
            {duties.length ? (
              <div className="pt-2">
                <p className="font-black text-[11px] uppercase tracking-wider text-[#8C8880] mb-1">{t.arsip.crew}</p>
                {duties.map((d, i) => (
                  <p key={i} className="text-[#1B1B1B]">{d.name} <span className="text-[#8C8880]">· {d.role}{d.division ? ` · ${d.division}` : ''}</span></p>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="mt-10 p-5 rounded-[24px] bg-white border border-[#D9D7D0]/60">
        <h2 className="text-sm font-black text-[#1B1B1B] uppercase tracking-wider inline-flex items-center gap-1.5">
          <BookOpen className="w-4 h-4" /> {t.arsip.captionTitle}
        </h2>
        <p className="mt-3 text-xs text-[#1B1B1B] leading-relaxed whitespace-pre-line">{caption}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={doCopy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? t.arsip.copied : t.arsip.copy}
          </button>
          <a
            href={whatsappShareUrl(caption)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
          >
            <Send className="w-3.5 h-3.5" /> {t.arsip.shareWa}
          </a>
        </div>
      </section>
    </article>
  );
};
