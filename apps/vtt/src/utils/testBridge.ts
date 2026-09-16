/**
 * Development-only bridge exposing the Zustand stores on `window`.
 *
 * Two purposes:
 *
 * 1. It completes a contract that already existed but was never wired up:
 *    `services/linearFlowStorage.ts` reads `window.__gameStore` and
 *    `vite-env.d.ts` declares it, but nothing ever assigned it, so that debug
 *    helper always took its "GameStore not available" fallback.
 *
 * 2. It gives the Playwright UI suite (`tests/ui`) a seam to put the app
 *    straight into a game view. Those tests are about panel layout, z-order,
 *    focus and docking - none of which need a backend - so driving the stores
 *    directly avoids standing up PostgreSQL, Redis and a WebSocket handshake
 *    to assert that a popover is not clipped.
 *
 * Gated on `import.meta.env.DEV`, which Vite folds to a literal in a
 * production build, so this module is eliminated rather than merely
 * unreachable. It is not a security boundary: in a dev build it exposes no
 * secrets and grants nothing a user could not already do from the console.
 */
import { useGameStore } from '@/stores/gameStore';
import { useUIStackStore } from '@/stores/uiStackStore';
import { useLayoutWorkspaceStore } from '@/stores/layoutWorkspaceStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import type { Scene, Session } from '@/types/game';

export interface TestSeed {
  /** Display name for the seeded user. Presence of a name satisfies ProtectedRoute. */
  userName?: string;
  userType?: 'host' | 'player';
  roomCode?: string;
  /** Panels to mark open before first render. */
  activePanels?: string[];
}

function buildScene(roomCode: string, userId: string): Scene {
  const now = Date.now();
  return {
    id: 'test-scene',
    name: 'Test Scene',
    description: 'Seeded by the UI test bridge.',
    roomCode,
    visibility: 'public',
    isEditable: true,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    gridSettings: {
      enabled: true,
      size: 50,
      color: '#ffffff',
      opacity: 0.3,
      snapToGrid: true,
      showToPlayers: true,
    },
    placedTokens: [],
    placedProps: [],
    drawings: [],
  } as unknown as Scene;
}

function buildSession(roomCode: string, userId: string): Session {
  return {
    roomCode,
    hostId: userId,
    players: [],
    status: 'connected',
    dmConnected: true,
  };
}

/**
 * Put the store into a state that renders the game view, without any network.
 *
 * `ProtectedRoute` only requires `user.name` and a non-null `session`; seeding
 * both before React first renders means no session-recovery round trip and no
 * redirect back to the lobby.
 */
export function applyTestSeed(seed: TestSeed = {}): void {
  const userName = seed.userName ?? 'UI Test DM';
  const userType = seed.userType ?? 'host';
  const roomCode = seed.roomCode ?? 'TEST';

  const userId = useGameStore.getState().user.id || 'ui-test-user';

  useGameStore.setState((state) => ({
    ...state,
    user: {
      ...state.user,
      id: userId,
      name: userName,
      type: userType,
      connected: false,
    },
    session: buildSession(roomCode, userId),
    sceneState: {
      ...state.sceneState,
      scenes: [buildScene(roomCode, userId)],
      activeSceneId: 'test-scene',
      camera: { x: 0, y: 0, zoom: 1 },
      followDM: false,
      activeTool: 'select',
      selectedObjectIds: [],
    },
  }));

  if (seed.activePanels) {
    useUIStackStore.setState({ activePanels: [...seed.activePanels] });
  }
}

/**
 * Install the bridge. Call once, before `ReactDOM.createRoot(...).render()`,
 * so a seed supplied via `page.addInitScript` is applied before the first
 * render and `ProtectedRoute` never sees a missing session.
 */
export function installTestBridge(): void {
  // `import.meta.env.DEV` directly, not the isDevMode() helper: Vite replaces
  // this with a literal `false` in a production build, so Rollup eliminates the
  // whole body and the bridge never reaches the bundle. Behind a function call
  // the code survives minification as unreachable-but-present, and a build with
  // VITE_DEV_MODE=true would arm session seeding in production. devMode.ts
  // states it does not gate security-sensitive behaviour; this keeps that true.
  if (!import.meta.env.DEV) return;
  if (typeof window === 'undefined') return;

  const w = window as unknown as Record<string, unknown>;
  w.__gameStore = useGameStore;
  w.__uiStackStore = useUIStackStore;
  w.__layoutWorkspaceStore = useLayoutWorkspaceStore;
  w.__initiativeStore = useInitiativeStore;
  w.__applyTestSeed = applyTestSeed;

  const seed = w.__TEST_SEED__ as TestSeed | undefined;
  if (seed) applyTestSeed(seed);
}
