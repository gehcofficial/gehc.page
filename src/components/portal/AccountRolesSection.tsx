import React from 'react';
import { ChevronRight, Shield } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useLang } from '../../context/LangContext';
import { portalRoleLabel } from '../../lib/portal-i18n';
import { roleToNamespace } from '../../lib/portal-routes';
import { UserRole } from '../../types';

export const AccountRolesSection: React.FC = () => {
  const { myRoleOptions, currentRole, setActiveUserRole } = useApp();
  const { t } = useLang();

  const openPanel = (role: UserRole) => {
    setActiveUserRole(role);
  };

  return (
    <div className="space-y-4 max-w-xl">
      <div className="rounded-2xl border border-[#D9D7D0] bg-white p-5">
        <h2 className="text-sm font-bold text-[#1B1B1B] flex items-center gap-2 mb-1">
          <Shield className="w-4 h-4 text-[#FF416C]" />
          {t.portal.layout.rolesAndPanels}
        </h2>
        <p className="text-[11px] text-[#8C8880] mb-4">
          {t.portal.accountRoles.hint}
        </p>
        <div className="space-y-2">
          {myRoleOptions.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => openPanel(role)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                role === currentRole
                  ? 'border-[#FF416C] bg-[#FF416C]/5'
                  : 'border-[#D9D7D0] hover:border-[#1B1B1B]'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#1B1B1B]">{portalRoleLabel(t, role)}</p>
                <p className="text-[10px] text-[#8C8880] font-mono mt-0.5">
                  #/portal/{roleToNamespace(role)}/dashboard
                </p>
              </div>
              {role === currentRole && (
                <span className="text-[9px] font-bold uppercase text-[#FF416C] shrink-0">{t.portal.layout.active}</span>
              )}
              <ChevronRight className="w-4 h-4 text-[#D9D7D0] shrink-0" />
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => { window.location.hash = '#/portal'; }}
        className="text-xs font-bold text-[#8C8880] hover:text-[#1B1B1B]"
      >
        {t.portal.layout.openRolePicker}
      </button>
    </div>
  );
};
