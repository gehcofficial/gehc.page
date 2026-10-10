import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, Vote, MonitorUp, KeyRound, ClipboardCheck, Lock, Unlock, RotateCcw } from 'lucide-react';
import { parsePelsusHash, pelsusPath, quorumNeed, quorumMet, nextPollDelay, SCOPE_LABEL, electionSubtitle } from '../../lib/pelsus';

export type Election = {
  id: string; scope: string; bipra?: string | null; kolomId?: string | null; roleTarget?: string | null;
  title: string; description?: string | null; status: string; maxChoices: number;
  open?: boolean; closesAt?: string | null;
  turnout?: { voted: number; total: number };
  quorum?: { need: number; met: boolean };
  myVoter?: { hasVoted: boolean } | null;
};
export type Candidate = { id: string; nomor: number; name: string; roleTarget?: string | null; photoUrl?: string | null; visi?: string | null; voteCount?: number | null };

export async function api(path: string, opts?: RequestInit) {
  const r = await fetch(path, { credentials: 'include', ...(opts || {}) });
  if (r.status === 401 && !path.includes('/live') && !path.includes('/bilik')) {
    const next = encodeURIComponent(window.location.hash);
    window.location.hash = `#/login?next=${next}`;
    throw new Error('Belum login.');
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error || `Server ${r.status}`);
  return d;
}

export function TurnoutBar({ voted, total }: { voted: number; total: number }) {
  const pct = total ? Math.round((voted / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-[#EFEDE8] overflow-hidden">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-bold tabular-nums text-[#5C5850]">{voted}/{total}</span>
    </div>
  );
}

export function QuorumBadge({ voted, total, num = 2, den = 3 }: { voted: number; total: number; num?: number; den?: number }) {
  const need = quorumNeed(total, num, den);
  const met = quorumMet(voted, total, num, den);
  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${met ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
      {met ? `Kuorum ✓ (${voted}/${total})` : `Kuorum ${voted}/${need} dari ${total}`}
    </span>
  );
}

/** Panduan 4 tahap — tampil di home saat warta (Juklak → Kuorum → Cara → Pilih). */
export function GuideCard() {
  return (
    <div className="rounded-3xl border border-[#D9D7D0]/60 bg-white p-5 space-y-3">
      <h2 className="text-sm font-black">Panduan memilih (4 tahap)</h2>
      <ol className="text-xs text-[#5C5850] space-y-2 list-decimal list-inside">
        <li><b>Juklak:</b> perorangan, langsung, rahasia, tertulis — 1 orang 1 suara, tak dapat diwakilkan.</li>
        <li><b>Absensi kuorum:</b> check-in dulu (login / bilik / manual). Pemilihan sah bila kuorum 2/3 tampil di layar.</li>
        <li><b>Cara memilih:</b> HP sendiri (login) · 5 laptop bilik (token petugas) · daftar manual (validasi petugas).</li>
        <li><b>Pilih:</b> buka surat suara BIPRA/Kolom Anda → pilih → Kirim. Layar hanya tampil partisipasi; hasil dibuka setelah ditutup.</li>
      </ol>
    </div>
  );
}

function HomeView() {
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

  const groups = useMemo(() => {
    const m = new Map<string, Election[]>();
    for (const e of data?.elections || []) {
      if (!m.has(e.scope)) m.set(e.scope, []);
      m.get(e.scope)!.push(e);
    }
    return [...m.entries()];
  }, [data]);

  return (
    <div className="mx-auto max-w-5xl px-5 py-6 space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[#1B1B1B] text-white"><Vote className="w-4 h-4" /></span>
        <div>
          <h1 className="text-lg font-black">Pemilihan Pelsus — 18 Okt 2026</h1>
          <p className="text-xs text-[#8C8880]">Penatua BIPRA · Penatua & Diaken Kolom · BPMJ</p>
        </div>
        <button type="button" onClick={() => void load()} className="ml-auto p-2 rounded-xl border border-[#D9D7D0] bg-white" title="Muat ulang"><RefreshCw className="w-4 h-4" /></button>
      </header>
      {err && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>}
      <GuideCard />
      {!data && !err && <p className="text-sm text-[#8C8880] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat…</p>}
      {groups.map(([scope, list]) => (
        <section key={scope} className="space-y-3">
          <h2 className="text-sm font-black">{SCOPE_LABEL[scope as keyof typeof SCOPE_LABEL] || scope}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {list.map((e) => (
              <a key={e.id} href={pelsusPath(e.id)} className="rounded-3xl border border-[#D9D7D0]/60 bg-white p-4 space-y-2 hover:border-brand transition-colors">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold flex-1">{e.title}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${e.open ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : e.status === 'CLOSED' ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                    {e.open ? 'Dibuka' : e.status === 'CLOSED' ? 'Ditutup' : 'Draft'}
                  </span>
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
                <p className="text-[11px] font-bold text-brand">Buka surat suara →</p>
              </a>
            ))}
          </div>
        </section>
      ))}
      {data && data.elections.length === 0 && (
        <div className="rounded-2xl border border-[#D9D7D0] bg-white px-6 py-10 text-center">
          <p className="text-sm font-bold">Belum ada pemilihan.</p>
          <p className="text-xs text-[#8C8880] mt-1">Panitia membuka dari panel admin menjelang 18 Okt.</p>
        </div>
      )}
    </div>
  );
}

function DetailView({ id }: { id: string }) {
  const [d, setD] = useState<any>(null);
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
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Gagal menyimpan.'); }
    finally { setBusy(false); }
  };

  if (err && !d) return <div className="mx-auto max-w-3xl px-5 py-10"><div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div><a href="#/pelsus" className="text-xs font-bold text-brand mt-3 inline-block">← Kembali</a></div>;
  if (!d) return <div className="min-h-screen flex items-center justify-center text-sm text-[#8C8880]"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Memuat surat suara…</div>;
  const e = d.election;
  const cands: Candidate[] = d.candidates || [];
  const voted = Boolean(d.myVoter?.hasVoted) || done;

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 space-y-4">
      <a href="#/pelsus" className="text-xs font-bold text-brand">← Semua pemilihan</a>
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
      <div className="flex flex-wrap gap-2 text-[11px]">
        <a href={pelsusPath(id, 'layar')} className="inline-flex items-center gap-1 font-bold text-brand"><MonitorUp className="w-3.5 h-3.5" /> Layar proyektor</a>
        {d.canAdmin && <AdminPanel id={id} onChange={() => void load()} />}
      </div>
    </div>
  );
}

export function AdminPanel({ id, onChange }: { id: string; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [voters, setVoters] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [csv, setCsv] = useState('');
  const [candName, setCandName] = useState('');
  const act = async (body: any, path = 'state') => {
    setBusy(true);
    try {
      await api(`/api/pelsus/${encodeURIComponent(id)}/${path}`, { method: path === 'state' ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      onChange();
    } catch (e) { alert(e instanceof Error ? e.message : 'Gagal'); }
    finally { setBusy(false); }
  };
  const loadVoters = useCallback(async () => {
    try { const r = await api(`/api/pelsus/${encodeURIComponent(id)}/voters?unvoted=1&q=${encodeURIComponent(q)}`); setVoters(r.voters || []); }
    catch { /* abaikan */ }
  }, [id, q]);
  useEffect(() => { void loadVoters(); }, [loadVoters]);
  const issueToken = async (voterId: string) => {
    try {
      const r = await api(`/api/pelsus/${encodeURIComponent(id)}/tokens`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voterId }) });
      alert(`Token untuk ${r.voter.name}: ${r.token} (10 menit)`);
      void loadVoters();
    } catch (e) { alert(e instanceof Error ? e.message : 'Gagal'); }
  };
  const checkin = async (voterId: string) => {
    if (!confirm('Catat sebagai sudah memilih (manual)?')) return;
    try {
      await api(`/api/pelsus/${encodeURIComponent(id)}/checkin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voterId, markOnly: true }) });
      void loadVoters(); onChange();
    } catch (e) { alert(e instanceof Error ? e.message : 'Gagal'); }
  };
  return (
    <details className="w-full rounded-2xl border border-[#D9D7D0] bg-white p-4">
      <summary className="text-xs font-black cursor-pointer">Panel panitia</summary>
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => void act({ action: 'open' })} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"><Unlock className="w-3.5 h-3.5" /> Buka</button>
        <button disabled={busy} onClick={() => void act({ action: 'close' })} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold"><Lock className="w-3.5 h-3.5" /> Tutup</button>
        <button disabled={busy} onClick={() => { if (confirm('Reset semua suara?')) void act({ action: 'reset' }); }} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-bold"><RotateCcw className="w-3.5 h-3.5" /> Reset</button>
        <button disabled={busy} onClick={() => void act({}, 'voters/sync')} className="px-3 py-2 rounded-xl border text-xs font-bold">Sync DPT dari DB</button>
        <a href={`/api/pelsus/${encodeURIComponent(id)}/export.csv`} className="px-3 py-2 rounded-xl border text-xs font-bold">Unduh Berita Acara (CSV)</a>
        <button disabled={busy} onClick={() => {
          if (!confirm('Hapus pemilihan ini + seluruh data (DPT, suara, token)?')) return;
          setBusy(true);
          api(`/api/pelsus/${encodeURIComponent(id)}`, { method: 'DELETE' })
            .then(() => { window.location.hash = '#/pelsus'; })
            .catch((e) => { alert(e instanceof Error ? e.message : 'Gagal'); setBusy(false); });
        }} className="px-3 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-bold">Hapus election</button>
      </div>
      <div className="mt-3 space-y-2">
        <p className="text-[11px] font-bold">Tambah kandidat (DRAFT)</p>
        <div className="flex gap-2">
          <input value={candName} onChange={(e) => setCandName(e.target.value)} placeholder="Nama kandidat" className="flex-1 px-3 py-2 rounded-xl border text-xs" />
          <button disabled={busy || !candName.trim()} onClick={() => { void act({ name: candName.trim() }, 'candidates'); setCandName(''); }} className="px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold">Tambah</button>
        </div>
        <p className="text-[11px] font-bold">Import DPT susulan (CSV: nama[,bipra,kolomId] per baris)</p>
        <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-xl border text-xs font-mono" placeholder="Nama Lengkap,BAPAK,kol-1" />
        <button disabled={busy || !csv.trim()} onClick={() => {
          const rows = csv.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
            const [name, bipra, kolomId] = l.split(',').map((s) => (s || '').trim());
            return { name, bipra, kolomId };
          });
          void act({ rows }, 'voters/import');
        }} className="px-3 py-2 rounded-xl border text-xs font-bold">Import {csv.split('\n').filter((l) => l.trim()).length} baris</button>
        <p className="text-[11px] font-bold">Terbitkan token / validasi manual (belum memilih)</p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama…" className="w-full px-3 py-2 rounded-xl border text-xs" />
        <div className="max-h-48 overflow-auto space-y-1">
          {voters.slice(0, 50).map((v) => (
            <div key={v.id} className="flex items-center gap-2 text-xs border rounded-xl px-2 py-1.5">
              <span className="flex-1 truncate">{v.name}</span>
              <button onClick={() => void issueToken(v.id)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-600 text-white font-bold"><KeyRound className="w-3 h-3" /> Token</button>
              <button onClick={() => void checkin(v.id)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border font-bold"><ClipboardCheck className="w-3 h-3" /> Manual</button>
            </div>
          ))}
          {voters.length === 0 && <p className="text-[11px] text-[#8C8880]">Semua sudah memilih / belum ada DPT.</p>}
        </div>
      </div>
    </details>
  );
}

function BilikView({ id }: { id: string }) {
  const [token, setToken] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const lookup = async () => {
    setBusy(true); setErr(null); setDone(false);
    try {
      const r = await api('/api/pelsus/bilik/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      setPreview(r); setPicked([]);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Token tidak valid.'); }
    finally { setBusy(false); }
  };
  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      await api('/api/pelsus/bilik', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, candidateIds: picked }) });
      setDone(true);
      window.setTimeout(() => { setPreview(null); setToken(''); setPicked([]); setDone(false); }, 15000);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Gagal menyimpan.'); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    const m = /[?&]token=([A-Za-z0-9]+)/.exec(window.location.hash);
    if (m) { setToken(m[1].toUpperCase()); }
  }, []);
  return (
    <div className="mx-auto max-w-2xl px-5 py-8 space-y-4">
      <h1 className="text-xl font-black text-center">Bilik Suara — {preview?.election?.title || 'Pelsus'}</h1>
      {!preview && !done && (
        <div className="rounded-3xl border bg-white p-6 space-y-3 text-center">
          <KeyRound className="w-8 h-8 mx-auto text-brand" />
          <p className="text-sm font-bold">Masukkan token 6 digit dari petugas</p>
          <input value={token} onChange={(e) => setToken(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16))} placeholder="XXXXXX" className="w-full text-center text-3xl font-black tracking-[0.3em] px-4 py-3 rounded-2xl border" />
          {err && <p className="text-xs text-red-600">{err}</p>}
          <button disabled={busy || token.length < 4} onClick={() => void lookup()} className="w-full py-3.5 rounded-2xl bg-[#1B1B1B] text-white text-sm font-bold disabled:opacity-50">{busy ? 'Memeriksa…' : 'Buka surat suara'}</button>
        </div>
      )}
      {preview && !done && (
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
          <button disabled={busy || !picked.length} onClick={() => void submit()} className="w-full py-4 rounded-2xl bg-emerald-600 text-white text-base font-bold disabled:opacity-50">{busy ? 'Menyimpan…' : `Kirim (${picked.length}/${preview.election.maxChoices})`}</button>
        </div>
      )}
      {done && (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-10 text-center space-y-2">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-600" />
          <p className="text-lg font-black">Suara tersimpan ✓</p>
          <p className="text-xs text-[#5C5850]">Layar dikosongkan otomatis. Silakan kembali ke petugas.</p>
        </div>
      )}
      <p className="text-[11px] text-center text-[#8C8880]">ID pemilihan: {id} · 1 token = 1 suara · jangan foto surat suara</p>
    </div>
  );
}

export function LayarView({ id }: { id: string }) {
  const [code, setCode] = useState(() => { try { return localStorage.getItem(`pelsus_code_${id}`) || ''; } catch { return ''; } });
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setErr(null);
      const r = await api(`/api/pelsus/${encodeURIComponent(id)}/live?code=${encodeURIComponent(code)}`);
      setData(r);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Gagal memuat.'); }
  }, [id, code]);
  useEffect(() => { if (code) void load(); }, [load, code]);
  useEffect(() => {
    if (!code) return;
    let fails = 0; let t: number; let alive = true;
    const tick = async () => {
      if (!alive) return;
      try { await load(); fails = 0; } catch { fails += 1; }
      t = window.setTimeout(tick, Math.max(5000, nextPollDelay(fails, 5000)));
    };
    t = window.setTimeout(tick, 5000);
    return () => { alive = false; window.clearTimeout(t); };
  }, [load, code]);
  const save = (v: string) => {
    const c = v.toUpperCase().trim();
    setCode(c);
    try { localStorage.setItem(`pelsus_code_${id}`, c); } catch { /* abaikan */ }
  };
  if (!code) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#141210] text-white">
        <div className="w-full max-w-sm space-y-3 text-center">
          <MonitorUp className="w-8 h-8 mx-auto" />
          <h1 className="font-black">Layar Proyektor</h1>
          <p className="text-xs text-white/60">Masukkan kode layar 6 digit dari panitia.</p>
          <input id="layar-code" placeholder="XXXXXX" className="w-full text-center text-3xl font-black tracking-[0.3em] px-4 py-3 rounded-2xl bg-white/10 border border-white/20" onKeyDown={(e) => { if (e.key === 'Enter') save((e.target as HTMLInputElement).value); }} />
          {err && <p className="text-xs text-red-300">{err}</p>}
        </div>
      </div>
    );
  }
  const t = data?.turnout || { voted: 0, total: 0 };
  const pct = t.total ? Math.round((t.voted / t.total) * 100) : 0;
  const res = data?.results;
  return (
    <div className="min-h-screen bg-[#141210] text-white p-6 sm:p-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/50">Pemilihan Pelsus · Layar</p>
          <h1 className="text-2xl sm:text-4xl font-black mt-1">{data?.election?.title || 'Memuat…'}</h1>
          <p className="text-xs text-white/50 mt-1">{data?.election ? electionSubtitle(data.election) : ''} · {data?.election?.status}</p>
        </div>
        <div className="rounded-3xl bg-white/5 border border-white/10 p-6 sm:p-10 text-center space-y-3">
          <p className="text-6xl sm:text-8xl font-black tabular-nums">{t.voted}<span className="text-2xl sm:text-4xl text-white/40">/{t.total}</span></p>
          <div className="h-4 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-emerald-400 transition-all" style={{ width: `${pct}%` }} /></div>
          <p className="text-sm font-bold">{data?.quorum?.met ? 'Kuorum ✓ terpenuhi' : `Kuorum: butuh ${data?.quorum?.need || '—'} suara`} · {pct}%</p>
          {err && <p className="text-xs text-red-300">{err}</p>}
        </div>
        {res ? (
          <div className="rounded-3xl bg-white text-[#1B1B1B] p-6 space-y-3">
            <h2 className="font-black">Hasil {data?.election?.status === 'CLOSED' ? '(resmi)' : '(pantau panitia)'}</h2>
            {res.candidates.map((c: any) => {
              const max = Math.max(1, ...res.candidates.map((x: any) => x.voteCount));
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-[#1B1B1B] text-white text-xs font-black flex items-center justify-center">{c.nomor}</span>
                  <span className="text-sm font-bold flex-1 truncate">{c.name} {res.winnerId === c.id && '🏆'}</span>
                  <span className="text-sm font-black tabular-nums">{c.voteCount}</span>
                  <span className="w-32 h-2 rounded-full bg-[#EFEDE8] overflow-hidden hidden sm:block"><span className="block h-full bg-emerald-500" style={{ width: `${Math.round((c.voteCount / max) * 100)}%` }} /></span>
                </div>
              );
            })}
            {res.tie && <p className="text-xs font-bold text-amber-700">Seri — lanjut ke undi oleh panitia (standar GMIM).</p>}
            {data?.election?.status !== 'CLOSED' && <p className="text-[11px] text-[#8C8880]">Tampil karena Anda panitia. Publik hanya lihat partisipasi hingga CLOSED.</p>}
          </div>
        ) : (
          <p className="text-center text-xs text-white/50">Perolehan kandidat dibuka setelah pemilihan ditutup (menjaga kerahasiaan).</p>
        )}
      </div>
    </div>
  );
}

export default function PelsusApp() {
  const [hash, setHash] = useState(() => (typeof window !== 'undefined' ? window.location.hash : ''));
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const route = parsePelsusHash(hash) || { view: 'home' as const, id: '' };
  if (route.view === 'layar') return <LayarView id={route.id} />;
  if (route.view === 'bilik') return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#1B1B1B]"><BilikView id={route.id} /></div>
  );
  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#1B1B1B]">
      {route.view === 'detail' ? <DetailView id={route.id} /> : <HomeView />}
      <p className="text-[11px] text-[#8C8880] text-center pb-8">Pelsus GMIM · 1 orang 1 suara · pilihan dirahasiakan</p>
    </div>
  );
}
