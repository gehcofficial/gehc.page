import React, { useState } from 'react';
import { useLang } from '../../context/LangContext';
import WartaPublikTab from './WartaPublikTab';
import { ManageWeeklyInfo } from './ManageWeeklyInfo';

/**
 * Satu destinasi "Warta" (P2-4): editor utama = alur Warta Publik
 * (DRAFT → terbit, tersinkron ke halaman publik), plus arsip/umum.
 */
export const WartaWorkspacePanel: React.FC = () => {
  const { t } = useLang();
  const w = t.portal.wartaWorkspace;
  const [tab, setTab] = useState<'publish' | 'archive'>('publish');

  const tabBtn = (id: 'publish' | 'archive', label: string) => (
    <button
      type="button"
      key={id}
      onClick={() => setTab(id)}
      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
        tab === id
          ? 'bg-[#181818] text-white'
          : 'bg-white border border-[#D9D7D0] text-[#8C8880] hover:text-[#1B1B1B]'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {tabBtn('publish', w.tabPublish)}
        {tabBtn('archive', w.tabArchive)}
      </div>
      <p className="text-[11px] text-[#8C8880]">{tab === 'publish' ? w.hintPublish : w.hintArchive}</p>
      {tab === 'publish' ? <WartaPublikTab division="DIDASKALIA" /> : <ManageWeeklyInfo />}
    </div>
  );
};
