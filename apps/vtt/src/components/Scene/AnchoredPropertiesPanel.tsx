import React, { useLayoutEffect, useRef, useState } from 'react';
import { Portal } from '@/components/Portal';
import { useStackZIndex, useUIStackStore } from '@/stores/uiStackStore';
import {
  calculateAnchoredPanelPosition,
  DEFAULT_ANCHOR_GAP,
  type ViewportRect,
} from './anchoredPanelPosition';
import styles from './AnchoredPropertiesPanel.module.css';

interface AnchoredPropertiesPanelProps {
  anchor: ViewportRect;
  label: string;
  children: React.ReactNode;
}

const PANEL_ID = 'objectProperties';

/**
 * Portal-mounted, non-modal properties surface anchored to a scene object.
 * Portaling lets it participate in the application chrome stack instead of
 * being trapped below floating panels by the scene's stacking context.
 */
export const AnchoredPropertiesPanel: React.FC<
  AnchoredPropertiesPanelProps
> = ({ anchor, label, children }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const zIndex = useStackZIndex(PANEL_ID);
  const bringToFront = useUIStackStore((state) => state.bringToFront);
  const [position, setPosition] = useState({
    left: anchor.right + DEFAULT_ANCHOR_GAP,
    top: anchor.top,
  });

  useLayoutEffect(() => {
    bringToFront(PANEL_ID);

    const updatePosition = () => {
      const bounds = panelRef.current?.getBoundingClientRect();
      const panel = {
        width: bounds?.width || panelRef.current?.offsetWidth || 320,
        height: bounds?.height || panelRef.current?.offsetHeight || 0,
      };
      setPosition(
        calculateAnchoredPanelPosition(anchor, panel, {
          width: window.innerWidth,
          height: window.innerHeight,
        }),
      );
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [anchor, bringToFront]);

  return (
    <Portal>
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="false"
        aria-label={label}
        style={{
          left: position.left,
          top: position.top,
          zIndex,
        }}
        onPointerDownCapture={() => bringToFront(PANEL_ID)}
      >
        {children}
      </div>
    </Portal>
  );
};
