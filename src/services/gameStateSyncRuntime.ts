import { buildInitiativeSnapshot, useGameStore } from '@/stores/gameStore';
import { useCharacterStore } from '@/stores/characterStore';
import { webSocketService } from '@/services/websocket';
import {
  configureGameStateSyncRuntime,
  type LegacyGameStatePayload,
} from '@/services/gameStateSync';
import { isDevMode } from '@/utils/devMode';
import type {
  GameStateUpload,
  SyncableGameState,
} from '../../shared/sync/contracts';

function buildState(): SyncableGameState {
  const sceneState = useGameStore.getState().sceneState;
  const raw = {
    scenes: sceneState.scenes,
    activeSceneId: sceneState.activeSceneId,
    characters: useCharacterStore.getState().characters,
    initiative: buildInitiativeSnapshot(),
  };
  return JSON.parse(JSON.stringify(raw)) as SyncableGameState;
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
    buildState,
    transport: { sendUpload, sendLegacy },
    onResync: (reason) => {
      if (isDevMode()) {
        console.warn(
          `[delta-sync] resync (${reason}); re-baselining with a full snapshot`,
        );
      }
    },
  });
}
