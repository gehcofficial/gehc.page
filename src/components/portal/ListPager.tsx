import React, { useEffect, useState } from 'react';
import { useLang } from '../../context/LangContext';
import { fmt } from '../../lib/portal-i18n';

const STORAGE_KEY = 'gehc_list_page_size';
const SIZES = [10, 20, 50] as const;

export type PageSize = number | 'all';

export function readStoredPageSize(): PageSize {
  if (typeof window === 'undefined') return 10;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === 'all') return 'all';
  const n = Number(raw);
  if (SIZES.includes(n as (typeof SIZES)[number])) return n;
  return 10;
}

export function useListPager<T>(items: T[]): {
  pageItems: T[];
  pager: React.ReactNode;
} {
  const [pageSize, setPageSize] = useState<PageSize>(readStoredPageSize);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [items.length, pageSize]);

  const size = pageSize === 'all' ? items.length || 1 : pageSize;
  const pageCount = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(items.length / size));
  const safePage = Math.min(page, pageCount);
  const start = pageSize === 'all' ? 0 : (safePage - 1) * size;
  const pageItems: T[] = pageSize === 'all' ? items : items.slice(start, start + size);

  const changeSize = (next: PageSize) => {
    setPageSize(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  };

  const pager =
    items.length === 0 ? null : (
      <ListPager
        total={items.length}
        page={safePage}
        pageCount={pageCount}
        pageSize={pageSize}
        onPage={setPage}
        onPageSize={changeSize}
      />
    );

  return { pageItems, pager };
}

export const ListPager: React.FC<{
  total: number;
  page: number;
  pageCount: number;
  pageSize: PageSize;
  onPage: (p: number) => void;
  onPageSize: (s: PageSize) => void;
}> = ({ total, page, pageCount, pageSize, onPage, onPageSize }) => {
  const { t } = useLang();
  const from = total === 0 ? 0 : pageSize === 'all' ? 1 : (page - 1) * (pageSize as number) + 1;
  const to = pageSize === 'all' ? total : Math.min(page * (pageSize as number), total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2">
      <p className="text-[11px] text-[#8C8880]">
        {fmt(t.portal.pager.showing, { from, to, total })}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880]">{t.portal.pager.pageSize}</span>
        {([...SIZES, 'all'] as const).map((s) => (
          <button
            key={String(s)}
            type="button"
            onClick={() => onPageSize(s)}
            className={`px-2 py-1 rounded-full text-[10px] font-bold ${
              pageSize === s ? 'bg-[#181818] text-white' : 'bg-white border border-[#D9D7D0] text-[#8C8880]'
            }`}
          >
            {s === 'all' ? t.portal.pager.all : s}
          </button>
        ))}
        {pageSize !== 'all' && pageCount > 1 && (
          <div className="flex items-center gap-1 ml-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPage(page - 1)}
              className="px-2 py-1 rounded-full text-[10px] font-bold bg-white border border-[#D9D7D0] disabled:opacity-40"
            >
              {t.portal.pager.prev}
            </button>
            <button
              type="button"
              disabled={page >= pageCount}
              onClick={() => onPage(page + 1)}
              className="px-2 py-1 rounded-full text-[10px] font-bold bg-white border border-[#D9D7D0] disabled:opacity-40"
            >
              {t.portal.pager.next}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
