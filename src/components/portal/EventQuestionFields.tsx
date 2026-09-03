import React from 'react';
import type { EventQuestion } from '../../lib/event-questions';

const inputClass =
  'w-full px-3 py-2 rounded-xl border border-[#D9D7D0] bg-[#FAF9F5] text-sm';

export const EventQuestionFields: React.FC<{
  questions: EventQuestion[];
  values: Record<string, unknown>;
  onChange: (questionId: string, value: unknown) => void;
  disabled?: boolean;
}> = ({ questions, values, onChange, disabled }) => {
  if (!questions.length) return null;
  return (
    <div className="space-y-3">
      {questions.map((q) => {
        const v = values[q.id];
        return (
          <label key={q.id} className="block space-y-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#8C8880]">
              {q.label}
            </span>
            {q.type === 'BOOLEAN' && (
              <select
                className={inputClass}
                disabled={disabled}
                value={v === true ? 'true' : v === false ? 'false' : ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  onChange(q.id, raw === '' ? undefined : raw === 'true');
                }}
              >
                <option value="">Belum diisi</option>
                <option value="true">Ya</option>
                <option value="false">Tidak</option>
              </select>
            )}
            {q.type === 'TEXT' && (
              <input
                className={inputClass}
                disabled={disabled}
                value={typeof v === 'string' ? v : ''}
                onChange={(e) => onChange(q.id, e.target.value)}
              />
            )}
            {q.type === 'SELECT' && (
              <select
                className={inputClass}
                disabled={disabled}
                value={typeof v === 'string' ? v : ''}
                onChange={(e) => onChange(q.id, e.target.value || undefined)}
              >
                <option value="">Pilih…</option>
                {q.options.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            )}
            {q.type === 'MULTI' && (
              <div className="flex flex-wrap gap-2">
                {q.options.map((o) => {
                  const selected = Array.isArray(v) && v.includes(o);
                  return (
                    <label key={o} className="inline-flex items-center gap-1.5 text-xs text-[#1B1B1B]">
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={selected}
                        onChange={() => {
                          const cur = Array.isArray(v) ? v.map(String) : [];
                          onChange(q.id, selected ? cur.filter((x) => x !== o) : [...cur, o]);
                        }}
                      />
                      {o}
                    </label>
                  );
                })}
              </div>
            )}
            {q.hint ? <span className="block text-[10px] text-[#8C8880] leading-relaxed">{q.hint}</span> : null}
          </label>
        );
      })}
    </div>
  );
};
