import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building, Loader2 } from 'lucide-react';
import {
  assignmentBranches,
  collectAssignableSlots,
  nestedDomainOf,
  ORG_DOMAINS,
  DEFAULT_ORG_DOMAIN,
  type OrgNode,
} from '../../lib/org-tree-utils';

export const OrgSlotPicker: React.FC<{
  value: string;
  onChange: (orgNodeId: string, slot: OrgNode | null) => void;
  compact?: boolean;
}> = ({ value, onChange, compact }) => {
  const [orgTree, setOrgTree] = useState<OrgNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState('');
  const [domain, setDomain] = useState(DEFAULT_ORG_DOMAIN);
  const [nestedTree, setNestedTree] = useState<OrgNode[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<OrgNode | null>(null);
  const [selectedSubBranch, setSelectedSubBranch] = useState<OrgNode | null>(null);
  const [selectedDeepBranch, setSelectedDeepBranch] = useState<OrgNode | null>(null);

  const loadTree = useCallback(async (d: string) => {
    setTreeLoading(true);
    setTreeError('');
    try {
      const res = await fetch(`/api/org/nodes?domain=${d}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setOrgTree(data.tree || []);
      } else {
        const err = await res.json().catch(() => ({}));
        setOrgTree([]);
        setTreeError((err as { error?: string }).error || `Gagal memuat pohon (${res.status})`);
      }
    } catch {
      setOrgTree([]);
      setTreeError('Tidak bisa memuat pohon organisasi.');
    } finally {
      setTreeLoading(false);
    }
  }, []);

  useEffect(() => { void loadTree(domain); }, [domain, loadTree]);

  useEffect(() => {
    setSelectedBranch(null);
    setSelectedSubBranch(null);
    setSelectedDeepBranch(null);
    setNestedTree([]);
    onChange('', null);
  }, [domain]); // eslint-disable-line react-hooks/exhaustive-deps

  const nestedDomain = nestedDomainOf(selectedBranch);
  useEffect(() => {
    if (!nestedDomain) {
      setNestedTree([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/org/nodes?domain=${nestedDomain}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setNestedTree(d.tree || []);
      })
      .catch(() => {
        if (!cancelled) setNestedTree([]);
      });
    return () => { cancelled = true; };
  }, [nestedDomain]);

  const topBranches = useMemo(() => assignmentBranches(orgTree, domain), [orgTree, domain]);
  const subBranches = useMemo(() => {
    const own = (selectedBranch?.children || []).filter((c) => c.nodeKind === 'BRANCH');
    const nested = assignmentBranches(nestedTree, nestedDomain || undefined);
    return [...own, ...nested];
  }, [selectedBranch, nestedTree, nestedDomain]);
  const deepBranches = useMemo(() => {
    if (!selectedSubBranch?.children) return [];
    return selectedSubBranch.children.filter((c) => c.nodeKind === 'BRANCH');
  }, [selectedSubBranch]);
  const slotSource = selectedDeepBranch || selectedSubBranch || selectedBranch;
  const slots = useMemo(() => collectAssignableSlots(slotSource), [slotSource]);

  const selectClass = compact
    ? 'w-full border border-[#D9D7D0] rounded-xl px-3 py-2 text-sm'
    : 'w-full px-4 py-2.5 rounded-xl bg-white border border-[#D9D7D0] text-xs font-semibold';

  return (
    <div className="rounded-xl border border-[#D9D7D0] bg-[#FAF9F5] p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Building className="w-4 h-4 text-[#FF416C]" />
        <span className="text-[10px] font-bold text-[#8C8880] uppercase tracking-wider">Slot posisi organisasi</span>
        {treeLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8C8880]" />}
      </div>
      {treeError ? (
        <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">{treeError}</p>
      ) : null}

      <label className="block space-y-1">
        <span className="text-[10px] font-bold text-[#8C8880]">Domain</span>
        <select value={domain} onChange={(e) => setDomain(e.target.value)} className={selectClass}>
          {ORG_DOMAINS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-[10px] font-bold text-[#8C8880]">Cabang</span>
        <select
          value={selectedBranch?.id || ''}
          onChange={(e) => {
            const b = topBranches.find((n) => n.id === e.target.value) || null;
            setSelectedBranch(b);
            setSelectedSubBranch(null);
            setSelectedDeepBranch(null);
            onChange('', null);
          }}
          className={selectClass}
        >
          <option value="">— Pilih cabang —</option>
          {topBranches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
      </label>

      {subBranches.length > 0 && (
        <label className="block space-y-1">
          <span className="text-[10px] font-bold text-[#8C8880]">Sub-cabang</span>
          <select
            value={selectedSubBranch?.id || ''}
            onChange={(e) => {
              const b = subBranches.find((n) => n.id === e.target.value) || null;
              setSelectedSubBranch(b);
              setSelectedDeepBranch(null);
              onChange('', null);
            }}
            className={selectClass}
          >
            <option value="">— Pilih sub-cabang —</option>
            {subBranches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </label>
      )}

      {deepBranches.length > 0 && (
        <label className="block space-y-1">
          <span className="text-[10px] font-bold text-[#8C8880]">Unit</span>
          <select
            value={selectedDeepBranch?.id || ''}
            onChange={(e) => {
              const b = deepBranches.find((n) => n.id === e.target.value) || null;
              setSelectedDeepBranch(b);
              onChange('', null);
            }}
            className={selectClass}
          >
            <option value="">— Pilih unit —</option>
            {deepBranches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </label>
      )}

      <label className="block space-y-1">
        <span className="text-[10px] font-bold text-[#8C8880]">Posisi *</span>
        <select
          value={value}
          onChange={(e) => {
            const slot = slots.find((s) => s.id === e.target.value) || null;
            onChange(e.target.value, slot);
          }}
          className={selectClass}
          disabled={!slots.length}
        >
          <option value="">{slots.length ? '— Pilih posisi —' : 'Pilih cabang dulu'}</option>
          {slots.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </label>
    </div>
  );
};
