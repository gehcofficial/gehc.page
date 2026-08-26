import React, { useEffect, useState } from 'react';
import { GraduationCap, GitBranch, Loader2 } from 'lucide-react';
import { shortName } from '../../lib/privacy-name';

interface ServerMember {
  id: string;
  name: string;
  familyRole: string;
  status: string;
  alumniNote?: string | null;
  alumniDate?: string | null;
}

interface ServerGroup {
  id: string;
  name: string;
  status: string;
  parentGroupId?: string | null;
}

/**
 * Tab Heritage (revision-v2-beyonders.md §4):
 * - Honor roll ALUMNI (Gen-0, pindah kota/negara, menikah) — jejak tetap terukir
 * - Lineage: grup keturunan hasil mitosis/merger
 * Data ditarik live dari TiDB via API publik; gagal = tampil placeholder halus.
 */
export const HeritageSection: React.FC<{
  groupId: string;
  color: string;
  onOpenChild?: (childGroupId: string) => void;
}> = ({ groupId, color, onOpenChild }) => {
  const [alumni, setAlumni] = useState<ServerMember[] | null>(null);
  const [children, setChildren] = useState<ServerGroup[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setAlumni(null);
    setChildren(null);
    setFailed(false);
    (async () => {
      try {
        const [m, g] = await Promise.all([
          fetch(`/api/db/groups/${groupId}/members`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
          fetch('/api/db/groups').then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
        ]);
        if (cancelled) return;
        setAlumni((m.members || []).filter((x: ServerMember) => x.status === 'ALUMNI'));
        setChildren((g.groups || []).filter(
          (x: ServerGroup) => x.parentGroupId === groupId && x.status !== 'ARCHIVED'
        ));
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  if (failed) return null;

  const loading = alumni === null || children === null;
  const empty = !loading && (alumni?.length ?? 0) === 0 && (children?.length ?? 0) === 0;
  if (empty) return null;

  return (
    <section>
      <div className="flex items-center gap-2 mb-5">
        <GraduationCap className="w-4 h-4" style={{ color }} />
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1B1B1B]">Heritage</h2>
        <span className="px-2 py-0.5 rounded-full bg-[#F3F1EC] text-[#8C8880] text-[9px] font-black uppercase tracking-wider">
          Jejak Generasi
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-[#8C8880]">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat arsip heritage…
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {/* Alumni Honor Roll */}
          {(alumni?.length ?? 0) > 0 && (
            <div className="p-5 sm:p-6 rounded-[28px] bg-white border border-[#D9D7D0]/60 shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-widest text-[#8C8880] mb-4">
                Hall of Alumni ({alumni!.length})
              </h3>
              <div className="space-y-3">
                {alumni!.map((a) => (
                  <div key={a.id} className="flex items-start gap-3">
                    <span
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[10px] font-black shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {(a.name || '').split(' ').map((w) => w[0]).slice(0, 2).join('')}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#1B1B1B] truncate">{shortName(a.name)}</p>
                      <p className="text-[11px] text-[#8C8880] leading-snug">
                        {a.alumniNote || 'Alumni — berkarya di luar kotanya.'}
                        {a.alumniDate && (
                          <span className="block mt-0.5 opacity-70">
                            Sejak {new Date(a.alumniDate).getFullYear()}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-[#8C8880]/80 mt-4 italic">
                “Nama dan jejak pelayanan tetap terukir di family tree, walau tidak lagi memakan kuota aktif.”
              </p>
            </div>
          )}

          {/* Lineage */}
          {(children?.length ?? 0) > 0 && (
            <div className="p-5 sm:p-6 rounded-[28px] bg-gradient-to-br from-[#181818] to-[#242424] shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-widest text-white/50 mb-4 flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5" style={{ color }} />
                Generasi Berikutnya ({children!.length})
              </h3>
              <div className="space-y-2.5">
                {children!.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onOpenChild?.(c.id)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-left"
                  >
                    <span className="text-sm font-bold text-white truncate">{c.name}</span>
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                        c.status === 'MERGED'
                          ? 'bg-purple-500/20 text-purple-300'
                          : c.status === 'DORMANT'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {c.status}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
