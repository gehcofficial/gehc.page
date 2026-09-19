import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Search, X } from 'lucide-react';
import type { SearchableOption } from '../../lib/searchable-options';

type Props = {
  /** Nilai terpilih (id). */
  values: string[];
  /** Label untuk nilai terpilih (boleh dari hasil pencarian sebelumnya). */
  selectedOptions?: SearchableOption[];
  /** Pencarian asinkron (pola Portal Doa). */
  onSearch: (q: string) => Promise<SearchableOption[]>;
  onChange: (values: string[], options: SearchableOption[]) => void;
  placeholder?: string;
  emptyHint?: string;
  minQuery?: number;
  /** Id yang tidak boleh dipilih lagi (mis. sudah ditugaskan). */
  exclude?: string[];
  /** Maksimum pilihan (opsional). */
  max?: number;
  disabled?: boolean;
};

/**
 * Pemilih banyak orang: cari di input, pilih beberapa, chip bisa dihapus,
 * dan tombol "Tambah semua hasil" untuk mengisi cepat.
 */
export const SearchableMultiSelect: React.FC<Props> = ({
  values,
  selectedOptions = [],
  onSearch,
  onChange,
  placeholder = 'Cari nama…',
  emptyHint,
  minQuery = 2,
  exclude = [],
  max,
  disabled = false,
}) => {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchableOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [known, setKnown] = useState<Record<string, SearchableOption>>({});
  const wrapRef = useRef<HTMLDivElement>(null);

  // Simpan label pilihan agar chip tetap terbaca walau hasil pencarian berubah.
  useEffect(() => {
    setKnown((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const o of selectedOptions) {
        if (o?.value && next[o.value]?.label !== o.label) { next[o.value] = o; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [selectedOptions]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < minQuery) {
      setHits([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = window.setTimeout(() => {
      onSearch(q)
        .then((rows) => {
          if (cancelled) return;
          setHits(rows);
          setKnown((prev) => {
            const next = { ...prev };
            for (const o of rows) next[o.value] = o;
            return next;
          });
        })
        .catch(() => { if (!cancelled) setHits([]); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [minQuery, onSearch, query]);

  useEffect(() => {
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
    };
  }, []);

  const excludeSet = useMemo(() => new Set(exclude), [exclude]);
  const selected = useMemo(() => values.map((v) => known[v] || { value: v, label: v }), [values, known]);
  const selectable = useMemo(
    () => hits.filter((h) => !values.includes(h.value) && !excludeSet.has(h.value)),
    [hits, values, excludeSet],
  );

  const atMax = typeof max === 'number' && values.length >= max;

  const addMany = (options: SearchableOption[]) => {
    if (disabled || atMax) return;
    const room = typeof max === 'number' ? Math.max(0, max - values.length) : options.length;
    const add = options.slice(0, room);
    if (!add.length) return;
    setKnown((prev) => {
      const next = { ...prev };
      for (const o of add) next[o.value] = o;
      return next;
    });
    onChange([...values, ...add.map((o) => o.value)], [...selected, ...add]);
  };

  const removeOne = (value: string) => {
    onChange(values.filter((v) => v !== value), selected.filter((o) => o.value !== value));
  };

  const qLen = query.trim().length;
  const needMore = qLen < minQuery;
  const showList = open && !disabled && !needMore;
  const noHits = showList && !searching && selectable.length === 0;

  return (
    <div ref={wrapRef} className="space-y-1.5">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((o) => (
            <span
              key={o.value}
              className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-[#181818] text-white text-[11px] font-bold"
            >
              {o.label}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeOne(o.value)}
                  className="p-0.5 rounded-full hover:bg-white/20"
                  aria-label={`Hapus ${o.label}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
          {typeof max === 'number' && (
            <span className="text-[10px] text-[#8C8880] self-center">{values.length}/{max}</span>
          )}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8880] pointer-events-none" />
        <input
          type="text"
          inputMode="search"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled || atMax}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-sm font-medium focus:outline-none focus:border-[#181818] disabled:opacity-50"
          placeholder={atMax ? 'Maksimum pilihan tercapai' : placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#8C8880]" />}
      </div>

      {needMore && open ? (
        <p className="text-[11px] text-[#8C8880] px-1">{emptyHint || `Ketik minimal ${minQuery} huruf untuk mencari.`}</p>
      ) : null}

      {showList ? (
        <div id={listId} role="listbox" className="rounded-2xl border border-[#D9D7D0] bg-white shadow-lg max-h-56 overflow-y-auto overscroll-contain">
          {selectable.length > 1 && (
            <button
              type="button"
              onClick={() => addMany(selectable)}
              className="w-full text-left px-3 py-2.5 text-[11px] font-black uppercase tracking-wider text-emerald-700 border-b border-[#EFEDE8] hover:bg-emerald-50"
            >
              + Tambah semua hasil ({selectable.length})
            </button>
          )}
          {selectable.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => addMany([o])}
              className="w-full text-left px-3 py-2.5 text-sm border-b border-[#EFEDE8] last:border-0 hover:bg-[#FAF9F5] flex items-center gap-2"
            >
              <span className="flex-1 min-w-0 truncate">{o.label}</span>
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            </button>
          ))}
          {noHits ? (
            <p className="px-3 py-3 text-sm text-[#8C8880]">{emptyHint || 'Tidak ada hasil. Coba kata lain.'}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
