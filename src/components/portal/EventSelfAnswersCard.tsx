import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { answersByQuestionKey, isQuestionVisible, type EventQuestion } from '../../lib/event-questions';
import { EventQuestionFields } from './EventQuestionFields';

export const EventSelfAnswersCard: React.FC<{ eventId: string }> = ({ eventId }) => {
  const [questions, setQuestions] = useState<EventQuestion[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [qs, ans] = await Promise.all([
        fetch(`/api/events/${encodeURIComponent(eventId)}/questions`, { credentials: 'include' }).then((r) => r.json()),
        fetch(`/api/me/events/${encodeURIComponent(eventId)}/answers`, { credentials: 'include' }).then((r) => r.json()),
      ]);
      setQuestions(qs.questions || []);
      setValues(ans.answers || {});
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

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch(`/api/me/events/${encodeURIComponent(eventId)}/answers`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: values }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Gagal menyimpan.');
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;
  if (!questions.length) return null;

  return (
    <form onSubmit={save} className="rounded-[28px] border border-[#D9D7D0]/60 bg-white p-6 space-y-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880]">Data untuk panitia</p>
        <p className="text-xs text-[#8C8880] mt-1 leading-relaxed">
          Opsional — panitia juga bisa mengisi dari meja. Boleh dilengkapi kapan saja.
        </p>
      </div>
      <EventQuestionFields
        questions={visible}
        values={values}
        onChange={(id, value) => setValues((d) => ({ ...d, [id]: value }))}
        disabled={saving}
      />
      {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
      {saved && <p className="text-xs text-emerald-700 font-semibold">Tersimpan.</p>}
      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 rounded-full bg-[#181818] text-white text-[10px] font-black uppercase tracking-wider disabled:opacity-50"
      >
        {saving ? 'Menyimpan…' : 'Simpan'}
      </button>
    </form>
  );
};
