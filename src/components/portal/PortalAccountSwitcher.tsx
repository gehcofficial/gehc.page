import React from 'react';
import { useApp } from '../../context/AppContext';

import { ROLE_LABEL } from '../../lib/roles';

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
            className={`text-[9px] font-extrabold px-2 py-1 rounded-full uppercase transition-all ${
              role === currentRole ? 'ring-2 ring-[#FF416C]' : ''
            }`}
          >
            {ROLE_LABEL[role]}
          </button>
        ))}
      </div>
    </div>
  );
};
