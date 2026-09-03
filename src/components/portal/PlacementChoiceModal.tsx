import React from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, ShieldCheck, User, Users } from 'lucide-react';

export interface PlacementTarget {
  poolId: string;
  userId: string | null;
  name: string;
  giftTestDone: boolean;
  gender: string | null;
}

interface PlacementChoiceModalProps {
  targets: PlacementTarget[];
  onClose: () => void;
  onJethro: () => void;
  onManual: () => void;
  onIndividu: () => void;
}

export const PlacementChoiceModal: React.FC<PlacementChoiceModalProps> = ({
  targets,
  onClose,
  onJethro,
  onManual,
  onIndividu,
}) => {
  const count = targets.length;
  const label = count === 1 ? targets[0].name : `${count} newcomer`;
  const canJethro = targets.every((t) => t.userId && t.giftTestDone && t.gender);
  const canManual = targets.every((t) => t.userId);
  const canIndividu = targets.every((t) => t.userId);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-[28px] w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-[#D9D7D0]/50 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-[#1B1B1B]">Penempatan</h2>
            <p className="text-xs text-[#8C8880] mt-1">
              Pilih cara assign role untuk <strong className="text-[#1B1B1B]">{label}</strong>
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 shrink-0">
            <X className="w-5 h-5 text-[#8C8880]" />
          </button>
        </div>

        <div className="p-4 space-y-2">
          <button
            type="button"
            onClick={onJethro}
            disabled={!canJethro}
            className="w-full text-left p-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-emerald-500 text-white shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1B1B1B]">Jethro Engine</p>
                <p className="text-[11px] text-[#8C8880] mt-0.5 leading-relaxed">
                  Rekomendasi AI berdasarkan karunia &amp; gender → review di Jethro Placement Review sebelum commit.
                </p>
                {!canJethro && (
                  <p className="text-[10px] text-amber-700 mt-1">Butuh profil lengkap + gift test + gender.</p>
                )}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onManual}
            disabled={!canManual}
            className="w-full text-left p-4 rounded-2xl border border-[#D9D7D0] hover:bg-[#FAF9F5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[#181818] text-white shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1B1B1B]">Manual — pilih grup &amp; role</p>
                <p className="text-[11px] text-[#8C8880] mt-0.5 leading-relaxed">
                  Wizard pohon organisasi: Beyonders (grup + Mentor/Mentee) atau jabatan lain.
                </p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onIndividu}
            disabled={!canIndividu}
            className="w-full text-left p-4 rounded-2xl border border-blue-200 bg-blue-50/40 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-blue-500 text-white shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#1B1B1B]">Individu</p>
                <p className="text-[11px] text-[#8C8880] mt-0.5 leading-relaxed">
                  Langsung assign sebagai Pemuda Individu — tanpa kelompok mentoring.
                </p>
              </div>
            </div>
          </button>
        </div>

        {count > 1 && (
          <div className="px-6 pb-4">
            <p className="text-[10px] text-[#8C8880] flex items-center gap-1">
              <Users className="w-3 h-3" /> Aksi berlaku untuk {count} orang terpilih.
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};
