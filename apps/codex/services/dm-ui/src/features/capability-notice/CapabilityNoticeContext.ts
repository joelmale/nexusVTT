import { createContext, useContext } from 'react';

import type { CapabilityId } from './capabilities';

export interface CapabilityNoticeContextValue {
  notifyCapability: (id: CapabilityId) => void;
}

export const CapabilityNoticeContext =
  createContext<CapabilityNoticeContextValue | null>(null);

export function useCapabilityNotice(): CapabilityNoticeContextValue {
  const context = useContext(CapabilityNoticeContext);
  if (!context) {
    throw new Error(
      'useCapabilityNotice must be used within CapabilityNoticeProvider',
    );
  }
  return context;
}
