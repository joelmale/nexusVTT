import React, { useEffect, useRef, useState } from 'react';
import { useGameStore, useSelectedPlacedToken, useActiveScene } from '@/stores/gameStore';
import { useCharacterStore } from '@/stores/characterStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import type { InitiativeEntry } from '@/types/initiative';
import { TextPanel } from './toolbar-panels/TextPanel';
import { OptionsPanel } from './toolbar-panels/OptionsPanel';
import { ConditionsPanel } from './toolbar-panels/ConditionsPanel';
import './TokenToolbar.css';

interface TokenToolbarProps {
  position: { x: number; y: number };
}

export const TokenToolbar: React.FC<TokenToolbarProps> = ({ position }) => {
  const [activeToolbarTool, setActiveToolbarTool] = useState<string | null>(null);
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

  const handleToolClick = (tool: string) => {
    setActiveToolbarTool(activeToolbarTool === tool ? null : tool);
  };

  const handleRemoveToken = () => {
    if (window.confirm('Are you sure you want to remove this token?')) {
      deleteToken(activeScene.id, selectedPlacedToken.id);
    }
  };

  const handleClosePanel = () => {
    setActiveToolbarTool(null);
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
          currentHP: character.hitPoints.current,
          maxHP: character.hitPoints.maximum,
          tempHP: character.hitPoints.temporary,
          armorClass: character.armorClass,
          initiative: character.initiative || 0,
          initiativeModifier: character.initiative || 0,
          dexterityModifier: character.abilities.dexterity.modifier,
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
    const { webSocketService } = await import('@/utils/websocket');
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

  const renderSubPanel = () => {
    switch (activeToolbarTool) {
      case 'text':
        return <TextPanel tokenId={selectedPlacedToken.id} onClose={handleClosePanel} />;
      case 'options':
        return <OptionsPanel tokenId={selectedPlacedToken.id} />;
      case 'conditions':
        return <ConditionsPanel tokenId={selectedPlacedToken.id} />;
      case 'players':
        // TODO: Refactor PlayerPanel to work with PlacedTokens
        return null;
      default:
        return null;
    }
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
          <button
            className={`token-toolbar-btn ${activeToolbarTool === 'text' ? 'active' : ''}`}
            onClick={() => handleToolClick('text')}
            title="Edit Label"
          >
            <span className="token-toolbar-icon">T</span>
          </button>

          <button
            className={`token-toolbar-btn ${activeToolbarTool === 'options' ? 'active' : ''}`}
            onClick={() => handleToolClick('options')}
            title="Token Options"
          >
            <span className="token-toolbar-icon">⚙️</span>
          </button>

          <button
            className={`token-toolbar-btn ${activeToolbarTool === 'conditions' ? 'active' : ''}`}
            onClick={() => handleToolClick('conditions')}
            title="Status Conditions"
          >
            <span className="token-toolbar-icon">❤️</span>
          </button>

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
            className={`token-toolbar-btn ${activeToolbarTool === 'players' ? 'active' : ''}`}
            onClick={() => handleToolClick('players')}
            title="Player Control"
          >
            <span className="token-toolbar-icon">👥</span>
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

      {/* Sub Panel */}
      {renderSubPanel()}
    </div>
  );
};
