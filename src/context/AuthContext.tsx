import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '../types';
import {
  fetchAuthConfig,
  fetchMe,
  loginWithGoogle,
  logout as logoutApi,
  fetchPersonas,
  impersonate as impersonateApi,
} from '../services/authApi';

export type SessionSource = 'google' | 'demo' | null;

interface AuthContextType {
  authUser: User | null;
  authLoading: boolean;
  ssoClientId: string | null;
  demoMode: boolean;
  sessionSource: SessionSource;
  loginWithCredential: (credential: string) => Promise<void>;
  logoutSso: () => Promise<void>;
  /** Called after demo personas load — parent syncs user list */
  onDemoPersonasLoaded?: (users: User[], defaultUserId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{
  children: React.ReactNode;
  onToast: (toast: { type: 'success' | 'error' | 'info'; title: string; description?: string }) => void;
  onDemoPersonasLoaded: (users: User[], defaultUserId: string) => void;
  onLogoutReset: () => void;
}> = ({ children, onToast, onDemoPersonasLoaded, onLogoutReset }) => {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [ssoClientId, setSsoClientId] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [sessionSource, setSessionSource] = useState<SessionSource>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await fetchAuthConfig();
        if (cancelled) return;
        setSsoClientId(cfg.clientId);
        if (cfg.configured) {
          const me = await fetchMe();
          if (!cancelled) setAuthUser(me);
        }
      } catch {
        /* server offline → demo fallback */
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchPersonas();
        if (cancelled || list.length === 0) return;
        setDemoMode(true);
        const fallback = list.find((u) => u.roles.some((r) => r.role === 'SUPERADMIN')) ?? list[0];
        onDemoPersonasLoaded(list, fallback.id);
        const existing = await fetchMe().catch(() => null);
        if (cancelled || existing) return;
        const target = list.find((u) => u.email === fallback.email) ?? fallback;
        const u = await impersonateApi(target.email);
        if (cancelled) return;
        setAuthUser(u);
        setSessionSource('demo');
      } catch {
        /* personas unavailable */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onDemoPersonasLoaded]);

  const loginWithCredential = useCallback(async (credential: string) => {
    const user = await loginWithGoogle(credential);
    setAuthUser(user);
    setSessionSource('google');
    onToast({
      type: 'success',
      title: `Login Google: ${user.name}`,
      description: 'Sesi SSO aktif — role dimuat dari TiDB.',
    });
  }, [onToast]);

  const logoutSso = useCallback(async () => {
    await logoutApi();
    setAuthUser(null);
    setSessionSource(null);
    onLogoutReset();
    onToast({ type: 'info', title: 'Logout berhasil', description: 'Kembali ke mode simulasi persona.' });
  }, [onLogoutReset, onToast]);

  return (
    <AuthContext.Provider
      value={{
        authUser,
        authLoading,
        ssoClientId,
        demoMode,
        sessionSource,
        loginWithCredential,
        logoutSso,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
