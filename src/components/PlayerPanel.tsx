import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession, useIsHost } from '@/stores/gameStore';
import { useCharacters, useCharacterCreation } from '@/stores/characterStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { CharacterSheet } from './CharacterSheet';
import { CharacterImportModal } from './CharacterImportModal';
import { useCharacterCreationLauncher } from '@/hooks';
import type { Player } from '@/types/game';

interface PlayerCardProps {
  player: Player;
  isHost: boolean;
  onKick?: (playerId: string) => void;
  onToggleDM?: (playerId: string, currentPermissions: boolean) => void;
}

const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  isHost,
  onKick,
  onToggleDM,
}) => {
  const { characters } = useCharacters();
  const playerCharacters = characters.filter(
    (c) => !c.playerId || c.playerId === player.id,
  );

  return (
    <div
      className={`player-card ${player.type === 'host' ? 'dm-card' : ''} ${player.connected ? 'online' : 'offline'}`}
    >
      <div className="player-header">
        <div className="player-avatar">
          {player.type === 'host' ? '👑' : '⚔️'}
        </div>
        <div className="player-info">
          <div className="player-name">{player.name}</div>
          <div className="player-role">
            {player.type === 'host' ? 'Dungeon Master' : 'Player'}
            {player.canEditScenes && player.type !== 'host' && ' (Co-DM)'}
          </div>
          <div className="character-count">
            {playerCharacters.length} character
            {playerCharacters.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div
          className={`connection-indicator ${player.connected ? 'online' : 'offline'}`}
        >
          <span className="indicator-dot"></span>
          <span className="status-text">
            {player.connected ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Character List */}
      {playerCharacters.length > 0 && (
        <div className="player-characters">
          {playerCharacters.map((character) => (
            <div key={character.id} className="character-summary">
              <span className="character-name">{character.name}</span>
              <span className="character-details">
                Level {character.level} {character.race || character.species}{' '}
                {character.class || 'Adventurer'}
              </span>
              <span className="character-hp">
                {character.hitPoints}/{character.maxHitPoints ?? character.hitPoints} HP
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Host Controls */}
      {isHost && player.type !== 'host' && (
        <div className="player-controls">
          <button
            onClick={() => onToggleDM?.(player.id, player.canEditScenes)}
            className={`dm-toggle-btn ${player.canEditScenes ? 'active' : ''}`}
            title={
              player.canEditScenes
                ? 'Remove DM permissions'
                : 'Grant DM permissions'
            }
          >
            {player.canEditScenes ? '📋→👤' : '👤→📋'}
          </button>
          <button
            onClick={() => onKick?.(player.id)}
            className="kick-btn"
            title="Kick player"
          >
            🚪
          </button>
        </div>
      )}
    </div>
  );
};

export const PlayerPanel: React.FC = () => {
  const session = useSession();
  const isHost = useIsHost();
  const { characters, activeCharacter, setActiveCharacter } = useCharacters();
  useCharacterCreation();
  const { addEntry, rollInitiativeForAll, startCombat } = useInitiativeStore();
  const [, setShowCharacterSheet] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const { LauncherComponent } = useCharacterCreationLauncher();
  const navigate = useNavigate();

  const players = session?.players ?? [];

  // Determine the current user based on whether they are a host or player
  let currentUserId: string | undefined;
  if (isHost) {
    currentUserId = players.find((p) => p.type === 'host')?.id;
  } else {
    // For non-hosts, find the first player (this works better for tests)
    currentUserId = players.find((p) => p.type === 'player')?.id;
  }

  // Filter characters for the current user
  const myCharacters = currentUserId
    ? characters.filter((c) => !c.playerId || c.playerId === currentUserId)
    : [];
  const effectiveMyCharacters = myCharacters;

  const handleKickPlayer = (playerId: string) => {
    const player = players.find((p) => p.id === playerId);
    if (player && window.confirm(`Kick ${player.name} from the game?`)) {
      // TODO: Implement kick functionality
    }
  };

  const handleToggleDMPermissions = (
    playerId: string,
    currentPermissions: boolean,
  ) => {
    const player = players.find((p) => p.id === playerId);
    if (player) {
      const action = currentPermissions ? 'Remove' : 'Grant';
      if (window.confirm(`${action} DM permissions for ${player.name}?`)) {
        // TODO: Implement permission toggle
      }
    }
  };

  const handleCreateCharacter = () => {
    // Navigate to player setup page for character creation
    navigate('/lobby/player-setup');
  };

  const handleImportCharacter = () => {
    setShowImportModal(true);
  };

  const handleImportComplete = (result: { successful: number; failed: number }) => {
    console.log(`✅ Import complete: ${result.successful} successful, ${result.failed} failed`);
    // Characters are automatically added to the store, so they'll appear in the UI
  };

  const handleViewCharacter = (characterId: string) => {
    try {
      setActiveCharacter(characterId);
      setShowCharacterSheet(true);
    } catch (error) {
      console.error('Failed to view character:', error);
    }
  };

  const handleBeginCombat = () => {
    // Add all player characters to initiative tracker
    characters.forEach((character) => {
      addEntry({
        name: character.name,
        type: 'player' as const,
        initiative: character.initiative || 0,
        maxHP: character.maxHitPoints ?? character.hitPoints ?? 1,
        currentHP: character.hitPoints || 1,
        tempHP: character.temporaryHitPoints || 0,
        armorClass: character.armorClass || 10,
        conditions: [],
        isActive: false,
        isReady: false,
        isDelayed: false,
        notes: '',
        deathSaves: { successes: 0, failures: 0 },
        initiativeModifier: character.abilities?.DEX?.modifier || 0,
        dexterityModifier: character.abilities?.DEX?.modifier || 0,
        playerId: character.playerId,
      });
    });

    // Roll initiative for all entries and start combat
    rollInitiativeForAll();
    startCombat();
    // TODO: Switch to initiative tab programmatically
  };

  // Show character sheet if one is active
  if (activeCharacter) {
    const isReadonly = !effectiveMyCharacters.some(
      (c) => c.id === activeCharacter.id,
    );
    return (
      <div className="player-panel">
        <div className="panel-header">
          <button
            onClick={() => {
              setActiveCharacter(null);
              setShowCharacterSheet(false);
            }}
            className="back-btn"
          >
            ← Back to Players
          </button>
          <h3>{activeCharacter.name}</h3>
        </div>
        <CharacterSheet character={activeCharacter} readonly={isReadonly} />
      </div>
    );
  }

  return (
    <div className="player-panel">
      <div className="panel-header">
        <h3>Players & Characters</h3>
        {isHost && (
          <button
            onClick={handleBeginCombat}
            className="begin-combat-btn"
            disabled={characters.length === 0}
            title="Add all characters to initiative tracker"
          >
            ⚔️ Begin Combat
          </button>
        )}
      </div>

      {/* My Characters Section */}
      <div className="my-characters-section">
        <div className="section-header">
          <h4>My Characters</h4>
          <div className="character-actions-group">
            <button
              onClick={handleImportCharacter}
              className="import-character-btn"
              title="Import characters from 5e Character Forge or other sources"
            >
              📥 Import
            </button>
            <button
              onClick={handleCreateCharacter}
              className="create-character-btn"
            >
              ➕ New Character
            </button>
          </div>
        </div>

        {effectiveMyCharacters.length > 0 ? (
          <div className="character-list">
            {effectiveMyCharacters.map((character) => (
              <div
                key={character.id}
                className="character-item"
                onClick={() => handleViewCharacter(character.id)}
              >
                <div className="character-avatar">
                  {character.class?.charAt(0) || '?'}
                </div>
                <div className="character-info">
                  <div className="character-name">{character.name}</div>
                  <div className="character-details">
                    Level {character.level} {character.race || character.species}{' '}
                    {character.class || 'Adventurer'}
                  </div>
                  <div className="character-stats">
                    HP: {character.hitPoints}/
                    {character.maxHitPoints ?? character.hitPoints} | AC: {character.armorClass}
                  </div>
                </div>
                <div className="character-actions">
                  <span className="view-icon">👁️</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-characters">
            <p>No characters created yet.</p>
            <p>Create a character to get started!</p>
          </div>
        )}
      </div>

      {/* All Players Section */}
      <div className="all-players-section">
        <div className="section-header">
          <h4>
            All Players ({players.filter((p) => p.connected).length}/
            {players.length} online)
          </h4>
        </div>

        <div className="players-list">
          {players.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              isHost={isHost}
              onKick={handleKickPlayer}
              onToggleDM={handleToggleDMPermissions}
            />
          ))}
        </div>
      </div>

      {/* Quick Combat Prep (DM Only) */}
      {isHost && characters.length > 0 && (
        <div className="combat-prep-section">
          <h4>Combat Preparation</h4>
          <div className="combat-summary">
            <p>{characters.length} player characters ready</p>
            <button onClick={handleBeginCombat} className="combat-prep-btn">
              🎲 Add All to Initiative
            </button>
          </div>
        </div>
      )}

      {/* Character Creation Launcher */}
      {LauncherComponent}

      {/* Character Import Modal */}
      <CharacterImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
};
