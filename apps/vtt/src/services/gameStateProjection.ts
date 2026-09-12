import type { Character } from '@/types/character';
import type { Scene } from '@/types/game';
import type { InitiativeState } from '@/types/initiative';
import { useCharacterStore } from '@/stores/characterStore';
import { buildInitiativeSnapshot, useGameStore } from '@/stores/gameStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import type { SyncableGameState } from '../../shared/sync/contracts';

let remoteApplicationDepth = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInitiativeState(value: unknown): value is InitiativeState {
  if (!isRecord(value)) return false;

  return (
    typeof value.isActive === 'boolean' &&
    typeof value.isPaused === 'boolean' &&
    typeof value.round === 'number' &&
    Array.isArray(value.entries) &&
    (typeof value.activeEntryId === 'string' || value.activeEntryId === null) &&
    Array.isArray(value.history) &&
    typeof value.autoAdvanceTurns === 'boolean' &&
    typeof value.showPlayerHP === 'boolean' &&
    typeof value.allowPlayerInitiative === 'boolean' &&
    typeof value.sortByInitiative === 'boolean'
  );
}

function deduplicateEntities(values: unknown[]): unknown[] {
  const seenIds = new Set<string>();
  return values.filter((value) => {
    if (!isRecord(value) || typeof value.id !== 'string') return true;
    if (seenIds.has(value.id)) return false;
    seenIds.add(value.id);
    return true;
  });
}

function normalizeScenes(scenes: unknown[]): Scene[] {
  return scenes.map((scene) => {
    if (!isRecord(scene)) return scene as unknown as Scene;

    return {
      ...scene,
      placedTokens: Array.isArray(scene.placedTokens)
        ? deduplicateEntities(scene.placedTokens)
        : [],
      placedProps: Array.isArray(scene.placedProps)
        ? deduplicateEntities(scene.placedProps)
        : [],
      drawings: Array.isArray(scene.drawings)
        ? deduplicateEntities(scene.drawings)
        : [],
    } as unknown as Scene;
  });
}

/**
 * Builds the one canonical, JSON-plain projection used by full snapshots and
 * JSON patches. Keeping this in one module prevents the sender and receiver
 * from silently drifting to different state shapes.
 */
export function buildGameStateProjection(): SyncableGameState {
  const sceneState = useGameStore.getState().sceneState;
  const projection = {
    scenes: sceneState.scenes,
    activeSceneId: sceneState.activeSceneId,
    characters: useCharacterStore.getState().characters,
    initiative: buildInitiativeSnapshot(),
  };

  return JSON.parse(JSON.stringify(projection)) as SyncableGameState;
}

/** True while a server snapshot or patch is being projected into local stores. */
export function isApplyingRemoteGameState(): boolean {
  return remoteApplicationDepth > 0;
}

/**
 * Projects an authoritative server state into every owning Zustand store.
 * Returns false for an incomplete/malformed payload instead of partially
 * applying it and leaving the client with a split-brain local state.
 */
export function applyGameStateProjection(value: unknown): boolean {
  if (!isRecord(value)) return false;

  const { scenes, activeSceneId, characters, initiative } = value;
  if (
    !Array.isArray(scenes) ||
    (typeof activeSceneId !== 'string' && activeSceneId !== null) ||
    !Array.isArray(characters) ||
    !isInitiativeState(initiative)
  ) {
    return false;
  }

  remoteApplicationDepth += 1;
  try {
    useGameStore.setState((state) => {
      // A real-time optimistic entity event may already exist locally when a
      // later canonical patch contains the same add. Normalize by stable id so
      // the authoritative projection cannot duplicate tokens/props/drawings.
      state.sceneState.scenes = normalizeScenes(scenes);
      state.sceneState.activeSceneId = activeSceneId;
    });
    useCharacterStore.setState({ characters: characters as Character[] });
    useInitiativeStore.setState({
      isActive: initiative.isActive,
      isPaused: initiative.isPaused,
      round: initiative.round,
      entries: initiative.entries,
      activeEntryId: initiative.activeEntryId,
      history: initiative.history,
      autoAdvanceTurns: initiative.autoAdvanceTurns,
      showPlayerHP: initiative.showPlayerHP,
      allowPlayerInitiative: initiative.allowPlayerInitiative,
      sortByInitiative: initiative.sortByInitiative,
    });
    return true;
  } finally {
    remoteApplicationDepth -= 1;
  }
}
