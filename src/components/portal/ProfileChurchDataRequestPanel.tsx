import React, { useEffect, useState } from 'react';
import { Loader2, Send } from 'lucide-react';

const BIPRA_LABEL: Record<string, string> = {
  BAPAK: 'Bapak', IBU: 'Ibu', PEMUDA: 'Pemuda', REMAJA: 'Remaja', ANAK: 'Anak',
};

export type ChurchDataRequest = {
  id: string;
  changeName?: boolean;
  changeBipra?: boolean;
  changeKolom?: boolean;
  requestedName?: string | null;
  requestedBipra?: string | null;
  requestedKolomId?: string | null;
  reason?: string | null;
  status: string;
};

type KolomOption = { id: string; number: number; name: string };

function requestSummary(req: ChurchDataRequest, kolomList: KolomOption[]) {
  const parts: string[] = [];
  if (req.changeName && req.requestedName) parts.push(`Nama → ${req.requestedName}`);
  if (req.changeBipra && req.requestedBipra) {
    parts.push(`BIPRA → ${BIPRA_LABEL[req.requestedBipra] || req.requestedBipra}`);
  }
  if (req.changeKolom) {
    const kol = req.requestedKolomId
      ? kolomList.find((k) => k.id === req.requestedKolomId)?.name || req.requestedKolomId
      : 'Belum di-assign';
    parts.push(`Kolom → ${kol}`);
  }
  return parts.join(' · ');
}

export const ProfileChurchDataRequestPanel: React.FC<{
  user: {
    name?: string;
    bipra?: string;
    kolom?: { id: string; name: string } | null;
    kolomId?: string | null;
  } | null;
  pendingRequest: ChurchDataRequest | null;
  kolomList: KolomOption[];
  bipraOptions: string[];
  onboardingMode?: boolean;
  onSubmitted: () => void;
  addToast: (t: { type: 'success' | 'error'; title: string; description?: string }) => void;
}> = ({ user, pendingRequest, kolomList, bipraOptions, onboardingMode, onSubmitted, addToast }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [onboardingForm, setOnboardingForm] = useState({
    name: user?.name || '',
    bipra: user?.bipra || 'PEMUDA',
    kolomId: user?.kolomId || user?.kolom?.id || '',
  });

  useEffect(() => {
    setOnboardingForm({
      name: user?.name || '',
      bipra: user?.bipra || 'PEMUDA',
      kolomId: user?.kolomId || user?.kolom?.id || '',
    });
  }, [user?.name, user?.bipra, user?.kolomId, user?.kolom?.id]);
  const [form, setForm] = useState({
    requestedName: '',
    requestedBipra: '',
    requestedKolomId: '',
    reason: '',
  });

  const field = 'w-full px-4 py-2.5 rounded-2xl bg-white border border-[#D9D7D0] text-xs font-medium focus:outline-none focus:border-black';

  const saveOnboardingChurch = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/me/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: onboardingForm.name.trim(),
          bipra: onboardingForm.bipra,
          kolomId: onboardingForm.kolomId || null,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((d as { error?: string }).error || 'Gagal menyimpan');
      addToast({ type: 'success', title: 'Tersimpan', description: 'Data gereja diperbarui.' });
      onSubmitted();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Gagal',
        description: err instanceof Error ? err.message : 'Gagal menyimpan',
      });
    } finally {
      setBusy(false);
    }
  };

  const openModal = () => {
    setForm({
      requestedName: user?.name || '',
      requestedBipra: user?.bipra || 'PEMUDA',
      requestedKolomId: user?.kolomId || user?.kolom?.id || '',
      reason: '',
    });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: Record<string, string | null> = { reason: form.reason.trim() || null };
      if (form.requestedName.trim() !== (user?.name || '').trim()) {
        payload.requestedName = form.requestedName.trim();
      }
      if (form.requestedBipra && form.requestedBipra !== user?.bipra) {
        payload.requestedBipra = form.requestedBipra;
      }
      const currentKolom = user?.kolomId || user?.kolom?.id || '';
      if (form.requestedKolomId !== currentKolom) {
        payload.requestedKolomId = form.requestedKolomId || null;
      }

      const res = await fetch('/api/me/profile/church-data-request', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((d as { error?: string }).error || 'Gagal mengirim permintaan');
      addToast({
        type: 'success',
        title: 'Permintaan terkirim',
        description: 'Admin Komisi akan meninjau di panel Jemaat.',
      });
      setOpen(false);
      onSubmitted();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Gagal',
        description: err instanceof Error ? err.message : 'Gagal mengirim permintaan',
      });
    } finally {
      setBusy(false);
    }
  };

  if (onboardingMode) {
    return (
      <div className="mt-4 pt-4 border-t border-dashed border-[#D9D7D0]/60">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880] mb-1">Identitas & data gereja</p>
        <p className="text-[10px] text-[#8C8880] mb-3 leading-relaxed">
          Isi nama lengkap sesuai KTP. Nama Google hanya untuk login — kolom dan BIPRA bisa diisi langsung saat onboarding.
        </p>
        <form onSubmit={saveOnboardingChurch} className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase text-[#8C8880] block mb-1">Nama lengkap (sesuai KTP) *</label>
            <input
              className={field}
              value={onboardingForm.name}
              onChange={(e) => setOnboardingForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={user?.name || 'Nama resmi'}
              required
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-[#8C8880] block mb-1">BIPRA *</label>
            <select
              className={field}
              value={onboardingForm.bipra}
              onChange={(e) => setOnboardingForm((f) => ({ ...f, bipra: e.target.value }))}
            >
              {bipraOptions.map((b) => (
                <option key={b} value={b}>{BIPRA_LABEL[b] || b}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-[#8C8880] block mb-1">Kolom</label>
            <select
              className={field}
              value={onboardingForm.kolomId}
              onChange={(e) => setOnboardingForm((f) => ({ ...f, kolomId: e.target.value }))}
            >
              <option value="">Pilih kolom…</option>
              {kolomList.map((k) => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2.5 rounded-2xl bg-[#181818] text-white text-xs font-bold disabled:opacity-50 flex items-center gap-2"
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Simpan data gereja
          </button>
        </form>
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 pt-4 border-t border-dashed border-[#D9D7D0]/60">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880] mb-1">Data gereja (admin)</p>
        <p className="text-xs text-[#1B1B1B]">
          {BIPRA_LABEL[user?.bipra || ''] || user?.bipra || '—'}
          {user?.kolom ? ` · ${user.kolom.name}` : ' · Kolom belum diisi'}
        </p>
        {pendingRequest ? (
          <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-[10px] font-bold text-amber-900">Permintaan perubahan menunggu Komisi</p>
            <p className="text-[10px] text-amber-800 mt-0.5">{requestSummary(pendingRequest, kolomList)}</p>
            <p className="text-[9px] text-amber-700/80 mt-1">Admin setujui di Portal → Jemaat → Permintaan ubah data gereja.</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={openModal}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D9D7D0] bg-white text-[10px] font-bold text-[#181818] hover:border-[#181818]"
          >
            <Send className="w-3 h-3" /> Ajukan perubahan
          </button>
        )}
        <p className="text-[10px] text-[#8C8880] mt-1.5">
          Setelah onboarding, perubahan nama/BIPRA/kolom perlu persetujuan Komisi.
        </p>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#FAF9F5] rounded-[28px] w-full max-w-md border border-[#D9D7D0] shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold">Ajukan perubahan data gereja</h3>
            <p className="text-[10px] text-[#8C8880]">
              Isi hanya field yang ingin diubah. Admin Komisi akan setujui atau tolak permintaan ini di panel Jemaat.
            </p>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-[#8C8880] block mb-1">Nama</label>
                <input
                  className={field}
                  value={form.requestedName}
                  onChange={(e) => setForm((f) => ({ ...f, requestedName: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-[#8C8880] block mb-1">BIPRA</label>
                <select
                  className={field}
                  value={form.requestedBipra}
                  onChange={(e) => setForm((f) => ({ ...f, requestedBipra: e.target.value }))}
                >
                  {bipraOptions.map((b) => (
                    <option key={b} value={b}>{BIPRA_LABEL[b] || b}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-[#8C8880] block mb-1">Kolom</label>
                <select
                  className={field}
                  value={form.requestedKolomId}
                  onChange={(e) => setForm((f) => ({ ...f, requestedKolomId: e.target.value }))}
                >
                  <option value="">Belum di-assign</option>
                  {kolomList.map((k) => (
                    <option key={k.id} value={k.id}>{k.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-[#8C8880] block mb-1">Alasan (opsional)</label>
                <textarea
                  className={`${field} resize-none`}
                  rows={2}
                  placeholder="Contoh: nama baptis berbeda, pindah kolom…"
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 py-2.5 rounded-2xl border border-[#D9D7D0] text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 py-2.5 rounded-2xl bg-[#181818] text-white text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Kirim permintaan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export function churchRequestSummaryForAdmin(
  req: ChurchDataRequest & { user?: { name?: string } },
  kolomList: KolomOption[],
) {
  const base = requestSummary(req, kolomList);
  return req.user?.name ? `${req.user.name}: ${base}` : base;
}
