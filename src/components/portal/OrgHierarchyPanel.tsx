import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Network, Loader2, Plus, ChevronRight, ChevronDown, Pencil, Trash2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

type OrgDomain = 'YOUTH' | 'KOLOM' | 'CHURCH';

interface OrgNodeRow {
  id: string;
  domain: string;
  parentId: string | null;
  slug: string;
  label: string;
  nodeKind: string;
  metadata?: Record<string, unknown> | null;
  sortOrder: number;
  isActive: boolean;
  children?: OrgNodeRow[];
}

const DOMAINS: { id: OrgDomain; label: string }[] = [
  { id: 'YOUTH', label: 'Pemuda' },
  { id: 'KOLOM', label: 'Kolom' },
  { id: 'CHURCH', label: 'Gereja (future)' },
];

const NODE_KINDS = [
  { value: 'BRANCH', label: 'Cabang' },
  { value: 'POSITION_SLOT', label: 'Slot Posisi' },
  { value: 'GROUP_REF', label: 'Referensi Grup' },
];

export const OrgHierarchyPanel: React.FC = () => {
  const { addToast } = useApp();
  const [domain, setDomain] = useState<OrgDomain>('YOUTH');
  const [tree, setTree] = useState<OrgNodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OrgNodeRow | null>(null);
  const [parentForNew, setParentForNew] = useState<OrgNodeRow | null>(null);
  const [form, setForm] = useState({ label: '', slug: '', nodeKind: 'BRANCH', sortOrder: 0 });
  const [saving, setSaving] = useState(false);

  const flatNodes = useMemo(() => {
    const out: OrgNodeRow[] = [];
    const walk = (nodes: OrgNodeRow[]) => {
      nodes.forEach((n) => {
        out.push(n);
        if (n.children?.length) walk(n.children);
      });
    };
    walk(tree);
    return out;
  }, [tree]);

  const fetchTree = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/org/nodes?domain=${domain}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Gagal memuat pohon organisasi');
      const d = await res.json();
      setTree(d.tree || []);
      setExpanded(new Set((d.tree || []).map((n: OrgNodeRow) => n.id)));
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [domain, addToast]);

  useEffect(() => { fetchTree(); }, [fetchTree]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openCreate = (parent: OrgNodeRow | null) => {
    setEditing(null);
    setParentForNew(parent);
    setForm({ label: '', slug: '', nodeKind: parent ? 'POSITION_SLOT' : 'BRANCH', sortOrder: (parent?.children?.length || 0) + 1 });
    setModalOpen(true);
  };

  const openEdit = (node: OrgNodeRow) => {
    setEditing(node);
    setParentForNew(null);
    setForm({ label: node.label, slug: node.slug, nodeKind: node.nodeKind, sortOrder: node.sortOrder });
    setModalOpen(true);
  };

  const saveNode = async () => {
    if (!form.label.trim()) {
      addToast({ type: 'error', title: 'Label wajib diisi' });
      return;
    }
    setSaving(true);
    try {
      const slug = form.slug.trim() || form.label.trim().toUpperCase().replace(/\s+/g, '_').slice(0, 60);
      if (editing) {
        const res = await fetch(`/api/org/nodes/${editing.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: form.label.trim(), sortOrder: form.sortOrder }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Gagal menyimpan');
        }
      } else {
        const res = await fetch('/api/org/nodes', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            domain,
            parentId: parentForNew?.id || null,
            slug,
            label: form.label.trim(),
            nodeKind: form.nodeKind,
            sortOrder: form.sortOrder,
            metadata: form.nodeKind === 'POSITION_SLOT' ? { maxAssignees: 1 } : {},
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Gagal membuat node');
        }
      }
      addToast({ type: 'success', title: editing ? 'Node diperbarui' : 'Node ditambahkan' });
      setModalOpen(false);
      fetchTree();
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const deactivateNode = async (node: OrgNodeRow) => {
    if (!confirm(`Nonaktifkan "${node.label}"?`)) return;
    try {
      const res = await fetch(`/api/org/nodes/${node.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal menonaktifkan');
      }
      addToast({ type: 'success', title: 'Node dinonaktifkan' });
      fetchTree();
    } catch (e) {
      addToast({ type: 'error', title: 'Gagal', description: (e as Error).message });
    }
  };

  const renderNode = (node: OrgNodeRow, depth = 0) => {
    const hasChildren = (node.children?.length || 0) > 0;
    const isOpen = expanded.has(node.id);
    const kindLabel = NODE_KINDS.find((k) => k.value === node.nodeKind)?.label || node.nodeKind;

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-[#FAF9F5] group"
          style={{ paddingLeft: `${12 + depth * 20}px` }}
        >
          <button type="button" onClick={() => hasChildren && toggleExpand(node.id)} className="w-5 h-5 flex items-center justify-center text-[#8C8880]">
            {hasChildren ? (isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />) : <span className="w-3.5" />}
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold truncate">{node.label}</p>
            <p className="text-[9px] text-[#8C8880]">{kindLabel} · {node.slug}</p>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {node.nodeKind === 'BRANCH' && (
              <button type="button" onClick={() => openCreate(node)} className="p-1.5 rounded-lg hover:bg-white" title="Tambah child">
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
            <button type="button" onClick={() => openEdit(node)} className="p-1.5 rounded-lg hover:bg-white" title="Edit">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => deactivateNode(node)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Nonaktifkan">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {hasChildren && isOpen && node.children!.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Network className="w-6 h-6 text-[#FF416C]" />
            Kelola Hirarki
          </h1>
          <p className="text-xs text-[#8C8880] mt-1">Konfigurasi pohon organisasi per domain — terpisah dari RBAC portal.</p>
        </div>
        <button
          type="button"
          onClick={() => openCreate(null)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#181818] text-white text-xs font-bold"
        >
          <Plus className="w-4 h-4" /> Cabang root
        </button>
      </div>

      <div className="flex gap-2">
        {DOMAINS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setDomain(d.id)}
            className={`px-4 py-2 rounded-full text-xs font-bold ${
              domain === d.id ? 'bg-[#FF416C] text-white' : 'bg-white border border-[#D9D7D0] text-[#8C8880]'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-[24px] border border-[#D9D7D0]/60 p-4 min-h-[320px]">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#8C8880]" />
          </div>
        ) : tree.length === 0 ? (
          <div className="text-center py-16 text-sm text-[#8C8880]">
            Belum ada pohon untuk domain ini. Jalankan <code className="text-xs bg-gray-100 px-1 rounded">npm run db:seed:org-tree</code> atau tambah cabang manual.
          </div>
        ) : (
          tree.map((n) => renderNode(n))
        )}
      </div>

      <p className="text-[10px] text-[#8C8880]">
        {flatNodes.length} node aktif · Penugasan user ke slot dilakukan lewat wizard Assign Role atau onboarding.
      </p>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-[24px] w-full max-w-md p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black">{editing ? 'Edit Node' : 'Tambah Node'}</h2>
              <button type="button" onClick={() => setModalOpen(false)}><X className="w-5 h-5 text-[#8C8880]" /></button>
            </div>
            {parentForNew && (
              <p className="text-[10px] text-[#8C8880] mb-3">Di bawah: <strong>{parentForNew.label}</strong></p>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold block mb-1">Label</label>
                <input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#D9D7D0] text-xs"
                />
              </div>
              {!editing && (
                <>
                  <div>
                    <label className="text-xs font-bold block mb-1">Slug (opsional)</label>
                    <input
                      value={form.slug}
                      onChange={(e) => setForm({ ...form, slug: e.target.value })}
                      placeholder="AUTO_FROM_LABEL"
                      className="w-full px-4 py-2.5 rounded-xl border border-[#D9D7D0] text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">Jenis</label>
                    <select
                      value={form.nodeKind}
                      onChange={(e) => setForm({ ...form, nodeKind: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#D9D7D0] text-xs"
                    >
                      {NODE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                    </select>
                  </div>
                </>
              )}
              <div>
                <label className="text-xs font-bold block mb-1">Urutan</label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#D9D7D0] text-xs"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={saveNode}
              disabled={saving}
              className="w-full mt-5 py-3 rounded-xl bg-[#181818] text-white text-xs font-black disabled:opacity-50"
            >
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
