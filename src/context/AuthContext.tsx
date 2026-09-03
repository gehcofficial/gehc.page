import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '../types';
import {
  fetchAuthConfig,
  fetchMe,
  loginWithGoogle,
  logout as logoutApi,
} from '../services/authApi';

interface AuthContextType {
  authUser: User | null;
  authLoading: boolean;
  ssoClientId: string | null;
  loginWithCredential: (credential: string) => Promise<void>;
  logoutSso: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{
  children: React.ReactNode;
  onToast: (toast: { type: 'success' | 'error' | 'info'; title: string; description?: string }) => void;
  onLogoutReset: () => void;
}> = ({ children, onToast, onLogoutReset }) => {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [ssoClientId, setSsoClientId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [cfgResult, meResult] = await Promise.allSettled([
        fetchAuthConfig(),
        fetchMe(),
      ]);
      if (cancelled) return;
      if (cfgResult.status === 'fulfilled') setSsoClientId(cfgResult.value.clientId);
      if (meResult.status === 'fulfilled') setAuthUser(meResult.value);
      setAuthLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loginWithCredential = useCallback(async (credential: string) => {
    const { user } = await loginWithGoogle(credential);
    setAuthUser(user);
    onToast({
      type: 'success',
      title: `Login Google: ${user.name}`,
      description: 'Sesi SSO aktif — role dimuat dari TiDB.',
    });
  }, [onToast]);

  const logoutSso = useCallback(async () => {
    await logoutApi();
    setAuthUser(null);
    onLogoutReset();
    onToast({ type: 'info', title: 'Logout berhasil', description: 'Anda telah keluar dari portal.' });
  }, [onLogoutReset, onToast]);

  return (
    <AuthContext.Provider
      value={{
        authUser,
        authLoading,
        ssoClientId,
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
