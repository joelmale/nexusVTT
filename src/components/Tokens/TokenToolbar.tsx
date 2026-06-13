import React, { useEffect, useRef } from 'react';
import { useGameStore, useSelectedPlacedToken, useActiveScene } from '@/stores/gameStore';
import { useCharacterStore } from '@/stores/characterStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import type { InitiativeEntry } from '@/types/initiative';
import { TextPanel } from './toolbar-panels/TextPanel';
import { OptionsPanel } from './toolbar-panels/OptionsPanel';
import { ConditionsPanel } from './toolbar-panels/ConditionsPanel';
import { PopoverMenu } from '../PopoverMenu';
import './TokenToolbar.css';

interface TokenToolbarProps {
  position: { x: number; y: number };
}

export const TokenToolbar: React.FC<TokenToolbarProps> = ({ position }) => {
  const selectedPlacedToken = useSelectedPlacedToken();
  const activeScene = useActiveScene();
  const { updateToken, deleteToken, clearSelection } = useGameStore();

  const toolbarRef = useRef<HTMLDivElement>(null);

  // Debug logging
  useEffect(() => {
    console.log('🎨 TokenToolbar render:', {
      hasToken: !!selectedPlacedToken,
      tokenId: selectedPlacedToken?.id,
      hasScene: !!activeScene,
      position
    });
  }, [selectedPlacedToken, activeScene, position]);

  // Handle clicking outside to close toolbar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        toolbarRef.current &&
        !toolbarRef.current.contains(event.target as Node)
      ) {
        clearSelection();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [clearSelection]);

  if (!selectedPlacedToken || !activeScene) {
    return null;
  }

  const handleRemoveToken = () => {
    if (window.confirm('Are you sure you want to remove this token?')) {
      deleteToken(activeScene.id, selectedPlacedToken.id);
    }
  };

  const handleAddToCombat = async () => {
    const { user } = useGameStore.getState();
    const { getCharacter } = useCharacterStore.getState();
    const { addEntry } = useInitiativeStore.getState();
    const { tokenAssetManager } = await import('@/services/tokenAssets');

    if (!selectedPlacedToken) return;

    let entryName = 'Unknown Token';
    let entryData: Omit<InitiativeEntry, 'id'> = {
      name: entryName,
      currentHP: 10,
      maxHP: 10,
      tempHP: 0,
      armorClass: 10,
      initiative: 0,
      initiativeModifier: 0,
      dexterityModifier: 0,
      type: 'monster' as const,
      tokenId: selectedPlacedToken.id,
      conditions: [],
      isActive: false,
      isReady: false,
      isDelayed: false,
      notes: '',
      deathSaves: { successes: 0, failures: 0 },
    };

    // Check if token has character binding
    if (selectedPlacedToken.characterId) {
      // PC token: pull character stats
      const character = getCharacter(selectedPlacedToken.characterId);
      if (character) {
        entryName = character.name;
        entryData = {
          ...entryData,
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
          playerId: character.playerId,
        };
      }
    } else {
      // NPC/Monster: use token name and nameOverride
      const baseToken = tokenAssetManager.getTokenById(selectedPlacedToken.tokenId);
      entryName = selectedPlacedToken.nameOverride || baseToken?.name || 'Unknown Token';
      entryData = {
        ...entryData,
        name: entryName,
      };
    }

    // Add to local initiative
    addEntry(entryData);

    // Broadcast to peers
    const { webSocketService } = await import('@/services/websocket');
    webSocketService.sendEvent({
      type: 'event',
      data: {
        name: 'combat/add-entry',
        sourceClientId: user.id,
        tokenId: selectedPlacedToken.id,
        entry: entryData,
      },
    });

    console.log('⚔️ Added to combat:', entryName);
  };

  return (
    <div
      ref={toolbarRef}
      className="token-toolbar"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {/* Main Toolbar */}
      <div className="token-toolbar-main">
        {/* Primary Tools */}
        <div className="token-toolbar-primary">
          <PopoverMenu
            trigger={<span className="token-toolbar-icon">T</span>}
            triggerClassName="token-toolbar-btn"
            contentClassName="token-toolbar-popover"
          >
            <TextPanel tokenId={selectedPlacedToken.id} onClose={() => {}} />
          </PopoverMenu>

          <PopoverMenu
            trigger={<span className="token-toolbar-icon">⚙️</span>}
            triggerClassName="token-toolbar-btn"
            contentClassName="token-toolbar-popover"
          >
            <OptionsPanel tokenId={selectedPlacedToken.id} />
          </PopoverMenu>

          <PopoverMenu
            trigger={<span className="token-toolbar-icon">❤️</span>}
            triggerClassName="token-toolbar-btn"
            contentClassName="token-toolbar-popover"
          >
            <ConditionsPanel tokenId={selectedPlacedToken.id} />
          </PopoverMenu>

          <button
            className={`token-toolbar-btn ${selectedPlacedToken.isInInitiative ? 'active' : ''}`}
            onClick={() => updateToken(activeScene.id, selectedPlacedToken.id, {
              isInInitiative: !selectedPlacedToken.isInInitiative
            })}
            title="Toggle Initiative"
          >
            <span className="token-toolbar-icon">⏳</span>
          </button>

          <button
            className="token-toolbar-btn"
            onClick={handleAddToCombat}
            title="Add to Combat"
          >
            <span className="token-toolbar-icon">⚔️</span>
          </button>

          <button
            className={`token-toolbar-btn ${selectedPlacedToken.isDead ? 'active' : ''}`}
            onClick={() => updateToken(activeScene.id, selectedPlacedToken.id, {
              isDead: !selectedPlacedToken.isDead
            })}
            title="Toggle Dead"
          >
            <span className="token-toolbar-icon">💀</span>
          </button>
        </div>

        {/* Separator */}
        <div className="token-toolbar-separator" />

        {/* Secondary Tools */}
        <div className="token-toolbar-secondary">
          <button
            className={`token-toolbar-btn ${selectedPlacedToken.dmNotesOnly ? 'active' : ''}`}
            onClick={() => updateToken(activeScene.id, selectedPlacedToken.id, {
              dmNotesOnly: !selectedPlacedToken.dmNotesOnly
            })}
            title={selectedPlacedToken.dmNotesOnly ? 'Show to Players' : 'Hide from Players'}
          >
            <span className="token-toolbar-icon">
              {selectedPlacedToken.dmNotesOnly ? '🙈' : '👁️'}
            </span>
          </button>

          <button
            className="token-toolbar-btn danger"
            onClick={handleRemoveToken}
            title="Remove Token"
          >
            <span className="token-toolbar-icon">🗑️</span>
          </button>
        </div>
      </div>
    </div>
  );
};
