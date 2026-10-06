import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarPlus, ClipboardList, Loader2, Lock, RotateCcw, Save, Send, Sparkles } from 'lucide-react';
import {
  countFilled,
  draftToStored,
  emptySessionDraft,
  sessionDraftGuard,
  storedToSections,
  templateFieldKeys,
  type DraftSection,
} from '../../lib/worship-session-draft';

type Props = {
  ym: string;
  weekIndex: number;
  patternCode?: string | null;
  event?: { id: string; name: string; serviceType?: string | null } | null;
  weekDate?: string | null;
  canWrite?: boolean;
  onPatternReset?: () => void;
};

type SessionRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  sessionDate?: string | null;
  eventId?: string | null;
  accessCode?: string | null;
  pattern?: { code: string; name: string } | null;
};

type SessionDetail = {
  session: SessionRow & { config: Record<string, unknown>; pattern?: { code: string; name: string } | null };
  likertItems: { id: string; topicCode: string; text: string }[];
  chips: { id: string; code: string; label: string }[];
  progress: { submitted: number; total: number };
};

const CARD = 'bg-white rounded-2xl border border-[#D9D7D0]/60 p-4';
const INPUT = 'w-full rounded-xl border border-[#D9D7D0] bg-white px-3 py-2 text-xs focus:outline-none focus:border-black';

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

const TOPIC_CODES = ['HUBUNGAN', 'PEKERJAAN', 'KELUARGA'];

function fieldOf(sections: DraftSection[], section: string, key: string): string {
  return sections.find((s) => s.key === section)?.fields.find((f) => f.key === key)?.value || '';
}

/** Kembalikan section form menjadi payload POST_TO_POST (urutan chip ↔ topik dari usulan AI). */
function sectionsToPostToPost(sections: DraftSection[], proposalChips?: { topicCode?: string | null }[]) {
  const topics = TOPIC_CODES.map((code) => ({
    code,
    label: fieldOf(sections, 'topics', `topic-${code}-label`) || code,
    pic: fieldOf(sections, 'topics', `topic-${code}-pic`),
  }));
  const items = TOPIC_CODES.flatMap((code) =>
    [1, 2, 3].map((n) => ({
      topicCode: code,
      text: fieldOf(sections, `likert-${code}`, `item-${code}-${n}`),
      gospelNote: fieldOf(sections, `likert-${code}`, `note-${code}-${n}`),
    })),
  ).filter((x) => x.text.trim());
  const chips = Array.from({ length: 12 }, (_, i) => {
    const label = fieldOf(sections, 'chips', `chip-${i + 1}`).trim();
    if (!label) return null;
    return {
      code: label.replace(/^#/, '').toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 40),
      label: label.startsWith('#') ? label : `#${label}`,
      topicCode: proposalChips?.[i]?.topicCode || null,
    };
  }).filter(Boolean);
  const affirmations: Record<string, string[]> = {};
  for (const code of TOPIC_CODES) {
    const list = [1, 2, 3]
      .map((n) => fieldOf(sections, 'affirmations', `affirm-${code}-${n}`).trim())
      .filter(Boolean);
    if (list.length) affirmations[code] = list;
  }
  return {
    topics,
    items,
    chips,
    affirmations,
    timerSeconds: Number(fieldOf(sections, 'timer', 'timerSeconds')) || 1200,
  };
}

export const SessionDraftTab: React.FC<Props> = ({ ym, weekIndex, patternCode, event, weekDate, canWrite, onPatternReset }) => {
  const code = String(patternCode || 'MONOLOG').toUpperCase();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  // Pola sesi terpilih (sumber kebenaran) — bukan pola pekan. Mencegah form
  // Bedah Film terhidrasi template Monolog/Post-to-Post.
  const detailCode = String(detail?.session?.pattern?.code || code).toUpperCase();
  const isPostDetail = detailCode === 'POST_TO_POST';
  const [sections, setSections] = useState<DraftSection[]>(() => emptySessionDraft(code));
  const [aiBusy, setAiBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [slugDraft, setSlugDraft] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const proposalChips = useRef<{ topicCode?: string | null }[] | undefined>(undefined);
  // Setelah reset pola yang tidak menghapus apa pun (sesi lama kept/terisi),
  // tahan seleksi kosong agar form film lama tidak langsung kepilih lagi.
  const suppressAutoSelect = useRef(false);

  const linked = useMemo(() => {
    if (!event) return [];
    const rows = sessions.filter((s) => s.eventId === event.id);
    if (showArchive) return rows;
    const cutoff = Date.now() - 28 * 24 * 3600 * 1000;
    return rows.filter((s) => {
      if (String(s.status || '').toUpperCase() !== 'CLOSED') return true;
      const t = s.sessionDate ? new Date(String(s.sessionDate)).getTime() : NaN;
      if (Number.isNaN(t)) return true;
      return t >= cutoff;
    });
  }, [sessions, event, showArchive]);

  const archivedCount = useMemo(() => {
    if (!event) return 0;
    return sessions.filter((s) => s.eventId === event.id).length - linked.length;
  }, [sessions, event, linked.length]);

  const loadSessions = useCallback(async () => {
    try {
      const r = await fetch('/api/worship/sessions', { credentials: 'include' });
      const d = r.ok ? await r.json() : { sessions: [] };
      const list: SessionRow[] = d.sessions || [];
      setSessions(list);
      setSelectedId((prev) => {
        if (prev && list.some((s) => s.id === prev)) return prev;
        if (suppressAutoSelect.current) {
          suppressAutoSelect.current = false;
          return '';
        }
        const forEvent = event ? list.filter((s) => s.eventId === event.id) : [];
        return forEvent[0]?.id || '';
      });
    } catch {
      setMsg({ kind: 'err', text: 'Gagal memuat daftar sesi.' });
    }
  }, [event]);

  const loadDetail = useCallback(async () => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    try {
      const r = await fetch(`/api/worship/sessions/${encodeURIComponent(selectedId)}`, { credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Gagal memuat detail sesi.');
      setDetail(d);
      const cfg = (d.session?.config || {}) as Record<string, unknown>;
      const sessionCode = String(d.session?.pattern?.code || code).toUpperCase();
      setSections(storedToSections(sessionCode, (cfg.draft as Record<string, Record<string, string>>) || null));
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal memuat detail.' });
    }
  }, [selectedId, code]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);
  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  // Tanpa sesi terpilih, kembalikan form ke kosongan pola pekan agar sisa
  // template pola lama (mis. Bedah Film) tidak tertinggal setelah ganti pola.
  useEffect(() => {
    if (!selectedId) setSections(emptySessionDraft(code));
  }, [selectedId, code]);

  useEffect(() => {
    const date = String(weekDate || '').slice(0, 10) || ym;
    setSlugDraft(slugify(`sesi-${date}`));
    setTitleDraft(`${code === 'MONOLOG' ? 'Ibadah' : code} — ${event?.name || date}`);
  }, [ym, weekDate, code, event]);

  const guard = useMemo(() => {
    if (!detail) return { locked: false, reason: '' };
    // Non-Post-to-Post tidak memakai Likert/Chip — warisan chip tidak boleh mengunci draft.
    const hasLegacy = isPostDetail
      ? (detail.likertItems || []).length > 0 || (detail.chips || []).length > 0
      : false;
    return sessionDraftGuard({
      status: detail.session.status,
      submittedCount: detail.progress?.submitted || 0,
      hasItems: hasLegacy,
    });
  }, [detail, isPostDetail]);

  const progress = useMemo(() => countFilled(sections), [sections]);

  const setField = (sectionKey: string, fieldKey: string, value: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.key !== sectionKey ? s : { ...s, fields: s.fields.map((f) => (f.key !== fieldKey ? f : { ...f, value })) },
      ),
    );
  };

  const createSession = async () => {
    if (!canWrite || !slugDraft.trim() || !titleDraft.trim()) return;
    setCreateBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/worship/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          patternCode: code,
          slug: slugDraft.trim(),
          title: titleDraft.trim(),
          eventId: event?.id || null,
          sessionDate: String(weekDate || '').slice(0, 10) || null,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        // Slug bentrok (mis. sesi pola lama masih pakai slug tanggal) — sarankan varian unik.
        if (r.status === 409 && String(d?.error || '').toLowerCase().includes('slug')) {
          const alt = slugify(`${slugDraft.trim()}-${code.toLowerCase()}`);
          setSlugDraft(alt);
          throw new Error(`Slug sudah dipakai. Coba "${alt}" — atau alihkan pola sesi lama di atas agar slug tetap.`);
        }
        throw new Error(d?.error || 'Gagal membuat sesi.');
      }
      setMsg({ kind: 'ok', text: `Sesi "${d.session?.slug}" dibuat — silakan isi draft.` });
      await loadSessions();
      if (d.session?.id) setSelectedId(d.session.id);
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal membuat sesi.' });
    } finally {
      setCreateBusy(false);
    }
  };

  // Alihkan pola sesi lama di tempat (slug + link tetap). Aman bila DRAFT kosong:
  // server menolak bila sudah ada data peserta. Perlu konfirmasi karena isi pola lama dibuang.
  const convertSession = async () => {
    if (!canWrite || !detail || !mismatched) return;
    if (
      !window.confirm(
        `Alihkan sesi "${detail.session.slug}" dari ${detailCode} ke ${code}? Isi draft pola lama dibuang (link peserta/layar/kontrol tetap sama).`,
      )
    )
      return;
    setCreateBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/worship/sessions/${detail.session.id}/convert-pattern`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ patternCode: code }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Gagal mengalihkan pola sesi.');
      setMsg({ kind: 'ok', text: `Sesi dialihkan ${d.from} → ${d.to}. Slug & link tetap — silakan isi draft ${code}.` });
      await loadSessions();
      await loadDetail();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal mengalihkan pola.' });
    } finally {
      setCreateBusy(false);
    }
  };

  const fillFromAi = async () => {
    if (!canWrite) return;
    setAiBusy(true);
    setAiNote(null);
    setMsg(null);
    // Gunakan pola sesi bila sudah ada (editing), pola pekan bila buat baru.
    const aiCode = detail ? detailCode : code;
    try {
      const r = await fetch(`/api/didaskalia/studio/${ym}/${weekIndex}/session-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ patternCode: aiCode, fieldKeys: templateFieldKeys(aiCode) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'AI gagal menyusun draft sesi.');
      const draft = d.draft || {};
      if (draft.kind === 'POST_TO_POST') {
        const topics: { code: string; label: string; pic: string }[] = draft.topics || [];
        const items: { topicCode: string; text: string; gospelNote: string }[] = draft.items || [];
        const chips: { code: string; label: string; topicCode?: string | null }[] = draft.chips || [];
        const affirm: Record<string, string[]> = draft.affirmations || {};
        proposalChips.current = chips.map((c) => ({ topicCode: c.topicCode || null }));
        setSections((prev) =>
          prev.map((s) => ({
            ...s,
            fields: s.fields.map((f) => {
              let v = '';
              const tm = /^topic-([A-Z]+)-(label|pic)$/.exec(f.key);
              if (s.key === 'topics' && tm) {
                const found = topics.find((x) => x.code === tm[1]);
                v = tm[2] === 'label' ? found?.label || '' : found?.pic || '';
              }
              const im = /^item-([A-Z]+)-(\d)$/.exec(f.key) || /^note-([A-Z]+)-(\d)$/.exec(f.key);
              if (im) {
                const list = items.filter((x) => x.topicCode === im[1]);
                const it = list[Number(im[2]) - 1];
                v = f.key.startsWith('item-') ? it?.text || '' : it?.gospelNote || '';
              }
              const cm = /^chip-(\d+)$/.exec(f.key);
              if (s.key === 'chips' && cm) v = chips[Number(cm[1]) - 1]?.label || '';
              const am = /^affirm-([A-Z]+)-(\d)$/.exec(f.key);
              if (am) v = (affirm[am[1]] || [])[Number(am[2]) - 1] || '';
              if (f.key === 'timerSeconds') v = String(draft.timerSeconds || 1200);
              return v ? { ...f, value: v } : f;
            }),
          })),
        );
        setAiNote(`Usulan AI: ${topics.length} topik, ${items.length} soal, ${chips.length} chip. Periksa tiap baris lalu Simpan/Terapkan.`);
      } else {
        const vals: { key: string; value: string }[] = draft.values || [];
        const map = new Map(vals.map((x) => [x.key, x.value]));
        proposalChips.current = undefined;
        setSections((prev) =>
          prev.map((s) => ({ ...s, fields: s.fields.map((f) => (map.has(f.key) ? { ...f, value: map.get(f.key) || '' } : f)) })),
        );
        setAiNote(`Usulan AI: ${vals.length} field terisi. Periksa tiap section lalu Simpan${aiCode === 'POST_TO_POST' ? '/Terapkan' : ''}.`);
      }
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'AI gagal.' });
    } finally {
      setAiBusy(false);
    }
  };

  const saveDraft = async () => {
    if (!canWrite || !detail) return;
    setSaveBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/worship/sessions/${detail.session.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ config: { ...(detail.session.config || {}), draft: draftToStored(sections) } }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Gagal menyimpan draft.');
      setMsg({ kind: 'ok', text: 'Draft sesi tersimpan.' });
      await loadDetail();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal menyimpan.' });
    } finally {
      setSaveBusy(false);
    }
  };

  const applyDraft = async () => {
    if (!canWrite || !detail || guard.locked) return;
    if (!window.confirm('Terapkan draft ke sesi ini? Hanya bisa untuk sesi DRAFT yang masih kosong.')) return;
    setApplyBusy(true);
    setMsg(null);
    try {
      const body =
        detailCode === 'POST_TO_POST'
          ? { kind: detailCode, draft: sectionsToPostToPost(sections, proposalChips.current), storedDraft: draftToStored(sections) }
          : { kind: detailCode, storedDraft: draftToStored(sections) };
      const r = await fetch(`/api/worship/sessions/${detail.session.id}/apply-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Gagal menerapkan draft.');
      setMsg({
        kind: 'ok',
        text: detailCode === 'POST_TO_POST' ? `Diterapkan: ${d.items} soal + ${d.chips} chip.` : 'Draft tersimpan ke sesi.',
      });
      await loadDetail();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal menerapkan.' });
    } finally {
      setApplyBusy(false);
    }
  };

  const resetPattern = async () => {
    if (!canWrite) return;
    if (!window.confirm(`Kembalikan pola pekan ini (${code}) ke Monolog? Sesi DRAFT kosong yang tertaut ikut dihapus; sesi yang sudah berjalan/terisi tidak disentuh.`)) return;
    setResetBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/didaskalia/studio/${ym}/${weekIndex}/reset-pattern`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ deleteEmptySessions: true }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Gagal mereset pola.');
      const parts = [`Pola ${d.from} → ${d.to}.`];
      if ((d.deleted || []).length) parts.push(`Sesi dihapus: ${(d.deleted as string[]).join(', ')}.`);
      for (const k of (d.kept || []) as { slug: string; reason: string }[]) parts.push(`Tetap: ${k.slug} (${k.reason}).`);
      setMsg({ kind: 'ok', text: parts.join(' ') });
      // Bila tidak ada yang terhapus tapi ada sesi kept (terisi/non-DRAFT),
      // jangan auto-pilih sesi pola lama lagi — tampilkan empty-state buat sesi baru.
      if (!(d.deleted || []).length && (d.kept || []).length) suppressAutoSelect.current = true;
      setSelectedId('');
      // Kosongkan form pola lama agar tidak tampil sisa Bedah Film setelah revert ke Monolog
      // (reset-pattern selalu kembali ke MONOLOG).
      setSections(emptySessionDraft('MONOLOG'));
      await loadSessions();
      onPatternReset?.();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Gagal mereset pola.' });
    } finally {
      setResetBusy(false);
    }
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  // Sesi terpilih berpola beda dari pekan (mis. pekan sudah MONOLOG tapi sesi masih BEDAH_FILM):
  // form milik sesi lama — jangan timpa; arahkan buat sesi baru pola pekan.
  const mismatched = Boolean(detail) && detailCode !== code;
  const sessionLinks = (slug: string) => ({
    peserta: `${origin}/#/mentoring/${slug}`,
    layar: `${origin}/#/mentoring/${slug}/layar`,
    kontrol: `${origin}/#/mentoring/${slug}/kontrol`,
  });
  const copyLink = (text: string) => {
    void navigator.clipboard?.writeText(text);
    setMsg({ kind: 'ok', text: 'Tautan disalin.' });
  };

  return (
    <div className="space-y-3">
      <div className={CARD}>
        <div className="flex flex-wrap items-center gap-2">
          <ClipboardList className="w-4 h-4 text-[#0EA5E9]" />
          <h4 className="text-sm font-black text-[#1B1B1B]">Draft Sesi Hari-H</h4>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700 font-bold">{code}</span>
          {detail && detailCode !== code && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-amber-700 font-bold">
              Pola sesi: {detailCode} (pekan: {code})
            </span>
          )}
          {code !== 'MONOLOG' && (
            <button
              type="button"
              disabled={!canWrite || resetBusy}
              onClick={() => void resetPattern()}
              title="Kembalikan pola pekan ke Monolog (default). Sesi DRAFT kosong tertaut ikut dihapus; sesi terisi tidak disentuh."
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-amber-300 text-amber-700 text-[10px] font-bold disabled:opacity-50"
            >
              {resetBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} Reset ke Monolog
            </button>
          )}
          {detail && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] text-[#8C8880] font-bold">
              {detail.session.slug} · {detail.session.status} · terisi {progress.filled}/{progress.total}
            </span>
          )}
          {linked.length > 1 && (
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="ml-auto rounded-xl border border-[#D9D7D0] px-2 py-1.5 text-xs">
              {linked.map((s) => (
                <option key={s.id} value={s.id}>{s.slug} · {s.status}</option>
              ))}
            </select>
          )}
          {archivedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowArchive((v) => !v)}
              className="text-[10px] font-bold text-[#8C8880] hover:text-[#1B1B1B]"
            >
              {showArchive ? 'Sembunyikan arsip' : `Tampilkan arsip (${archivedCount})`}
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[11px] text-[#8C8880]">
          {event ? (
            <>Event pekan ini: <b className="text-[#1B1B1B]">{event.name}</b>. Pilih pola → isi form kosongan (manual atau dari AI) → Terapkan ke sesi.</>
          ) : (
            <>Belum ada event ibadah pada tanggal pekan ini — sesi hanya bisa dibuat manual dari kontrol hari-H.</>
          )}
        </p>
        {msg && (
          <p className={`mt-2 text-[11px] rounded-xl px-3 py-2 border ${msg.kind === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>{msg.text}</p>
        )}

        {linked.length > 0 && (
          <div className="mt-3 rounded-xl border border-[#EFEDE8] p-3 space-y-2">
            <p className="text-[11px] font-bold">Tautan per sesi event ini ({linked.length})</p>
            {linked.map((s) => {
              const urls = sessionLinks(s.slug);
              const active = s.id === selectedId;
              return (
                <div key={s.id} className={`rounded-xl border p-2.5 space-y-1.5 ${active ? 'border-sky-300 bg-sky-50/50' : 'border-[#EFEDE8]'}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedId(s.id)}
                      className={`text-xs font-black ${active ? 'text-sky-800' : 'text-[#1B1B1B] hover:text-sky-700'}`}
                    >
                      {s.slug}
                    </button>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] text-[#8C8880] font-bold">
                      {s.pattern?.code || ''} · {s.status}
                    </span>
                    {s.accessCode && (
                      <span className="text-[10px] font-mono font-black tracking-[0.2em] text-[#1B1B1B]">
                        {s.accessCode}
                      </span>
                    )}
                  </div>
                  {(['peserta', 'layar', 'kontrol'] as const).map((k) => (
                    <div key={k} className="flex items-center gap-2 text-[11px]">
                      <span className="w-16 shrink-0 text-[#8C8880] capitalize">{k}</span>
                      <code className="flex-1 truncate text-[#1B1B1B]">{urls[k]}</code>
                      <button
                        type="button"
                        onClick={() => copyLink(k === 'layar' && s.accessCode ? `${urls[k]}?code=${s.accessCode}` : urls[k])}
                        className="font-bold text-sky-700 hover:underline"
                      >
                        Salin
                      </button>
                      <a href={urls[k]} target="_blank" rel="noreferrer" className="font-bold text-[#8C8880] hover:text-[#1B1B1B]">
                        Buka
                      </a>
                    </div>
                  ))}
                </div>
              );
            })}
            <p className="text-[10px] text-[#8C8880]">Layar proyektor memakai kode sesi (disalin beserta <code>?code=</code>). Sesi CLOSED otomatis read-only.</p>
          </div>
        )}

        {!detail && event && (
          <div className="mt-3 rounded-xl border border-dashed border-[#D9D7D0] p-3 space-y-2">
            <p className="text-[11px] text-[#8C8880]">Belum ada sesi untuk event ini. Buat sesi dari pola <b>{code}</b>:</p>
            <div className="grid sm:grid-cols-2 gap-2">
              <input value={slugDraft} onChange={(e) => setSlugDraft(e.target.value)} placeholder="slug-sesi" className={INPUT} />
              <input value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} placeholder="Judul sesi" className={INPUT} />
            </div>
            <button type="button" disabled={!canWrite || createBusy} onClick={() => void createSession()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-50">
              {createBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarPlus className="w-3.5 h-3.5" />} Buat sesi {code}
            </button>
            {!canWrite && <p className="text-[11px] text-amber-700">Mode baca.</p>}
          </div>
        )}

        {mismatched && event && (
          <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2">
            <p className="text-[11px] text-amber-900">
              Sesi terpilih berpola <b>{detailCode}</b>, sedangkan pekan ini <b>{code}</b>. Form di bawah milik sesi lama
              (arsip). Pilihan tercepat: alihkan sesi ini ke {code} — slug & link tetap sama.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!canWrite || createBusy} onClick={() => void convertSession()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-50">
                {createBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarPlus className="w-3.5 h-3.5" />} Alihkan sesi ini ke {code}
              </button>
            </div>
            <p className="text-[10px] text-amber-800">Atau buat sesi baru (slug harus unik — bila bentrok, saran otomatis terisi):</p>
            <div className="grid sm:grid-cols-2 gap-2">
              <input value={slugDraft} onChange={(e) => setSlugDraft(e.target.value)} placeholder="slug-sesi" className={INPUT} />
              <input value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} placeholder="Judul sesi" className={INPUT} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!canWrite || createBusy} onClick={() => void createSession()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#D9D7D0] bg-white text-xs font-bold text-[#1B1B1B] disabled:opacity-50">
                {createBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarPlus className="w-3.5 h-3.5" />} Buat sesi {code} baru
              </button>
            </div>
          </div>
        )}

        {detail && !mismatched && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={!canWrite || aiBusy} onClick={() => void fillFromAi()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-brand to-brand-end text-white text-xs font-bold disabled:opacity-50">
              {aiBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Isi dari AI pekan ini
            </button>
            <button type="button" disabled={!canWrite || saveBusy} onClick={() => void saveDraft()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs font-bold text-[#1B1B1B] disabled:opacity-50">
              {saveBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Simpan draft
            </button>
            <button type="button" disabled={!canWrite || applyBusy || guard.locked} onClick={() => void applyDraft()} title={guard.locked ? guard.reason : 'Terapkan ke sesi'} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50">
              {applyBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Terapkan ke sesi
            </button>
          </div>
        )}
        {aiNote && <p className="mt-2 text-[11px] text-sky-800 bg-sky-50 border border-sky-200 rounded-xl px-3 py-2">{aiNote}</p>}
        {detail && guard.locked && (
          <p className="mt-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 inline-flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> {guard.reason}
          </p>
        )}
      </div>

      <div key={`${selectedId || 'none'}-${detailCode}`} className="space-y-3">
      {detail && sections.map((s) => (
        <div key={s.key} className={CARD}>
          <h5 className="text-xs font-black text-[#1B1B1B]">{s.title}</h5>
          <p className="text-[11px] text-[#8C8880] mb-2">{s.hint}</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {s.fields.map((f) => (
              <div key={f.key} className={f.kind === 'textarea' ? 'sm:col-span-2' : ''}>
                <label className="text-[10px] font-black uppercase tracking-wider text-[#8C8880] mb-1 block">{f.label}</label>
                {f.kind === 'textarea' ? (
                  <textarea value={f.value} onChange={(e) => setField(s.key, f.key, e.target.value)} placeholder={f.placeholder} rows={2} disabled={!canWrite || guard.locked || mismatched} className={`${INPUT} resize-y disabled:opacity-60`} />
                ) : (
                  <input value={f.value} onChange={(e) => setField(s.key, f.key, e.target.value)} placeholder={f.placeholder} type={f.kind === 'number' ? 'number' : 'text'} disabled={!canWrite || guard.locked || mismatched} className={`${INPUT} disabled:opacity-60`} />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      </div>
    </div>
  );
};
