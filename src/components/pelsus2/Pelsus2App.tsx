import React, { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, Loader2, RefreshCw, Vote, MonitorUp, KeyRound, ClipboardCheck,
  Search, Users, ArrowRight, FlaskConical,
} from 'lucide-react';
import {
  api, TurnoutBar, QuorumBadge, GuideCard, AdminPanel, LayarView,
} from '../pelsus/PelsusApp';
import type { Candidate, Election } from '../pelsus/PelsusApp';
import {
  parsePelsus2Hash, pelsus2Path, isSimPreview, filterSim,
  parseTokenQueue, nextUnvoted, myBallotProgress,
} from '../../lib/pelsus2';
import { quorumNeed, quorumMet, nextPollDelay, SCOPE_LABEL, electionSubtitle } from '../../lib/pelsus';

function useHash(): string {
  const [hash, setHash] = useState(() => (typeof window !== 'undefined' ? window.location.hash : ''));
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

function StatusPill({ e }: { e: Election }) {
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${e.open ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : e.status === 'CLOSED' ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
      {e.open ? 'Dibuka' : e.status === 'CLOSED' ? 'Ditutup' : 'Draft'}
    </span>
  );
}

function ElectionCard({ e, cta }: { e: Election; cta?: string }) {
  return (
    <a href={pelsus2Path(e.id)} className="rounded-3xl border border-[#D9D7D0]/60 bg-white p-4 space-y-2 hover:border-brand transition-colors">
      <div className="flex items-center gap-2">
        <p className="text-sm font-bold flex-1">{e.title}</p>
        <StatusPill e={e} />
      </div>
      <p className="text-[11px] text-[#8C8880]">{electionSubtitle(e)}</p>
      {e.turnout && (
        <>
          <TurnoutBar voted={e.turnout.voted} total={e.turnout.total} />
          <div className="flex items-center gap-2">
            <QuorumBadge voted={e.turnout.voted} total={e.turnout.total} />
            {e.myVoter && (e.myVoter.hasVoted
              ? <span className="text-[11px] font-bold text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Sudah memilih</span>
              : <span className="text-[11px] text-[#8C8880]">Anda terdaftar — belum memilih</span>)}
          </div>
        </>
      )}
      <p className="text-[11px] font-bold text-brand">{cta || 'Buka surat suara →'}</p>
    </a>
  );
}

function HomeV2() {
  const hash = useHash();
  const sim = isSimPreview(hash);
  const [data, setData] = useState<{ elections: Election[]; canAdmin: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setErr(null);
      setData(await api('/api/pelsus'));
    } catch (e) { setErr(e instanceof Error ? e.message : 'Gagal memuat.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let fails = 0; let t: number;
    const tick = async () => {
      try { await load(); fails = 0; }
      catch { fails += 1; }
      t = window.setTimeout(tick, nextPollDelay(fails));
    };
    t = window.setTimeout(tick, 15000);
    return () => window.clearTimeout(t);
  }, [load]);

  const elections = useMemo(() => filterSim(data?.elections || [], hash), [data, hash]);
  const mine = useMemo(() => elections.filter((e) => Boolean(e.myVoter)), [elections]);
  const prog = useMemo(() => myBallotProgress(elections), [elections]);
  const groups = useMemo(() => {
    const m = new Map<string, Election[]>();
    for (const e of elections) {
      if (!m.has(e.scope)) m.set(e.scope, []);
      m.get(e.scope)!.push(e);
    }
    return [...m.entries()];
  }, [elections]);

  return (
    <div className="mx-auto max-w-5xl px-5 py-6 space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[#1B1B1B] text-white"><Vote className="w-4 h-4" /></span>
        <div>
          <h1 className="text-lg font-black">Pemilihan Pelsus — V2 by-person</h1>
          <p className="text-xs text-[#8C8880]">Satu orang, semua surat suara Anda dalam satu alur</p>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200"><FlaskConical className="w-3 h-3" /> Preview</span>
        {sim && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">Data SIMULASI</span>}
        <button type="button" onClick={() => void load()} className="ml-auto p-2 rounded-xl border border-[#D9D7D0] bg-white" title="Muat ulang"><RefreshCw className="w-4 h-4" /></button>
      </header>
      {err && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>}

      {mine.length > 0 && (
        <section className="rounded-3xl border-2 border-[#1B1B1B] bg-white p-4 space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black flex-1">Surat suara saya</h2>
            <span className="text-[11px] font-bold tabular-nums text-[#5C5850]">Sudah {prog.done} dari {prog.total}</span>
          </div>
          <div className="h-2 rounded-full bg-[#EFEDE8] overflow-hidden">
            <div className="h-full bg-[#1B1B1B] transition-all" style={{ width: `${prog.total ? Math.round((prog.done / prog.total) * 100) : 0}%` }} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {mine.map((e) => (
              <Fragment key={e.id}><ElectionCard e={e} cta={e.myVoter?.hasVoted ? 'Sudah memilih ✓' : e.open ? 'Pilih sekarang →' : 'Buka surat suara →'} /></Fragment>
            ))}
          </div>
        </section>
      )}

      <GuideCard />
      {!data && !err && <p className="text-sm text-[#8C8880] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat…</p>}
      {groups.map(([scope, list]) => (
        <section key={scope} className="space-y-3">
          <h2 className="text-sm font-black">{SCOPE_LABEL[scope as keyof typeof SCOPE_LABEL] || scope}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {list.map((e) => <Fragment key={e.id}><ElectionCard e={e} /></Fragment>)}
          </div>
        </section>
      ))}
      {data && elections.length === 0 && (
        <div className="rounded-2xl border border-[#D9D7D0] bg-white px-6 py-10 text-center">
          <p className="text-sm font-bold">Belum ada pemilihan{sim ? ' simulasi' : ''}.</p>
        </div>
      )}
      {data?.canAdmin && (
        <a href={pelsus2Path(undefined, 'panitia')} className="flex items-center gap-2 rounded-2xl border border-dashed border-[#1B1B1B]/30 bg-white px-4 py-3 text-xs font-bold">
          <Users className="w-4 h-4" /> Perkakas panitia: cari orang by-person →
        </a>
      )}
    </div>
  );
}

function DetailV2({ id }: { id: string }) {
  const [d, setD] = useState<any>(null);
  const [list, setList] = useState<Election[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const load = useCallback(async () => {
    try {
      setErr(null);
      const r = await api(`/api/pelsus/${encodeURIComponent(id)}`);
      setD(r);
      setPicked((p) => p.filter((x) => (r.candidates || []).some((c: Candidate) => c.id === x)));
    } catch (e) { setErr(e instanceof Error ? e.message : 'Gagal memuat.'); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    api('/api/pelsus').then((r) => setList(r.elections || [])).catch(() => {});
  }, []);

  const toggle = (cid: string, max: number) => {
    setPicked((p) => (p.includes(cid) ? p.filter((x) => x !== cid) : p.length >= max ? p : [...p, cid]));
  };
  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      await api(`/api/pelsus/${encodeURIComponent(id)}/ballot`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateIds: picked }),
      });
      setDone(true);
      const r = await api('/api/pelsus');
      setList(r.elections || []);
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Gagal menyimpan.'); }
    finally { setBusy(false); }
  };

  if (err && !d) return <div className="mx-auto max-w-3xl px-5 py-10"><div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div><a href="#/pelsus2" className="text-xs font-bold text-brand mt-3 inline-block">← Kembali</a></div>;
  if (!d) return <div className="min-h-screen flex items-center justify-center text-sm text-[#8C8880]"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Memuat surat suara…</div>;
  const e = d.election;
  const cands: Candidate[] = d.candidates || [];
  const voted = Boolean(d.myVoter?.hasVoted) || done;
  const next = voted ? nextUnvoted(list, id) : null;
  const nextTitle = next ? (list.find((x) => x.id === next.id)?.title || next.id) : '';

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 space-y-4">
      <a href="#/pelsus2" className="text-xs font-bold text-brand">← Semua pemilihan</a>
      <div className="rounded-3xl border border-[#D9D7D0]/60 bg-white p-5 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-base font-black flex-1">{e.title}</h1>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${e.open ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>{e.open ? 'Dibuka' : e.status}</span>
        </div>
        <p className="text-[11px] text-[#8C8880]">{electionSubtitle(e)} · pilih {e.maxChoices} · rahasia (panitia hanya lihat sudah/belum)</p>
        {d.turnout && <><TurnoutBar voted={d.turnout.voted} total={d.turnout.total} /><QuorumBadge voted={d.turnout.voted} total={d.turnout.total} /></>}
        {err && <p className="text-xs text-red-600">{err}</p>}
        {voted && <p className="text-xs font-bold text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Suara Anda sudah tercatat. Terima kasih.</p>}
        {!d.myVoter && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">Anda tidak terdaftar di DPT pemilihan ini. Ke bilik dengan token bila diarahkan petugas.</p>}
      </div>
      <div className="space-y-3">
        {cands.map((c) => {
          const active = picked.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              disabled={!d.canVote || voted}
              onClick={() => toggle(c.id, e.maxChoices)}
              className={`w-full text-left rounded-3xl border p-4 flex items-center gap-3 transition-colors disabled:cursor-default ${active ? 'border-emerald-400 bg-emerald-50/40' : 'border-[#D9D7D0]/60 bg-white'}`}
            >
              <span className="w-9 h-9 rounded-full bg-[#1B1B1B] text-white text-sm font-black flex items-center justify-center shrink-0">{c.nomor}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold truncate">{c.name}</span>
                {c.visi && <span className="block text-[11px] text-[#8C8880] line-clamp-2">{c.visi}</span>}
                {typeof c.voteCount === 'number' && <span className="block text-[11px] font-bold text-[#5C5850] tabular-nums">{c.voteCount} suara</span>}
              </span>
              {active && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
            </button>
          );
        })}
      </div>
      {d.canVote && !voted && (
        <button type="button" disabled={busy || !picked.length} onClick={() => void submit()} className="w-full py-3.5 rounded-2xl bg-[#1B1B1B] text-white text-sm font-bold disabled:opacity-50">
          {busy ? 'Menyimpan…' : `Kirim pilihan (${picked.length}/${e.maxChoices}) — tidak dapat diubah`}
        </button>
      )}
      {next && (
        <a href={pelsus2Path(next.id)} className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-emerald-600 text-white text-sm font-bold">
          Lanjut: {nextTitle} <ArrowRight className="w-4 h-4" />
        </a>
      )}
      <div className="flex flex-wrap gap-2 text-[11px]">
        <a href={pelsus2Path(id, 'layar')} className="inline-flex items-center gap-1 font-bold text-brand"><MonitorUp className="w-3.5 h-3.5" /> Layar proyektor</a>
        {d.canAdmin && <AdminPanel id={id} onChange={() => void load()} />}
      </div>
    </div>
  );
}

type QueueItem = { token: string; done: boolean };

function BilikV2({ id }: { id: string }) {
  const hash = useHash();
  const urlQueue = parseTokenQueue(hash);
  const [manualQueue, setManualQueue] = useState<string[]>([]);
  const [manual, setManual] = useState('');
  const [idx, setIdx] = useState(0);
  const [preview, setPreview] = useState<any>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(0);

  const queue: QueueItem[] = (urlQueue.length ? urlQueue : manualQueue).map((t) => ({ token: t, done: false }));
  const total = queue.length;
  const current = queue[idx];

  useEffect(() => {
    setIdx(0); setPreview(null); setPicked([]); setErr(null); setFinished(0);
  }, [hash]);

  const lookupToken = useCallback(async (token: string) => {
    setBusy(true); setErr(null);
    try {
      const r = await api('/api/pelsus/bilik/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      setPreview(r); setPicked([]);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Token tidak valid.'); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => {
    if (current && !preview && !err) void lookupToken(current.token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, hash]);

  const submit = async () => {
    if (!current) return;
    setBusy(true); setErr(null);
    try {
      await api('/api/pelsus/bilik', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: current.token, candidateIds: picked }) });
      const n = finished + 1;
      setFinished(n);
      setPreview(null); setPicked([]);
      if (idx + 1 < total) {
        setIdx(idx + 1);
      }
    } catch (e) { setErr(e instanceof Error ? e.message : 'Gagal menyimpan.'); }
    finally { setBusy(false); }
  };

  const startManual = () => {
    const t = manual.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (t.length < 4) return;
    setManualQueue([t]); setManual(''); setIdx(0); setPreview(null); setPicked([]); setErr(null); setFinished(0);
  };

  const allDone = total > 0 && finished >= total;

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 space-y-4">
      <h1 className="text-xl font-black text-center">Bilik Suara V2 — {preview?.election?.title || 'Pelsus'}</h1>
      {total > 1 && (
        <p className="text-center text-xs font-bold text-[#5C5850]">Surat suara {Math.min(idx + 1, total)} dari {total} · sudah {finished}</p>
      )}
      {total === 0 && (
        <div className="rounded-3xl border bg-white p-6 space-y-3 text-center">
          <KeyRound className="w-8 h-8 mx-auto text-brand" />
          <p className="text-sm font-bold">Masukkan token dari petugas</p>
          <input value={manual} onChange={(e) => setManual(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16))} placeholder="XXXXXX" className="w-full text-center text-3xl font-black tracking-[0.3em] px-4 py-3 rounded-2xl border" />
          {err && <p className="text-xs text-red-600">{err}</p>}
          <button disabled={busy || manual.length < 4} onClick={startManual} className="w-full py-3.5 rounded-2xl bg-[#1B1B1B] text-white text-sm font-bold disabled:opacity-50">{busy ? 'Memeriksa…' : 'Buka surat suara'}</button>
        </div>
      )}
      {preview && !allDone && (
        <div className="space-y-3">
          <p className="text-center text-sm">Halo, <b>{preview.voter.name}</b> — pilih {preview.election.maxChoices}, lalu Kirim. Rahasia.</p>
          {preview.candidates.map((c: Candidate) => {
            const active = picked.includes(c.id);
            return (
              <button key={c.id} type="button" onClick={() => setPicked((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : p.length >= preview.election.maxChoices ? p : [...p, c.id]))}
                className={`w-full text-left rounded-3xl border p-5 flex items-center gap-4 ${active ? 'border-emerald-400 bg-emerald-50/40' : 'bg-white border-[#D9D7D0]/60'}`}>
                <span className="w-12 h-12 rounded-full bg-[#1B1B1B] text-white text-lg font-black flex items-center justify-center">{c.nomor}</span>
                <span className="text-lg font-bold flex-1">{c.name}</span>
                {active && <CheckCircle2 className="w-7 h-7 text-emerald-600" />}
              </button>
            );
          })}
          {err && <p className="text-xs text-red-600 text-center">{err}</p>}
          <button disabled={busy || !picked.length} onClick={() => void submit()} className="w-full py-4 rounded-2xl bg-emerald-600 text-white text-base font-bold disabled:opacity-50">
            {busy ? 'Menyimpan…' : idx + 1 < total ? `Kirim & lanjut surat ${idx + 2}/${total}` : `Kirim (${picked.length}/${preview.election.maxChoices})`}
          </button>
        </div>
      )}
      {!preview && !allDone && total > 0 && (
        <div className="rounded-3xl border bg-white p-6 text-center">
          {err ? <p className="text-xs text-red-600">{err}</p> : <p className="text-sm text-[#8C8880] flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Membuka surat suara…</p>}
        </div>
      )}
      {allDone && (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-10 text-center space-y-2">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-600" />
          <p className="text-lg font-black">{finished} suara tersimpan ✓</p>
          <p className="text-xs text-[#5C5850]">Semua surat suara selesai. Silakan kembali ke petugas.</p>
        </div>
      )}
      <p className="text-[11px] text-center text-[#8C8880]">ID pemilihan: {id} · 1 token = 1 suara per surat · jangan foto surat suara</p>
    </div>
  );
}

type Person = {
  key: string; userId: string | null; name: string; bipra: string | null; kolomId: string | null;
  elections: { electionId: string; voterId: string; title: string; scope: string | null; status: string | null; open: boolean; hasVoted: boolean; votedVia: string | null }[];
};

function PanitiaView() {
  const [gate, setGate] = useState<'loading' | 'ok' | 'denied'>('loading');
  const [q, setQ] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [batches, setBatches] = useState<Record<string, { tokens: { token: string; electionId: string; title: string }[]; skipped: { reason: string }[] }>>({});

  useEffect(() => {
    api('/api/pelsus')
      .then((r) => setGate(r.canAdmin ? 'ok' : 'denied'))
      .catch(() => setGate('denied'));
  }, []);

  const search = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await api(`/api/pelsus/people/search?q=${encodeURIComponent(q)}`);
      setPeople(r.people || []);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Gagal mencari.'); }
    finally { setBusy(false); }
  };

  const issueBatch = async (p: Person) => {
    const voterIds = p.elections.filter((e) => e.open && !e.hasVoted).map((e) => e.voterId);
    if (!voterIds.length) { alert('Tidak ada surat suara OPEN yang belum dipilih.'); return; }
    setBusy(true);
    try {
      const r = await api('/api/pelsus/tokens/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voterIds }) });
      setBatches((b) => ({ ...b, [p.key]: r }));
      await search();
    } catch (e) { alert(e instanceof Error ? e.message : 'Gagal menerbitkan token.'); }
    finally { setBusy(false); }
  };

  const checkin = async (p: Person, electionId: string, voterId: string) => {
    if (!confirm(`Catat ${p.name} sebagai sudah memilih (manual)?`)) return;
    try {
      await api(`/api/pelsus/${encodeURIComponent(electionId)}/checkin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voterId, markOnly: true }) });
      await search();
    } catch (e) { alert(e instanceof Error ? e.message : 'Gagal mencatat.'); }
  };

  if (gate === 'loading') return <div className="min-h-screen flex items-center justify-center text-sm text-[#8C8880]"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Memeriksa peran…</div>;
  if (gate === 'denied') return <div className="mx-auto max-w-2xl px-5 py-10"><div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Hanya panitia (SUPERADMIN/BPMJ/KOMISI/COMMITTEE).</div><a href="#/pelsus2" className="text-xs font-bold text-brand mt-3 inline-block">← Kembali</a></div>;

  return (
    <div className="mx-auto max-w-4xl px-5 py-6 space-y-4">
      <a href="#/pelsus2" className="text-xs font-bold text-brand">← Semua pemilihan</a>
      <header className="flex items-center gap-3">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[#1B1B1B] text-white"><Users className="w-4 h-4" /></span>
        <div>
          <h1 className="text-lg font-black">Perkakas panitia — cari orang</h1>
          <p className="text-xs text-[#8C8880]">Satu orang → semua surat suara + paket token sekaligus</p>
        </div>
      </header>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C8880]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void search(); }} placeholder="Ketik nama (min. 2 huruf)…" className="w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm bg-white" />
        </div>
        <button disabled={busy || q.trim().length < 2} onClick={() => void search()} className="px-4 py-2.5 rounded-xl bg-[#1B1B1B] text-white text-sm font-bold disabled:opacity-50">Cari</button>
      </div>
      {err && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>}
      <div className="space-y-3">
        {people.map((p) => {
          const batch = batches[p.key];
          const bilikHref = batch && batch.tokens.length
            ? `${pelsus2Path(batch.tokens[0].electionId, 'bilik')}?tokens=${batch.tokens.map((t) => t.token).join(',')}`
            : null;
          return (
            <div key={p.key} className="rounded-3xl border border-[#D9D7D0]/60 bg-white p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-black flex-1">{p.name}</p>
                {(p.bipra || p.kolomId) && <span className="text-[11px] text-[#8C8880]">{[p.bipra, p.kolomId].filter(Boolean).join(' · ')}</span>}
                {!p.userId && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">Tanpa akun</span>}
                <button disabled={busy} onClick={() => void issueBatch(p)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-bold disabled:opacity-50"><KeyRound className="w-3 h-3" /> Paket Token</button>
              </div>
              <div className="space-y-1">
                {p.elections.map((e) => (
                  <div key={e.electionId} className="flex items-center gap-2 text-xs border rounded-xl px-2 py-1.5">
                    <span className="flex-1 truncate font-bold">{e.title}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${e.hasVoted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : e.open ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                      {e.hasVoted ? `SUDAH${e.votedVia ? ` · ${e.votedVia}` : ''}` : e.open ? 'BELUM · DIBUKA' : e.status}
                    </span>
                    {!e.hasVoted && e.open && (
                      <button onClick={() => void checkin(p, e.electionId, e.voterId)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border font-bold"><ClipboardCheck className="w-3 h-3" /> Manual</button>
                    )}
                    <a href={pelsus2Path(e.electionId)} className="px-2 py-1 font-bold text-brand">Buka →</a>
                  </div>
                ))}
              </div>
              {batch && (
                <div className="rounded-2xl bg-sky-50/60 border border-sky-200 p-3 space-y-1">
                  <p className="text-[11px] font-black">Paket token ({batch.tokens.length} surat, 10 menit):</p>
                  {batch.tokens.map((t) => (
                    <p key={t.token} className="text-xs font-mono">{t.token} — {t.title}</p>
                  ))}
                  {batch.skipped.length > 0 && <p className="text-[11px] text-[#8C8880]">Dilewati: {batch.skipped.map((s) => s.reason).join('; ')}</p>}
                  {bilikHref && <a href={bilikHref} className="inline-flex items-center gap-1 text-xs font-bold text-brand"><MonitorUp className="w-3.5 h-3.5" /> Buka bilik berantai →</a>}
                </div>
              )}
            </div>
          );
        })}
        {people.length === 0 && <p className="text-xs text-[#8C8880] text-center">Cari nama untuk melihat hak pilih per surat suara.</p>}
      </div>
    </div>
  );
}

export default function Pelsus2App() {
  const hash = useHash();
  const route = parsePelsus2Hash(hash) || { view: 'home' as const, id: '' };
  if (route.view === 'layar') return <LayarView id={route.id} />;
  if (route.view === 'bilik') return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#1B1B1B]"><BilikV2 id={route.id} /></div>
  );
  if (route.view === 'panitia') return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#1B1B1B]"><PanitiaView /></div>
  );
  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#1B1B1B]">
      {route.view === 'detail' ? <DetailV2 id={route.id} /> : <HomeV2 />}
      <p className="text-[11px] text-[#8C8880] text-center pb-8">Pelsus GMIM V2 preview · 1 orang semua surat suara · pilihan dirahasiakan</p>
    </div>
  );
}
