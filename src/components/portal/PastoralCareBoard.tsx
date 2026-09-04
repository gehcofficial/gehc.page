import React, { useCallback, useEffect, useState } from 'react';
import { HeartHandshake } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DriveUploadButton } from './DriveUploadButton';

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
  subject?: { id: string; name: string; avatar?: string | null };
  reporter?: { id: string; name: string };
};

export const PastoralCareBoard: React.FC = () => {
  const { addToast } = useApp();
  const [notes, setNotes] = useState<Note[]>([]);
  const [q, setQ] = useState('');
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [subjectUserId, setSubjectUserId] = useState('');
  const [kind, setKind] = useState('SAKIT');
  const [note, setNote] = useState('');
  const [visitPhoto, setVisitPhoto] = useState<{
    data: string;
    mimetype: string;
    filename: string;
  } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/pastoral-care', { credentials: 'include' });
    const d = await r.json();
    setNotes(d.notes || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setPeople([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/pastoral-care/people?q=${encodeURIComponent(q)}`, { credentials: 'include' });
      const d = await r.json();
      setPeople(d.people || []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const submit = async () => {
    if (!subjectUserId || !note.trim()) return;
    const r = await fetch('/api/pastoral-care', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjectUserId,
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
    setQ('');
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
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama jemaat…"
          className="w-full px-3 py-2 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs"
        />
        {people.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {people.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSubjectUserId(p.id);
                  setQ(p.name);
                  setPeople([]);
                }}
                className={`px-2 py-1 rounded-full text-[11px] font-bold ${
                  subjectUserId === p.id ? 'bg-[#181818] text-white' : 'bg-[#F3F1EC]'
                }`}
              >
                {p.name}
              </button>
            ))}
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
              onFile={async (payload) => setVisitPhoto(payload)}
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
