import { useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { applyPendingBakutauRegistration, loadBakutauPending } from '../../lib/bakutau-pending';

export const ApplyPendingBakutau: React.FC<{ onApplied?: () => void }> = ({ onApplied }) => {
  const { authUser } = useApp();
  const ran = useRef(false);

  useEffect(() => {
    if (!authUser || ran.current || !loadBakutauPending()) return;
    ran.current = true;
    applyPendingBakutauRegistration().then((result) => {
      if (result.applied) onApplied?.();
    });
  }, [authUser, onApplied]);

  return null;
};
