import React, { useCallback, useEffect, useState } from 'react';
import { Copy, ExternalLink, Loader2, MessageCircle, Archive, Play } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  buildServingCloseCaption,
  buildServingInviteCaption,
  buildServingRosterText,
  buildToolHowtoCaption,
  fmtDateID,
  waShareHref,
  type WeekInvite,
} from '../../lib/serving-week-caption';

/**
 * Kartu grup WA temporer per Minggu serving (BOD Tim Kerja).
 * Dipasang di baris serving ServicePlanPanel. Alur: BOD buat grup di HP →
 * tempel link → sebar undangan (caption siap-tempel) → tutup H+1 (arsip).
 */

type Channel = {
  eventDate: string;
  status: 'DRAFT' | 'OPEN' | 'CLOSED';
  waUrl?: string | null;
  representativeIds: string[];
  cycleIndex?: number | null;
};

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600 border-gray-200',
  OPEN: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CLOSED: 'bg-[#FAF9F5] text-[#8C8880] border-[#D9D7D0]',
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { credentials: 'include', ...init });
  const d = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error((d as { error?: string }).error || `HTTP ${r.status}`);
  return d as T;
}

export const ServingWeekChannelCard: React.FC<{ date: string; canManage: boolean }> = ({ date, canManage }) => {
  const { addToast } = useApp();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [invite, setInvite] = useState<WeekInvite>({ officers: [], mentors: [], hods: [] });
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [waUrl, setWaUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [showCaption, setShowCaption] = useState<'invite' | 'close' | 'roster' | 'howto' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ channel: Channel | null; invite: WeekInvite; canManage: boolean }>(
        `/api/serving-weeks/${date}/channel`,
      );
      setChannel(d.channel);
      setInvite(d.invite || { officers: [], mentors: [], hods: [] });
      setAllowed(Boolean(d.canManage));
      if (d.channel?.waUrl) setWaUrl(d.channel.waUrl);
    } catch {
      setChannel(null);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="text-[11px] text-[#8C8880]">Memuat grup mingguan…</p>;
  if (!channel && !canManage && !allowed) return null;

  const mutate = async (fn: () => Promise<{ channel: Channel }>, ok: string) => {
    setBusy(true);
    try {
      const d = await fn();
      setChannel(d.channel);
      if (d.channel?.waUrl) setWaUrl(d.channel.waUrl);
      addToast({ type: 'success', title: ok });
    } catch (e) {
      addToast({ type: 'error', title: e instanceof Error ? e.message : 'Gagal.' });
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    mutate(
      () =>
        api<{ channel: Channel }>(`/api/serving-weeks/${date}/channel`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ waUrl: waUrl || null }),
        }),
      'Link grup tersimpan',
    );

  const inviteCaption = channel?.waUrl
    ? buildServingInviteCaption({ date, waUrl: channel.waUrl, invite })
    : '';
  const closeCaption = buildServingCloseCaption({ date, invite });
  const roster = buildServingRosterText(invite);
  const captionText = showCaption === 'invite' ? inviteCaption : showCaption === 'close' ? closeCaption : showCaption === 'howto' ? buildToolHowtoCaption({}) : roster;

  return (
    <div className="rounded-xl border border-[#EFEDE8] bg-[#FAF9F5] p-2.5 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <MessageCircle className="w-3.5 h-3.5 text-[#8C8880]" />
        <span className="text-[11px] font-black text-[#1B1B1B]">Grup WA temporer</span>
        {channel && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${STATUS_STYLE[channel.status]}`}>
            {channel.status === 'OPEN' ? 'Terbuka' : channel.status === 'CLOSED' ? 'Ditutup/diarsip' : 'Siapkan'}
          </span>
        )}
        <span className="flex-1" />
        {channel?.waUrl && channel.status !== 'CLOSED' && (
          <a href={channel.waUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline">
            <ExternalLink className="w-3 h-3" /> Buka grup
          </a>
        )}
      </div>

      {(canManage || allowed) && channel?.status !== 'CLOSED' && (
        <div className="flex flex-wrap gap-1.5">
          <input
            value={waUrl}
            onChange={(e) => setWaUrl(e.target.value)}
            placeholder="Tempel link https://chat.whatsapp.com/…"
            className="flex-1 min-w-[200px] px-2.5 py-1.5 rounded-xl bg-white border border-[#D9D7D0] text-[11px]"
          />
          <button type="button" onClick={() => void save()} disabled={busy} className="px-3 py-1.5 rounded-xl bg-[#1B1B1B] text-white text-[11px] font-bold disabled:opacity-50">
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Simpan'}
          </button>
          {channel && channel.status === 'DRAFT' && (
            <button
              type="button"
              onClick={() => void mutate(() => api(`/api/serving-weeks/${date}/open`, { method: 'POST' }), 'Grup dibuka — sebar undangan')}
              disabled={busy || !channel.waUrl}
              title={!channel.waUrl ? 'Isi link dulu' : 'Buka grup'}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-[11px] font-bold disabled:opacity-50"
            >
              <Play className="w-3 h-3" /> Buka
            </button>
          )}
          {channel && channel.status === 'OPEN' && (
            <button
              type="button"
              onClick={() => {
                if (!window.confirm(`Tutup grup ${fmtDateID(date)}? Link diarsipkan; anggota keluar manual via caption penutup.`)) return;
                void mutate(() => api(`/api/serving-weeks/${date}/close`, { method: 'POST' }), 'Grup ditutup & diarsip');
              }}
              disabled={busy}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-[#D9D7D0] text-[11px] font-bold text-[#8C8880] disabled:opacity-50"
            >
              <Archive className="w-3 h-3" /> Tutup & arsip
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setShowCaption(showCaption === 'roster' ? null : 'roster')} className="text-[11px] px-2 py-1 rounded-lg bg-white border border-[#D9D7D0] font-bold text-[#8C8880]">
          👥 Daftar undangan ({invite.officers.length + invite.mentors.length + invite.hods.length})
        </button>
        <button type="button" disabled={!channel?.waUrl} onClick={() => setShowCaption(showCaption === 'invite' ? null : 'invite')} className="text-[11px] px-2 py-1 rounded-lg bg-white border border-[#D9D7D0] font-bold text-[#8C8880] disabled:opacity-40">
          ✉️ Caption undangan
        </button>
        <button type="button" onClick={() => setShowCaption(showCaption === 'close' ? null : 'close')} className="text-[11px] px-2 py-1 rounded-lg bg-white border border-[#D9D7D0] font-bold text-[#8C8880]">
          👋 Caption penutup
        </button>
        <button type="button" onClick={() => setShowCaption(showCaption === 'howto' ? null : 'howto')} className="text-[11px] px-2 py-1 rounded-lg bg-white border border-[#D9D7D0] font-bold text-[#8C8880]">
          🛠️ Cara kerja alat
        </button>
      </div>

      {showCaption && (
        <div className="space-y-1.5">
          <textarea readOnly rows={Math.min(12, captionText.split('\n').length + 1)} value={captionText} className="w-full px-2.5 py-2 rounded-xl bg-white border border-[#D9D7D0] text-[11px] whitespace-pre-wrap" />
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(captionText);
                addToast({ type: 'success', title: 'Caption disalin' });
              }}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-[#1B1B1B] text-white font-bold"
            >
              <Copy className="w-3 h-3" /> Salin
            </button>
            <a href={waShareHref(captionText)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-white border border-[#D9D7D0] font-bold text-[#8C8880]">
              Kirim via WA
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
