import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useLabActivity } from '../hooks/useLabActivity';

type LabActivityApi = ReturnType<typeof useLabActivity>;

const LabActivityContext = createContext<LabActivityApi | null>(null);

export const LabActivityProvider: React.FC<{
  sessionId: string;
  reloadKey?: string | number | null;
  children: React.ReactNode;
}> = ({
  sessionId,
  reloadKey,
  children,
}) => {
  const api = useLabActivity(sessionId);
  useEffect(() => {
    void api.reload();
  }, [reloadKey, api.reload]);
  const value = useMemo(() => api, [api]);
  return <LabActivityContext.Provider value={value}>{children}</LabActivityContext.Provider>;
};

export function useLabActivityContext(): LabActivityApi {
  const ctx = useContext(LabActivityContext);
  if (!ctx) throw new Error('useLabActivityContext requires LabActivityProvider');
  return ctx;
}

export function useLabActivityContextOptional(): LabActivityApi | null {
  return useContext(LabActivityContext);
}
