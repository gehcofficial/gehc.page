import React, { useEffect, useState } from 'react';
import { UserPlus, Trash2, Loader2 } from 'lucide-react';
import { grantPlatformAdmin, listPlatformAdminGrants, revokePlatformAdmin } from '../../services/platformApi';

type GrantRow = {
  id: string;
  grantedAt: string;
  note?: string | null;
  user: { id: string; email: string | null; name: string };
  grantedByOperator: { email: string; displayName: string };
};

export const PlatformAdminsPanel: React.FC = () => {
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [userId, setUserId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    listPlatformAdminGrants()
      .then((d) => setGrants((d.grants || []) as GrantRow[]))
      .catch((e) => setError((e as Error).message));
  };

  useEffect(() => {
    load();
  }, []);

  const grant = async () => {
    setBusy(true);
    setError('');
    try {
      await grantPlatformAdmin(userId.trim(), note.trim() || undefined);
      setUserId('');
      setNote('');
      load();
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
        <p className="text-sm text-[#8C8880]">Delegasi akses admin ke user jemaat existing (Google SSO).</p>
      </div>

      <div className="rounded-xl border border-[#E8E4DC] bg-white p-4 space-y-3">
        <h3 className="font-semibold text-sm">Grant baru</h3>
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="User ID (usr-...)"
          className="w-full px-3 py-2 border rounded-lg text-sm"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Catatan (opsional)"
          className="w-full px-3 py-2 border rounded-lg text-sm"
        />
        <button
          type="button"
          disabled={busy || !userId.trim()}
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
