import React, { useCallback, useEffect, useState } from 'react';
import { HeartHandshake } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DriveUploadButton } from './DriveUploadButton';
import { SearchableSelect } from '../ui/SearchableSelect';
import type { SearchableOption } from '../../lib/searchable-options';

const KINDS = [
  { id: 'SAKIT', label: 'Sakit' },
  { id: 'DUKA', label: 'Duka' },
  { id: 'YUDISIUM', label: 'Yudisium' },
  { id: 'WISUDA', label: 'Wisuda' },
  { id: 'KERJA', label: 'Kerja / pindah' },
  { id: 'LAINNYA', label: 'Lainnya' },
];

type Note = {
  id: string;
  kind: string;
  note: string;
  status: string;
  expiresAt?: string;
  subjectName?: string | null;
  subject?: { id: string | null; name: string; avatar?: string | null };
  reporter?: { id: string; name: string };
};

export const PastoralCareBoard: React.FC = () => {
  const { addToast, groups } = useApp();
  const [notes, setNotes] = useState<Note[]>([]);
  const [filterGroupId, setFilterGroupId] = useState('');
  const [subjectUserId, setSubjectUserId] = useState('');
  const [subjectLabel, setSubjectLabel] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [kind, setKind] = useState('SAKIT');
  const [note, setNote] = useState('');
  const [visitPhoto, setVisitPhoto] = useState<{
    data: string;
    mimetype: string;
    filename: string;
  } | null>(null);

  const load = useCallback(async () => {
    const url = filterGroupId
      ? `/api/pastoral-care?groupId=${encodeURIComponent(filterGroupId)}`
      : '/api/pastoral-care';
    const r = await fetch(url, { credentials: 'include' });
    const d = await r.json();
    setNotes(d.notes || []);
  }, [filterGroupId]);

  useEffect(() => {
    load();
  }, [load]);

  const searchPeople = useCallback(async (query: string): Promise<SearchableOption[]> => {
    const url = `/api/pastoral-care/people?q=${encodeURIComponent(query)}${filterGroupId ? `&groupId=${encodeURIComponent(filterGroupId)}` : ''}`;
    const r = await fetch(url, { credentials: 'include' });
    const d = await r.json().catch(() => ({}));
    return (d.people || []).map((p: { id: string; name: string }) => ({ value: p.id, label: p.name }));
  }, [filterGroupId]);

  const submit = async () => {
    if (!subjectUserId && !subjectName.trim()) {
      addToast({ type: 'error', title: 'Pilih jemaat atau tulis nama manual dulu.' });
      return;
    }
    if (!note.trim()) {
      addToast({ type: 'error', title: 'Tulis catatan doa dulu sebelum kirim.' });
      return;
    }
    const r = await fetch('/api/pastoral-care', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(subjectUserId ? { subjectUserId } : { subjectName: subjectName.trim() }),
        kind,
        note: note.trim(),
        ...(kind === 'SAKIT' || kind === 'DUKA' ? visitPhoto || {} : {}),
      }),
    });
    const d = await r.json();
    if (!r.ok) {
      addToast({ type: 'error', title: d.error || 'Gagal menyimpan' });
      return;
    }
    setNote('');
    setSubjectUserId('');
    setSubjectLabel('');
    setSubjectName('');
    setManualMode(false);
    setVisitPhoto(null);
    addToast({ type: 'success', title: 'Tercatat di Portal Doa (privat)' });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#D9D7D0]/60 bg-white p-4 space-y-2">
        <p className="text-xs font-bold flex items-center gap-1.5">
          <HeartHandshake className="w-4 h-4 text-[#EA580C]" />
          Laporkan kabar penggembalaan (bukan ubah profil orang lain)
        </p>
        {!manualMode ? (
          <SearchableSelect
            value={subjectUserId}
            selectedLabel={subjectLabel}
            onSearch={searchPeople}
            onChange={(value, option) => {
              setSubjectUserId(value);
              setSubjectLabel(option?.label || '');
              if (value) setSubjectName('');
            }}
            placeholder="Cari nama jemaat…"
            emptyHint="Tidak ketemu? Pakai nama manual di bawah."
            minQuery={2}
          />
        ) : null}
        {!subjectUserId && (
          <div className="space-y-1.5">
            <input
              value={subjectName}
              onChange={(e) => {
                setSubjectName(e.target.value);
                setManualMode(e.target.value.trim().length > 0);
              }}
              placeholder="Atau pakai nama ini (belum terdaftar)…"
              className="w-full px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs"
            />
            {manualMode && (
              <button
                type="button"
                onClick={() => { setSubjectName(''); setManualMode(false); }}
                className="text-[11px] font-bold text-[#8C8880] underline"
              >
                Kembali cari jemaat terdaftar
              </button>
            )}
          </div>
        )}
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs"
        >
          {KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Catatan singkat untuk doa — tanpa diagnosis."
          className="w-full px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs"
        />
        {(kind === 'SAKIT' || kind === 'DUKA') && (
          <div className="pt-1">
            <p className="text-[10px] text-[#8C8880] mb-1">Foto kunjungan Diakonia (privat, bukan landing)</p>
            <DriveUploadButton
              label={visitPhoto ? 'Foto kunjungan siap' : 'Lampirkan foto kunjungan'}
              hasFile={Boolean(visitPhoto)}
              onFile={async (payload) => setVisitPhoto(payload)}
              onClear={() => setVisitPhoto(null)}
            />
          </div>
        )}
        <button
          type="button"
          onClick={submit}
          className="px-3 py-1.5 rounded-full bg-[#181818] text-white text-[11px] font-bold"
        >
          Kirim ke Portal Doa
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[11px] font-bold uppercase tracking-wider text-[#8C8880]">Filter grup</label>
        <select
          value={filterGroupId}
          onChange={(e) => { setFilterGroupId(e.target.value); setSubjectUserId(''); setSubjectLabel(''); setSubjectName(''); }}
          className="px-3 py-1.5 rounded-xl bg-white border border-[#D9D7D0] text-xs font-semibold"
        >
          <option value="">Semua kelompok</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        {filterGroupId && <span className="text-[10px] text-[#8C8880]">Menampilkan catatan anggota kelompok ini</span>}
      </div>

      <div className="space-y-2">
        {notes.length === 0 ? (
          <p className="text-xs text-[#8C8880]">Tidak ada catatan terbuka yang boleh kamu lihat.</p>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="rounded-2xl border border-[#D9D7D0]/50 bg-white p-3 text-xs">
              <div className="flex justify-between gap-2">
                <span className="font-bold">{n.subject?.name}</span>
                <span className="text-[10px] font-bold uppercase text-[#EA580C]">{n.kind}</span>
              </div>
              <p className="mt-1 text-[#5C5850]">{n.note}</p>
              <p className="mt-1 text-[10px] text-[#8C8880]">Dari {n.reporter?.name}</p>
              <button
                type="button"
                onClick={async () => {
                  await fetch(`/api/pastoral-care/${n.id}/resolve`, { method: 'PATCH', credentials: 'include' });
                  load();
                }}
                className="mt-2 text-[11px] font-bold"
              >
                Tandai selesai
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
