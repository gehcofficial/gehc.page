import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, NotebookPen } from 'lucide-react';
import type { NoteSlot } from '../../lib/session-engine';

type Props = {
  slots: NoteSlot[];
  values: Record<string, string>;
  disabled?: boolean;
  onSave: (key: string, value: string) => Promise<void>;
};

const CARD = 'bg-white rounded-2xl border border-[#D9D7D0]/60 p-4';
const TEXTAREA =
  'w-full rounded-xl border border-[#D9D7D0] bg-white px-3 py-2 text-sm leading-relaxed focus:outline-none focus:border-brand';

/**
 * Catatan peserta generik: textarea per slot + auto-save (debounce) +
 * indikator tersimpan. Dipakai semua pola (FGD, deep sharing, film, misi).
 */
export const SessionNotes: React.FC<Props> = ({ slots, values, disabled, onSave }) => {
  const [drafts, setDrafts] = useState<Record<string, string>>(values);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const timers = useRef<Record<string, number>>({});
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const s of slots) if (next[s.key] === undefined) next[s.key] = values[s.key] || '';
      return next;
    });
  }, [slots, values]);

  useEffect(
    () => () => {
      for (const t of Object.values(timers.current) as number[]) window.clearTimeout(t);
    },
    [],
  );

  const change = (key: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [key]: value }));
    if (timers.current[key]) window.clearTimeout(timers.current[key]);
    timers.current[key] = window.setTimeout(async () => {
      if (disabled) return;
      setSaving((p) => ({ ...p, [key]: true }));
      try {
        await saveRef.current(key, value);
        setSavedAt(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
      } catch {
        /* pesan error ditangani induk */
      } finally {
        setSaving((p) => ({ ...p, [key]: false }));
      }
    }, 800);
  };

  return (
    <div className={CARD}>
      <div className="flex items-center gap-2 mb-3">
        <NotebookPen className="w-4 h-4 text-brand" />
        <h4 className="text-sm font-black text-[#1B1B1B]">Catatan & Komitmen</h4>
        <span className="ml-auto text-[10px] text-[#8C8880] inline-flex items-center gap-1">
          {Object.values(saving).some(Boolean) ? (
            <><Loader2 className="w-3 h-3 animate-spin" /> Menyimpan…</>
          ) : savedAt ? (
            <><Check className="w-3 h-3 text-emerald-600" /> Tersimpan {savedAt}</>
          ) : (
            'Otomatis tersimpan'
          )}
        </span>
      </div>
      <div className="space-y-3">
        {slots.map((s) => (
          <div key={s.key}>
            <label className="text-[11px] font-black text-[#1B1B1B] mb-1 block">{s.label}</label>
            <textarea
              value={drafts[s.key] || ''}
              onChange={(e) => change(s.key, e.target.value)}
              placeholder={s.placeholder}
              rows={s.key === 'KOMITMEN' ? 2 : 3}
              disabled={disabled}
              className={`${TEXTAREA} disabled:opacity-60`}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
