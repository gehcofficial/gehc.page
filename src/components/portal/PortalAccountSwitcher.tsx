import React from 'react';
import { useApp } from '../../context/AppContext';

import { ROLE_LABEL } from '../../lib/roles';
import { ROLE_CHIP_COLORS } from '../../lib/status-colors';

export const PortalAccountSwitcher: React.FC = () => {
  const { myRoleOptions, setActiveUserRole, currentRole } = useApp();

  if (myRoleOptions.length <= 1) return null;

  return (
    <div className="pt-4 border-t border-[#D9D7D0]/60">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#8C8880] mb-1.5">
        Konteks Peran Aktif
      </p>
      <div className="flex flex-wrap gap-1">
        {myRoleOptions.map((role, idx) => (
          <button
            key={`${role}-${idx}`}
            onClick={() => setActiveUserRole(role)}
            title={ROLE_LABEL[role]}
            className={`text-[9px] font-extrabold px-2.5 py-1.5 rounded-full uppercase tracking-wide transition-all duration-200 ${
              ROLE_CHIP_COLORS[role] || 'bg-gray-100 text-gray-700'
            } ${
              role === currentRole
                ? 'ring-2 ring-[#FF416C] ring-offset-1 shadow-sm'
                : 'opacity-70 hover:opacity-100 hover:scale-105 hover:shadow-md hover:ring-2 hover:ring-[#181818]/25'
            }`}
          >
            {ROLE_LABEL[role]}
          </button>
        ))}
      </div>
    </div>
  );
};
