import React from 'react';
import { Portal } from './Portal';
import { DOCK_ZONES, type DockZone } from '@/stores/uiStackStore';
import styles from './DockZoneOverlay.module.css';

interface DockZoneOverlayProps {
  /** Null while nothing is being dragged - the overlay renders nothing. */
  activeZone: DockZone | null;
  /** True while a panel drag is in flight, so the zones are visible at all. */
  isDragging: boolean;
}

/**
 * Translucent drop targets shown while a floating panel is dragged near a
 * viewport edge. Purely visual - the hit-testing lives in `dockZoneForPoint`
 * so it can be unit-tested without a DOM.
 */
export const DockZoneOverlay: React.FC<DockZoneOverlayProps> = ({
  activeZone,
  isDragging,
}) => {
  if (!isDragging) return null;

  return (
    <Portal>
      <div className={styles.overlay} aria-hidden="true">
        {DOCK_ZONES.map((zone) => (
          <div
            key={zone}
            className={styles.zone}
            data-zone={zone}
            data-active={zone === activeZone || undefined}
          >
            <span className={styles.hint}>Dock {zone}</span>
          </div>
        ))}
      </div>
    </Portal>
  );
};
