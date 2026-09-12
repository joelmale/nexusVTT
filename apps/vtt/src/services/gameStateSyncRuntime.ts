import { useCharacterStore } from '@/stores/characterStore';
import { useGameStore } from '@/stores/gameStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { webSocketService } from '@/services/websocket';
import {
  configureGameStateSyncRuntime,
  gameStateSyncEngine,
  type LegacyGameStatePayload,
} from '@/services/gameStateSync';
import {
  buildGameStateProjection,
  isApplyingRemoteGameState,
} from '@/services/gameStateProjection';
import { isDevMode } from '@/utils/devMode';
import type { GameStateUpload } from '../../shared/sync/contracts';

let storeSubscriptionsInitialized = false;

function canPublishGameState(): boolean {
  const { session, user } = useGameStore.getState();
  return session !== null && user.type === 'host';
}

function initializeStoreSubscriptions(): void {
  if (storeSubscriptionsInitialized) return;
  storeSubscriptionsInitialized = true;

  useInitiativeStore.subscribe((state, previousState) => {
    const initiativeChanged =
      state.isActive !== previousState.isActive ||
      state.isPaused !== previousState.isPaused ||
      state.round !== previousState.round ||
      state.entries !== previousState.entries ||
      state.activeEntryId !== previousState.activeEntryId ||
      state.history !== previousState.history ||
      state.autoAdvanceTurns !== previousState.autoAdvanceTurns ||
      state.showPlayerHP !== previousState.showPlayerHP ||
      state.allowPlayerInitiative !== previousState.allowPlayerInitiative ||
      state.sortByInitiative !== previousState.sortByInitiative;

    if (
      initiativeChanged &&
      !isApplyingRemoteGameState() &&
      canPublishGameState()
    ) {
      gameStateSyncEngine.schedule();
    }
  });

  useCharacterStore.subscribe((state, previousState) => {
    if (
      state.characters !== previousState.characters &&
      !isApplyingRemoteGameState() &&
      canPublishGameState()
    ) {
      gameStateSyncEngine.schedule();
    }
  });
}

function sendUpload(upload: GameStateUpload): void {
  webSocketService.sendEvent({
    type: 'game-state-update',
    data: { upload },
  });
}

function sendLegacy(payload: LegacyGameStatePayload): void {
  webSocketService.sendGameStateUpdate({
    sceneState: {
      scenes: payload.scenes as unknown[],
      activeSceneId: payload.activeSceneId,
    },
    characters: payload.characters as unknown[],
    initiative: payload.initiative,
  });
}

export function initializeGameStateSyncRuntime(): void {
  configureGameStateSyncRuntime({
    buildState: buildGameStateProjection,
    transport: { sendUpload, sendLegacy },
    onResync: (reason) => {
      if (isDevMode()) {
        console.warn(
          `[delta-sync] resync (${reason}); re-baselining with a full snapshot`,
        );
      }
    },
  });
  initializeStoreSubscriptions();
}
