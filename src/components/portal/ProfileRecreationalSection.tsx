import React, { useMemo, useState } from 'react';
import { Loader2, Plus, Search } from 'lucide-react';
import type { RecreationalNode } from '../../lib/recreational';

type PendingSuggestion = {
  id: string;
  name: string;
  kind: string;
  parentId?: string | null;
  status: string;
};

export const ProfileRecreationalSection: React.FC<{
  recFlat: RecreationalNode[];
  selectedIds: string[];
  pendingSuggestions: PendingSuggestion[];
  onChange: (ids: string[]) => void;
  onSuggest: (payload: { name: string; kind: string; parentId?: string }) => Promise<void>;
  suggestBusy: boolean;
}> = ({ recFlat, selectedIds, pendingSuggestions, onChange, onSuggest, suggestBusy }) => {
  const [search, setSearch] = useState('');
  const [suggestKey, setSuggestKey] = useState<string | null>(null);
  const [suggestName, setSuggestName] = useState('');
  const q = search.trim().toLowerCase();

  const filteredLeaves = useMemo(() => {
    const leaves = recFlat.filter((r) => r.parentId && r.selectable !== false);
    if (!q) return leaves;
    return leaves.filter((leaf) => {
      const cat = recFlat.find((r) => r.id === leaf.parentId);
      const kindLabel = leaf.kind === 'SPORTS' ? 'sports' : 'arts';
      const hay = `${leaf.name} ${cat?.name || ''} ${kindLabel}`.toLowerCase();
      return hay.includes(q);
    });
  }, [recFlat, q]);

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id],
    );
  };

  const submitSuggest = async (kind: string, parentId?: string) => {
    const name = suggestName.trim();
    if (!name) return;
    await onSuggest({ name, kind, parentId });
    setSuggestKey(null);
    setSuggestName('');
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8880]" />
        <input
          className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black"
          placeholder="Cari minat…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {pendingSuggestions.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1">
          <p className="text-[10px] font-bold uppercase text-amber-800">Menunggu persetujuan admin</p>
          {pendingSuggestions.map((s) => (
            <p key={s.id} className="text-[10px] text-amber-900">• {s.name}</p>
          ))}
        </div>
      )}

      {(['SPORTS', 'ARTS'] as const).map((kind) => {
        const cats = recFlat.filter((r) => !r.parentId && r.kind === kind);
        const kindKey = `kind-${kind}`;
        return (
          <div key={kind}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black uppercase text-[#8C8880]">
                {kind === 'SPORTS' ? 'Sports' : 'Arts'}
              </p>
              <button
                type="button"
                onClick={() => { setSuggestKey(kindKey); setSuggestName(''); }}
                className="inline-flex items-center gap-0.5 text-[9px] font-bold text-[#FF416C]"
              >
                <Plus className="w-3 h-3" /> Lainnya…
              </button>
            </div>
            {suggestKey === kindKey && (
              <div className="flex gap-1.5 mb-3">
                <input
                  autoFocus
                  value={suggestName}
                  onChange={(e) => setSuggestName(e.target.value)}
                  placeholder={kind === 'SPORTS' ? 'Contoh: Futsal indoor' : 'Contoh: Ukulele'}
                  className="flex-1 px-3 py-1.5 rounded-xl bg-white border border-[#D9D7D0] text-[10px]"
                />
                <button
                  type="button"
                  disabled={suggestBusy || !suggestName.trim()}
                  onClick={() => submitSuggest(kind)}
                  className="px-2.5 py-1.5 rounded-xl bg-[#181818] text-white text-[9px] font-bold disabled:opacity-50"
                >
                  {suggestBusy ? '…' : 'Kirim'}
                </button>
              </div>
            )}
            {cats.map((cat) => {
              const leaves = filteredLeaves.filter((r) => r.parentId === cat.id);
              if (q && leaves.length === 0) return null;
              const catKey = `cat-${cat.id}`;
              return (
                <div key={cat.id} className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-bold">{cat.name}</p>
                    <button
                      type="button"
                      onClick={() => { setSuggestKey(catKey); setSuggestName(''); }}
                      className="text-[9px] font-bold text-[#8C8880] hover:text-[#FF416C]"
                    >
                      Lainnya…
                    </button>
                  </div>
                  {suggestKey === catKey && (
                    <div className="flex gap-1.5 mb-2">
                      <input
                        autoFocus
                        value={suggestName}
                        onChange={(e) => setSuggestName(e.target.value)}
                        placeholder={`Minat di ${cat.name}…`}
                        className="flex-1 px-3 py-1.5 rounded-xl bg-white border border-[#D9D7D0] text-[10px]"
                      />
                      <button
                        type="button"
                        disabled={suggestBusy || !suggestName.trim()}
                        onClick={() => submitSuggest(kind, cat.id)}
                        className="px-2.5 py-1.5 rounded-xl bg-[#181818] text-white text-[9px] font-bold disabled:opacity-50"
                      >
                        {suggestBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Kirim'}
                      </button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {leaves.map((leaf) => {
                      const on = selectedIds.includes(leaf.id);
                      return (
                        <button
                          key={leaf.id}
                          type="button"
                          onClick={() => toggle(leaf.id)}
                          className={`px-2.5 py-1 rounded-full text-[9px] font-bold ${on ? 'bg-[#181818] text-white' : 'bg-[#F3F1EC] text-[#8C8880]'}`}
                        >
                          {leaf.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {q && filteredLeaves.length === 0 && (
        <p className="text-[10px] text-[#8C8880]">Tidak ada minat yang cocok. Gunakan &quot;Lainnya…&quot; untuk mengusulkan.</p>
      )}
    </div>
  );
};
