import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Users, Mail } from 'lucide-react';
import { UserRole } from '../../types';
import { useLang } from '../../context/LangContext';
import { fmt, portalRoleLabel } from '../../lib/portal-i18n';
import { useListPager } from './ListPager';

const ROLES: UserRole[] = ['SUPERADMIN', 'BPMJ', 'KOMISI', 'COMMITTEE', 'MENTOR', 'CO_MENTOR', 'MENTEE', 'ALUMNI'];

interface AccessGroupDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  roles: string[];
  memberCount: number;
  members: { id: string; email: string; status: string }[];
  autoApplyOnLogin: boolean;
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

export const AccessGroupsPanel: React.FC = () => {
  const { t } = useLang();
  const p = t.portal.people;
  const [groups, setGroups] = useState<AccessGroupDto[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newGroup, setNewGroup] = useState({ name: '', description: '', roles: ['COMMITTEE'] as string[] });
  const [emailBatch, setEmailBatch] = useState('');

  const load = () => authedFetch('/api/admin/access-groups').then((d) => setGroups(d.groups));

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const create = async () => {
    setBusy(true);
    try {
      await authedFetch('/api/admin/access-groups', 'POST', newGroup);
      setNewGroup({ name: '', description: '', roles: ['COMMITTEE'] });
      await load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const addMembers = async (groupId: string) => {
    setBusy(true);
    try {
      await authedFetch(`/api/admin/access-groups/${groupId}/members`, 'POST', {
        emails: emailBatch.split(/[\n,;]+/).map((e) => e.trim()).filter(Boolean),
      });
      setEmailBatch('');
      await load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeGroup = async (id: string) => {
    if (!confirm(t.portal.people.deleteGroupConfirm)) return;
    setBusy(true);
    try {
      await authedFetch(`/api/admin/access-groups/${id}`, 'DELETE');
      await load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const { pageItems: pagedGroups, pager: groupsPager } = useListPager<AccessGroupDto>(groups || []);

  if (!groups) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#8C8880] py-12 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> {p.loadingAccess}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-black text-[#1B1B1B]">{p.accessTitle}</h2>
        <p className="text-xs text-[#8C8880] mt-1">{p.accessHint}</p>
      </div>

      <div className="rounded-2xl border border-[#D9D7D0] bg-white p-5 space-y-4">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Plus className="w-4 h-4" /> {p.newGroup}
        </h3>
        <input
          className="w-full border border-[#D9D7D0] rounded-xl px-3 py-2 text-sm"
          placeholder={p.groupNamePh}
          value={newGroup.name}
          onChange={(e) => setNewGroup((g) => ({ ...g, name: e.target.value }))}
        />
        <textarea
          className="w-full border border-[#D9D7D0] rounded-xl px-3 py-2 text-sm"
          placeholder={p.descOptional}
          rows={2}
          value={newGroup.description}
          onChange={(e) => setNewGroup((g) => ({ ...g, description: e.target.value }))}
        />
        <div className="flex flex-wrap gap-1">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setNewGroup((g) => ({
                ...g,
                roles: g.roles.includes(r) ? g.roles.filter((x) => x !== r) : [...g.roles, r],
              }))}
              className={`text-[9px] font-bold px-2 py-1 rounded-full uppercase ${
                newGroup.roles.includes(r) ? 'bg-[#1B1B1B] text-white' : 'bg-gray-100 text-[#8C8880]'
              }`}
            >
              {portalRoleLabel(t, r)}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={busy || !newGroup.name.trim()}
          onClick={create}
          className="px-4 py-2 rounded-xl bg-[#FF416C] text-white text-xs font-black uppercase disabled:opacity-50"
        >
          {p.createGroup}
        </button>
      </div>

      <div className="space-y-3">
        {groups.length === 0 && (
          <p className="text-sm text-[#8C8880] text-center py-8">{p.noAccessGroups}</p>
        )}
        {groupsPager}
        {pagedGroups.map((g) => (
          <div key={g.id} className="rounded-2xl border border-[#D9D7D0] bg-white overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-[#FAF9F5]"
              onClick={() => setExpanded(expanded === g.id ? null : g.id)}
            >
              <div className="w-10 h-10 rounded-xl bg-[#1B1B1B] text-white flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">{g.name}</p>
                <p className="text-[10px] text-[#8C8880]">
                  {g.roles.map((r) => portalRoleLabel(t, r)).join(', ')} · {fmt(p.emailCount, { n: g.memberCount })}
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeGroup(g.id); }}
                className="p-2 text-red-400 hover:bg-red-50 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </button>
            {expanded === g.id && (
              <div className="border-t border-[#D9D7D0] p-4 space-y-3 bg-[#FAF9F5]/50">
                <div className="space-y-1">
                  {g.members.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 text-xs">
                      <Mail className="w-3 h-3 text-[#8C8880]" />
                      <span>{m.email}</span>
                      <span className={`text-[9px] font-bold uppercase ${m.status === 'ACTIVE' ? 'text-green-600' : 'text-amber-600'}`}>
                        {m.status}
                      </span>
                    </div>
                  ))}
                </div>
                <textarea
                  className="w-full border border-[#D9D7D0] rounded-xl px-3 py-2 text-xs"
                  placeholder={p.emailsPlaceholder}
                  rows={3}
                  value={emailBatch}
                  onChange={(e) => setEmailBatch(e.target.value)}
                />
                <button
                  type="button"
                  disabled={busy || !emailBatch.trim()}
                  onClick={() => addMembers(g.id)}
                  className="px-3 py-1.5 rounded-lg bg-[#1B1B1B] text-white text-[10px] font-bold uppercase"
                >
                  {p.addEmails}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
