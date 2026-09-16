import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Lock, ArrowRight, Sparkles, Loader2, CornerDownLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useLang } from '../../context/LangContext';
import { portalNavGroup, portalRoleLabel } from '../../lib/portal-i18n';
import { buildPortalSearchIndex, searchPortal, type PortalSearchEntry } from '../../lib/portal-search-index';
import type { UserRole } from '../../types';
import { PortalGuidePreview } from './PortalGuidePreview';

type Props = {
  open: boolean;
  onClose: () => void;
  isGroupMentor?: boolean;
  isMentee?: boolean;
  onNavigate: (tabId: string) => void;
  onSwitchRole: (role: UserRole, page: string) => void;
};

type AiState = { loading: boolean; answer?: string; steps?: string[]; page?: string; error?: string };

export const PortalSearchPalette: React.FC<Props> = ({ open, onClose, isGroupMentor, isMentee, onNavigate, onSwitchRole }) => {
  const { currentRole, myRoleOptions, isBodTimkerja, authUser } = useApp();
  const { t } = useLang();
  const search = t.portal.search;

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [aiMode, setAiMode] = useState(false);
  const [aiQ, setAiQ] = useState('');
  const [ai, setAi] = useState<AiState>({ loading: false });
  const inputRef = useRef<HTMLInputElement>(null);

  const isOnboarding = authUser?.onboardingStatus === 'WAITING_POOL';

  const entries = useMemo(
    () => buildPortalSearchIndex({ t, role: currentRole, ctx: { isGroupMentor: !!isGroupMentor, isMentee: !!isMentee, isBodTimkerja }, isOnboarding, isGroupMentor, isMentee }),
    [t, currentRole, isGroupMentor, isMentee, isBodTimkerja, isOnboarding],
  );

  const results = useMemo(() => searchPortal(entries, query), [entries, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setAiMode(false);
      setAiQ('');
      setAi({ loading: false });
      const id = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  useEffect(() => { setSelected(0); }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const active: PortalSearchEntry | undefined = results[selected];

  const openEntry = useCallback((entry: PortalSearchEntry | undefined) => {
    if (!entry) return;
    if (!entry.allowed && entry.requiredRoles && entry.requiredRoles.length) {
      const ownable = entry.requiredRoles.find((r) => myRoleOptions.includes(r));
      if (ownable) {
        onSwitchRole(ownable, entry.page);
        onClose();
      }
      return;
    }
    onNavigate(entry.page);
    onClose();
  }, [myRoleOptions, onNavigate, onSwitchRole, onClose]);

  const askAi = useCallback(async () => {
    const q = aiQ.trim();
    if (!q) return;
    setAi({ loading: true });
    try {
      const r = await fetch('/api/portal/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ question: q }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || search.askError);
      setAi({ loading: false, answer: d.answer, steps: d.steps || [], page: d.page });
    } catch (e) {
      setAi({ loading: false, error: e instanceof Error ? e.message : search.askError });
    }
  }, [aiQ, search.askError]);

  if (!open) return null;

  const groupLabel = (group: string) =>
    group === 'Aksi' ? search.groups.action : portalNavGroup(t, group);

  const locked = !!active && !active.allowed;
  const ownableLocked = locked && (active?.requiredRoles || []).some((r) => myRoleOptions.includes(r));

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={search.title}>
      <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-label={t.portal.common.close} onClick={onClose} />
      <div className="relative w-full max-w-3xl mt-10 sm:mt-16 bg-white rounded-[24px] shadow-2xl border border-[#D9D7D0] overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#D9D7D0]/60">
          <Search className="w-4 h-4 text-[#8C8880] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, Math.max(results.length - 1, 0))); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
              else if (e.key === 'Enter') { e.preventDefault(); openEntry(active); }
            }}
            placeholder={aiMode ? search.askPlaceholder : search.placeholder}
            className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-[#8C8880]"
            inputMode="search"
          />
          <button
            type="button"
            onClick={() => setAiMode((v) => !v)}
            className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${aiMode ? 'bg-[#FF416C] text-white' : 'bg-[#FAF9F5] border border-[#D9D7D0] text-[#5C5850]'}`}
            title={search.askToggle}
          >
            <Sparkles className="w-3.5 h-3.5" /> {search.askToggle}
          </button>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F3F1EC] text-[#8C8880]" title={t.portal.common.close}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {aiMode ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex gap-2">
              <input
                value={aiQ}
                onChange={(e) => setAiQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void askAi(); }}
                placeholder={search.askPlaceholder}
                className="flex-1 px-3 py-2 rounded-xl border border-[#D9D7D0] text-sm outline-none focus:ring-1 focus:ring-[#FF416C]"
              />
              <button
                type="button"
                onClick={() => void askAi()}
                disabled={ai.loading || !aiQ.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#181818] text-white text-xs font-bold disabled:opacity-40"
              >
                {ai.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {search.askToggle}
              </button>
            </div>
            {ai.loading && <p className="text-xs text-[#8C8880] flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {search.askThinking}</p>}
            {ai.error && <p className="text-xs text-red-600">{ai.error}</p>}
            {ai.answer && (
              <div className="rounded-2xl border border-[#D9D7D0]/60 bg-[#FAF9F5] p-4 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#8C8880]">{search.askAnswer}</p>
                <p className="text-sm text-[#1B1B1B] leading-relaxed whitespace-pre-wrap">{ai.answer}</p>
                {(ai.steps || []).length > 0 && (
                  <ol className="space-y-1.5">
                    {(ai.steps || []).map((step, i) => (
                      <li key={i} className="flex gap-2 text-xs leading-relaxed text-[#1B1B1B]">
                        <span className="mt-0.5 w-4 h-4 rounded-full bg-white border border-[#D9D7D0] flex items-center justify-center shrink-0 text-[10px] font-bold text-[#8C8880]">{i + 1}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                )}
                {ai.page && (
                  <button
                    type="button"
                    onClick={() => { onNavigate(ai.page as string); onClose(); }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FF416C] text-white text-xs font-bold"
                  >
                    {search.open} <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 grid md:grid-cols-2 min-h-0">
            {/* Results */}
            <div className="overflow-y-auto border-b md:border-b-0 md:border-r border-[#D9D7D0]/60 max-h-[70vh]">
              {results.length === 0 ? (
                <p className="p-5 text-xs text-[#8C8880]">{search.empty}</p>
              ) : (
                <ul className="p-2">
                  {results.map((entry, idx) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onMouseEnter={() => setSelected(idx)}
                        onClick={() => openEntry(entry)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl flex items-start gap-2.5 ${idx === selected ? 'bg-[#FAF9F5]' : 'hover:bg-[#FAF9F5]/60'}`}
                      >
                        <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${entry.kind === 'action' ? 'bg-[#FF416C]' : 'bg-[#1B1B1B]/30'}`} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-[#1B1B1B] truncate">{entry.title}</span>
                            {!entry.allowed && <Lock className="w-3 h-3 text-[#8C8880] shrink-0" />}
                          </span>
                          <span className="block text-[10px] text-[#8C8880] truncate mt-0.5">{groupLabel(entry.group)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Preview */}
            <div className="overflow-y-auto p-4 max-h-[70vh]">
              {!active ? (
                <p className="text-xs text-[#8C8880]">{search.hint}</p>
              ) : locked ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-amber-700">
                    <Lock className="w-4 h-4" />
                    <p className="text-sm font-black">{search.lockedTitle.replace('{roles}', (active.requiredRoles || []).map((r) => portalRoleLabel(t, r)).join(', '))}</p>
                  </div>
                  <p className="text-xs text-[#5C5850] leading-relaxed">{search.lockedBody}</p>
                  {ownableLocked && (
                    <button
                      type="button"
                      onClick={() => openEntry(active)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FF416C] text-white text-xs font-bold"
                    >
                      {search.switchTo.replace('{role}', (active.requiredRoles || []).find((r) => myRoleOptions.includes(r)) || '')} <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <PortalGuidePreview
                    title={active.title}
                    purpose={active.purpose}
                    steps={active.steps}
                    when={active.when}
                    notFor={active.notFor}
                  />
                  <button
                    type="button"
                    onClick={() => openEntry(active)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#181818] text-white text-xs font-bold"
                  >
                    <CornerDownLeft className="w-3.5 h-3.5" /> {search.open}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="px-4 py-2 border-t border-[#D9D7D0]/60 flex items-center justify-between text-[10px] text-[#8C8880]">
          <span>{search.footerHint}</span>
          <span className="hidden sm:inline">{currentRole}</span>
        </div>
      </div>
    </div>
  );
};
