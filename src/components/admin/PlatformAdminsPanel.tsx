import React, { useCallback, useEffect, useState } from 'react';
import { UserPlus, Trash2, Loader2, X } from 'lucide-react';
import {
  grantPlatformAdmin,
  listPlatformAdminGrants,
  revokePlatformAdmin,
  searchGrantableUsers,
} from '../../services/platformApi';

type GrantRow = {
  id: string;
  grantedAt: string;
  note?: string | null;
  user: { id: string; email: string | null; name: string };
  grantedByOperator: { email: string; displayName: string };
};

type SearchUser = {
  id: string;
  name: string;
  email: string | null;
  loginUsername: string | null;
};

function userSubtitle(u: SearchUser) {
  return [u.loginUsername && `@${u.loginUsername}`, u.email].filter(Boolean).join(' · ') || u.id;
}

export const PlatformAdminsPanel: React.FC = () => {
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [selected, setSelected] = useState<SearchUser | null>(null);
  const [note, setNote] = useState('');
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    listPlatformAdminGrants()
      .then((d) => setGrants((d.grants || []) as GrantRow[]))
      .catch((e) => setError((e as Error).message));
  };

  const runSearch = useCallback(async (q: string) => {
    setSearching(true);
    try {
      const d = await searchGrantableUsers(q);
      setResults(d.users || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (selected) return;
    const t = setTimeout(() => void runSearch(query), 250);
    return () => clearTimeout(t);
  }, [query, selected, runSearch]);

  const grant = async () => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      await grantPlatformAdmin(selected.id, note.trim() || undefined);
      setSelected(null);
      setQuery('');
      setNote('');
      load();
      await runSearch('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (grantId: string) => {
    if (!confirm('Cabut grant platform admin?')) return;
    setBusy(true);
    try {
      await revokePlatformAdmin(grantId);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#1B1B1B]">Platform Admins</h2>
        <p className="text-sm text-[#8C8880]">
          Delegasi akses admin ke user jemaat yang sudah ada. Mereka login Google di portal, bukan di #/admin.
        </p>
      </div>

      <div className="rounded-xl border border-[#E8E4DC] bg-white p-4 space-y-3">
        <h3 className="font-semibold text-sm">Grant baru</h3>
        {selected ? (
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[#E8E4DC] bg-[#FAF9F5]">
            <div className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-xs font-bold">
              {(selected.name || '?').charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{selected.name}</p>
              <p className="text-xs text-[#8C8880] truncate">{userSubtitle(selected)}</p>
            </div>
            <button type="button" onClick={() => setSelected(null)} className="p-1 rounded hover:bg-white">
              <X className="w-4 h-4 text-[#8C8880]" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nama, username, atau email…"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#8C8880]" />
              )}
            </div>
            <div className="border rounded-lg max-h-56 overflow-y-auto">
              {results.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setSelected(u);
                    setQuery('');
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[#FAF9F5] border-b border-[#E8E4DC] last:border-0"
                >
                  <div className="w-8 h-8 rounded-full bg-[#FAF9F5] flex items-center justify-center text-xs font-bold text-[#8C8880]">
                    {(u.name || '?').charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{u.name}</p>
                    <p className="text-xs text-[#8C8880] truncate">{userSubtitle(u)}</p>
                  </div>
                </button>
              ))}
              {!searching && !results.length && (
                <p className="px-3 py-6 text-center text-xs text-[#8C8880]">
                  Tidak ada jemaat. Undang dulu di Orang & Provision, lalu grant di sini.
                </p>
              )}
            </div>
          </div>
        )}
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Catatan (opsional)"
          className="w-full px-3 py-2 border rounded-lg text-sm"
        />
        <button
          type="button"
          disabled={busy || !selected}
          onClick={() => void grant()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF416C] text-white text-sm font-medium disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          Assign Admin
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="rounded-xl border border-[#E8E4DC] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#FAF9F5] text-left text-[#8C8880]">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Granted</th>
              <th className="px-4 py-3">Oleh</th>
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody>
            {grants.map((g) => (
              <tr key={g.id} className="border-t border-[#E8E4DC]">
                <td className="px-4 py-3">
                  <div className="font-medium">{g.user.name}</div>
                  <div className="text-xs text-[#8C8880]">{g.user.email || g.user.id}</div>
                </td>
                <td className="px-4 py-3 text-xs">{new Date(g.grantedAt).toLocaleString('id-ID')}</td>
                <td className="px-4 py-3 text-xs">{g.grantedByOperator.displayName}</td>
                <td className="px-4 py-3">
                  <button type="button" onClick={() => void revoke(g.id)} className="text-red-600 hover:text-red-800">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {!grants.length && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[#8C8880]">Belum ada platform admin.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
