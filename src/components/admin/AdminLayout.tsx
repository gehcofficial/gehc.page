import React, { useEffect, useMemo, useState } from 'react';
import { Shield, LogOut, Menu, X } from 'lucide-react';
import { parseAdminHash, navigateAdmin, AdminPage } from '../../lib/admin-routes';
import { buildAdminNavItems } from '../../lib/admin-nav-config';
import { OperatorLogin } from './OperatorLogin';
import { PlatformAdminsPanel } from './PlatformAdminsPanel';
import { PasskeyManagePanel } from './PasskeyManagePanel';
import { AccessGroupsPanel } from '../portal/AccessGroupsPanel';
import { ProvisionInviteWizard } from '../portal/ProvisionInviteWizard';
import { fetchPlatformContext, fetchOperatorMe, operatorLogout, fetchPlatformAudit } from '../../services/platformApi';
import { useApp } from '../../context/AppContext';

const AdminAuditPanel: React.FC = () => {
  const [logs, setLogs] = useState<unknown[]>([]);
  useEffect(() => {
    fetchPlatformAudit(100).then((d) => setLogs(d.logs || [])).catch(console.error);
  }, []);
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Audit Log</h2>
      <div className="rounded-xl border overflow-hidden text-xs font-mono">
        {(logs as { action: string; actorType: string; createdAt: string }[]).map((l, i) => (
          <div key={i} className="px-4 py-2 border-b border-[#E8E4DC] flex justify-between gap-4">
            <span>{l.action}</span>
            <span className="text-[#8C8880]">{new Date(l.createdAt).toLocaleString('id-ID')}</span>
          </div>
        ))}
        {!logs.length && <p className="p-4 text-[#8C8880]">Belum ada log.</p>}
      </div>
    </div>
  );
};

const AdminIntegrationsPanel: React.FC = () => (
  <div className="space-y-4">
    <h2 className="text-xl font-bold">Integrasi</h2>
    <p className="text-sm text-[#8C8880]">
      Audit sinkronisasi Drive tersedia untuk operator root di menu Audit / endpoint{' '}
      <code className="text-xs bg-black/5 px-1 rounded">GET /api/drive/audit</code>.
    </p>
    <a
      href="#/portal/komisi/integrations"
      className="inline-block text-sm text-[#FF416C] underline"
    >
      Buka integrasi portal komisi →
    </a>
  </div>
);

export const AdminLayout: React.FC = () => {
  const { platformCapabilities, isPlatformOperator, refreshPlatformContext, authUser } = useApp();
  const [operatorReady, setOperatorReady] = useState(false);
  const [operatorEmail, setOperatorEmail] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminPage, setAdminPage] = useState<AdminPage>('dashboard');

  const isRoot = isPlatformOperator;
  const caps = platformCapabilities;
  const navItems = useMemo(() => buildAdminNavItems(caps, isRoot), [caps, isRoot]);

  const memberAdminAccess = !isRoot && caps.length > 0 && authUser;

  useEffect(() => {
    const sync = () => {
      const route = parseAdminHash(window.location.hash);
      if (route) setAdminPage(route.page);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  useEffect(() => {
    (async () => {
      await refreshPlatformContext();
      try {
        const me = await fetchOperatorMe();
        setOperatorEmail(me.operator.email);
        setOperatorReady(true);
      } catch {
        const ctx = await fetchPlatformContext();
        if (ctx.isPlatformAdmin && authUser) setOperatorReady(true);
      }
    })();
  }, [refreshPlatformContext, authUser]);

  if (!operatorReady && !memberAdminAccess) {
    return (
      <OperatorLogin
        onSuccess={async () => {
          await refreshPlatformContext();
          const me = await fetchOperatorMe().catch(() => null);
          if (me) setOperatorEmail(me.operator.email);
          setOperatorReady(true);
        }}
      />
    );
  }

  const go = (page: AdminPage) => {
    navigateAdmin(page);
    setMobileOpen(false);
  };

  const logout = async () => {
    if (isRoot) await operatorLogout();
    window.location.hash = isRoot ? '#/admin' : '#/portal';
    window.location.reload();
  };

  const renderPage = () => {
    switch (adminPage) {
      case 'platform-admins':
        return <PlatformAdminsPanel />;
      case 'access-groups':
        return <AccessGroupsPanel />;
      case 'people':
        return <ProvisionInviteWizard />;
      case 'integrations':
        return <AdminIntegrationsPanel />;
      case 'audit':
        return <AdminAuditPanel />;
      case 'passkey':
        return <PasskeyManagePanel />;
      default:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Platform Admin</h2>
            <p className="text-[#8C8880]">
              {isRoot
                ? `Operator root: ${operatorEmail}`
                : `Platform admin: ${authUser?.name} (${authUser?.email})`}
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {navItems.filter((n) => n.id !== 'dashboard').map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go(item.id)}
                  className="text-left p-4 rounded-xl border border-[#E8E4DC] hover:border-[#FF416C]/40 bg-white"
                >
                  <div className="font-semibold">{item.label}</div>
                </button>
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex">
      <aside
        className={`${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:static z-40 w-64 bg-[#1B1B1B] text-white min-h-screen flex flex-col transition-transform`}
      >
        <div className="p-4 border-b border-white/10 flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#FF416C]" />
          <span className="font-bold text-sm">GEHC Admin</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => go(item.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                adminPage === item.id ? 'bg-[#FF416C] text-white' : 'hover:bg-white/10'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => void logout()}
          className="m-3 flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-white/10"
        >
          <LogOut className="w-4 h-4" /> Keluar
        </button>
      </aside>

      {mobileOpen && (
        <button type="button" className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className="flex-1 min-w-0">
        <header className="lg:hidden flex items-center justify-between p-4 border-b bg-white">
          <button type="button" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm">Admin</span>
          <button type="button" onClick={() => setMobileOpen(false)} className="opacity-0">
            <X className="w-5 h-5" />
          </button>
        </header>
        <main className="p-6 lg:p-8 max-w-5xl">{renderPage()}</main>
      </div>
    </div>
  );
};
