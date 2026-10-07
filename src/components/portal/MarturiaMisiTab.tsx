import React, { useCallback, useEffect, useState } from 'react';
import { Copy, HeartHandshake, Loader2, Megaphone, Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { referralLink } from '../../lib/marturia';
import { copyText } from '../../lib/rhb-caption';

type Soul = {
  id: string;
  nickname: string;
  status: string;
  handoverNote?: string | null;
  referralCode?: string | null;
};

type Referral = {
  id: string;
  code: string;
  clicks: number;
  registrations: number;
  attendances: number;
};

const SOUL_NEXT: Record<string, string | null> = { BARU: 'DIHUBUNGI', DIHUBUNGI: 'HADIR', HADIR: 'DISERAHKAN', DISERAHKAN: null };

/**
 * Tab Misi Marturia — invite-a-friend (referral personal) + log jiwa baru per event.
 * Marturia menjangkau; Koinonia menyambut & menempatkan (handover by-id ke Jethro).
 */
export const MarturiaMisiTab: React.FC<{ eventId: string }> = ({ eventId }) => {
  const { addToast } = useApp();
  const [souls, setSouls] = useState<Soul[]>([]);
  const [refs, setRefs] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        fetch(`/api/events/${encodeURIComponent(eventId)}/marturia/souls`, { credentials: 'include' }).then((x) => (x.ok ? x.json() : { items: [] })),
        fetch('/api/marturia/referrals/mine', { credentials: 'include' }).then((x) => (x.ok ? x.json() : { items: [] })),
      ]);
      setSouls(s.items || []);
      setRefs(r.items || []);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  const makeRef = async () => {
    const r = await fetch('/api/marturia/referrals', { method: 'POST', credentials: 'include' });
    if (r.ok) await load();
  };

  const copyRef = async (code: string) => {
    const ok = await copyText(referralLink(code, typeof window !== 'undefined' ? window.location.origin : ''));
    addToast({ type: ok ? 'success' : 'error', title: ok ? `Link ${code} tersalin` : 'Gagal menyalin' });
  };

  const copyForJethro = async (s: Soul) => {
    const ok = await copyText(`Newcomer dari Marturia: ${s.nickname}${s.referralCode ? ` (ref ${s.referralCode})` : ''}${s.handoverNote ? ` — ${s.handoverNote}` : ''}`);
    addToast({ type: ok ? 'success' : 'error', title: ok ? 'Tersalin untuk Jethro' : 'Gagal menyalin', description: ok ? 'Tempel di input newcomer panel Koinonia.' : undefined });
  };

  const addSoul = async () => {
    if (!nickname.trim()) return;
    const r = await fetch(`/api/events/${encodeURIComponent(eventId)}/marturia/souls`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: nickname.trim() }),
    });
    if (r.ok) { setNickname(''); await load(); }
  };

  const advanceSoul = async (s: Soul, handover: boolean) => {
    const next = SOUL_NEXT[s.status];
    if (!next) return;
    let handoverNote: string | undefined;
    if (handover) {
      handoverNote = window.prompt('Catatan serah terima ke Koinonia (siapa, kontak, kebutuhan awal)?', s.handoverNote || '') || undefined;
      if (handoverNote === undefined) return;
    }
    const r = await fetch(`/api/marturia/souls/${s.id}`, {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next, handoverNote }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { addToast({ type: 'error', title: d.error || 'Gagal' }); return; }
    if (next === 'DISERAHKAN') addToast({ type: 'success', title: 'Diserahkan ke Koinonia', description: 'Lanjut input newcomer → Jethro di panel Koinonia.' });
    await load();
  };

  if (loading) {
    return <p className="text-xs text-[#8C8880] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat misi…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-4">
        <h3 className="text-sm font-black text-[#1B1B1B] flex items-center gap-2"><Megaphone className="w-4 h-4 text-[#DC2626]" /> Invite-a-friend</h3>
        <p className="text-[11px] text-[#8C8880] mt-1">Link personal kamu — klik tercatat otomatis. Bagikan ke teman kos/kampus/pabrik.</p>
        <div className="mt-2 space-y-1.5">
          {refs.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] px-3 py-2">
              <span className="text-xs font-black text-[#1B1B1B]">{r.code}</span>
              <span className="text-[10px] text-[#8C8880]">{r.clicks} klik · {r.registrations} daftar · {r.attendances} hadir</span>
              <button type="button" onClick={() => void copyRef(r.code)} className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-sky-700">
                <Copy className="w-3 h-3" /> Salin link
              </button>
            </div>
          ))}
          <button type="button" onClick={() => void makeRef()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold">
            <Plus className="w-3.5 h-3.5" /> Buat link ajakan
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-4">
        <h3 className="text-sm font-black text-[#1B1B1B] flex items-center gap-2"><HeartHandshake className="w-4 h-4 text-[#DC2626]" /> Jiwa baru event ini</h3>
        <div className="mt-2 flex gap-2">
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void addSoul(); }} placeholder="Nama panggilan jiwa baru… (Enter)" className="flex-1 px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs focus:outline-none focus:border-black" />
          <button type="button" onClick={() => void addSoul()} disabled={!nickname.trim()} className="px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-40">Catat</button>
        </div>
        <div className="mt-3 space-y-2">
          {souls.length === 0 && <p className="text-[11px] text-[#8C8880]">Belum ada jiwa baru tercatat.</p>}
          {souls.map((s) => {
            const next = SOUL_NEXT[s.status];
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] px-3 py-2">
                <span className="text-xs font-black text-[#1B1B1B]">{s.nickname}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-[#D9D7D0] text-[#8C8880]">{s.status}</span>
                {s.status === 'DISERAHKAN' && (
                  <button
                    type="button"
                    onClick={() => void copyForJethro(s)}
                    className="text-[11px] font-bold text-sky-700"
                    title="Salin data untuk input newcomer Jethro di panel Koinonia"
                  >
                    Salin untuk Jethro
                  </button>
                )}
                {next && (
                  <button
                    type="button"
                    onClick={() => void advanceSoul(s, next === 'DISERAHKAN')}
                    className="ml-auto text-[11px] font-bold text-white bg-[#1B1B1B] rounded-lg px-2.5 py-1"
                  >
                    → {next === 'DISERAHKAN' ? 'Serahkan ke Koinonia' : next}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
