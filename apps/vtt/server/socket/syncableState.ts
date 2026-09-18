import type {
  JsonValue,
  SyncableGameState,
} from '../../shared/sync/contracts.js';
import { createEmptySyncableGameState } from '../../shared/sync/contracts.js';

/**
 * Builds a SyncableGameState from a legacy untagged snapshot (the current
 * client format), tolerating missing fields. Trusted fallback: no token was
 * supplied, so no integrity check is possible.
 */
export function buildSyncableFromLegacy(data: unknown): SyncableGameState {
  const d = (data ?? {}) as Partial<{
    scenes: JsonValue[];
    activeSceneId: string | null;
    characters: JsonValue[];
    initiative: JsonValue;
  }>;
  const defaultInitiative = createEmptySyncableGameState().initiative as Record<
    string,
    JsonValue
  >;
  const legacyInitiative =
    typeof d.initiative === 'object' &&
    d.initiative !== null &&
    !Array.isArray(d.initiative)
      ? (d.initiative as Record<string, JsonValue>)
      : {};
  return {
    scenes: Array.isArray(d.scenes) ? d.scenes : [],
    activeSceneId: d.activeSceneId ?? null,
    characters: Array.isArray(d.characters) ? d.characters : [],
    initiative: { ...defaultInitiative, ...legacyInitiative },
  };
}
