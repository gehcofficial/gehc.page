import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { filterSearchableOptions, type SearchableOption } from '../../lib/searchable-options';

type Props = {
  value: string;
  selectedLabel?: string;
  options?: SearchableOption[];
  onSearch?: (q: string) => Promise<SearchableOption[]>;
  onChange: (value: string, option: SearchableOption | null) => void;
  placeholder?: string;
  emptyHint?: string;
  minQuery?: number;
  disabled?: boolean;
  allowClear?: boolean;
};

export const SearchableSelect: React.FC<Props> = ({
  value,
  selectedLabel,
  options = [],
  onSearch,
  onChange,
  placeholder = 'Cari…',
  emptyHint,
  minQuery = 0,
  disabled = false,
  allowClear = true,
}) => {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchableOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const asyncMode = Boolean(onSearch);

  const localHits = useMemo(
    () => (asyncMode ? hits : filterSearchableOptions(options, query)),
    [asyncMode, hits, options, query],
  );

  useEffect(() => {
    if (!asyncMode || !onSearch) return;
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
          if (!cancelled) setHits(rows);
        })
        .catch(() => {
          if (!cancelled) setHits([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [asyncMode, minQuery, onSearch, query]);

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

  const shown = localHits.slice(0, 80);
  const qLen = query.trim().length;
  const needMore = asyncMode && qLen < minQuery;
  const showList = open && !disabled && !needMore;
  const noHits = showList && !searching && shown.length === 0 && (asyncMode ? qLen >= minQuery : true);

  return (
    <div ref={wrapRef} className="space-y-1.5">
      {value && selectedLabel ? (
        <div className="flex items-center gap-2 rounded-2xl border border-line bg-page px-3 py-2">
          <p className="flex-1 min-w-0 text-sm font-semibold text-ink truncate">{selectedLabel}</p>
          {allowClear && !disabled ? (
            <button
              type="button"
              className="shrink-0 p-1 rounded-lg text-muted hover:bg-white"
              aria-label="Hapus pilihan"
              onClick={() => {
                onChange('', null);
                setQuery('');
                setHits([]);
                setOpen(true);
              }}
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
        <input
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={disabled}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          className="w-full pl-9 pr-4 py-3 rounded-2xl bg-white border border-line text-base sm:text-sm font-medium focus:outline-none focus:border-ink disabled:opacity-50"
          placeholder={placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.preventDefault();
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
        />
        {searching ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted" />
        ) : null}
      </div>
      {needMore && open ? (
        <p className="text-[11px] text-muted px-1">
          {emptyHint || `Ketik minimal ${minQuery} huruf untuk mencari.`}
        </p>
      ) : null}
      {showList ? (
        <div
          id={listId}
          role="listbox"
          className="rounded-2xl border border-line bg-white shadow-lg max-h-56 overflow-y-auto overscroll-contain"
        >
          {shown.map((o) => (
            <button
              key={o.value || o.label}
              type="button"
              role="option"
              aria-selected={o.value === value}
              className={`w-full text-left px-3 py-3 text-sm border-b border-line/40 last:border-0 ${
                o.value === value ? 'bg-page font-semibold' : 'hover:bg-page'
              }`}
              onClick={() => {
                onChange(o.value, o);
                setQuery('');
                setHits([]);
                setOpen(false);
              }}
            >
              <span className="block truncate">{o.label}</span>
              {o.hint ? <span className="block text-[11px] text-muted truncate">{o.hint}</span> : null}
            </button>
          ))}
          {noHits ? (
            <p className="px-3 py-3 text-sm text-muted">{emptyHint || 'Tidak ada hasil. Coba kata lain.'}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
