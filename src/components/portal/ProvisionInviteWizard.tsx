import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, UserPlus, Copy, CheckCircle2, Download, Users, Plus, Trash2 } from 'lucide-react';
import { UserRole } from '../../types';
import {
  BEYONDERS_GROUPS,
  formatBulkShareText,
  formatCredentialBlock,
  type InviteType,
} from '../../lib/invite-credentials';
import { OrgSlotPicker } from './OrgSlotPicker';
import { useLang } from '../../context/LangContext';
import { fmt, portalRoleLabel } from '../../lib/portal-i18n';

const MENTORING_ROLES: UserRole[] = ['MENTOR', 'CO_MENTOR', 'MENTEE'];
const STAFF_ROLES: UserRole[] = ['KOMISI', 'COMMITTEE', 'BPMJ'];
const MAX_BULK = 40;

export type ProvisionRow = {
  name: string;
  loginUsername?: string;
  email?: string | null;
  role: string;
  userId?: string;
  tempPassword?: string;
  claimUrl?: string;
  error?: string;
};

type BulkDraft = {
  key: string;
  name: string;
  loginUsername: string;
  email: string;
  role: UserRole;
  groupId: string;
  orgNodeId: string;
};

function newDraftKey() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `row-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clampRole(inviteType: InviteType, role: UserRole): UserRole {
  if (inviteType === 'beyonders' && !MENTORING_ROLES.includes(role)) return 'MENTEE';
  if (inviteType === 'staff' && !STAFF_ROLES.includes(role)) return 'KOMISI';
  if (inviteType === 'individual') return 'MENTEE';
  return role;
}

function makeDraft(inviteType: InviteType, role: UserRole, groupId: string): BulkDraft {
  return {
    key: newDraftKey(),
    name: '',
    loginUsername: '',
    email: '',
    role: clampRole(inviteType, role),
    groupId,
    orgNodeId: '',
  };
}

function downloadResultsCsv(rows: ProvisionRow[]) {
  const ok = rows.filter((r) => !r.error);
  const header = 'name,loginUsername,email,role,temporaryPassword,claimUrl';
  const body = ok.map((r) =>
    `"${r.name.replace(/"/g, '""')}","${r.loginUsername || ''}","${r.email || ''}","${r.role}","${r.tempPassword || ''}","${r.claimUrl || ''}"`,
  );
  const blob = new Blob([[header, ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gehc-invite-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const ProvisionInviteWizard: React.FC = () => {
  const { t } = useLang();
  const p = t.portal.people;
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [inviteType, setInviteType] = useState<InviteType>('beyonders');
  const [name, setName] = useState('');
  const [loginUsername, setLoginUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('MENTEE');
  const [groupId, setGroupId] = useState('grp-1');
  const [orgNodeId, setOrgNodeId] = useState('');
  const [groups, setGroups] = useState(BEYONDERS_GROUPS);
  const [bulkDrafts, setBulkDrafts] = useState<BulkDraft[]>(() => [
    makeDraft('beyonders', 'MENTEE', 'grp-1'),
    makeDraft('beyonders', 'MENTEE', 'grp-1'),
  ]);
  const [useUniformPassword, setUseUniformPassword] = useState(false);
  const [uniformPassword, setUniformPassword] = useState('GEHCikarang');
  const [busy, setBusy] = useState(false);
  const [singleResult, setSingleResult] = useState<ProvisionRow | null>(null);
  const [bulkResults, setBulkResults] = useState<ProvisionRow[] | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/groups-lite', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.groups?.length) setGroups(d.groups);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const next = clampRole(inviteType, role);
    if (next !== role) setRole(next);
    if (inviteType !== 'staff') setOrgNodeId('');
    setBulkDrafts((rows) =>
      rows.map((r) => ({
        ...r,
        role: clampRole(inviteType, r.role),
        orgNodeId: inviteType === 'staff' ? r.orgNodeId : '',
      })),
    );
  }, [inviteType]); // eslint-disable-line react-hooks/exhaustive-deps

  const namedDrafts = useMemo(() => bulkDrafts.filter((r) => r.name.trim()), [bulkDrafts]);
  const roleOptions = inviteType === 'beyonders' ? MENTORING_ROLES : inviteType === 'staff' ? STAFF_ROLES : (['MENTEE'] as UserRole[]);

  const copyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* ignore */ }
  };

  const bannerFor = (personName: string) => fmt(p.bulkBlockBanner, { name: personName });

  const provisionPayload = () => ({
    useUniformPassword,
    inviteType,
    groupId: inviteType === 'beyonders' ? groupId : undefined,
    orgNodeId: inviteType === 'staff' ? orgNodeId || undefined : undefined,
    ...(useUniformPassword && uniformPassword.trim() ? { uniformPassword: uniformPassword.trim() } : {}),
  });

  const updateDraft = (key: string, patch: Partial<BulkDraft>) => {
    setBulkDrafts((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const addDraft = () => {
    if (bulkDrafts.length >= MAX_BULK) return;
    const last = bulkDrafts[bulkDrafts.length - 1];
    setBulkDrafts((rows) => [
      ...rows,
      makeDraft(inviteType, last?.role || role, last?.groupId || groupId),
    ]);
  };

  const removeDraft = (key: string) => {
    setBulkDrafts((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.key !== key)));
  };

  const submitSingle = async () => {
    if (!name.trim()) return;
    if (inviteType === 'beyonders' && !groupId) return;
    if (inviteType === 'staff' && !orgNodeId) {
      alert(p.pickOrgSlot);
      return;
    }
    setBusy(true);
    setSingleResult(null);
    setBulkResults(null);
    try {
      const res = await fetch('/api/admin/users/invite-provision', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          loginUsername: loginUsername.trim() || undefined,
          email: email.trim().toLowerCase() || undefined,
          role,
          ...provisionPayload(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSingleResult({
        name: data.name || name.trim(),
        loginUsername: data.loginUsername,
        email: data.email,
        role: data.role,
        userId: data.userId,
        tempPassword: data.tempPassword,
        claimUrl: data.claimUrl,
      });
      setName('');
      setLoginUsername('');
      setEmail('');
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submitBulk = async () => {
    if (!namedDrafts.length) return;
    if (inviteType === 'beyonders' && namedDrafts.some((r) => !r.groupId)) {
      alert(p.bulkNeedGroup);
      return;
    }
    if (inviteType === 'staff' && namedDrafts.some((r) => !r.orgNodeId)) {
      alert(p.bulkNeedOrg);
      return;
    }
    setBusy(true);
    setSingleResult(null);
    setBulkResults(null);
    try {
      const res = await fetch('/api/admin/users/invite-provision-bulk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: namedDrafts.map((row) => ({
            name: row.name.trim(),
            loginUsername: row.loginUsername.trim() || undefined,
            email: row.email.trim().toLowerCase() || undefined,
            role: row.role,
            groupId: inviteType === 'beyonders' ? row.groupId : undefined,
            orgNodeId: inviteType === 'staff' ? row.orgNodeId : undefined,
            inviteType,
          })),
          defaultRole: role,
          ...provisionPayload(),
        }),
      });
      const data = await res.json();
      if (!res.ok && !data.created?.length) throw new Error(data.error || `HTTP ${res.status}`);
      const ok: ProvisionRow[] = (data.created || []).map((r: ProvisionRow) => ({ ...r }));
      const failed: ProvisionRow[] = (data.errors || []).map((e: { name: string; loginUsername?: string; error: string }) => ({
        name: e.name,
        loginUsername: e.loginUsername,
        role,
        error: e.error,
      }));
      setBulkResults([...ok, ...failed]);
      if (ok.length) {
        setBulkDrafts([makeDraft(inviteType, role, groupId), makeDraft(inviteType, role, groupId)]);
      }
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const renderCredentialCard = (row: ProvisionRow, key: string, namedShare: boolean) => {
    if (row.error) {
      return (
        <div key={key} className="rounded-xl bg-red-50 border border-red-200 p-3 text-[11px]">
          <p className="font-bold text-red-800">{row.name || row.loginUsername}</p>
          <p className="text-red-600">{row.error}</p>
        </div>
      );
    }
    const block = formatCredentialBlock(row, namedShare ? { banner: bannerFor(row.name) } : undefined);
    return (
      <div key={key} className="rounded-xl bg-green-50 border border-green-200 p-3 space-y-2">
        <p className="text-[11px] font-bold text-green-800">{row.name}</p>
        <pre className="text-[10px] text-green-900 whitespace-pre-wrap font-sans bg-white/70 rounded-lg p-2">{block}</pre>
        <button type="button" onClick={() => void copyText(block, key)} className="flex items-center gap-1 text-[10px] font-bold text-green-800 hover:underline">
          <Copy className="w-3 h-3" />
          {copiedId === key ? t.portal.common.copied : p.copyFull}
        </button>
      </div>
    );
  };

  const successBulk = bulkResults?.filter((r) => !r.error) || [];
  const bulkShareText = successBulk.length
    ? formatBulkShareText(successBulk, { header: p.bulkShareHeader, bannerFor })
    : '';

  const inputClass = 'border border-[#D9D7D0] rounded-xl px-3 py-2 text-sm';
  const selectClass = 'w-full border border-[#D9D7D0] rounded-xl px-3 py-2 text-sm';

  return (
    <div className="rounded-2xl border border-[#D9D7D0] bg-white p-5 space-y-4">
      <div className="flex items-center gap-2">
        <UserPlus className="w-5 h-5 text-[#FF416C]" />
        <h3 className="text-sm font-bold">{p.provisionTitle}</h3>
      </div>
      <p className="text-[11px] text-[#8C8880]">{p.provisionHint}</p>

      <div className="space-y-2">
        <span className="text-[10px] font-bold text-[#8C8880] uppercase tracking-wider">{p.inviteType}</span>
        <div className="flex flex-wrap gap-2">
          {([
            ['beyonders', p.typeBeyonders],
            ['staff', p.typeStaff],
            ['individual', p.typeIndividual],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setInviteType(id)}
              className={`text-[10px] font-bold px-3 py-1.5 rounded-full ${inviteType === id ? 'bg-[#FF416C] text-white' : 'bg-gray-100 text-[#8C8880]'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setMode('single')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${mode === 'single' ? 'bg-[#1B1B1B] text-white' : 'bg-gray-100 text-[#8C8880]'}`}>{p.modeSingle}</button>
        <button type="button" onClick={() => setMode('bulk')} className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 ${mode === 'bulk' ? 'bg-[#1B1B1B] text-white' : 'bg-gray-100 text-[#8C8880]'}`}>
          <Users className="w-3.5 h-3.5" /> {p.modeBulk}
        </button>
      </div>

      {mode === 'single' && (
        <div className="flex flex-wrap gap-1">
          {roleOptions.map((r) => (
            <button key={r} type="button" onClick={() => setRole(r)} className={`text-[9px] font-bold px-2 py-1 rounded-full uppercase ${role === r ? 'bg-[#1B1B1B] text-white' : 'bg-gray-100 text-[#8C8880]'}`}>
              {portalRoleLabel(t, r)}
            </button>
          ))}
        </div>
      )}

      {mode === 'single' && inviteType === 'beyonders' && (
        <label className="block space-y-1">
          <span className="text-[10px] font-bold text-[#8C8880] uppercase tracking-wider">{p.beyondersGroup}</span>
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={selectClass}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </label>
      )}

      {mode === 'single' && inviteType === 'staff' && (
        <OrgSlotPicker
          value={orgNodeId}
          onChange={(id) => setOrgNodeId(id)}
          compact
        />
      )}

      <label className="flex items-start gap-2 cursor-pointer">
        <input type="checkbox" checked={useUniformPassword} onChange={(e) => setUseUniformPassword(e.target.checked)} className="mt-0.5" />
        <span className="text-[11px] text-[#8C8880]">{p.uniformPassword}</span>
      </label>
      {useUniformPassword && (
        <input className={`${inputClass} font-mono`} placeholder="GEHCikarang" value={uniformPassword} onChange={(e) => setUniformPassword(e.target.value)} />
      )}

      {mode === 'single' ? (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            <input className={inputClass} placeholder={p.fullName} value={name} onChange={(e) => setName(e.target.value)} />
            <input className={`${inputClass} font-mono`} placeholder={p.usernameOptional} value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} />
            <input className={`${inputClass} sm:col-span-2`} placeholder={p.emailOptional} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button type="button" disabled={busy || !name.trim() || (inviteType === 'staff' && !orgNodeId)} onClick={submitSingle} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF416C] text-white text-xs font-black uppercase disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {p.createInviteBtn}
          </button>
        </>
      ) : (
        <>
          <p className="text-[11px] text-[#8C8880]">{p.bulkHint}</p>
          <div className="space-y-3">
            {bulkDrafts.map((row, index) => (
              <div key={row.key} className="rounded-2xl border border-[#D9D7D0] bg-[#FAF9F5] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-[#8C8880] uppercase tracking-wider">{fmt(p.personN, { n: index + 1 })}</span>
                  <button
                    type="button"
                    disabled={bulkDrafts.length <= 1}
                    onClick={() => removeDraft(row.key)}
                    className="flex items-center gap-1 text-[10px] font-bold text-red-600 disabled:opacity-40"
                  >
                    <Trash2 className="w-3 h-3" />
                    {p.removePerson}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {roleOptions.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => updateDraft(row.key, { role: r })}
                      className={`text-[9px] font-bold px-2 py-1 rounded-full uppercase ${row.role === r ? 'bg-[#1B1B1B] text-white' : 'bg-white text-[#8C8880] border border-[#D9D7D0]'}`}
                    >
                      {portalRoleLabel(t, r)}
                    </button>
                  ))}
                </div>
                {inviteType === 'beyonders' && (
                  <label className="block space-y-1">
                    <span className="text-[10px] font-bold text-[#8C8880] uppercase tracking-wider">{p.beyondersGroup}</span>
                    <select value={row.groupId} onChange={(e) => updateDraft(row.key, { groupId: e.target.value })} className={selectClass}>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </label>
                )}
                {inviteType === 'staff' && (
                  <OrgSlotPicker
                    value={row.orgNodeId}
                    onChange={(id) => updateDraft(row.key, { orgNodeId: id })}
                    compact
                  />
                )}
                <div className="grid sm:grid-cols-2 gap-3">
                  <input className={inputClass} placeholder={p.fullName} value={row.name} onChange={(e) => updateDraft(row.key, { name: e.target.value })} />
                  <input className={`${inputClass} font-mono`} placeholder={p.usernameOptional} value={row.loginUsername} onChange={(e) => updateDraft(row.key, { loginUsername: e.target.value })} />
                  <input className={`${inputClass} sm:col-span-2`} placeholder={p.emailOptional} type="email" value={row.email} onChange={(e) => updateDraft(row.key, { email: e.target.value })} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={bulkDrafts.length >= MAX_BULK}
              onClick={addDraft}
              className="flex items-center gap-1 px-3 py-2 rounded-xl border border-[#D9D7D0] text-xs font-bold text-[#1B1B1B] disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              {p.addPerson}
            </button>
            {namedDrafts.length > 0 && (
              <span className="text-[10px] font-bold text-[#FF416C]">{fmt(p.provisionN, { n: namedDrafts.length })}</span>
            )}
          </div>
          <p className="text-[10px] text-[#8C8880]">{p.afterInviteJemaat}</p>
          <button type="button" disabled={busy || namedDrafts.length === 0} onClick={submitBulk} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF416C] text-white text-xs font-black uppercase disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
            {fmt(p.provisionN, { n: namedDrafts.length })}
          </button>
        </>
      )}

      {singleResult && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-green-800 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> {p.inviteCreated}</p>
          {renderCredentialCard(singleResult, 'single', false)}
        </div>
      )}

      {bulkResults && bulkResults.length > 0 && (
        <div className="space-y-3">
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[11px] text-amber-900 leading-relaxed">
            {p.bulkShareHeader}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-green-800">{fmt(p.doneOk, { ok: successBulk.length })}{bulkResults.length > successBulk.length ? fmt(p.doneFail, { n: bulkResults.length - successBulk.length }) : ''}</p>
            {successBulk.length > 0 && (
              <div className="flex gap-2">
                <button type="button" onClick={() => void copyText(bulkShareText, 'bulk-all')} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-100 text-green-900 text-[10px] font-bold">
                  <Copy className="w-3 h-3" />{copiedId === 'bulk-all' ? t.portal.common.copied : p.copyAll}
                </button>
                <button type="button" onClick={() => downloadResultsCsv(bulkResults)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#181818] text-white text-[10px] font-bold">
                  <Download className="w-3 h-3" /> CSV
                </button>
              </div>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto space-y-2">
            {bulkResults.map((row, i) => renderCredentialCard(row, `bulk-${i}-${row.loginUsername || row.name}`, true))}
          </div>
        </div>
      )}
    </div>
  );
};
