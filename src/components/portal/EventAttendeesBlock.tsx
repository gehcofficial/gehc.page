import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { asalFromOrigin } from '../../lib/origin';
import { answersByQuestionKey, isQuestionVisible, type EventQuestion } from '../../lib/event-questions';
import { EventQuestionFields } from './EventQuestionFields';
import { useApp } from '../../context/AppContext';

type AttendeeRow = {
  id: string;
  userId: string;
  user?: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    gender?: string | null;
    origin?: string | null;
    domicileKind?: string | null;
  };
};

export const EventAttendeesBlock: React.FC<{ eventId: string; slug: string }> = ({ eventId, slug }) => {
  const { addToast } = useApp();
  const [rows, setRows] = useState<AttendeeRow[]>([]);
  const [questions, setQuestions] = useState<EventQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, Record<string, unknown>>>({});
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [att, qs, ans] = await Promise.all([
        fetch(`/api/events/${encodeURIComponent(slug)}/attendees`, { credentials: 'include' }).then((r) => r.json()),
        fetch(`/api/events/${encodeURIComponent(eventId)}/questions`, { credentials: 'include' }).then((r) => r.json()),
        fetch(`/api/events/${encodeURIComponent(eventId)}/answers`, { credentials: 'include' }).then((r) => r.json()).catch(() => ({ answers: [] })),
      ]);
      setRows(att.attendees || []);
      setQuestions(qs.questions || []);
      const byUser: Record<string, Record<string, unknown>> = {};
      for (const a of ans.answers || []) {
        if (!byUser[a.userId]) byUser[a.userId] = {};
        byUser[a.userId][a.questionId] = a.value;
      }
      setAnswers(byUser);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [eventId, slug]);

  useEffect(() => { load(); }, [load]);

  const openRow = (userId: string) => {
    setOpenId((cur) => (cur === userId ? null : userId));
    setDraft(answers[userId] || {});
  };

  const visible = useMemo(() => {
    const byKey = answersByQuestionKey(questions, draft);
    return questions.filter((q) => isQuestionVisible(q, byKey));
  }, [questions, draft]);

  const saveRow = async (userId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/answers/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: draft }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Gagal menyimpan.');
      setAnswers((prev) => ({ ...prev, [userId]: { ...draft } }));
      addToast({ type: 'success', title: 'Jawaban disimpan' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Gagal menyimpan jawaban', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-black text-[#1B1B1B]">Kehadiran Event ({rows.length})</h3>
        <a
          href={`/api/events/${encodeURIComponent(eventId)}/answers/export`}
          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#8C8880] hover:text-[#1B1B1B]"
        >
          <Download className="w-3.5 h-3.5" /> CSV
        </a>
      </div>
      {loading ? (
        <p className="text-xs text-[#8C8880] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-[#8C8880]">Belum ada peserta dengan akun terhubung.</p>
      ) : (
        <div className="rounded-2xl border border-[#D9D7D0] bg-white divide-y divide-[#D9D7D0]/60 max-h-[28rem] overflow-y-auto">
          {rows.map((row) => {
            const uid = row.user?.id || row.userId;
            const asal = asalFromOrigin(row.user?.origin);
            const open = openId === uid;
            return (
              <div key={row.id} className="px-4 py-2.5 text-xs">
                <button type="button" className="w-full text-left" onClick={() => openRow(uid)}>
                  <p className="font-bold text-[#1B1B1B]">{row.user?.name || '—'}</p>
                  <p className="text-[#8C8880]">
                    {row.user?.email}{row.user?.phone ? ` · ${row.user.phone}` : ''}
                    {' · '}
                    {asal.asalRegion === 'KOSONG' ? 'Asal belum diisi' : `${asal.asalRegion === 'SULUT' ? 'Sulut' : 'Luar Sulut'}${asal.asalPlace ? ` · ${asal.asalPlace}` : ''}`}
                  </p>
                </button>
                {open && questions.length > 0 && (
                  <div className="mt-3 space-y-3">
                    <EventQuestionFields
                      questions={visible}
                      values={draft}
                      onChange={(id, value) => setDraft((d) => ({ ...d, [id]: value }))}
                      disabled={saving}
                    />
                    <button
                      type="button"
                      onClick={() => saveRow(uid)}
                      disabled={saving}
                      className="text-[10px] px-3 py-1.5 rounded-lg bg-[#181818] text-white font-bold disabled:opacity-40"
                    >
                      {saving ? 'Menyimpan…' : 'Simpan jawaban'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
