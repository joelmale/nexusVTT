import type { DockZone, PanelId } from '@/stores/uiStackStore';
import type { PanelLayout } from '@/types/game';

/**
 * Bump when the shape of a stored workspace changes.
 *
 * v2 added `panelLayout`. A v1 preset is readable as-is: no field means the
 * preset predates layouts, which is Original by definition.
 */
export const WORKSPACE_SCHEMA_VERSION = 2;

export interface PanelGeometry {
  position: { x: number; y: number };
  /** Absent for chrome that is draggable but not resizable (ScenePill, PanelDock). */
  size?: { width: number; height: number };
  collapsed?: boolean;
}

/**
 * A named layout preset.
 *
 * Purely local: this is a per-browser UI preference, not tabletop state, so it
 * stays out of `sessions.gameState` and the event journal entirely (see the
 * durable game-state contract in CLAUDE.md). It carries no multiplayer
 * semantics and its pixel geometry is device-specific.
 */
export interface LayoutWorkspace {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /**
   * Viewport the preset was captured at. Positions are absolute pixels, so
   * restoring on a smaller screen relies on the drag hook's clamp, which is
   * lossy. Recorded now so a future version can rescale proportionally.
   */
  viewport: { width: number; height: number };
  /**
   * Panel layout the preset was captured in. Its pixel geometry only makes
   * sense at that density, so applying the preset also restores the layout.
   * Absent on v1 presets, which are Original.
   */
  panelLayout?: PanelLayout;
  activePanels: PanelId[];
  panelStack: PanelId[];
  /** Panels docked to an edge; everything else in the preset is floating. */
  dockedPanels: Record<string, DockZone>;
  geometry: Record<string, PanelGeometry>;
}

export interface WorkspaceFile {
  version: number;
  workspaces: LayoutWorkspace[];
  lastAppliedId: string | null;
}

export const EMPTY_WORKSPACE_FILE: WorkspaceFile = {
  version: WORKSPACE_SCHEMA_VERSION,
  workspaces: [],
  lastAppliedId: null,
};
