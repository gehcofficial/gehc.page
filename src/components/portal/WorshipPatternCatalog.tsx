import React, { useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Clock, Copy, Layers, Sparkles } from 'lucide-react';
import {
  divisionLabel,
  moduleLabel,
  patternDurationDelta,
  patternTemplateCheck,
  patternTotalMinutes,
  prettyPlaybook,
  type WorshipPatternLite,
} from '../../lib/worship-patterns';
import { MdBlocks, parseMdLite } from '../../lib/md-lite';

type Props = {
  patterns: WorshipPatternLite[];
  activeCode?: string | null;
  canWrite?: boolean;
  busy?: boolean;
  onUse?: (code: string) => void;
  onCopyPlaybook?: (pattern: WorshipPatternLite) => void;
};

/** Naskah playbook siap baca di kartu putih: markdown ter-render + slot adaptasi jadi kata biasa. */
function PlaybookView({ text }: { text: string }) {
  const blocks = useMemo(() => parseMdLite(prettyPlaybook(text)), [text]);
  return (
    <div className="rounded-xl border border-[#EFEDE8] bg-white px-3 py-2">
      <MdBlocks blocks={blocks} tone="paper" density="compact" />
    </div>
  );
}

export const WorshipPatternCatalog: React.FC<Props> = ({ patterns, activeCode, canWrite, busy, onUse, onCopyPlaybook }) => {
  const [openCode, setOpenCode] = useState<string | null>(activeCode || 'POST_TO_POST');
  const [query, setQuery] = useState('');
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = (patterns || []).filter((p) => (p as { status?: string }).status !== 'ARCHIVED' || p.code === activeCode);
    const sorted = [...visible].sort((a, b) => (a.code === 'MONOLOG' ? -1 : b.code === 'MONOLOG' ? 1 : (a.code || '').localeCompare(b.code || '')));
    if (!q) return sorted;
    return sorted.filter((p) => `${p.code} ${p.name} ${p.summary || ''}`.toLowerCase().includes(q));
  }, [patterns, query]);
  const open = list.find((p) => p.code === openCode) || null;

  if (!list.length) {
    return (
      <div className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4">
        <p className="text-xs text-[#8C8880]">Belum ada pola ibadah. Jalankan seed worship (<code>npm run db:seed:worship</code>).</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[#D9D7D0]/60 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <BookOpen className="w-4 h-4 text-[#0EA5E9]" />
        <h4 className="text-sm font-black text-[#1B1B1B]">Katalog Pola Ibadah</h4>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700 font-bold">{list.length} pola</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari pola…"
          className="ml-auto rounded-xl border border-[#D9D7D0] px-3 py-1.5 text-xs w-44 focus:outline-none focus:border-black"
        />
      </div>
      <p className="text-[11px] text-[#8C8880]">
        Draft template sedetil Post-to-Post: rundown menit-per-menit + naskah siap baca + slot adaptasi <code>{'{{tema}}'}</code> <code>{'{{firman_ref}}'}</code>. Pilih pola untuk dipakai pekan ini, atau salin naskahnya untuk disesuaikan.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {list.map((p) => {
          const total = patternTotalMinutes(p.phases);
          const check = patternTemplateCheck(p);
          const isActive = p.code === activeCode;
          const isOpen = p.code === openCode;
          return (
            <button
              key={p.code}
              type="button"
              onClick={() => setOpenCode(isOpen ? null : p.code)}
              className={`text-left rounded-xl border p-3 space-y-1.5 hover:border-black ${isOpen ? 'border-black bg-[#FAF9F5]' : 'border-[#EFEDE8] bg-white'}`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-[#1B1B1B] truncate">{p.name}</span>
                {isActive && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold">pekan ini</span>}
              </div>
              <p className="text-[10px] text-[#8C8880] font-mono">{p.code} · {p.defaultDurationMin || total}&prime; · {total}&prime; rundown</p>
              {p.summary ? <p className="text-[11px] text-[#555] line-clamp-2">{p.summary}</p> : null}
              <div className="flex flex-wrap gap-1">
                {(p.modules || []).map((m) => (
                  <span key={m} className="text-[9px] px-1.5 py-0.5 rounded-full bg-sky-50 border border-sky-100 text-sky-700 font-bold">{moduleLabel(m)}</span>
                ))}
                {check.complete
                  ? <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold"><CheckCircle2 className="w-2.5 h-2.5" /> template lengkap</span>
                  : <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-bold">template parsial</span>}
              </div>
            </button>
          );
        })}
      </div>

      {open && (
        <div className="rounded-xl border border-[#1B1B1B] overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 bg-[#1B1B1B] text-white px-4 py-3">
            <Layers className="w-4 h-4" />
            <div>
              <p className="text-sm font-black">{open.name}</p>
              <p className="text-[10px] opacity-70 font-mono">{open.code} · {open.defaultDurationMin || patternTotalMinutes(open.phases)} menit baku</p>
            </div>
            <div className="ml-auto flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const text = `# ${open.name}\n\n${open.playbook || ''}`;
                  if (onCopyPlaybook) onCopyPlaybook(open);
                  else navigator.clipboard?.writeText(text);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 text-[11px] font-bold hover:bg-white/20"
              >
                <Copy className="w-3 h-3" /> Salin naskah
              </button>
              {canWrite && open.code !== activeCode && (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => onUse?.(open.code)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white text-[#1B1B1B] text-[11px] font-black disabled:opacity-50"
                >
                  <Sparkles className="w-3 h-3" /> Pakai pekan ini
                </button>
              )}
            </div>
          </div>
          <div className="p-4 space-y-3 bg-white">
            {open.summary && <p className="text-xs text-[#444]">{open.summary}</p>}
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880] mb-1.5 inline-flex items-center gap-1"><Clock className="w-3 h-3" /> Rundown {patternTotalMinutes(open.phases)}&prime;
                {(() => { const d = patternDurationDelta(open); return d !== null && d !== 0 ? <span className="text-amber-600 normal-case"> (selisih {d > 0 ? '+' : ''}{d}&prime; vs baku)</span> : null; })()}
              </p>
              <div className="overflow-x-auto rounded-xl border border-[#EFEDE8]">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-[#FAF9F5] text-[#8C8880]">
                      <th className="text-left px-2.5 py-1.5 w-8">No</th>
                      <th className="text-left px-2.5 py-1.5">Segmen</th>
                      <th className="text-left px-2.5 py-1.5 w-16">Menit</th>
                      <th className="text-left px-2.5 py-1.5">Cakupan</th>
                      <th className="text-left px-2.5 py-1.5">Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(open.phases || []).map((f, i) => (
                      <tr key={i} className="border-t border-[#EFEDE8]">
                        <td className="px-2.5 py-1.5 font-black">{f.no ?? i + 1}</td>
                        <td className="px-2.5 py-1.5">
                          <p className="font-bold text-[#1B1B1B]">{f.title}</p>
                          {f.notes && <p className="text-[#8C8880]">{f.notes}</p>}
                        </td>
                        <td className="px-2.5 py-1.5">{f.minutes}&prime;</td>
                        <td className="px-2.5 py-1.5">
                          {f.division ? (
                            <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700 font-bold whitespace-nowrap">
                              {divisionLabel(f.division)}
                            </span>
                          ) : (
                            <span className="text-[#BDBAB2]">—</span>
                          )}
                        </td>
                        <td className="px-2.5 py-1.5 text-[#8C8880]">{f.owner}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-[#8C8880] mb-1.5">Draft template (7 bagian)</p>
              <PlaybookView text={open.playbook || '(belum ada naskah)'} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
