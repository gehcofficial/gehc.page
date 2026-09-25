import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, CheckCircle2, Vote, RefreshCw, Lock, Unlock, Trophy, Users, CalendarClock, RotateCcw, UserCog } from 'lucide-react';
import { ConfirmDialog } from '../ui/ConfirmDialog';

type Option = { id: string; optionNo: number; label: string; imageFileId: string | null; voteCount: number };
type GroupCard = {
  groupId: string;
  name: string;
  philosophy: string;
  canVote: boolean;
  myOptionId: string | null;
  total: number;
  voters: { voted: number; total: number };
  options: Option[];
};
type VotingData = {
  session: { id: string; title: string; description?: string | null; status: string; closesAt?: string | null } | null;
  open?: boolean;
  deadline?: string | null;
  canAdmin: boolean;
  activeRole: string;
  roleAllowed: boolean;
  beyonderRoles: string[];
  myGroupIds: string[];
  overall: { voted: number; total: number };
  groups: GroupCard[];
};

const WIB = 7 * 3600 * 1000;
const pad = (n: number) => String(n).padStart(2, '0');
function toWibInput(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const t = new Date(d.getTime() + WIB);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}
function fromWibInput(v: string) { return v ? `${v}:00+07:00` : null; }
function nextSunday1700() {
  const t = new Date(Date.now() + WIB);
  const add = (7 - t.getUTCDay()) % 7;
  const d = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() + add));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T17:00`;
}
function fmtWib(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB';
}
function countdown(iso?: string | null) {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return '';
  if (ms <= 0) return 'Sudah lewat';
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  const remH = h % 24;
  return d > 0 ? `${d} hari ${remH} jam lagi` : `${h} jam ${Math.floor((ms % 3600000) / 60000)} menit lagi`;
}

/** Standalone page: pemilihan logo kelompok (Beyonders). Route #/voting */
export default function GroupLogoVote() {
  const [state, setState] = useState<{ status: 'loading' | 'ok' | 'error'; message?: string }>({ status: 'loading' });
  const [data, setData] = useState<VotingData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [deadlineInput, setDeadlineInput] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/voting', { credentials: 'include', cache: 'no-store' });
      if (r.status === 401) { window.location.hash = `#/login?next=${encodeURIComponent('#/voting')}`; return; }
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setState({ status: 'error', message: d.error || `Gagal memuat (server ${r.status}).` }); return; }
      setData(d);
      setDeadlineInput((prev) => prev || toWibInput(d.deadline) || nextSunday1700());
      setState({ status: 'ok' });
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : 'Gagal memuat.' });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => { void load(); }, 60000);
    return () => clearInterval(t);
  }, [load]);

  const vote = async (optionId: string) => {
    setBusy(optionId);
    try {
      const r = await fetch('/api/voting/ballot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ optionId }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal menyimpan pilihan.');
      await load();
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : 'Gagal menyimpan pilihan.' });
    } finally { setBusy(null); }
  };

  const sessionAction = async (action: 'open' | 'close' | 'reset', extra?: Record<string, unknown>) => {
    setBusy(action);
    try {
      const r = await fetch('/api/voting/session', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ action, ...(extra || {}) }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Gagal memperbarui sesi.');
      setConfirmReset(false);
      await load();
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : 'Gagal memperbarui sesi.' });
    } finally { setBusy(null); }
  };

  const switchRole = async (role: string) => {
    setBusy(`role-${role}`);
    try {
      const r = await fetch('/api/auth/active-role', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ role }) });
      if (!r.ok) throw new Error('Gagal mengganti peran.');
      window.location.reload();
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : 'Gagal mengganti peran.' });
    } finally { setBusy(null); }
  };

  const open = Boolean(data?.open);

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#1B1B1B]">
      <header className="border-b border-[#D9D7D0]/60 bg-white">
        <div className="mx-auto max-w-5xl px-5 py-5 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[#1B1B1B] text-white"><Vote className="w-4 h-4" /></span>
          <div>
            <h1 className="text-lg font-black">{data?.session?.title || 'Pemilihan Logo Kelompok'}</h1>
            <p className="text-xs text-[#8C8880]">{data?.session?.description || 'Pilih satu dari dua opsi logo untuk kelompok Anda.'}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {data?.session && (
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${open ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                {open ? 'Dibuka' : data.session.status === 'CLOSED' ? 'Ditutup' : 'Draft'}
              </span>
            )}
            {data?.canAdmin && (
              <>
                <button type="button" onClick={() => void sessionAction('open')} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"><Unlock className="w-3.5 h-3.5" /> Buka</button>
                <button type="button" onClick={() => void sessionAction('close')} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-50"><Lock className="w-3.5 h-3.5" /> Tutup</button>
                <button type="button" onClick={() => setConfirmReset(true)} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-red-200 text-red-600 text-xs font-bold disabled:opacity-50"><RotateCcw className="w-3.5 h-3.5" /> Reset suara</button>
              </>
            )}
            <button type="button" onClick={() => void load()} disabled={!!busy} className="p-2 rounded-xl border border-[#D9D7D0] bg-white disabled:opacity-50" title="Muat ulang">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {data?.session && (
          <div className="mx-auto max-w-5xl px-5 pb-4 flex flex-wrap items-center gap-3 text-[11px] text-[#8C8880]">
            <span className="inline-flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" />
              {data.deadline ? <>Ditutup {fmtWib(data.deadline)} <b className="text-[#1B1B1B]">({countdown(data.deadline)})</b></> : 'Tanpa deadline'}
            </span>
            {data.canAdmin && (
              <span className="inline-flex items-center gap-1 flex-wrap">
                <input type="datetime-local" value={deadlineInput} onChange={(e) => setDeadlineInput(e.target.value)} className="px-2 py-1 rounded-lg border border-[#D9D7D0] bg-white" />
                <button type="button" onClick={() => void sessionAction('open', { closesAt: fromWibInput(deadlineInput) })} disabled={!!busy || !deadlineInput} className="px-2 py-1 rounded-lg bg-sky-600 text-white font-bold disabled:opacity-50">Simpan deadline (WIB)</button>
                <button type="button" onClick={() => void sessionAction('open', { clearDeadline: true })} disabled={!!busy} className="px-2 py-1 rounded-lg border border-[#D9D7D0] bg-white font-bold text-[#8C8880]">Hapus deadline</button>
                <button type="button" onClick={() => setDeadlineInput(nextSunday1700())} className="px-2 py-1 rounded-lg border border-[#D9D7D0] bg-white font-bold text-[#8C8880]">Minggu 17:00</button>
              </span>
            )}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-5 py-6 space-y-5">
        {state.status === 'loading' && <p className="text-sm text-[#8C8880] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat…</p>}
        {state.status === 'error' && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.message}</div>}

        {state.status === 'ok' && data && !data.roleAllowed && data.session && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-2">
            <p className="flex items-center gap-2 font-bold"><UserCog className="w-4 h-4" /> Voting hanya untuk Beyonders (Mentee / Mentor / Co-Mentor).</p>
            <p className="text-xs">
              {data.canAdmin
                ? <>Anda sedang memakai peran <b>{data.activeRole || 'tidak diketahui'}</b> (admin tidak ikut memilih). </>
                : <>Anda sedang memakai peran <b>{data.activeRole || 'tidak diketahui'}</b>. </>}
              {data.beyonderRoles.length > 0 ? 'Ganti ke peran Beyonder Anda untuk ikut memilih.' : 'Silakan login dengan akun Beyonders (mentee/mentor/co-mentor).'}
            </p>
            {data.beyonderRoles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {data.beyonderRoles.map((r) => (
                  <button key={r} type="button" onClick={() => void switchRole(r)} disabled={!!busy} className="px-3 py-1.5 rounded-xl bg-[#1B1B1B] text-white text-xs font-bold disabled:opacity-50">
                    {busy === `role-${r}` ? 'Beralih…' : `Ganti ke peran ${r}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {state.status === 'ok' && data && data.session && data.groups.length > 0 && (
          <div className="rounded-2xl border border-[#D9D7D0] bg-white p-4 flex flex-wrap items-center gap-3">
            <Users className="w-4 h-4 text-[#0EA5E9]" />
            <p className="text-sm font-bold">Partisipasi: {data.overall.voted} dari {data.overall.total} pemilih</p>
            <div className="flex-1 min-w-[160px] h-2 rounded-full bg-[#EFEDE8] overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: `${data.overall.total ? Math.round((data.overall.voted / data.overall.total) * 100) : 0}%` }} />
            </div>
          </div>
        )}

        {state.status === 'ok' && data && !data.session && (
          <div className="rounded-2xl border border-[#D9D7D0] bg-white px-6 py-10 text-center">
            <p className="text-sm font-bold">Belum ada sesi pemilihan.</p>
            <p className="text-xs text-[#8C8880] mt-1">Hubungi Komisi/Didaskalia untuk membuka sesi.</p>
          </div>
        )}

        {state.status === 'ok' && data && data.session && data.groups.length === 0 && (
          <div className="rounded-2xl border border-[#D9D7D0] bg-white px-6 py-10 text-center">
            <p className="text-sm font-bold">Belum ada logo untuk kelompok Anda.</p>
            <p className="text-xs text-[#8C8880] mt-1">Pastikan Anda terdaftar di salah satu kelompok Beyonders.</p>
          </div>
        )}

        {state.status === 'ok' && data && data.groups.map((g) => {
          const pct = g.voters.total ? Math.round((g.voters.voted / g.voters.total) * 100) : 0;
          return (
            <section key={g.groupId} className="rounded-3xl border border-[#D9D7D0]/60 bg-white p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-black">{g.name}</h2>
                {g.myOptionId && <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5"><CheckCircle2 className="w-3 h-3" /> Pilihan tersimpan</span>}
                <span className="ml-auto text-[11px] text-[#8C8880]">{g.voters.voted} dari {g.voters.total} sudah memilih · {g.total} suara</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#EFEDE8] overflow-hidden">
                <div className="h-full bg-sky-500" style={{ width: `${pct}%` }} />
              </div>
              {g.philosophy && <p className="text-xs text-[#5C5850] leading-relaxed whitespace-pre-line">{g.philosophy}</p>}

              <div className="grid sm:grid-cols-2 gap-4">
                {g.options.map((o) => {
                  const mine = g.myOptionId === o.id;
                  const opct = g.total ? Math.round(((o.voteCount || 0) / g.total) * 100) : 0;
                  const src = o.imageFileId ? (o.imageFileId.startsWith('/') ? o.imageFileId : `/api/voting/asset/${o.imageFileId}`) : '';
                  return (
                    <div key={o.id} className={`rounded-2xl border p-4 space-y-3 transition-colors ${mine ? 'border-emerald-400 bg-emerald-50/40' : 'border-[#D9D7D0] bg-[#FAF9F5]'}`}>
                      <div className="aspect-square rounded-xl bg-white border border-[#EFEDE8] overflow-hidden flex items-center justify-center">
                        {src ? <img src={src} alt={`${g.name} ${o.label}`} className="w-full h-full object-contain p-4" loading="lazy" /> : <span className="text-[11px] text-[#8C8880]">Gambar belum tersedia</span>}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold">{o.label}</p>
                        <span className="text-[11px] font-bold text-[#8C8880]">{o.voteCount || 0} · {opct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#EFEDE8] overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${opct}%` }} />
                      </div>
                      {g.canVote ? (
                        <button type="button" onClick={() => void vote(o.id)} disabled={!!busy} className={`w-full py-2.5 rounded-xl text-xs font-bold disabled:opacity-50 ${mine ? 'bg-emerald-600 text-white' : 'bg-[#1B1B1B] text-white'}`}>
                          {busy === o.id ? 'Menyimpan…' : mine ? 'Pilihan Anda' : `Pilih ${o.label}`}
                        </button>
                      ) : (
                        <p className="text-[11px] text-[#8C8880] text-center">
                          {!open ? 'Pemilihan belum dibuka / sudah ditutup.' : data.myGroupIds.includes(g.groupId) ? 'Ganti ke peran Beyonder untuk memilih.' : 'Anda tidak terdaftar di kelompok ini.'}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {state.status === 'ok' && data?.canAdmin && data.groups.length > 0 && (
          <div className="rounded-2xl border border-[#D9D7D0] bg-white p-4">
            <p className="text-xs font-black flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5" /> Rekap sementara</p>
            <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {data.groups.map((g) => {
                const top = [...g.options].sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0))[0];
                const tie = g.options.length > 1 && g.options[0].voteCount === g.options[1].voteCount && g.total > 0;
                return (
                  <div key={g.groupId} className="rounded-xl bg-[#FAF9F5] px-3 py-2">
                    <p className="text-[11px] font-bold">{g.name}</p>
                    <p className="text-[11px] text-[#8C8880]">{g.total === 0 ? 'Belum ada suara' : tie ? 'Seri' : `Unggul: ${top.label} (${top.voteCount})`}</p>
                    <p className="text-[10px] text-[#8C8880]">{g.voters.voted}/{g.voters.total} memilih</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-[11px] text-[#8C8880] text-center pt-2">Beyonders · GEHC Youth — satu suara per orang per kelompok.</p>
      </main>

      <ConfirmDialog
        open={confirmReset}
        title="Reset semua suara?"
        tone="danger"
        confirmLabel="Ya, hapus semua suara"
        busy={busy === 'reset'}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => void sessionAction('reset')}
        description={<p>Semua pilihan pada sesi ini akan dihapus dan hitungan kembali ke 0. Tindakan ini tidak dapat dibatalkan.</p>}
      />
    </div>
  );
}
