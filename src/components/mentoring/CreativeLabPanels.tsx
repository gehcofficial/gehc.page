import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Check, ImagePlus, Loader2, Save, Send, Trash2, Users } from 'lucide-react';
import type {
  SessionActivityBrief,
  SessionLabMine,
  SessionLabUpdate,
  SessionJarCard,
} from '../../lib/mentoring';

const CARD = 'bg-white rounded-2xl border border-[#D9D7D0]/60 p-4';
const INPUT = 'w-full rounded-xl border border-[#D9D7D0] bg-white px-3 py-2 text-sm focus:outline-none focus:border-brand';
const BTN = 'inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-60';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.readAsDataURL(file);
  });
}

function kindLabel(kind: string) {
  if (kind === 'POT') return 'Pot';
  if (kind === 'BAG') return 'Tas';
  if (kind === 'COMMIT') return 'Komitmen';
  if (kind === 'GROUP') return 'Foto bersama';
  return 'Catatan';
}

function timeLabel(iso: string | null) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/* ------------------------------- Reminder Jar ------------------------------- */

/**
 * Dua slot web untuk Reminder Jar. Semua 6 pertanyaan tetap ditulis di kertas;
 * peserta memilih 2 pertanyaan yang juga diketik di web. Server menolak >2.
 */
export const JarWebSlots: React.FC<{
  cards: SessionJarCard[];
  values: Record<string, string>;
  disabled?: boolean;
  onSave: (entries: { topicCode: string; content: string }[]) => Promise<void>;
}> = ({ cards, values, disabled, onSave }) => {
  const codes = useMemo(() => cards.map((c) => c.code), [cards]);
  const initial = useMemo(() => {
    const picked = codes.filter((code) => String(values[code] || '').trim()).slice(0, 2);
    return [0, 1].map((i) => {
      const code = picked[i] || null;
      return { code, answer: code ? String(values[code] || '') : '' };
    });
  }, [codes, values]);
  const [slots, setSlots] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const touched = useRef(false);

  useEffect(() => {
    if (!touched.current) setSlots(initial);
  }, [initial]);

  const setSlot = (index: number, patch: Partial<{ code: string | null; answer: string }>) => {
    touched.current = true;
    setSlots((prev) => prev.map((s, i) => {
      if (i !== index) return s;
      const next = { ...s, ...patch };
      if (patch.code !== undefined && patch.code !== s.code && patch.answer === undefined) {
        next.answer = patch.code ? String(values[patch.code] || '') : '';
      }
      return next;
    }));
  };

  const used = new Set(slots.map((s) => s.code).filter(Boolean) as string[]);
  const save = async () => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const selected = slots.filter((s) => s.code && String(s.answer || '').trim());
      if (!selected.length) throw new Error('Isi minimal satu jawaban dulu.');
      const entries: { topicCode: string; content: string }[] = selected.map((s) => ({
        topicCode: String(s.code),
        content: String(s.answer || '').trim(),
      }));
      // Hapus pilihan lama yang diganti agar server tetap maksimal 2.
      for (const code of codes) {
        if (String(values[code] || '').trim() && !selected.some((s) => s.code === code)) {
          entries.push({ topicCode: code, content: '' });
        }
      }
      await onSave(entries);
      touched.current = false;
      setMsg(selected.length >= 2 ? '2 jawaban web tersimpan.' : '1 jawaban tersimpan — pilih satu pertanyaan lagi.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  };

  if (!cards.length) return null;
  return (
    <div className={CARD}>
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-xl bg-brand/10 text-brand grid place-items-center shrink-0">
          <Send className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-black text-[#1B1B1B]">2 pertanyaan yang kamu tulis di web</h4>
          <p className="text-[11px] text-[#8C8880] mt-0.5 leading-relaxed">
            Tulis <b>semua 6 pertanyaan</b> di kertas. Di web, pilih <b>2 pertanyaan</b> dan isi jawabanmu.
          </p>
        </div>
        <span className="ml-auto shrink-0 text-[10px] font-black px-2 py-1 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] text-[#8C8880]">
          {slots.filter((s) => s.code && String(s.answer || '').trim()).length}/2
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {slots.map((slot, index) => {
          const card = cards.find((c) => c.code === slot.code);
          return (
            <div key={index} className="rounded-xl border border-[#EFEDE8] bg-[#FAF9F5] p-3 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-brand">Slot {index + 1}</p>
              <select
                value={slot.code || ''}
                disabled={disabled || busy}
                onChange={(e) => setSlot(index, { code: e.target.value || null })}
                className={INPUT}
              >
                <option value="">Pilih pertanyaan…</option>
                {cards.map((c) => (
                  <option key={c.code} value={c.code} disabled={used.has(c.code) && slot.code !== c.code}>
                    {c.title}
                  </option>
                ))}
              </select>
              {card?.direction && (
                <p className="text-[10px] text-[#8C8880] leading-relaxed"><b>Contoh:</b> {card.direction}</p>
              )}
              <textarea
                value={slot.answer}
                disabled={disabled || busy || !slot.code}
                onChange={(e) => setSlot(index, { answer: e.target.value })}
                rows={4}
                maxLength={4000}
                placeholder={slot.code ? 'Tulis jawabanmu di sini…' : 'Pilih pertanyaan dulu.'}
                className={`${INPUT} resize-y`}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button type="button" disabled={disabled || busy} onClick={() => void save()} className={`${BTN} bg-[#1B1B1B] text-white`}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Simpan 2 jawaban
        </button>
        {msg && <span className="text-[11px] text-emerald-700 font-bold">{msg}</span>}
      </div>
      {err && <p className="mt-2 text-[11px] text-red-600">{err}</p>}
      <details className="mt-3 rounded-xl border border-[#EFEDE8] bg-white p-3">
        <summary className="text-[11px] font-black text-[#8C8880] cursor-pointer">Lihat 6 pertanyaan untuk ditulis di kertas</summary>
        <ol className="mt-2 space-y-1.5">
          {cards.map((c, i) => (
            <li key={c.code} className="text-[11px] leading-relaxed">
              <b>{i + 1}. {c.title}</b>
              <span className="text-[#8C8880]"> — {c.direction}</span>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
};

/* ------------------------------ Karya kelompok ------------------------------ */

/**
 * POV peserta Activity 2. Perwakilan bisa update makna/progress/komitmen + foto
 * (2 Pot, 2 Tas, 1 foto bersama wajib). Anggota hanya melihat feed group sendiri.
 */
export const LabGroupPanel: React.FC<{
  slug: string;
  lab: SessionLabMine;
  brief: SessionActivityBrief;
  phase: string;
  onReload: () => void;
}> = ({ slug, lab, brief, phase, onReload }) => {
  const updates = lab?.updates || [];
  const canEdit = Boolean(lab?.isRep) && String(phase || '').toUpperCase() === 'A2';
  const latest = useCallback((kind: string) => updates.find((u) => u.kind === kind && (String(u.body || '').trim() || u.progress != null)) || null, [updates]);
  const photos = useCallback((kind: string) => updates.filter((u) => u.kind === kind && u.photoUrl).slice(0, 2), [updates]);
  const groupPhoto = useMemo(() => updates.find((u) => u.kind === 'GROUP' && u.photoUrl) || null, [updates]);
  const potPhotos = photos('POT');
  const bagPhotos = photos('BAG');
  const latestPot = latest('POT');
  const latestBag = latest('BAG');
  const latestCommit = latest('COMMIT');

  const [form, setForm] = useState({
    potBody: latestPot?.body || '',
    potProgress: latestPot?.progress == null ? 0 : Number(latestPot.progress),
    bagBody: latestBag?.body || '',
    bagProgress: latestBag?.progress == null ? 0 : Number(latestBag.progress),
    commit: latestCommit?.body || '',
  });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRefs = {
    POT: useRef<HTMLInputElement>(null),
    BAG: useRef<HTMLInputElement>(null),
    GROUP: useRef<HTMLInputElement>(null),
  };

  useEffect(() => {
    if (dirty) return;
    setForm({
      potBody: latestPot?.body || '',
      potProgress: latestPot?.progress == null ? 0 : Number(latestPot.progress),
      bagBody: latestBag?.body || '',
      bagProgress: latestBag?.progress == null ? 0 : Number(latestBag.progress),
      commit: latestCommit?.body || '',
    });
  }, [latestPot?.id, latestPot?.body, latestPot?.progress, latestBag?.id, latestBag?.body, latestBag?.progress, latestCommit?.id, latestCommit?.body, dirty]);

  const patchForm = (patch: Partial<typeof form>) => {
    setDirty(true);
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const postUpdate = async (kind: 'POT' | 'BAG' | 'COMMIT' | 'NOTE', body: string, progress?: number) => {
    const r = await fetch(`/api/worship/session/${encodeURIComponent(slug)}/lab/updates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ kind, body, progress }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || 'Gagal menyimpan update.');
    return d;
  };

  const saveOfficial = async () => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      if (String(form.potBody || '').trim() || form.potProgress > 0) {
        await postUpdate('POT', form.potBody, form.potProgress);
      }
      if (String(form.bagBody || '').trim() || form.bagProgress > 0) {
        await postUpdate('BAG', form.bagBody, form.bagProgress);
      }
      if (String(form.commit || '').trim()) {
        await postUpdate('COMMIT', form.commit);
      }
      setDirty(false);
      setMsg('Update kelompok tersimpan.');
      onReload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setBusy(false);
    }
  };

  const uploadPhoto = async (kind: 'POT' | 'BAG' | 'GROUP', file: File | undefined) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setErr('Foto terlalu besar (maks 15MB).');
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const data = await fileToDataUrl(file);
      const r = await fetch(`/api/worship/session/${encodeURIComponent(slug)}/lab/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ kind, filename: file.name, mimetype: file.type, data }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Gagal mengunggah foto.');
      setMsg(kind === 'GROUP' ? 'Foto bersama tersimpan.' : `Foto ${kindLabel(kind)} tersimpan.`);
      onReload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal mengunggah foto.');
    } finally {
      setBusy(false);
      const ref = fileRefs[kind].current;
      if (ref) ref.value = '';
    }
  };

  const removeUpdate = async (row: SessionLabUpdate) => {
    if (!window.confirm('Hapus item ini?')) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/worship/session/${encodeURIComponent(slug)}/lab/updates/${encodeURIComponent(row.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Gagal menghapus.');
      onReload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menghapus.');
    } finally {
      setBusy(false);
    }
  };

  const markDone = async () => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch(`/api/worship/session/${encodeURIComponent(slug)}/lab/done`, {
        method: 'POST',
        credentials: 'include',
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Gagal menandai selesai.');
      setMsg('Laporan kelompok ditandai selesai.');
      onReload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menandai selesai.');
    } finally {
      setBusy(false);
    }
  };

  if (!lab?.teamIndex && lab?.teamIndex !== 0) {
    return (
      <div className={CARD}>
        <h4 className="text-sm font-black text-[#1B1B1B]">Karya kelompok</h4>
        <p className="text-[11px] text-[#8C8880] mt-1 leading-relaxed">
          Kamu belum terdaftar di kelompok Creative Lab. Hubungi Admin di meja kontrol untuk dimasukkan ke kelompok dan ditunjuk sebagai perwakilan.
        </p>
      </div>
    );
  }

  const photoSlot = (kind: 'POT' | 'BAG' | 'GROUP', rows: SessionLabUpdate[], limit: number, label: string) => (
    <div className="rounded-xl border border-[#EFEDE8] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-black text-[#1B1B1B]">{label}</p>
        <span className="text-[10px] font-bold text-[#8C8880]">{rows.length}/{limit}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {rows.map((row) => (
          <div key={row.id} className="relative rounded-lg overflow-hidden border border-[#EFEDE8] bg-[#FAF9F5]">
            <img src={row.thumbUrl || row.photoUrl || ''} alt={label} className="w-full h-24 object-cover" />
            <button
              type="button"
              disabled={busy}
              onClick={() => void removeUpdate(row)}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white grid place-items-center"
              title="Hapus foto"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        {rows.length < limit && (
          <button
            type="button"
            disabled={busy || !canEdit}
            onClick={() => fileRefs[kind].current?.click()}
            className="h-24 rounded-lg border-2 border-dashed border-[#D9D7D0] text-[#8C8880] grid place-items-center text-[10px] font-bold disabled:opacity-50"
          >
            <span className="inline-flex flex-col items-center gap-1"><ImagePlus className="w-4 h-4" /> Upload</span>
          </button>
        )}
      </div>
      <input
        ref={fileRefs[kind]}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void uploadPhoto(kind, e.target.files?.[0])}
      />
    </div>
  );

  const feed = updates.filter((u) => u.kind === 'NOTE' || u.kind === 'POT' || u.kind === 'BAG' || u.kind === 'COMMIT').slice(0, 12);

  return (
    <div className={CARD}>
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 grid place-items-center shrink-0">
          <Users className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-black text-[#1B1B1B]">Karya kelompok — {lab.teamName}</h4>
          <p className="text-[11px] text-[#8C8880] mt-0.5">
            {lab.isRep ? 'Kamu perwakilan kelompok. Update makna, progress, komitmen, dan foto karya di sini.' : 'Kamu anggota kelompok. Update dari rekan group hanya terlihat di kelompokmu.'}
          </p>
        </div>
        <span className={`ml-auto shrink-0 text-[10px] font-black px-2 py-1 rounded-full ${lab.done ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {lab.done ? 'SELESAI' : 'PROSES'}
        </span>
      </div>

      {brief && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5">
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Pot — Grow What You Believe</p>
            <p className="text-[11px] leading-relaxed mt-1">{brief.a2.potMeaning}</p>
            <p className="text-[10px] text-emerald-800/70 mt-1.5"><b>Refleksi:</b> {brief.a2.pot}</p>
          </div>
          <div className="rounded-xl bg-brand/5 border border-brand/20 px-3 py-2.5">
            <p className="text-[10px] font-black uppercase tracking-wider text-brand">Tas — Carry The Gospel</p>
            <p className="text-[11px] leading-relaxed mt-1">{brief.a2.bagMeaning}</p>
            <p className="text-[10px] text-brand/80 mt-1.5"><b>Refleksi:</b> {brief.a2.bag}</p>
          </div>
        </div>
      )}

      {canEdit ? (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#EFEDE8] p-3 space-y-2">
              <p className="text-[11px] font-black text-emerald-700">Pot</p>
              <textarea
                value={form.potBody}
                onChange={(e) => patchForm({ potBody: e.target.value })}
                rows={3}
                maxLength={2000}
                placeholder="Makna / apa yang perlu dirawat agar iman bertumbuh…"
                className={`${INPUT} resize-y`}
              />
              <label className="block text-[10px] font-bold text-[#8C8880]">
                Progress: {form.potProgress}%
                <input type="range" min={0} max={100} step={5} value={form.potProgress} onChange={(e) => patchForm({ potProgress: Number(e.target.value) })} className="w-full accent-emerald-600" />
              </label>
            </div>
            <div className="rounded-xl border border-[#EFEDE8] p-3 space-y-2">
              <p className="text-[11px] font-black text-brand">Tas</p>
              <textarea
                value={form.bagBody}
                onChange={(e) => patchForm({ bagBody: e.target.value })}
                rows={3}
                maxLength={2000}
                placeholder="Nilai Injil yang ingin dibawa ke kehidupan sehari-hari…"
                className={`${INPUT} resize-y`}
              />
              <label className="block text-[10px] font-bold text-[#8C8880]">
                Progress: {form.bagProgress}%
                <input type="range" min={0} max={100} step={5} value={form.bagProgress} onChange={(e) => patchForm({ bagProgress: Number(e.target.value) })} className="w-full accent-brand" />
              </label>
            </div>
          </div>
          <label className="block text-[10px] font-bold text-[#8C8880]">
            Komitmen kelompok (1 kata / simbol / kalimat)
            <input
              value={form.commit}
              onChange={(e) => patchForm({ commit: e.target.value })}
              maxLength={500}
              placeholder="Contoh: Tumbuh — akar di Kristus, buah di kampus."
              className={`${INPUT} mt-1`}
            />
          </label>
          <button type="button" disabled={busy} onClick={() => void saveOfficial()} className={`${BTN} bg-[#1B1B1B] text-white`}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Simpan makna & progress
          </button>

          <div className="grid gap-2 sm:grid-cols-3">
            {photoSlot('POT', potPhotos, 2, 'Foto Pot')}
            {photoSlot('BAG', bagPhotos, 2, 'Foto Tas')}
            {photoSlot('GROUP', groupPhoto ? [groupPhoto] : [], 1, 'Foto bersama (wajib)')}
          </div>
          <p className="text-[10px] text-[#8C8880] leading-relaxed">
            <b>Wajib:</b> 1 foto bersama seluruh anggota kelompok + hasil karya Pot/Tas. Maksimal 2 foto Pot, 2 foto Tas, dan 1 foto bersama.
          </p>
          <button
            type="button"
            disabled={busy || !groupPhoto || lab.done}
            onClick={() => void markDone()}
            className={`${BTN} bg-emerald-600 text-white`}
          >
            <Check className="w-3.5 h-3.5" /> {lab.done ? 'Sudah lapor selesai' : 'Lapor selesai ke Admin'}
          </button>
          {!groupPhoto && <p className="text-[10px] text-amber-700">Foto bersama belum ada — tombol lapor selesai terkunci.</p>}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Pot · progress {latestPot?.progress ?? 0}%</p>
              <p className="text-[11px] mt-1">{latestPot?.body || 'Belum ada update makna.'}</p>
            </div>
            <div className="rounded-xl bg-brand/5 border border-brand/20 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-brand">Tas · progress {latestBag?.progress ?? 0}%</p>
              <p className="text-[11px] mt-1">{latestBag?.body || 'Belum ada update makna.'}</p>
            </div>
          </div>
          <div className="rounded-xl border border-[#EFEDE8] p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">Komitmen kelompok</p>
            <p className="text-xs font-black mt-1">{latestCommit?.body || 'Belum diisi.'}</p>
          </div>
        </div>
      )}

      {(potPhotos.length > 0 || bagPhotos.length > 0 || groupPhoto) && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {potPhotos.map((p) => <img key={p.id} src={p.thumbUrl || p.photoUrl || ''} alt="Pot" className="rounded-xl border border-[#EFEDE8] h-28 w-full object-cover" />)}
          {bagPhotos.map((p) => <img key={p.id} src={p.thumbUrl || p.photoUrl || ''} alt="Tas" className="rounded-xl border border-[#EFEDE8] h-28 w-full object-cover" />)}
          {groupPhoto && <img src={groupPhoto.thumbUrl || groupPhoto.photoUrl || ''} alt="Foto bersama" className="rounded-xl border border-emerald-200 h-28 w-full object-cover" />}
        </div>
      )}

      <div className="mt-3">
        <p className="text-[11px] font-black text-[#8C8880]">Update group</p>
        {feed.length === 0 ? (
          <p className="text-[11px] text-[#8C8880] italic mt-1">Belum ada update. Perwakilan akan melapor ke Admin.</p>
        ) : (
          <div className="mt-1.5 space-y-1.5">
            {feed.map((u) => (
              <div key={u.id} className="rounded-xl bg-[#FAF9F5] border border-[#EFEDE8] px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-white border border-[#D9D7D0] text-[#8C8880]">{kindLabel(u.kind)}</span>
                  <span className="text-[10px] font-bold truncate">{u.userName || 'Peserta'}</span>
                  <span className="ml-auto text-[9px] text-[#8C8880]">{timeLabel(u.createdAt)}</span>
                </div>
                {u.body && <p className="text-[11px] mt-1 leading-relaxed whitespace-pre-wrap">{u.body}</p>}
                {u.progress != null && <p className="text-[10px] text-[#8C8880] mt-0.5">Progress {u.progress}%</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {msg && <p className="mt-2 text-[11px] text-emerald-700 font-bold">{msg}</p>}
      {err && <p className="mt-2 text-[11px] text-red-600">{err}</p>}
    </div>
  );
};
