import React, { useState } from 'react';
import type { Character } from '@/types/character';
import type { PlacedToken } from '@/types/token';
import type { InitiativeEntry } from '@/types/initiative';
import { useGameStore } from '@/stores/gameStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { CharacterSheetPopup } from './CharacterSheetPopup';

interface CharacterCardProps {
  character: Character;
  token?: PlacedToken;
  initiativeEntry?: InitiativeEntry;
}

export const CharacterCard: React.FC<CharacterCardProps> = ({
  character,
  token,
  initiativeEntry,
}) => {
  const { updateCamera, sceneState } = useGameStore();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Calculate HP percentage for color coding
  const maxHP = character.maxHitPoints ?? character.hitPoints ?? 1;
  const hpPercent = (character.hitPoints / maxHP) * 100;
  const hpBarColor =
    hpPercent > 50 ? '#10b981' : hpPercent > 25 ? '#f59e0b' : '#ef4444';

  // Get class initial for portrait
  const classInitial = character.class?.charAt(0).toUpperCase() || '?';

  const handleFocusToken = () => {
    if (!token) return;

    // Find the scene containing this token
    const scene = sceneState.scenes.find((s) =>
      s.placedTokens?.some((t) => t.id === token.id),
    );

    if (scene) {
      // Pan camera to token
      updateCamera({
        x: token.x,
        y: token.y,
      });
    }
  };

  const handleAddToCombat = async () => {
    const { user } = useGameStore.getState();
    const { addEntry } = useInitiativeStore.getState();

    // Create stat snapshot
    const entry = {
      name: character.name,
      currentHP: character.hitPoints,
      maxHP: character.maxHitPoints ?? character.hitPoints,
      tempHP: character.temporaryHitPoints || 0,
      armorClass: character.armorClass ?? 10,
      initiative: character.initiative || 0,
      initiativeModifier: character.initiative || 0,
      dexterityModifier: character.abilities.DEX.modifier,
      type: 'player' as const,
      characterId: character.id,
      tokenId: token?.id,
      playerId: character.playerId,
      conditions: [],
      isActive: false,
      isReady: false,
      isDelayed: false,
      notes: '',
      deathSaves: { successes: 0, failures: 0 },
    };

    // Add to local initiative
    addEntry(entry);

    // Broadcast stat snapshot to peers
    const { webSocketService } = await import('@/services/websocket');
    webSocketService.sendEvent({
      type: 'event',
      data: {
        name: 'combat/add-character',
        sourceClientId: user.id,
        characterId: character.id,
        tokenId: token?.id,
        entry: {
          name: entry.name,
          currentHP: entry.currentHP,
          maxHP: entry.maxHP,
          tempHP: entry.tempHP,
          armorClass: entry.armorClass,
          initiative: entry.initiative,
          initiativeModifier: entry.initiativeModifier,
          dexterityModifier: entry.dexterityModifier,
          type: entry.type,
        },
      },
    });

    console.log('⚔️ Added character to combat:', character.name);
  };

  const handleViewSheet = () => {
    setIsSheetOpen(true);
  };

  return (
    <div className="character-card">
      {/* Portrait */}
      <div className="character-portrait">
        <div className="portrait-circle">{classInitial}</div>
      </div>

      {/* Info */}
      <div className="character-info">
        <div className="character-header">
          <h3 className="character-name">{character.name}</h3>
          <div className="character-badges">
            {token && (
              <span className="badge badge-token" title="Has token on scene">
                🎭
              </span>
            )}
            {initiativeEntry && (
              <span className="badge badge-combat" title="In combat">
                ⚔️
              </span>
            )}
          </div>
        </div>

        <div className="character-details">
          <span className="character-class">
            {character.class || 'Adventurer'} {character.level}
          </span>
        </div>

        {/* HP Bar */}
        <div className="hp-bar-container">
          <div className="hp-labels">
            <span className="hp-current">
              {character.hitPoints}
              {(character.temporaryHitPoints || 0) > 0 && (
                <span className="hp-temp">
                  {' '}
                  +{character.temporaryHitPoints}
                </span>
              )}
            </span>
            <span className="hp-max">
              / {character.maxHitPoints ?? character.hitPoints}
            </span>
          </div>
          <div className="hp-bar">
            <div
              className="hp-bar-fill"
              style={{
                width: `${Math.min(100, hpPercent)}%`,
                backgroundColor: hpBarColor,
              }}
            />
          </div>
        </div>

        {/* AC Display */}
        <div className="character-stats">
          <div className="stat-item">
            <span className="stat-label">AC</span>
            <span className="stat-value">{character.armorClass}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="character-actions">
        <button
          className="action-btn"
          onClick={handleViewSheet}
          title="View Character Sheet"
        >
          📋
        </button>
        {token && (
          <button
            className="action-btn"
            onClick={handleFocusToken}
            title="Focus on Token"
          >
            🎯
          </button>
        )}
        {!initiativeEntry && (
          <button
            className="action-btn"
            onClick={handleAddToCombat}
            title="Add to Combat"
          >
            ➕
          </button>
        )}
      </div>

      {/* Character Sheet Modal */}
      <CharacterSheetPopup
        character={character}
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
      />
    </div>
  );
};
