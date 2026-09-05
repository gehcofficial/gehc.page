import React, { useState } from 'react';
import { CheckCircle2, Download, Share, Smartphone } from 'lucide-react';
import { useLang } from '../../context/LangContext';
import { detectPwaInstallKind, isStandaloneDisplay, promptPwaInstall } from '../../lib/pwa-install';

export const PwaInstallCard: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { t } = useLang();
  const copy = t.portal.pwaInstall;
  const kind = detectPwaInstallKind();
  const installed = isStandaloneDisplay();
  const [busy, setBusy] = useState(false);

  if (installed) {
    if (compact) return null;
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
          <div>
            <p className="font-bold text-green-800">{copy.installed}</p>
            <p className="text-sm text-green-700">{copy.installedHint}</p>
          </div>
        </div>
      </div>
    );
  }

  const onInstall = async () => {
    setBusy(true);
    try {
      await promptPwaInstall();
    } finally {
      setBusy(false);
    }
  };

  const steps =
    kind === 'ios' ? copy.iosSteps
      : kind === 'macos-safari' ? copy.macSteps
        : kind === 'chromium' ? copy.chromiumHint
          : copy.otherHint;

  const heading =
    kind === 'ios' ? copy.iosTitle
      : kind === 'macos-safari' ? copy.macTitle
        : copy.title;

  return (
    <div className={compact ? 'rounded-xl border border-[#D9D7D0]/60 bg-white p-3 space-y-2' : 'bg-white rounded-2xl border border-[#D9D7D0]/50 p-5'}>
      <h3 className={`font-bold text-[#1B1B1B] flex items-center gap-2 ${compact ? 'text-sm' : 'text-lg mb-2'}`}>
        <Smartphone className={compact ? 'w-4 h-4 text-[#F6AE4A]' : 'w-5 h-5 text-[#F6AE4A]'} />
        {heading}
      </h3>
      {!compact && <p className="text-sm text-[#8C8880] mb-3">{copy.body}</p>}
      <p className="text-xs text-[#8C8880] leading-relaxed">{steps}</p>
      {kind === 'ios' || kind === 'macos-safari' ? (
        <p className="text-[11px] text-[#8C8880] flex items-center gap-1.5 mt-2">
          <Share className="w-3.5 h-3.5 shrink-0" />
          {kind === 'ios' ? copy.iosTitle : copy.macTitle}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => { void onInstall(); }}
          disabled={busy}
          className="mt-3 px-6 py-3 rounded-xl bg-[#F6AE4A] text-[#1B1B1B] text-sm font-bold flex items-center gap-2 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {copy.button}
        </button>
      )}
      {kind === 'ios' && (
        <p className="text-[11px] text-[#8C8880] mt-2">{copy.pushIosNote}</p>
      )}
    </div>
  );
};
