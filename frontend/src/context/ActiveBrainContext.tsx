import { createContext, PropsWithChildren, useMemo, useState } from 'react';

type ActiveBrainContextValue = {
  activeBrainId: string;
  setActiveBrainId: (brainId: string) => void;
};

const ACTIVE_BRAIN_STORAGE_KEY = 'knowledge-brain.active-brain-id';

const ActiveBrainContext = createContext<ActiveBrainContextValue | undefined>(
  undefined,
);

export function ActiveBrainProvider({ children }: PropsWithChildren) {
  const [activeBrainId, setActiveBrainIdState] = useState(() => {
    return window.localStorage.getItem(ACTIVE_BRAIN_STORAGE_KEY) ?? '';
  });

  const setActiveBrainId = (brainId: string) => {
    setActiveBrainIdState(brainId);
    if (brainId) {
      window.localStorage.setItem(ACTIVE_BRAIN_STORAGE_KEY, brainId);
      return;
    }
    window.localStorage.removeItem(ACTIVE_BRAIN_STORAGE_KEY);
  };

  const value = useMemo(
    () => ({ activeBrainId, setActiveBrainId }),
    [activeBrainId],
  );

  return (
    <ActiveBrainContext.Provider value={value}>
      {children}
    </ActiveBrainContext.Provider>
  );
}

export { ActiveBrainContext };
