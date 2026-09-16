import React from 'react';
import { useDockHostRef } from '@/hooks/useDocking';
import type { DockZone } from '@/stores/uiStackStore';

/**
 * Host element for panels docked to one viewport edge.
 *
 * Registers itself through a callback ref so docked FloatingPanels can portal
 * into it without racing the DOM (see useDockHostRef). Occupying a region opens
 * the matching `--dock-*` grid track on `.game-layout`, which is what makes a
 * dock reserve real layout space and reflow the canvas.
 */
export const DockRegion: React.FC<{ zone: DockZone }> = ({ zone }) => {
  const ref = useDockHostRef(zone);
  return (
    <div
      ref={ref}
      className="dock-region"
      data-zone={zone}
      data-dock-region={zone}
    />
  );
};
