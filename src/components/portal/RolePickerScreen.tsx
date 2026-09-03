import React from 'react';
import { Shield, Users, Sparkles, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useLang } from '../../context/LangContext';
import { portalRoleLabel } from '../../lib/portal-i18n';
import { UserRole } from '../../types';
import { buildPortalPath, roleToNamespace } from '../../lib/portal-routes';

const ROLE_ICONS: Partial<Record<UserRole, React.ReactNode>> = {
  SUPERADMIN: <Shield className="w-5 h-5" />,
  KOMISI: <Users className="w-5 h-5" />,
  COMMITTEE: <Users className="w-5 h-5" />,
  MENTOR: <Sparkles className="w-5 h-5" />,
};

export const RolePickerScreen: React.FC = () => {
  const { myRoleOptions, setActiveUserRole } = useApp();
  const { t } = useLang();

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-[#1B1B1B]">{t.portal.rolePicker.title}</h1>
          <p className="text-sm text-[#8C8880] mt-2">{t.portal.rolePicker.subtitle}</p>
        </div>
        <div className="space-y-3">
          {myRoleOptions.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setActiveUserRole(role)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white border border-[#D9D7D0] hover:border-[#FF416C] hover:shadow-md transition-all text-left group"
            >
              <div className="w-11 h-11 rounded-xl bg-[#1B1B1B] text-white flex items-center justify-center shrink-0">
                {ROLE_ICONS[role] || <Users className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#1B1B1B]">{portalRoleLabel(t, role)}</p>
                <p className="text-[11px] text-[#8C8880] mt-0.5 font-mono">#/portal/{roleToNamespace(role)}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#D9D7D0] group-hover:text-[#FF416C] shrink-0" />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => { window.location.hash = buildPortalPath({ namespace: 'account', accountSection: 'profile' }).slice(1); }}
          className="mt-6 w-full text-center text-xs font-bold text-[#8C8880] hover:text-[#1B1B1B]"
        >
          {t.portal.layout.accountSettings}
        </button>
      </div>
    </div>
  );
};
