/**
 * WebSocket Payload Interfaces for VTT collaboration.
 * These types govern the real-time synchronization between the VTT clients and the doc-websocket server.
 */

/**
 * Payload broadcasted when a client scrolls a document page
 */
export interface ScrollOffsetPayload {
  /** The unique ID of the active collaborative viewing session */
  sessionId: string;
  /** Vertical scroll ratio or absolute offset position in the viewport */
  position: number;
}

/**
 * Payload broadcasted when a client changes the active page of a document
 */
export interface PageTurnPayload {
  /** The unique ID of the active collaborative viewing session */
  sessionId: string;
  /** The 1-based page number to navigate to */
  page: number;
}

/**
 * Payload used to update session synchronization settings
 */
export interface SyncLockPayload {
  /** The unique ID of the active collaborative viewing session */
  sessionId: string;
  /** Configuration settings determining which states are locked or synced */
  syncSettings: {
    /** Lock and sync scroll position across clients */
    syncScroll: boolean;
    /** Lock and sync page turns across clients */
    syncPage: boolean;
    /** Lock and sync text selections/highlights across clients */
    syncHighlight: boolean;
  };
}

/**
 * Generic WebSocket message envelope format
 */
export interface WSMessage<T = unknown> {
  type: string;
  data: T;
}
