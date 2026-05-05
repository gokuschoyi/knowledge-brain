import { useContext } from 'react';

import { ActiveBrainContext } from './ActiveBrainContext';

export function useActiveBrain() {
  const context = useContext(ActiveBrainContext);
  if (!context) {
    throw new Error('useActiveBrain must be used within ActiveBrainProvider.');
  }
  return context;
}
