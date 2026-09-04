import React, { useEffect, useState } from 'react';
import { ShieldCheck, Copy, Trash2, UserPlus, CheckCircle2, Loader2, X } from 'lucide-react';
import { UserRole } from '../../types';
import { ProvisionInviteWizard } from './ProvisionInviteWizard';
import { AccessGroupsPanel } from './AccessGroupsPanel';
import { displayAvatar } from '../../lib/avatar';
import { useLang } from '../../context/LangContext';
import { fmt, portalRoleLabel } from '../../lib/portal-i18n';
import { PanelGuide } from './PanelGuide';
import { useListPager } from './ListPager';

const ROLES: UserRole[] = ['SUPERADMIN', 'BPMJ', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR', 'MENTEE', 'ALUMNI'];

interface ApiUser {
  id: string;
  name: string;
  email: string | null;
  loginUsername?: string | null;
  linkStatus?: string | null;
  googleSub?: string | null;
  avatar: string | null;
  accountStatus: string;
  groupCount: number;
  roles: { role: string; groupId?: string | null }[];
}

interface InviteDto {
  code: string;
  type: string;
  defaultRole: string;
  maxUses: number;
  uses: number;
  expiresAt: string | null;
}

const authedFetch = async (url: string, method = 'GET', body?: unknown) => {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: method !== 'GET' ? { 'Content-Type': 'application/json' } : undefined,
    body: method !== 'GET' ? JSON.stringify(body ?? {}) : undefined,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error((e as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json();
};

export const PeopleInvites: React.FC<{ onNavigate?: (tabId: string) => void }> = ({ onNavigate }) => {
  const { t } = useLang();
  const p = t.portal.people;
  const [tab, setTab] = useState<'akun' | 'invite' | 'provision' | 'access-groups'>('akun');
  const [users, setUsers] = useState<ApiUser[] | null>(null);
  const [invites, setInvites] = useState<InviteDto[] | null>(null);
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiUser | null>(null);
  const [newInvite, setNewInvite] = useState({ type: 'SINGLE', defaultRole: 'MENTEE', maxUses: 1, expiresDays: 14 });
  const [lastLink, setLastLink] = useState('');

  const loadUsers = () => authedFetch('/api/db/users').then((d) => setUsers(d.users));
  const loadInvites = () => authedFetch('/api/invites').then((d) => setInvites(d.invites));

  useEffect(() => {
    loadUsers().catch(console.error);
    loadInvites().catch(console.error);
  }, []);

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await loadUsers();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const pending = (users || []).filter((u) => u.accountStatus === 'PENDING');
  const filtered = (users || []).filter((u) => {
    if (!q) return true;
    const hay = `${u.name} ${u.email || ''} ${u.loginUsername || ''} ${u.id}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });
  const { pageItems: pagedUsers, pager: usersPager } = useListPager<ApiUser>(filtered);
  const { pageItems: pagedInvites, pager: invitesPager } = useListPager<InviteDto>(invites || []);

  const guideId =
    tab === 'akun' ? 'people.akun' : tab === 'provision' ? 'people.provision' : tab === 'access-groups' ? 'people.access-groups' : 'people.invite';

  if (users === null || invites === null) {
    return (
      <div className="py-20 text-center text-sm text-[#8C8880] flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> {t.portal.common.loading}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-[#D9D7D0]/50 shadow-sm">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF9F5] border border-[#D9D7D0] mb-2">
          <ShieldCheck className="w-3.5 h-3.5 text-[#FF416C]" />
          <span className="text-[11px] font-bold text-[#8C8880] uppercase tracking-wider">{p.badge}</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{p.title}</h2>
        <p className="text-xs sm:text-sm text-[#8C8880] mt-1">{p.subtitle}</p>
      </div>

      <PanelGuide guideId={guideId} />

      <div className="flex items-center gap-2 border-b border-[#D9D7D0]/60 pb-3 flex-wrap">
        {([
          ['akun', fmt(p.tabAkun, { n: (users || []).length })],
          ['provision', p.tabProvision],
          ['access-groups', p.tabAccess],
          ['invite', p.tabInvite],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
              tab === id ? 'bg-[#181818] text-white shadow-md' : 'bg-white border border-[#D9D7D0]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {pending.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-xs text-amber-900">{fmt(p.pendingBanner, { n: pending.length })}</p>
          {onNavigate && (
            <button onClick={() => onNavigate('onboarding')} className="px-3 py-1.5 rounded-xl bg-amber-700 text-white text-xs font-bold shrink-0">
              {p.openOnboarding}
            </button>
          )}
        </div>
      )}

      {tab === 'akun' && (
        <>
          <input
            placeholder={p.searchPlaceholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full px-4 py-2.5 rounded-full bg-white border border-[#D9D7D0] text-xs font-medium"
          />
          <p className="text-[11px] text-[#8C8880]">{p.assignHint}</p>
          {usersPager}
          <div className="space-y-2">
            {pagedUsers.map((u) => (
              <div key={u.id} className="bg-white rounded-2xl border border-[#D9D7D0]/50 p-4">
                <div className="flex items-center gap-3">
                  <img src={displayAvatar(u.name, u.avatar)} alt={u.name} loading="lazy" decoding="async"
                    className="w-9 h-9 rounded-full object-cover border border-[#D9D7D0]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">{u.name}</p>
                    <p className="text-[10px] text-[#8C8880] truncate">
                      {u.loginUsername ? `@${u.loginUsername}` : u.id}
                      {u.email ? ` · ${u.email}` : ''}
                    </p>
                    <p className="text-[9px] text-[#8C8880] mt-0.5">
                      {u.linkStatus === 'LINKED' && u.googleSub ? p.linked : p.unlinked}
                    </p>
                  </div>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                    u.accountStatus === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {u.accountStatus}
                  </span>
                  <div className="hidden lg:flex gap-1 shrink-0">
                    {u.roles.map((r, i) => (
                      <span key={i} className="text-[8px] font-black px-1.5 py-0.5 rounded bg-[#F3F1EC] text-[#8C8880] uppercase">
                        {portalRoleLabel(t, r.role)}{r.groupId ? p.groupTag : ''}
                      </span>
                    ))}
                  </div>
                </div>

                  <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-[#D9D7D0]/40">
                    {u.accountStatus === 'PENDING' && (
                    <button
                      onClick={() => act(async () => { setBusyId(u.id); await authedFetch(`/api/people/${u.id}`, 'PATCH', { action: 'approve' }); })}
                      disabled={busyId === u.id}
                      className="text-[10px] font-black px-3 py-1.5 rounded-full bg-emerald-600 text-white flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3" /> {t.portal.common.approve}
                    </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(u)}
                      className="text-[10px] font-black px-3 py-1.5 rounded-full border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1"
                      title={p.deleteUser}
                    >
                      <Trash2 className="w-3 h-3" /> {p.deleteUser}
                    </button>
                  </div>
              </div>
            ))}
          </div>
        </>
      )}

      {deleteTarget && (
        <DeleteUserModal
          user={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={async () => {
            setDeleteTarget(null);
            await loadUsers();
          }}
        />
      )}

      {tab === 'provision' && <ProvisionInviteWizard />}

      {tab === 'access-groups' && <AccessGroupsPanel />}

      {tab === 'invite' && (
        <div className="space-y-6">
          <div className="bg-white rounded-[28px] border border-[#D9D7D0]/50 p-6 space-y-4">
            <h3 className="text-sm font-black flex items-center gap-2"><UserPlus className="w-4 h-4 text-[#FF416C]" /> {p.createInvite}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <select value={newInvite.type} onChange={(e) => setNewInvite({ ...newInvite, type: e.target.value, maxUses: e.target.value === 'SINGLE' ? 1 : 25 })}
                className="px-3 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-semibold">
                <option value="SINGLE">{p.typeSingle}</option>
                <option value="TEAM">{p.typeTeam}</option>
              </select>
              <select value={newInvite.defaultRole} onChange={(e) => setNewInvite({ ...newInvite, defaultRole: e.target.value as UserRole })}
                className="px-3 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-semibold">
                {ROLES.map((r) => <option key={r} value={r}>{portalRoleLabel(t, r)}</option>)}
              </select>
              <input type="number" min={1} value={newInvite.maxUses}
                onChange={(e) => setNewInvite({ ...newInvite, maxUses: Number(e.target.value) })}
                placeholder={p.maxUses} className="px-3 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-semibold" />
              <input type="number" min={1} value={newInvite.expiresDays}
                onChange={(e) => setNewInvite({ ...newInvite, expiresDays: Number(e.target.value) })}
                placeholder={p.expiresDays} className="px-3 py-2 rounded-xl bg-white border border-[#D9D7D0] text-xs font-semibold" />
            </div>
            <CreateInviteBtn form={newInvite} setInvites={setInvites} setLastLink={setLastLink} label={p.generateLink} />
            {lastLink && (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 flex items-center gap-2">
                <code className="text-[11px] flex-1 truncate">{lastLink}</code>
                <CopyBtn text={lastLink} />
              </div>
            )}
          </div>

          {invitesPager}
          <div className="space-y-2">
            {pagedInvites.map((inv) => {
              const expired = inv.expiresAt && new Date(inv.expiresAt) < new Date();
              const habis = inv.uses >= inv.maxUses;
              const dead = expired || habis;
              return (
                <div key={inv.code} className="bg-white rounded-2xl border border-[#D9D7D0]/50 px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black font-mono">{inv.code}</p>
                    <p className="text-[10px] text-[#8C8880]">
                      {inv.type} • {portalRoleLabel(t, inv.defaultRole)} • {inv.uses}/{inv.maxUses}
                      {inv.expiresAt ? ` • ${new Date(inv.expiresAt).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!dead && <CopyBtn text={`${window.location.origin}/#/join?inv=${inv.code}`} />}
                    <button onClick={async () => { await authedFetch(`/api/invites/${inv.code}`, 'DELETE'); loadInvites(); }}
                      className="p-2 rounded-lg hover:bg-red-50 text-red-500" title={p.revoke}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const DeleteUserModal: React.FC<{
  user: ApiUser;
  onClose: () => void;
  onDeleted: () => Promise<void>;
}> = ({ user, onClose, onDeleted }) => {
  const { t } = useLang();
  const p = t.portal.people;
  const linked = user.linkStatus === 'LINKED' && Boolean(user.googleSub);
  const expected = user.loginUsername || user.email || user.name;
  const [confirm, setConfirm] = useState('');
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await authedFetch(`/api/people/${user.id}`, 'DELETE', {
        confirm,
        confirmPhrase: linked ? phrase : undefined,
      });
      await onDeleted();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black">{p.deleteTitle}</h3>
            <p className="text-xs text-[#8C8880] mt-1">{p.deleteWarn}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
            <X className="w-4 h-4 text-[#8C8880]" />
          </button>
        </div>
        <div className="rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0] p-3 text-xs space-y-1">
          <p className="font-bold">{user.name}</p>
          <p className="font-mono text-[11px]">{user.loginUsername ? `@${user.loginUsername}` : user.id}</p>
          {user.email && <p className="text-[#8C8880]">{user.email}</p>}
          <p className={linked ? 'text-amber-700 font-bold' : 'text-[#8C8880]'}>
            {linked ? p.linked : p.unlinked}
          </p>
        </div>
        <label className="block space-y-1">
          <span className="text-[11px] font-bold">{p.deleteConfirmLabel}</span>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={String(expected || '')}
            className="w-full px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm"
            autoComplete="off"
          />
        </label>
        {linked && (
          <label className="block space-y-1">
            <span className="text-[11px] font-bold">{p.deletePhraseLabel}</span>
            <input
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={p.deletePhrasePh}
              className="w-full px-3 py-2 rounded-xl border border-amber-200 text-sm"
              autoComplete="off"
            />
          </label>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-full border text-xs font-bold">
            {t.portal.common.cancel}
          </button>
          <button
            type="button"
            disabled={busy || !confirm.trim() || (linked && phrase.trim().toUpperCase() !== 'HAPUS')}
            onClick={() => void submit()}
            className="flex-1 py-2.5 rounded-full bg-red-600 text-white text-xs font-black disabled:opacity-50"
          >
            {busy ? '…' : p.deleteSubmit}
          </button>
        </div>
      </div>
    </div>
  );
};

const CreateInviteBtn: React.FC<{
  form: { type: string; defaultRole: string; maxUses: number; expiresDays: number };
  setInvites: (i: InviteDto[]) => void;
  setLastLink: (l: string) => void;
  label: string;
}> = ({ form, setInvites, setLastLink, label }) => {
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        setBusy(true);
        try {
          const d = await authedFetch('/api/invites', 'POST', form);
          const all = await authedFetch('/api/invites');
          setInvites(all.invites);
          setLastLink(`${window.location.origin}/#/join?inv=${d.invite.code}`);
        } catch (e) {
          alert((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
      disabled={busy}
      className="w-full py-2.5 rounded-full bg-[#181818] text-white text-xs font-black uppercase tracking-wider disabled:opacity-50"
    >
      {label}
    </button>
  );
};

const CopyBtn: React.FC<{ text: string }> = ({ text }) => {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      title={t.portal.common.copy}
      className="p-2 rounded-lg hover:bg-gray-100"
    >
      {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-[#8C8880]" />}
    </button>
  );
};
