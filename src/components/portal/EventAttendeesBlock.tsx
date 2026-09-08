import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { asalFromOrigin } from '../../lib/origin';
import { answersByQuestionKey, isQuestionVisible, type EventQuestion } from '../../lib/event-questions';
import { EventQuestionFields } from './EventQuestionFields';
import { useApp } from '../../context/AppContext';
import { useListPager } from './ListPager';
import { useLang } from '../../context/LangContext';

type RegistrationRow = {
  id: string;
  userId: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  origin?: string | null;
  status: string;
  statusLabel: string;
  hasAccount: boolean;
};

type Summary = { total: number; withAccount: number; counterOnly: number };
type Source = 'waiting_pool' | 'event_attendee';
type ListFilter = 'all' | 'account' | 'counter';

const STATUS_CLASS: Record<string, string> = {
  REGISTERED: 'bg-amber-50 text-amber-800 border-amber-100',
  WAITING_POOL: 'bg-blue-50 text-blue-700 border-blue-100',
  PROFILE_COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  ROLE_ASSIGNED: 'bg-[#FAF9F5] text-[#8C8880] border-[#D9D7D0]',
  ATTENDEE: 'bg-[#FAF9F5] text-[#8C8880] border-[#D9D7D0]',
};

export const EventAttendeesBlock: React.FC<{ eventId: string; slug: string }> = ({ eventId, slug }) => {
  const { addToast } = useApp();
  const { t } = useLang();
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [source, setSource] = useState<Source>('event_attendee');
  const [filter, setFilter] = useState<ListFilter>('all');
  const [questions, setQuestions] = useState<EventQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, Record<string, unknown>>>({});
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const visibleRows = useMemo(() => {
    if (filter === 'account') return rows.filter((r) => r.hasAccount);
    if (filter === 'counter') return rows.filter((r) => !r.hasAccount);
    return rows;
  }, [rows, filter]);

  const { pageItems: pagedRows, pager: attendeePager } = useListPager<RegistrationRow>(visibleRows);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [regRes, qs, ans] = await Promise.all([
        fetch(`/api/events/${encodeURIComponent(slug)}/registrations`, { credentials: 'include' }),
        fetch(`/api/events/${encodeURIComponent(eventId)}/questions`, { credentials: 'include' }).then((r) => r.json()),
        fetch(`/api/events/${encodeURIComponent(eventId)}/answers`, { credentials: 'include' }).then((r) => r.json()).catch(() => ({ answers: [] })),
      ]);
      const reg = await regRes.json();
      if (!regRes.ok) throw new Error(reg.error || 'Gagal memuat pendaftar.');
      setRows(reg.registrations || []);
      setSummary(reg.summary || null);
      setSource(reg.source === 'waiting_pool' ? 'waiting_pool' : 'event_attendee');
      setQuestions(qs.questions || []);
      const byUser: Record<string, Record<string, unknown>> = {};
      for (const a of ans.answers || []) {
        if (!byUser[a.userId]) byUser[a.userId] = {};
        byUser[a.userId][a.questionId] = a.value;
      }
      setAnswers(byUser);
    } catch (err: any) {
      setRows([]);
      setSummary(null);
      setError(err?.message || 'Gagal memuat pendaftar.');
    } finally {
      setLoading(false);
    }
  }, [eventId, slug]);

  useEffect(() => { load(); }, [load]);

  const openRow = (userId: string | null) => {
    if (!userId) return;
    setOpenId((cur) => (cur === userId ? null : userId));
    // Buang jawaban basi (soal arsip/dilepas) agar tak ikut terkirim & memicu 400.
    const known = new Set(questions.map((q) => q.id));
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(answers[userId] || {})) {
      if (known.has(k)) clean[k] = v;
    }
    setDraft(clean);
  };

  const visible = useMemo(() => {
    const byKey = answersByQuestionKey(questions, draft);
    return questions.filter((q) => isQuestionVisible(q, byKey));
  }, [questions, draft]);

  const saveRow = async (userId: string) => {
    const known = new Set(questions.map((q) => q.id));
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(draft)) {
      if (known.has(k)) payload[k] = v;
    }
    const summary = visible
      .map((q) => {
        const v = draft[q.id];
        const text = v === true ? 'Ya' : v === false ? 'Tidak' : Array.isArray(v) ? v.join(', ') : String(v ?? '—');
        return `• ${q.label}: ${text}`;
      })
      .join('\n');
    if (!window.confirm(`Simpan jawaban berikut?\n\n${summary || '(kosong)'}`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/answers/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: payload }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Gagal menyimpan.');
      setAnswers((prev) => ({ ...prev, [userId]: { ...payload } }));
      addToast({ type: 'success', title: 'Jawaban disimpan' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Gagal menyimpan jawaban', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const isPool = source === 'waiting_pool';
  const titleCount = summary?.total ?? rows.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-black text-[#1B1B1B]">
          {isPool ? `Pendaftar Event (${titleCount})` : `Kehadiran Event (${titleCount})`}
        </h3>
        <div className="flex items-center gap-3">
          <a
            href={`/api/events/${encodeURIComponent(slug)}/registrations/export`}
            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#8C8880] hover:text-[#1B1B1B]"
          >
            <Download className="w-3.5 h-3.5" /> CSV pendaftar
          </a>
          <a
            href={`/api/events/${encodeURIComponent(eventId)}/answers/export`}
            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#8C8880] hover:text-[#1B1B1B]"
          >
            <Download className="w-3.5 h-3.5" /> CSV jawaban
          </a>
        </div>
      </div>
      {isPool && (
        <p className="text-[11px] text-[#8C8880] leading-relaxed">
          Angka ini sama dengan “peserta terdaftar” di halaman QR. Termasuk daftar counter (nama & WhatsApp) yang belum login Google — bukan absensi hari H (itu di Divisi → Koinonia → Check-in).
        </p>
      )}
      {isPool && summary && (
        <div className="flex flex-wrap gap-2">
          {([
            ['all', `Semua (${summary.total})`],
            ['account', `Punya akun (${summary.withAccount})`],
            ['counter', `Counter saja (${summary.counterOnly})`],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`px-3 py-1 rounded-full text-[10px] font-bold border ${
                filter === id ? 'bg-[#181818] text-white border-[#181818]' : 'bg-white text-[#8C8880] border-[#D9D7D0]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {loading ? (
        <p className="text-xs text-[#8C8880] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat…</p>
      ) : error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : visibleRows.length === 0 ? (
        <p className="text-xs text-[#8C8880]">{t.portal.common.empty}</p>
      ) : (
        <>
          {attendeePager}
        <div className="rounded-2xl border border-[#D9D7D0] bg-white divide-y divide-[#D9D7D0]/60 max-h-[28rem] overflow-y-auto">
          {pagedRows.map((row) => {
            const uid = row.userId;
            const asal = asalFromOrigin(row.origin);
            const open = Boolean(uid) && openId === uid;
            const canOpen = Boolean(uid) && questions.length > 0;
            return (
              <div key={row.id} className="px-4 py-2.5 text-xs">
                <button type="button" className="w-full text-left" onClick={() => openRow(uid)} disabled={!canOpen}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-[#1B1B1B]">{row.name || '—'}</p>
                    <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_CLASS[row.status] || STATUS_CLASS.ATTENDEE}`}>
                      {row.statusLabel}
                    </span>
                  </div>
                  <p className="text-[#8C8880]">
                    {row.email || (row.hasAccount ? '' : 'Belum punya akun Google')}
                    {row.phone ? ` · ${row.phone}` : ''}
                    {' · '}
                    {asal.asalRegion === 'KOSONG' ? 'Asal belum diisi' : `${asal.asalRegion === 'SULUT' ? 'Sulut' : 'Luar Sulut'}${asal.asalPlace ? ` · ${asal.asalPlace}` : ''}`}
                  </p>
                </button>
                {open && questions.length > 0 && uid && (
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
        </>
      )}
    </div>
  );
};
