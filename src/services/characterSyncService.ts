import { useInitiativeStore } from '@/stores/initiativeStore';
import { useCharacterStore } from '@/stores/characterStore';
import { useGameStore } from '@/stores/gameStore';
import { orderedEventClient } from '@/services/orderedEventClient';
import { isFlagEnabled } from '@/utils/featureFlags';

type SyncSource = 'character' | 'token' | 'initiative';

interface StatUpdate {
  sourceClientId?: string;
  characterId?: string;
  tokenId?: string;
  initiativeEntryId?: string;
  stats: {
    currentHP?: number;
    tempHP?: number;
    maxHP?: number;
    armorClass?: number;
  };
}

class CharacterSyncService {
  syncStats(_source: SyncSource, _update: StatUpdate): void {
    // Left as a hook for local changes syncing out to the network
  }

  handleRemoteSync(update: StatUpdate): void {
    // Prevent re-entrancy / echo loop
    if (update.sourceClientId && update.sourceClientId === orderedEventClient.clientId) {
      return;
    }

    // 1. Update the initiative store
    const initiativeState = useInitiativeStore.getState();
    const entry = initiativeState.entries.find(
      (e) =>
        e.id === update.initiativeEntryId ||
        (update.characterId && e.characterId === update.characterId) ||
        (update.tokenId && e.tokenId === update.tokenId)
    );

    if (entry) {
      if (update.stats.currentHP !== undefined) {
        initiativeState.setHP(entry.id, update.stats.currentHP);
      }
      if (update.stats.tempHP !== undefined) {
        initiativeState.addTempHP(entry.id, update.stats.tempHP - entry.tempHP);
      }
      if (update.stats.maxHP !== undefined && isFlagEnabled('max-hp-sync')) {
        initiativeState.setMaxHP(entry.id, update.stats.maxHP);
      }
    }

    // 2. Update the character store if characterId is provided
    if (update.characterId) {
      const characterStore = useCharacterStore.getState();
      const character = characterStore.characters.find(c => c.id === update.characterId);
      if (character) {
        if (update.stats.currentHP !== undefined) {
          characterStore.updateCharacter(update.characterId, { hitPoints: update.stats.currentHP });
        }
      }
    }

    // 3. Sync token HP if user preferences allow and it's a player-character owned by this client
    const gameStore = useGameStore.getState();
    const { settings, user, sceneState } = gameStore;
    const { activeSceneId, scenes } = sceneState;
    
    // Check hpSync preference (default true)
    if (settings.hpSync !== false) {
      // Is it a player-character?
      if (entry?.type === 'player' || update.characterId) {
        // Is it owned by this client? (i.e. playerId matches our user id)
        const isOwned = entry?.playerId === user?.id || 
                        useCharacterStore.getState().characters.find((c) => c.id === update.characterId)?.playerId === user?.id;
                        
        if (isOwned && activeSceneId) {
          const scene = scenes.find((s: { id: string; placedTokens: unknown[] }) => s.id === activeSceneId);
          if (scene) {
            // Find token
            const token = scene.placedTokens.find((t: { id: string; characterId?: string }) => t.id === update.tokenId || (update.characterId && t.characterId === update.characterId));
            if (token) {
              // Dispatch token update
              const tokenUpdates = { ...token };
              let changed = false;
              if (update.stats.currentHP !== undefined && tokenUpdates.currentStats?.hp !== update.stats.currentHP) {
                tokenUpdates.currentStats = { ...tokenUpdates.currentStats, hp: update.stats.currentHP };
                changed = true;
              }
              if (changed) {
                gameStore.updateToken(activeSceneId, tokenUpdates.id, tokenUpdates);
              }
            }
          }
        }
      }
    }
  }
}

export const characterSyncService = new CharacterSyncService();
