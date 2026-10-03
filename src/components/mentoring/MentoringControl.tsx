import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Copy,
  Download,
  KeyRound,
  Loader2,
  MapPin,
  MonitorPlay,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Users,
} from 'lucide-react';
import {
  STATUS_LABELS,
  type MentoringLivePayload,
  type MentoringStatus,
} from '../../lib/mentoring';

const CARD = 'bg-white rounded-2xl border border-[#D9D7D0]/60 p-4';
const INPUT = 'w-full rounded-xl border border-[#D9D7D0] bg-white px-3 py-2 text-sm focus:outline-none focus:border-brand';

type SessionRow = {
  id: string;
  slug: string;
  title: string;
  status: MentoringStatus;
  sessionDate?: string | null;
  accessCode?: string | null;
  pattern?: { code: string; name: string } | null;
};

type ItemRow = { id: string; topicCode: string; text: string; gospelNote?: string | null; sortOrder: number };
type ChipRow = { id: string; code: string; label: string; topicCode?: string | null; sortOrder: number };

type NoteRow = { userId: string; userName: string; topicCode: string; content: string };
type SessionDetail = {
  session: {
    id: string;
    slug: string;
    title: string;
    status: MentoringStatus;
    sessionDate?: string | null;
    accessCode?: string | null;
    config: {
      timerSeconds: number;
      topics: { code: string; label: string }[];
      floors: { floor: number; label: string; venueId?: string | null; capacity?: number }[];
      rankFloors?: number[];
      expectedCount: number | null;
      chipLimit: number;
    };
    pattern?: { code: string; name: string; phases?: { no?: number; title?: string; minutes?: number; owner?: string }[] } | null;
  };
  likertItems: ItemRow[];
  chips: ChipRow[];
  rooms: { code: string; label: string; floorLabel: string; count: number; total: number; capacity?: number; isFull?: boolean }[];
  wordcloud: { code: string; label: string; count: number }[];
  notes?: NoteRow[];
  progress: { submitted: number; total: number };
};

type VenueRow = {
  id: string;
  code: string;
  name: string;
  capacity: number;
  kind: string;
  note?: string | null;
  isActive: boolean;
};

const ACTIONS: { action: string; label: string; tone: string }[] = [
  { action: 'open-likert', label: 'Buka Akses Likert', tone: 'bg-sky-600' },
  { action: 'start', label: 'Start Sesi', tone: 'bg-emerald-600' },
  { action: 'wrapup', label: 'Trigger Lesson Learned', tone: 'bg-amber-600' },
  { action: 'extend', label: '+5 menit', tone: 'bg-sky-500' },
  { action: 'close', label: 'Tutup Sesi', tone: 'bg-[#1B1B1B]' },
  { action: 'reset', label: 'Reset ke Draft', tone: 'bg-white !text-[#8C8880] border border-[#D9D7D0]' },
];

export const MentoringControl: React.FC<{ initialSlug?: string }> = ({ initialSlug }) => {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [live, setLive] = useState<MentoringLivePayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [newItem, setNewItem] = useState({ topicCode: '', text: '', gospelNote: '' });
  const [newChip, setNewChip] = useState({ label: '', topicCode: '' });
  const [configDraft, setConfigDraft] = useState({ timerSeconds: 1200, expectedCount: '' });
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [rankVenues, setRankVenues] = useState<string[]>(['', '', '']);
  const [venueDraft, setVenueDraft] = useState({ name: '', capacity: '', kind: 'TERAS', note: '' });
  const [venueEdit, setVenueEdit] = useState<Record<string, { capacity: string; note: string }>>({});

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const loadSessions = useCallback(async () => {
    try {
      const r = await fetch('/api/worship/sessions', { credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Gagal memuat sesi.');
      const list: SessionRow[] = d.sessions || [];
      setSessions(list);
      setSelectedId((prev) => {
        if (prev && list.some((s) => s.id === prev)) return prev;
        const bySlug = initialSlug ? list.find((s) => s.slug === initialSlug)?.id : '';
        return bySlug || list[0]?.id || '';
      });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal memuat sesi.' });
    }
  }, []);

  const loadDetail = useCallback(async () => {
    if (!selectedId) return;
    try {
      const r = await fetch(`/api/worship/sessions/${encodeURIComponent(selectedId)}`, { credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Gagal memuat detail sesi.');
      setDetail(d);
      setConfigDraft({
        timerSeconds: d.session?.config?.timerSeconds ?? 1200,
        expectedCount: d.session?.config?.expectedCount ?? '',
      });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal memuat detail.' });
    }
  }, [selectedId]);

  const loadLive = useCallback(async () => {
    if (!detail?.session?.slug) return;
    try {
      const r = await fetch(`/api/worship/live/${encodeURIComponent(detail.session.slug)}`, { credentials: 'include' });
      if (!r.ok) return;
      setLive(await r.json());
    } catch {
      /* abaikan */
    }
  }, [detail?.session?.slug]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);
  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);
  useEffect(() => {
    void loadLive();
    const id = window.setInterval(() => void loadLive(), 5000);
    return () => window.clearInterval(id);
  }, [loadLive]);

  const doAction = async (action: string, extra?: Record<string, unknown>) => {
    if (!detail) return;
    if (action === 'start') {
      const p = live?.progress || detail.progress;
      if (p && p.submitted < p.total) {
        const ok = window.confirm(
          `Baru ${p.submitted}/${p.total} peserta mengisi Likert. Tetap mulai sesi 20 menit?`,
        );
        if (!ok) return;
      }
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/worship/sessions/${detail.session.id}/state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, ...(extra || {}) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Gagal mengubah status.');
      setMsg({ kind: 'ok', text: `Status: ${d.status}` });
      await loadDetail();
      await loadLive();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal mengubah status.' });
    } finally {
      setBusy(false);
    }
  };

  const rotateCode = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/worship/sessions/${detail.session.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rotateCode: true }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Gagal merotasi kode.');
      setMsg({ kind: 'ok', text: `Kode baru: ${d.session.accessCode}` });
      await loadDetail();
      await loadSessions();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal merotasi kode.' });
    } finally {
      setBusy(false);
    }
  };

  const saveConfig = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/worship/sessions/${detail.session.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          config: {
            ...detail.session.config,
            timerSeconds: Number(configDraft.timerSeconds) || 1200,
            expectedCount: configDraft.expectedCount === '' ? null : Number(configDraft.expectedCount),
          },
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Gagal menyimpan konfigurasi.');
      setMsg({ kind: 'ok', text: 'Konfigurasi tersimpan.' });
      await loadDetail();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal menyimpan konfigurasi.' });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void loadVenues();
  }, []);

  const loadVenues = async () => {
    try {
      const r = await fetch('/api/worship/venues?active=0', { credentials: 'include' });
      const d = r.ok ? await r.json() : { venues: [] };
      setVenues((d.venues || []) as VenueRow[]);
    } catch {
      setVenues([]);
    }
  };

  // rankVenues[i] = venueId untuk prioritas rank i+1.
  useEffect(() => {
    const cfg = detail?.session.config;
    if (!cfg) return;
    const ranks: number[] = Array.isArray(cfg.rankFloors) && cfg.rankFloors.length === 3 ? cfg.rankFloors : [1, 2, 3];
    setRankVenues(
      ranks.map((floor) => cfg.floors.find((f) => f.floor === floor)?.venueId || ''),
    );
  }, [detail?.session.id]);

  const venueTotal = rankVenues.reduce((n, id) => {
    const v = venues.find((x) => x.id === id);
    return n + (v?.capacity || 0);
  }, 0);

  const saveVenues = async () => {
    if (!detail) return;
    const picked = rankVenues.map((id) => venues.find((v) => v.id === id));
    if (picked.some((v) => !v)) {
      setMsg({ kind: 'err', text: 'Pilih tempat untuk Rank 1, 2, dan 3.' });
      return;
    }
    if (new Set(rankVenues).size !== rankVenues.length) {
      setMsg({ kind: 'err', text: 'Tiga rank harus memakai tempat berbeda.' });
      return;
    }
    setBusy(true);
    try {
      const floors = picked.map((v, i) => ({
        floor: i + 1,
        label: v?.name || `Pos ${i + 1}`,
        venueId: v?.id || null,
        capacity: v?.capacity || 0,
      }));
      const r = await fetch(`/api/worship/sessions/${detail.session.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          config: { ...detail.session.config, floors, rankFloors: [1, 2, 3] },
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Gagal menyimpan tempat.');
      setMsg({ kind: 'ok', text: 'Tempat pos tersimpan.' });
      await loadDetail();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal menyimpan tempat.' });
    } finally {
      setBusy(false);
    }
  };

  const addVenue = async () => {
    if (!venueDraft.name.trim()) {
      setMsg({ kind: 'err', text: 'Nama tempat wajib diisi.' });
      return;
    }
    setBusy(true);
    try {
      const code = venueDraft.name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || `V${Date.now().toString(36).toUpperCase()}`;
      const r = await fetch('/api/worship/venues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          code,
          name: venueDraft.name.trim(),
          capacity: Number(venueDraft.capacity) || 0,
          kind: venueDraft.kind,
          note: venueDraft.note.trim() || null,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Gagal menambah tempat.');
      setVenueDraft({ name: '', capacity: '', kind: 'TERAS', note: '' });
      setMsg({ kind: 'ok', text: 'Tempat ditambahkan.' });
      await loadVenues();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal menambah tempat.' });
    } finally {
      setBusy(false);
    }
  };

  const patchVenue = async (id: string, patch: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/worship/venues/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(patch),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Gagal menyimpan tempat.');
      setMsg({ kind: 'ok', text: 'Tempat diperbarui.' });
      await loadVenues();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal menyimpan tempat.' });
    } finally {
      setBusy(false);
    }
  };

  const deleteVenue = async (id: string, name: string) => {
    if (!window.confirm(`Hapus tempat "${name}"? Hanya bisa bila tidak dipakai sesi mana pun.`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/worship/venues/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Gagal menghapus.');
      setMsg({ kind: 'ok', text: 'Tempat dihapus.' });
      await loadVenues();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal menghapus.' });
    } finally {
      setBusy(false);
    }
  };

  const addItem = async () => {
    if (!detail || !newItem.topicCode || !newItem.text.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/worship/sessions/${detail.session.id}/likert-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newItem),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Gagal menambah pertanyaan.');
      setNewItem({ topicCode: newItem.topicCode, text: '', gospelNote: '' });
      await loadDetail();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal menambah pertanyaan.' });
    } finally {
      setBusy(false);
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!detail) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/worship/sessions/${detail.session.id}/likert-items/${itemId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!r.ok) throw new Error('Gagal menghapus pertanyaan.');
      await loadDetail();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal menghapus.' });
    } finally {
      setBusy(false);
    }
  };

  const addChip = async () => {
    if (!detail || !newChip.label.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/worship/sessions/${detail.session.id}/chips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ label: newChip.label, topicCode: newChip.topicCode || null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Gagal menambah chip.');
      setNewChip({ label: '', topicCode: newChip.topicCode });
      await loadDetail();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal menambah chip.' });
    } finally {
      setBusy(false);
    }
  };

  const deleteChip = async (code: string) => {
    if (!detail) return;
    setBusy(true);
    try {
      const r = await fetch(
        `/api/worship/sessions/${detail.session.id}/chips/${encodeURIComponent(code)}`,
        { method: 'DELETE', credentials: 'include' },
      );
      if (!r.ok) throw new Error('Gagal menghapus chip.');
      await loadDetail();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal menghapus chip.' });
    } finally {
      setBusy(false);
    }
  };

  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text);
    setMsg({ kind: 'ok', text: 'Tautan disalin.' });
  };

  const links = useMemo(() => {
    const slug = detail?.session.slug || '';
    return {
      peserta: `${origin}/#/mentoring/${slug}`,
      layar: `${origin}/#/mentoring/${slug}/layar`,
      kontrol: `${origin}/#/mentoring/${slug}/kontrol`,
    };
  }, [detail?.session.slug, origin]);

  return (
    <div className="space-y-4">
      <div className={CARD}>
        <div className="flex flex-wrap items-center gap-2">
          <MonitorPlay className="w-4 h-4 text-brand" />
          <h3 className="text-sm font-black text-[#1B1B1B]">Pola Ibadah &amp; Mentoring Day</h3>
          <button
            type="button"
            onClick={() => void loadSessions()}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs font-bold"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Muat ulang
          </button>
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-[11px] text-[#8C8880]">Sesi</span>
            <select className={INPUT} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {sessions.length === 0 && <option value="">(belum ada sesi)</option>}
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} — {STATUS_LABELS[s.status]}
                </option>
              ))}
            </select>
          </label>
          {detail?.session?.pattern && (
            <div className="space-y-1">
              <span className="text-[11px] text-[#8C8880]">Pola</span>
              <p className="text-sm font-bold">{detail.session.pattern.name}</p>
            </div>
          )}
        </div>
        {msg && (
          <p className={`mt-3 text-xs ${msg.kind === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</p>
        )}
      </div>

      {detail && (
        <>
          <div className={CARD}>
            <div className="flex flex-wrap items-center gap-2">
              {ACTIONS.map((a) => (
                <button
                  key={a.action}
                  type="button"
                  disabled={busy}
                  onClick={() => void doAction(a.action, a.action === 'extend' ? { seconds: 300 } : undefined)}
                  className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider text-white disabled:opacity-60 ${a.tone}`}
                >
                  {a.label}
                </button>
              ))}
              <span className="ml-auto text-[11px] font-bold text-[#8C8880]">
                Status: {STATUS_LABELS[detail.session.status]}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="space-y-1">
                <span className="text-[11px] text-[#8C8880]">Timer sesi (detik)</span>
                <input
                  className={INPUT}
                  type="number"
                  min={60}
                  value={configDraft.timerSeconds}
                  onChange={(e) => setConfigDraft((c) => ({ ...c, timerSeconds: Number(e.target.value) }))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] text-[#8C8880]">Target peserta (opsional)</span>
                <input
                  className={INPUT}
                  type="number"
                  min={1}
                  value={configDraft.expectedCount}
                  placeholder="otomatis dari tenant"
                  onChange={(e) => setConfigDraft((c) => ({ ...c, expectedCount: e.target.value }))}
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveConfig()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5" /> Simpan konfigurasi
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-[#EFEDE8] p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-brand" />
                <p className="text-[11px] font-bold">Tempat pos per prioritas</p>
                <span className="ml-auto text-[11px] font-bold text-[#8C8880] tabular-nums">
                  Total {venueTotal} kursi
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[0, 1, 2].map((rank) => (
                  <label key={rank} className="space-y-1">
                    <span className="text-[11px] text-[#8C8880]">Rank {rank + 1}</span>
                    <select
                      className={INPUT}
                      value={rankVenues[rank] || ''}
                      disabled={busy}
                      onChange={(e) => setRankVenues((prev) => prev.map((v, i) => (i === rank ? e.target.value : v)))}
                    >
                      <option value="">— Pilih tempat —</option>
                      {venues.map((v) => (
                        <option key={v.id} value={v.id} disabled={!v.isActive}>
                          {v.name} · {v.capacity}
                          {v.isActive ? '' : ' (nonaktif)'}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveVenues()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-60"
              >
                <Save className="w-3.5 h-3.5" /> Simpan tempat
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-[#EFEDE8] p-3 space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-brand" />
                <p className="text-[11px] font-bold">Daftar tempat &amp; daya tampung</p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void loadVenues()}
                  className="ml-auto text-[11px] font-bold text-[#8C8880] hover:text-[#1B1B1B]"
                >
                  Muat ulang
                </button>
              </div>
              <ul className="space-y-2">
                {venues.map((v) => {
                  const edit = venueEdit[v.id] || { capacity: String(v.capacity), note: v.note || '' };
                  return (
                    <li key={v.id} className={`rounded-xl border p-3 space-y-2 ${v.isActive ? 'border-[#EFEDE8]' : 'border-[#EFEDE8] bg-[#FAF9F5] opacity-70'}`}>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-black text-[#1B1B1B]">{v.name}</p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] font-bold text-[#8C8880]">{v.kind}</span>
                        {!v.isActive && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-bold">Nonaktif</span>
                        )}
                        <span className="ml-auto flex items-center gap-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void patchVenue(v.id, { isActive: !v.isActive })}
                            className="text-[11px] font-bold text-sky-700 hover:underline"
                          >
                            {v.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void deleteVenue(v.id, v.name)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 hover:underline disabled:opacity-60"
                          >
                            <Trash2 className="w-3 h-3" /> Hapus
                          </button>
                        </span>
                      </div>
                      <div className="grid grid-cols-[96px_1fr] gap-2 items-center">
                        <label className="space-y-1">
                          <span className="text-[10px] text-[#8C8880]">Kapasitas</span>
                          <input
                            className={INPUT}
                            type="number"
                            min={0}
                            value={edit.capacity}
                            disabled={busy}
                            onChange={(e) => setVenueEdit((prev) => ({ ...prev, [v.id]: { ...edit, capacity: e.target.value } }))}
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="text-[10px] text-[#8C8880]">Deskripsi detail</span>
                          <input
                            className={INPUT}
                            value={edit.note}
                            disabled={busy}
                            placeholder="cth. antara GMIM dan HKBP"
                            onChange={(e) => setVenueEdit((prev) => ({ ...prev, [v.id]: { ...edit, note: e.target.value } }))}
                          />
                        </label>
                      </div>
                      {(edit.capacity !== String(v.capacity) || (edit.note || '') !== (v.note || '')) && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void patchVenue(v.id, { capacity: Number(edit.capacity) || 0, note: edit.note.trim() || null })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1B1B1B] text-white text-[11px] font-bold disabled:opacity-60"
                        >
                          <Save className="w-3 h-3" /> Simpan
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="rounded-xl bg-[#FAF9F5] border border-[#EFEDE8] p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <label className="space-y-1 col-span-2">
                  <span className="text-[10px] text-[#8C8880]">Nama tempat baru</span>
                  <input
                    className={INPUT}
                    value={venueDraft.name}
                    disabled={busy}
                    placeholder="cth. Teras Belakang"
                    onChange={(e) => setVenueDraft((d) => ({ ...d, name: e.target.value }))}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] text-[#8C8880]">Kapasitas</span>
                  <input
                    className={INPUT}
                    type="number"
                    min={0}
                    value={venueDraft.capacity}
                    disabled={busy}
                    onChange={(e) => setVenueDraft((d) => ({ ...d, capacity: e.target.value }))}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] text-[#8C8880]">Jenis</span>
                  <select
                    className={INPUT}
                    value={venueDraft.kind}
                    disabled={busy}
                    onChange={(e) => setVenueDraft((d) => ({ ...d, kind: e.target.value }))}
                  >
                    {['LANTAI', 'TERAS', 'CITYWALK'].map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 col-span-2 sm:col-span-3">
                  <span className="text-[10px] text-[#8C8880]">Deskripsi detail</span>
                  <input
                    className={INPUT}
                    value={venueDraft.note}
                    disabled={busy}
                    placeholder="cth. antara GMIM dan HKBP"
                    onChange={(e) => setVenueDraft((d) => ({ ...d, note: e.target.value }))}
                  />
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void addVenue()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-60"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-[#EFEDE8] p-3 space-y-2">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-brand" />
                <p className="text-[11px] font-bold">Kode sesi proyektor</p>
                <span className="ml-2 font-mono text-sm font-black tracking-[0.2em]">
                  {detail.session.accessCode || '—'}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void rotateCode()}
                  className="ml-auto text-[11px] font-bold text-brand disabled:opacity-60"
                >
                  Rotasi kode
                </button>
              </div>
              {(
                [
                  ['Peserta', links.peserta],
                  ['Layar proyektor', links.layar],
                  ['Control room', links.kontrol],
                ] as const
              ).map(([label, url]) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <span className="w-28 shrink-0 text-[#8C8880]">{label}</span>
                  <code className="flex-1 truncate text-[11px] text-[#1B1B1B]">{url}</code>
                  <button
                    type="button"
                    onClick={() => copy(url)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-brand"
                  >
                    <Copy className="w-3.5 h-3.5" /> Salin
                  </button>
                </div>
              ))}
              <a
                href={`/api/worship/sessions/${detail.session.id}/export.csv`}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-brand mt-1"
              >
                <Download className="w-3.5 h-3.5" /> Ekspor CSV (Likert + chip)
              </a>
            </div>
          </div>

          <div className={CARD}>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-brand" />
              <p className="text-sm font-black">Monitor hari-H</p>
              <span className="ml-auto text-xs text-[#8C8880] tabular-nums">
                {live?.progress.submitted ?? detail.progress.submitted}/{live?.progress.total ?? detail.progress.total}{' '}
                sudah mengisi
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(live?.rooms || detail.rooms).map((room) => (
                <div key={room.code} className="rounded-xl border border-[#EFEDE8] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#BDBAB2]">{room.floorLabel}</p>
                  <p className="text-sm font-bold mt-1">{room.label}</p>
                  <p className="text-[11px] text-[#8C8880] mt-1 tabular-nums">
                    {room.count}{(room.capacity || 0) > 0 ? `/${room.capacity}` : ''} peserta
                    {room.isFull ? ' · Penuh' : ''}
                  </p>
                </div>
              ))}
            </div>
            {(live?.wordcloud || detail.wordcloud).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {(live?.wordcloud || detail.wordcloud).map((w) => (
                  <span key={w.code} className="px-3 py-1.5 rounded-full bg-brand/10 text-brand text-xs font-bold">
                    {w.label} · {w.count}
                  </span>
                ))}
              </div>
            )}

            {(detail.notes || []).length > 0 && (
              <details className="mt-4 rounded-xl border border-[#EFEDE8] p-3">
                <summary className="text-xs font-bold cursor-pointer">
                  Catatan peserta ({new Set((detail.notes || []).map((n) => n.userId)).size} orang)
                </summary>
                <div className="mt-3 space-y-3 max-h-80 overflow-y-auto">
                  {[...new Set((detail.notes || []).map((n) => n.userId))].map((userId) => {
                    const rows = (detail.notes || []).filter((n) => n.userId === userId);
                    return (
                      <div key={userId} className="rounded-xl border border-[#EFEDE8] p-3">
                        <p className="text-xs font-bold">{rows[0]?.userName || userId}</p>
                        {rows.map((n) => (
                          <p key={`${n.userId}-${n.topicCode}`} className="text-[11px] text-[#8C8880] mt-1">
                            <span className="font-bold text-brand">{n.topicCode}</span> — {n.content}
                          </p>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </details>
            )}
          </div>

          <div className={CARD}>
            <p className="text-sm font-black">Pertanyaan Likert ({detail.likertItems.length})</p>
            <div className="mt-3 space-y-2">
              {detail.likertItems.map((item) => (
                <div key={item.id} className="rounded-xl border border-[#EFEDE8] p-3 flex items-start gap-2">
                  <div className="flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand">{item.topicCode}</p>
                    <p className="text-xs mt-1">{item.text}</p>
                    {item.gospelNote && <p className="text-[11px] text-[#8C8880] mt-1">{item.gospelNote}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteItem(item.id)}
                    className="p-1.5 rounded-lg text-[#8C8880] hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-[160px_1fr_auto] gap-2 items-start">
              <select
                className={INPUT}
                value={newItem.topicCode}
                onChange={(e) => setNewItem((n) => ({ ...n, topicCode: e.target.value }))}
              >
                <option value="">Topik…</option>
                {detail.session.config.topics.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label}
                  </option>
                ))}
              </select>
              <textarea
                className={INPUT}
                rows={2}
                placeholder="Teks pernyataan (skala 1–5)"
                value={newItem.text}
                onChange={(e) => setNewItem((n) => ({ ...n, text: e.target.value }))}
              />
              <button
                type="button"
                disabled={busy || !newItem.topicCode || !newItem.text.trim()}
                onClick={() => void addItem()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-xs font-bold disabled:opacity-60"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah
              </button>
            </div>
          </div>

          <div className={CARD}>
            <p className="text-sm font-black">Chip words ({detail.chips.length})</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {detail.chips.map((chip) => (
                <span
                  key={chip.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#D9D7D0] text-xs font-bold"
                >
                  {chip.label}
                  <button
                    type="button"
                    onClick={() => void deleteChip(chip.code)}
                    className="text-[#BDBAB2] hover:text-red-600"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-[160px_1fr_auto] gap-2">
              <select
                className={INPUT}
                value={newChip.topicCode}
                onChange={(e) => setNewChip((n) => ({ ...n, topicCode: e.target.value }))}
              >
                <option value="">Umum</option>
                {detail.session.config.topics.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label}
                  </option>
                ))}
              </select>
              <input
                className={INPUT}
                placeholder="#KataKunci"
                value={newChip.label}
                onChange={(e) => setNewChip((n) => ({ ...n, label: e.target.value }))}
              />
              <button
                type="button"
                disabled={busy || !newChip.label.trim()}
                onClick={() => void addChip()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-xs font-bold disabled:opacity-60"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah
              </button>
            </div>
          </div>

          {detail.session.pattern?.phases && detail.session.pattern.phases.length > 0 && (
            <div className={CARD}>
              <p className="text-sm font-black">Rundown pola — {detail.session.pattern.name}</p>
              <ol className="mt-3 space-y-2">
                {detail.session.pattern.phases.map((p, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-xl border border-[#EFEDE8] p-3">
                    <span className="w-6 h-6 rounded-full bg-brand/10 text-brand text-[11px] font-black flex items-center justify-center shrink-0">
                      {p.no ?? i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-xs font-bold">{p.title}</p>
                      <p className="text-[11px] text-[#8C8880]">
                        {[p.minutes ? `${p.minutes}'` : null, p.owner].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}

      {busy && (
        <p className="text-xs text-[#8C8880] inline-flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Memproses…
        </p>
      )}
    </div>
  );
};

export default MentoringControl;
