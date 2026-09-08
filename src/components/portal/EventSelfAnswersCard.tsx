import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { answersByQuestionKey, isQuestionVisible, type EventQuestion } from '../../lib/event-questions';
import { EventQuestionFields } from './EventQuestionFields';

function formatAnswer(v: unknown) {
  if (v === true) return 'Ya';
  if (v === false) return 'Tidak';
  if (Array.isArray(v)) return v.map(String).join(', ') || '—';
  if (v == null || v === '') return '—';
  return String(v);
}

export const EventSelfAnswersCard: React.FC<{ eventId: string }> = ({ eventId }) => {
  const [questions, setQuestions] = useState<EventQuestion[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [qs, ans] = await Promise.all([
        fetch(`/api/events/${encodeURIComponent(eventId)}/questions`, { credentials: 'include' }).then((r) => r.json()),
        fetch(`/api/me/events/${encodeURIComponent(eventId)}/answers`, { credentials: 'include' }).then((r) => r.json()),
      ]);
      const list: EventQuestion[] = qs.questions || [];
      setQuestions(list);
      // Buang jawaban basi (soal arsip/dilepas) agar tak ikut terkirim & memicu 400.
      const known = new Set(list.map((q) => q.id));
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries((ans.answers || {}) as Record<string, unknown>)) {
        if (known.has(k)) clean[k] = v;
      }
      setValues(clean);
    } catch {
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const byKey = answersByQuestionKey(questions, values);
    return questions.filter((q) => isQuestionVisible(q, byKey));
  }, [questions, values]);

  // Simpan 2 langkah: isi → periksa ringkasan (konfirmasi) → tersimpan.
  // Form tetap bisa dibuka lagi untuk edit jawaban kapan saja.
  // Hanya kirim ID soal yang dikenal event ini (anti jawaban basi).
  const save = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const known = new Set(questions.map((q) => q.id));
      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(values)) {
        if (known.has(k)) payload[k] = v;
      }
      const res = await fetch(`/api/me/events/${encodeURIComponent(eventId)}/answers`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: payload }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Gagal menyimpan.');
      setSaved(true);
      setConfirming(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;
  if (!questions.length) return null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        setConfirming(true);
      }}
      className="rounded-[28px] border border-[#D9D7D0]/60 bg-white p-6 space-y-4"
    >
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">Data untuk panitia</p>
        <p className="text-xs text-[#8C8880] mt-1 leading-relaxed">
          Opsional — panitia juga bisa mengisi dari meja. Boleh dilengkapi kapan saja.
        </p>
      </div>
      <EventQuestionFields
        questions={visible}
        values={values}
        onChange={(id, value) => {
          setValues((d) => ({ ...d, [id]: value }));
          setSaved(false);
          setConfirming(false);
        }}
        disabled={saving}
      />
      {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
      {saved && (
        <p className="text-xs text-emerald-700 font-semibold">
          Tersimpan. Untuk mengubah jawaban, ubah isian di atas lalu Simpan lagi.
        </p>
      )}
      {confirming ? (
        <div className="rounded-2xl border border-[#181818]/20 bg-[#FAF9F5] p-4 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">
            Periksa dulu sebelum simpan
          </p>
          <ul className="space-y-1">
            {visible.map((q) => (
              <li key={q.id} className="text-xs text-[#1B1B1B]">
                <span className="font-bold">{q.label}:</span>{' '}
                <span className="text-[#5C5850]">{formatAnswer(values[q.id])}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={saving}
              className="px-4 py-2 rounded-full border border-[#D9D7D0] text-[10px] font-black uppercase tracking-wider disabled:opacity-50"
            >
              Kembali
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="px-4 py-2 rounded-full bg-[#181818] text-white text-[10px] font-black uppercase tracking-wider disabled:opacity-50"
            >
              {saving ? 'Menyimpan…' : 'Ya, simpan jawaban'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-full bg-[#181818] text-white text-[10px] font-black uppercase tracking-wider disabled:opacity-50"
        >
          {saving ? 'Menyimpan…' : Object.keys(values).length ? 'Simpan perubahan' : 'Simpan'}
        </button>
      )}
    </form>
  );
};
