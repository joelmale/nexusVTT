import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import CircleCheck from 'lucide-react/dist/esm/icons/circle-check';
import X from 'lucide-react/dist/esm/icons/x';
import { getCapability } from './capabilities';
import type { CapabilityId, PrototypeCapability } from './capabilities';
import { CapabilityNoticeContext } from './CapabilityNoticeContext';
import styles from './CapabilityNotice.module.css';

interface CapabilityNoticeProviderProps {
  children: ReactNode;
}

export function CapabilityNoticeProvider({
  children,
}: CapabilityNoticeProviderProps) {
  const [capability, setCapability] = useState<PrototypeCapability | null>(
    null,
  );
  const notifyCapability = useCallback((id: CapabilityId) => {
    setCapability(getCapability(id));
  }, []);
  const contextValue = useMemo(
    () => ({ notifyCapability }),
    [notifyCapability],
  );

  return (
    <CapabilityNoticeContext.Provider value={contextValue}>
      {children}
      {capability && (
        <aside className={styles.notice} aria-label="Capability notice">
          <div className={styles.icon} aria-hidden="true">
            <CircleCheck size={18} />
          </div>
          <div className={styles.content} role="status" aria-live="polite">
            <p className={styles.title}>{capability.label}</p>
            <p className={styles.description}>{capability.description}</p>
            <p className={styles.phase}>Planned: {capability.targetPhase}</p>
            <p className={styles.unchanged}>No data changed.</p>
          </div>
          <button
            aria-label="Dismiss capability notice"
            className={styles.dismiss}
            onClick={() => setCapability(null)}
            type="button"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </aside>
      )}
    </CapabilityNoticeContext.Provider>
  );
}
