import React, { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { useLang } from '../../context/LangContext';

type Ringkasan = {
  yearMonth: string;
  weekIndex: number;
  date: string;
  theme: string;
  bigIdea: string;
  teksUtama: { ref: string; text: string };
  outline: { pengantar: string; bedahTeologis: string; jembatan: string; kesimpulan: string };
  coverUrl: string | null;
};

function paramsFromHash(): { ym: string; week: string } {
  const raw = (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#\/?/, '').split('?')[0];
  const seg = raw.split('/').filter(Boolean);
  return { ym: seg[1] || '', week: seg[2] || '' };
}

const SECTION_KEYS = ['pengantar', 'bedahTeologis', 'jembatan', 'kesimpulan'] as const;

/** Halaman publik ringkasan khotbah per pekan (#/ringkasan/:ym/:week). */
export const RingkasanPublik: React.FC = () => {
  const { t } = useLang();
  const [{ ym, week }] = useState(paramsFromHash);
  const [data, setData] = useState<Ringkasan | null>(null);
  const [state, setState] = useState<'loading' | 'missing' | 'ok'>('loading');

  useEffect(() => {
    if (!/^\d{4}-\d{2}$/.test(ym) || !week) {
      setState('missing');
      return;
    }
    fetch(`/api/ibadah/ringkasan/${ym}/${week}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setData(d); setState('ok'); })
      .catch(() => setState('missing'));
  }, [ym, week]);

  if (state === 'loading' || (!data && state === 'ok')) {
    return <p className="text-xs text-[#8C8880] py-20 text-center">{t.ringkasan.loading}</p>;
  }
  if (state === 'missing' || !data) {
    return (
      <section className="py-20 px-4 max-w-2xl mx-auto text-center">
        <BookOpen className="w-10 h-10 text-[#8C8880] mx-auto mb-3 opacity-50" />
        <h1 className="text-lg font-bold text-[#1B1B1B]">{t.ringkasan.missingTitle}</h1>
        <p className="text-xs text-[#8C8880] mt-1">{t.ringkasan.missingSub}</p>
        <a href="#/bulletin" className="inline-block mt-4 text-xs font-bold text-brand hover:underline">{t.ringkasan.back}</a>
      </section>
    );
  }
  return (
    <article className="py-14 sm:py-20 px-4 sm:px-8 max-w-[800px] mx-auto">
      <a href="#/bulletin" className="text-xs font-bold text-[#8C8880] hover:text-[#1B1B1B]">{t.ringkasan.back}</a>
      <p className="mt-4 text-[11px] font-black uppercase tracking-[0.2em] text-brand">{t.ringkasan.eyebrow}</p>
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1B1B1B] font-display mt-1">
        {data.theme || `Pekan ${data.weekIndex}`}
      </h1>
      {data.coverUrl ? (
        <div className="mt-6 rounded-[28px] overflow-hidden border border-[#D9D7D0]/40">
          <img src={data.coverUrl} alt={data.theme} className="w-full object-cover" />
        </div>
      ) : null}
      {data.bigIdea ? (
        <p className="mt-6 text-sm font-bold text-[#1B1B1B] leading-relaxed">{data.bigIdea}</p>
      ) : null}
      {data.teksUtama?.ref ? (
        <blockquote className="mt-4 p-4 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0]/50 text-xs text-[#1B1B1B] italic">
          <span className="not-italic font-black">{data.teksUtama.ref}</span>
          {data.teksUtama.text ? ` — "${data.teksUtama.text}"` : ''}
        </blockquote>
      ) : null}
      {SECTION_KEYS.map((k) => {
        const label = k === 'pengantar' ? t.ringkasan.sPengantar : k === 'bedahTeologis' ? t.ringkasan.sBedah : k === 'jembatan' ? t.ringkasan.sJembatan : t.ringkasan.sKesimpulan;
        return data.outline?.[k] ? (
          <section key={k} className="mt-8">
            <h2 className="text-sm font-black text-[#1B1B1B] uppercase tracking-wider">{label}</h2>
            <p className="mt-2 text-sm text-[#1B1B1B]/90 leading-relaxed whitespace-pre-line">{data.outline[k]}</p>
          </section>
        ) : null;
      })}
    </article>
  );
};
