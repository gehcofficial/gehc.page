import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { lastPortalPlace, portalLiturgiaHref } from '../../lib/portal-place';

async function resolveHref(): Promise<string> {
  let last = '';
  try {
    last = lastPortalPlace('');
  } catch { /* abaikan */ }
  if (last.includes('div-liturgia')) return last;
  try {
    const r = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
    if (r.ok) {
      const d = await r.json().catch(() => ({}));
      return portalLiturgiaHref(last, d?.activeNamespace || null);
    }
  } catch { /* belum login / offline */ }
  return portalLiturgiaHref(last, null);
}

/**
 * Tombol kembali ke portal Liturgia minggu terkait (untuk rute standalone
 * layar/kontrol yang hidup di luar portal shell). Target berlapis:
 * posisi div-liturgia terakhir → tab Liturgia namespace aktif → #/portal.
 */
export const PortalBackButton: React.FC<{ dark?: boolean; label?: string }> = ({ dark, label }) => {
  const [href, setHref] = useState('#/portal');
  useEffect(() => {
    void resolveHref().then(setHref);
  }, []);
  return (
    <a
      href={href}
      title="Kembali ke portal Liturgia"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold ${
        dark
          ? 'border-white/20 text-white/70 hover:text-white'
          : 'border-[#D9D7D0] text-[#8C8880] hover:text-[#1B1B1B]'
      }`}
    >
      <ArrowLeft className="w-3.5 h-3.5" /> {label || 'Portal Liturgia'}
    </a>
  );
};

export default PortalBackButton;
