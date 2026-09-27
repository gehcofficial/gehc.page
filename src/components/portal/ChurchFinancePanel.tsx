import React, { useEffect, useState } from 'react';
import { Wallet, Plus, Check, X, Send } from 'lucide-react';
import { useApp } from '../../context/AppContext';

type Account = { id: string; code: string; name: string; kind: string; unit: string; balance: number };
type Txn = { id: string; accountId: string; direction: string; amount: number; category: string; description?: string; occurredAt: string; approvedAt?: string | null };
type Funding = { id: string; unit: string; title: string; amount: number; status: string; neededBy?: string | null; rejectReason?: string | null };

const rupiah = (n: number) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
const STATUS_STYLE: Record<string, string> = {
  SUBMITTED: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  DISBURSED: 'bg-sky-50 text-sky-700',
  SETTLED: 'bg-slate-100 text-slate-600',
  REJECTED: 'bg-rose-50 text-rose-700',
};

/** Keuangan: kas, transaksi, pengajuan dana, distribusi. */
export const ChurchFinancePanel: React.FC = () => {
  const { currentRole, addToast } = useApp();
  const isTreasurer = ['SUPERADMIN', 'BPMJ'].includes(currentRole);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [funding, setFunding] = useState<Funding[]>([]);
  const [loading, setLoading] = useState(true);
  const [txnForm, setTxnForm] = useState({ accountId: '', direction: 'OUT', amount: '', category: 'MANUAL', description: '' });
  const [fundForm, setFundForm] = useState({ title: '', amount: '', neededBy: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [acc, fund] = await Promise.all([
        fetch('/api/church/cash/accounts', { credentials: 'include' }).then((r) => (r.ok ? r.json() : { accounts: [] })),
        fetch('/api/church/funding', { credentials: 'include' }).then((r) => (r.ok ? r.json() : { requests: [] })),
      ]);
      const list: Account[] = Array.isArray(acc?.accounts) ? acc.accounts : [];
      setAccounts(list);
      setFunding(Array.isArray(fund?.requests) ? fund.requests : []);
      if (list[0]) {
        setTxnForm((s) => ({ ...s, accountId: s.accountId || list[0].id }));
        const t = await fetch(`/api/church/cash/transactions?accountId=${encodeURIComponent(list[0].id)}`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : { transactions: [] }));
        setTxns(Array.isArray(t?.transactions) ? t.transactions : []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addTxn = async () => {
    const res = await fetch('/api/church/cash/transactions', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...txnForm, amount: Number(txnForm.amount) }),
    });
    if (!res.ok) {
      addToast({ type: 'error', title: 'Gagal menambah transaksi', description: (await res.json().catch(() => ({}))).error });
      return;
    }
    setTxnForm((s) => ({ ...s, amount: '', description: '' }));
    addToast({ type: 'success', title: 'Transaksi dicatat' });
    load();
  };

  const createFunding = async () => {
    const res = await fetch('/api/church/funding', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: fundForm.title, amount: Number(fundForm.amount), neededBy: fundForm.neededBy || undefined }),
    });
    if (!res.ok) {
      addToast({ type: 'error', title: 'Gagal mengajukan dana', description: (await res.json().catch(() => ({}))).error });
      return;
    }
    setFundForm({ title: '', amount: '', neededBy: '' });
    addToast({ type: 'success', title: 'Pengajuan dana dikirim' });
    load();
  };

  const fundingAction = async (f: Funding, action: string, extra: Record<string, unknown> = {}) => {
    const res = await fetch(`/api/church/funding/${f.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    });
    if (!res.ok) {
      addToast({ type: 'error', title: `Gagal ${action}`, description: (await res.json().catch(() => ({}))).error });
      return;
    }
    addToast({ type: 'success', title: `Pengajuan ${action}` });
    load();
  };

  const total = accounts.reduce((s, a) => s + Number(a.balance || 0), 0);

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] bg-white border border-[#D9D7D0] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-[#FF416C]" />
          <h3 className="text-sm font-black uppercase tracking-wide">Keuangan</h3>
          {isTreasurer && <span className="text-[10px] text-[#8C8880]">Total kas: <b>{rupiah(total)}</b></span>}
        </div>

        {loading ? (
          <p className="text-xs text-[#8C8880]">Memuat…</p>
        ) : !isTreasurer ? (
          <p className="text-xs text-[#8C8880]">Rincian kas hanya untuk Bendahara/BPMJ. Anda dapat mengajukan dana di bawah.</p>
        ) : accounts.length === 0 ? (
          <p className="text-xs text-[#8C8880]">Belum ada akun kas.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {accounts.map((a) => (
              <div key={a.id} className="p-3 rounded-2xl border border-[#EFEDE8]">
                <p className="text-[10px] text-[#8C8880]">{a.kind} · {a.unit}</p>
                <p className="text-xs font-bold truncate">{a.name}</p>
                <p className="text-sm font-black">{rupiah(a.balance)}</p>
              </div>
            ))}
          </div>
        )}

        {isTreasurer && accounts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-[1.2fr_.7fr_.8fr_1fr_1.4fr_auto] gap-2 items-center pt-2 border-t border-[#EFEDE8]">
            <select value={txnForm.accountId} onChange={(e) => setTxnForm((s) => ({ ...s, accountId: e.target.value }))} className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs">
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <select value={txnForm.direction} onChange={(e) => setTxnForm((s) => ({ ...s, direction: e.target.value }))} className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs">
              <option value="IN">Masuk</option>
              <option value="OUT">Keluar</option>
            </select>
            <input value={txnForm.amount} onChange={(e) => setTxnForm((s) => ({ ...s, amount: e.target.value.replace(/[^0-9]/g, '') }))} placeholder="Jumlah" className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs" />
            <input value={txnForm.category} onChange={(e) => setTxnForm((s) => ({ ...s, category: e.target.value }))} placeholder="Kategori" className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs" />
            <input value={txnForm.description} onChange={(e) => setTxnForm((s) => ({ ...s, description: e.target.value }))} placeholder="Keterangan" className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs" />
            <button type="button" onClick={addTxn} className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-[#181818] text-white text-xs font-bold">
              <Plus className="w-3.5 h-3.5" /> Catat
            </button>
          </div>
        )}
      </div>

      {isTreasurer && txns.length > 0 && (
        <div className="rounded-[24px] bg-white border border-[#D9D7D0] p-5 space-y-2">
          <h4 className="text-xs font-black uppercase tracking-wide">Transaksi terakhir</h4>
          {txns.slice(0, 20).map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2 text-xs p-2 rounded-xl border border-[#EFEDE8]">
              <span className="truncate">{t.category} · {t.description || '—'}</span>
              <span className={`font-bold ${t.direction === 'IN' ? 'text-emerald-700' : 'text-rose-700'}`}>
                {t.direction === 'IN' ? '+' : '−'}{rupiah(t.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-[24px] bg-white border border-[#D9D7D0] p-5 space-y-3">
        <h4 className="text-xs font-black uppercase tracking-wide">Pengajuan Dana</h4>
        <div className="grid grid-cols-1 md:grid-cols-[1.6fr_.8fr_1fr_auto] gap-2 items-center">
          <input value={fundForm.title} onChange={(e) => setFundForm((s) => ({ ...s, title: e.target.value }))} placeholder="Keperluan" className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs" />
          <input value={fundForm.amount} onChange={(e) => setFundForm((s) => ({ ...s, amount: e.target.value.replace(/[^0-9]/g, '') }))} placeholder="Jumlah" className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs" />
          <input type="date" value={fundForm.neededBy} onChange={(e) => setFundForm((s) => ({ ...s, neededBy: e.target.value }))} className="px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs" />
          <button type="button" onClick={createFunding} className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-[#181818] text-white text-xs font-bold">
            <Send className="w-3.5 h-3.5" /> Ajukan
          </button>
        </div>
        {funding.length === 0 ? (
          <p className="text-xs text-[#8C8880]">Belum ada pengajuan.</p>
        ) : (
          funding.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center gap-2 p-3 rounded-2xl border border-[#EFEDE8]">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate">{f.title}</p>
                <p className="text-[10px] text-[#8C8880]">{f.unit} · {rupiah(f.amount)}</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[f.status] || 'bg-slate-100 text-slate-600'}`}>{f.status}</span>
              {isTreasurer && f.status === 'SUBMITTED' && (
                <>
                  <button type="button" onClick={() => fundingAction(f, 'approve')} className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50" title="Setujui"><Check className="w-4 h-4" /></button>
                  <button type="button" onClick={() => fundingAction(f, 'reject')} className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-50" title="Tolak"><X className="w-4 h-4" /></button>
                </>
              )}
              {isTreasurer && f.status === 'APPROVED' && (
                <button type="button" onClick={() => fundingAction(f, 'disburse', { accountId: accounts[0]?.id })} className="text-[10px] font-bold px-2 py-1 rounded-full bg-sky-50 text-sky-700">
                  Cairkan
                </button>
              )}
              {isTreasurer && f.status === 'DISBURSED' && (
                <button type="button" onClick={() => fundingAction(f, 'settle')} className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100">
                  Settle
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ChurchFinancePanel;
